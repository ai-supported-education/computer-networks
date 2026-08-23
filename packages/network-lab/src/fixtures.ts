import { randomUUID } from "node:crypto";
import {
  appendFile,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import {
  DOCKER_ID_PATTERN,
  KNOWN_FIXTURE_SHA256,
  LAB_ENDPOINTS,
  LAB_IMAGE,
  LAB_LABEL_KEY,
  LAB_OWNER_LABEL,
  LAB_ROLE_LABEL_KEY,
  LAB_RUN_LABEL_KEY
} from "./constants.js";
import { runCommand, tryCommand } from "./command.js";
import {
  isNoSuchDockerObject,
  isLocalUnixDockerEndpoint,
  requireLocalDockerEndpoint,
  requireMatchingDockerEndpoint,
  isSafeDockerDaemonId,
  type DockerEndpointInventory
} from "./docker-safety.js";
import {
  buildArpFrame,
  buildIcmpEchoFrame,
  createClassicPcap,
  sha256,
  type PcapRecord
} from "./pcap.js";
import { waitForCleanupQuiescence } from "./reconciliation.js";

export interface FixtureDefinition {
  id: string;
  directory: string;
  pcapRelativePath: string;
  artifacts: ReadonlyMap<string, Buffer>;
  companionRelativePaths: readonly string[];
}

const alpha = LAB_ENDPOINTS.alpha;
const beta = LAB_ENDPOINTS.beta;
const broadcast = "ff:ff:ff:ff:ff:ff";
const zeroMac = "00:00:00:00:00:00";
const FIXTURE_CLEANUP_QUIET_PERIOD_MS = 3_000;
const FIXTURE_CLEANUP_TIMEOUT_MS = 15_000;
const FIXTURE_CLEANUP_POLL_INTERVAL_MS = 250;

export function buildFixtureDefinitions(): readonly FixtureDefinition[] {
  const known = knownNeighbourFixture();
  const interfaceNotReady = diagnosticFixture("interface-not-ready", [], {
    baseline:
      "capture_point=alpha:eth0\neth0 state DOWN\nipv4=not-observed\nneighbor_172.30.0.20=not-observed\n",
    events:
      "frame\telapsed_ms\tprotocol\tobservation\n" +
      "-\t-\t-\tno relevant frame observed in the bounded window\n",
    action:
      "requested_at=2024-01-01T00:10:00.000Z\n" +
      "action=one IPv4 ICMP Echo probe requested\n" +
      "source=172.30.0.10\ntarget=172.30.0.20\n" +
      "capture_point=alpha:eth0\nwindow_ms=2000\nframe_limit=8\n"
  });

  const arpRequest = buildArpFrame({
    operation: 1,
    ethernetSource: alpha.mac,
    ethernetDestination: broadcast,
    senderMac: alpha.mac,
    senderIpv4: alpha.ipv4,
    targetMac: zeroMac,
    targetIpv4: beta.ipv4
  });
  const arpReply = buildArpFrame({
    operation: 2,
    ethernetSource: beta.mac,
    ethernetDestination: alpha.mac,
    senderMac: beta.mac,
    senderIpv4: beta.ipv4,
    targetMac: alpha.mac,
    targetIpv4: alpha.ipv4
  });
  const diagnosticRequest = buildIcmpEchoFrame({
    ethernetSource: alpha.mac,
    ethernetDestination: beta.mac,
    ipv4Source: alpha.ipv4,
    ipv4Destination: beta.ipv4,
    type: 8,
    identifier: 0x5105,
    sequence: 1,
    ipIdentifier: 0x5100,
    payload: Buffer.from(
      "diagnostic-icmp-no-reply".padEnd(32, "."),
      "ascii"
    )
  });

  const arpNoReply = diagnosticFixture(
    "arp-no-reply",
    [
      { seconds: 1_704_067_200, microseconds: 0, frame: arpRequest },
      { seconds: 1_704_067_200, microseconds: 500_000, frame: arpRequest },
      { seconds: 1_704_067_201, microseconds: 0, frame: arpRequest }
    ],
    {
      baseline:
        `capture_point=alpha:eth0\neth0 state UP LOWER_UP\nmac=${alpha.mac}\nipv4=${alpha.ipv4}\nneighbor_172.30.0.20=absent\n`,
      events:
        "frame\telapsed_ms\tprotocol\tobservation\n" +
        `1\t0\tARP\trequest who-has ${beta.ipv4} tell ${alpha.ipv4}\n` +
        `2\t500\tARP\trequest who-has ${beta.ipv4} tell ${alpha.ipv4}\n` +
        `3\t1000\tARP\trequest who-has ${beta.ipv4} tell ${alpha.ipv4}\n`,
      action:
        "requested_at=2024-01-01T00:00:00.000Z\n" +
        "action=one IPv4 ICMP Echo probe requested\n" +
        `source=${alpha.ipv4}\ntarget=${beta.ipv4}\n` +
        "capture_point=alpha:eth0\nwindow_ms=2000\nframe_limit=8\n"
    }
  );

  const icmpNoReply = diagnosticFixture(
    "icmp-no-reply",
    [
      { seconds: 1_704_067_800, microseconds: 0, frame: arpRequest },
      { seconds: 1_704_067_800, microseconds: 300, frame: arpReply },
      {
        seconds: 1_704_067_800,
        microseconds: 900,
        frame: diagnosticRequest
      }
    ],
    {
      baseline:
        `capture_point=alpha:eth0\neth0 state UP LOWER_UP\nmac=${alpha.mac}\nipv4=${alpha.ipv4}\nneighbor_172.30.0.20=absent\n`,
      events:
        "frame\telapsed_ms\tprotocol\tobservation\n" +
        `1\t0.0\tARP\trequest who-has ${beta.ipv4} tell ${alpha.ipv4}\n` +
        `2\t0.3\tARP\treply ${beta.ipv4} is-at ${beta.mac}\n` +
        `3\t0.9\tICMP\tEcho Request ${alpha.ipv4} -> ${beta.ipv4} id=20741 seq=1\n`,
      action:
        "requested_at=2024-01-01T00:10:00.000Z\n" +
        "action=one IPv4 ICMP Echo probe requested\n" +
        `source=${alpha.ipv4}\ntarget=${beta.ipv4}\n` +
        "capture_point=alpha:eth0\nwindow_ms=2000\nframe_limit=8\n"
    }
  );

  return [
    known,
    interfaceNotReady,
    arpNoReply,
    icmpNoReply,
    novelLocalExchangeFixture()
  ];
}

export async function generateFixtures(root: string): Promise<string[]> {
  const written: string[] = [];
  for (const fixture of buildFixtureDefinitions()) {
    for (const [relativePath, expected] of fixture.artifacts) {
      const target = path.join(root, relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      try {
        const handle = await open(target, "wx");
        try {
          await handle.writeFile(expected);
        } finally {
          await handle.close();
        }
        written.push(relativePath);
      } catch (error) {
        if (!isAlreadyExists(error)) throw error;
        const actual = await readFile(target);
        if (!actual.equals(expected)) {
          throw new Error(
            `Отказ от перезаписи отличающегося fixture: ${relativePath}`
          );
        }
      }
    }
  }
  return written;
}

export async function verifyFixtures(
  root: string,
  target?: string
): Promise<string[]> {
  const selected = await selectFixtures(root, target);
  const verified: string[] = [];
  for (const fixture of selected) {
    for (const [relativePath, expected] of fixture.artifacts) {
      const absolute = path.join(root, relativePath);
      const metadata = await lstat(absolute).catch(() => null);
      if (!metadata || !metadata.isFile() || metadata.isSymbolicLink()) {
        throw new Error(
          `Fixture artifact должен быть regular non-symlink file: ${relativePath}`
        );
      }
      const actual = await readFile(absolute);
      if (!actual.equals(expected)) {
        throw new Error(`Fixture mismatch: ${relativePath}`);
      }
    }
    const pcap = fixture.artifacts.get(fixture.pcapRelativePath);
    if (!pcap) throw new Error(`Нет pcap для fixture ${fixture.id}`);
    verified.push(`${fixture.pcapRelativePath} sha256=${sha256(pcap)}`);
  }
  return verified;
}

export async function preflightFixtureInspector(
  knownEndpoint?: DockerEndpointInventory
): Promise<string> {
  const endpoint = knownEndpoint
    ? await requireMatchingDockerEndpoint(knownEndpoint)
    : await requireLocalDockerEndpoint();
  const version = await runCommand(
    "docker",
    ["version", "--format", "{{json .Server}}"],
    { timeoutMs: 10_000 }
  );
  const server = JSON.parse(version.stdout) as {
    Version?: string;
    Os?: string;
    Arch?: string;
  };
  if (
    !server.Version ||
    server.Os !== "linux" ||
    !server.Arch ||
    !["amd64", "arm64"].includes(server.Arch)
  ) {
    throw new Error(
      `Offline inspector требует Docker Linux amd64/arm64; observed ${server.Os ?? "unknown"}/${server.Arch ?? "unknown"}.`
    );
  }
  const image = await tryCommand(
    "docker",
    ["image", "inspect", LAB_IMAGE, "--format", "{{.Id}}"],
    { timeoutMs: 10_000 }
  );
  if (image.exitCode !== 0) {
    if (isNoSuchDockerObject(image, "image")) {
      throw new Error(
        "Pinned image не загружен. Выполните pnpm network:fixture preload, затем повторите preflight."
      );
    }
    throw new Error(
      `Pinned image нельзя безопасно проверить: ${image.stderr || image.stdout || "Docker не вернул причину"}`
    );
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(image.stdout.trim())) {
    throw new Error(`Неожиданный local image ID: ${image.stdout.trim()}`);
  }
  const existing = await runCommand(
    "docker",
    [
      "container",
      "ls",
      "-a",
      "--filter",
      `label=${LAB_LABEL_KEY}=${LAB_OWNER_LABEL}`,
      "--format",
      "{{.ID}}\t{{.Names}}\t{{.Status}}"
    ],
    { timeoutMs: 10_000 }
  );
  const labelledContainers = existing.stdout
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const networks = await runCommand(
    "docker",
    [
      "network",
      "ls",
      "--filter",
      `label=${LAB_LABEL_KEY}=${LAB_OWNER_LABEL}`,
      "--format",
      "{{.ID}}\t{{.Name}}"
    ],
    { timeoutMs: 10_000 }
  );
  const volumes = await runCommand(
    "docker",
    [
      "volume",
      "ls",
      "--filter",
      `label=${LAB_LABEL_KEY}=${LAB_OWNER_LABEL}`,
      "--format",
      "{{.Name}}"
    ],
    { timeoutMs: 10_000 }
  );
  const labelledNetworks = networks.stdout
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const labelledVolumes = volumes.stdout
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (
    labelledContainers.length > 0 ||
    labelledNetworks.length > 0 ||
    labelledVolumes.length > 0
  ) {
    throw new Error(
      "Найдены course-labelled Docker resources; завершите exact cleanup перед offline inspect."
    );
  }
  return [
    "PASS fixture inspector preflight",
    `docker_context=${endpoint.context} endpoint=${endpoint.endpoint} endpoint_source=${endpoint.source} daemon_id=${endpoint.daemonId}`,
    `docker=${server.Version} server=${server.Os}/${server.Arch}`,
    `image=${LAB_IMAGE}`,
    `image_id=${image.stdout.trim()}`,
    "network_mode=none labelled_containers=0 labelled_networks=0 labelled_volumes=0"
  ].join("\n");
}

export async function inspectFixture(
  root: string,
  target: string
): Promise<string> {
  const [fixture] = await selectFixtures(root, target);
  if (!fixture) throw new Error(`Fixture не найден: ${target}`);
  const evidenceRun = await reserveFixtureEvidenceRun(root, fixture);
  const dockerRunId = `fixture-inspect-${randomUUID()}`;
  const name = `cn-fixture-${dockerRunId.slice(-12)}`;
  const absolutePcapPath = path.join(root, fixture.pcapRelativePath);
  let containerId: string | null = null;
  let dockerEndpoint: DockerEndpointInventory | null = null;
  let recoveryState: FixtureRecoveryState | null = null;
  let result: string | null = null;
  let inspectionError: unknown = null;
  try {
    const verified = await verifyFixtures(root, target);
    dockerEndpoint = await requireLocalDockerEndpoint();
    const preflight = await preflightFixtureInspector(dockerEndpoint);
    await writeFixtureRunArtifact(
      evidenceRun,
      "preflight.txt",
      [
        `checked_at=${new Date().toISOString()}`,
        `command=pnpm network:fixture inspect ${target}`,
        `fixture=${fixture.pcapRelativePath}`,
        ...verified,
        preflight
      ].join("\n") + "\n"
    );
    recoveryState = {
      schemaVersion: 3,
      evidenceRunDirectory: evidenceRun.relativeDirectory,
      dockerEndpoint,
      dockerRunId,
      containerName: name,
      containerRole: "fixture-inspect",
      containerId: null
    };
    await writeFixtureRunArtifact(
      evidenceRun,
      "recovery.json",
      JSON.stringify(recoveryState, null, 2) + "\n"
    );
    await appendFixtureRunEvent(evidenceRun, {
      phase: "preflight",
      kind: "observed",
      detail: "fixture identity and zero-resource offline inspector preflight passed"
    });
    await appendFixtureRunEvent(evidenceRun, {
      phase: "inspect",
      kind: "action",
      detail: `create reserved ${name} with run label ${dockerRunId} as one network-none parser for ${fixture.pcapRelativePath}`
    });
    await requireMatchingDockerEndpoint(recoveryState.dockerEndpoint);
    const created = await runCommand(
      "docker",
      [
        "container",
        "create",
        "--pull",
        "never",
        "--name",
        name,
        "--label",
        `${LAB_LABEL_KEY}=${LAB_OWNER_LABEL}`,
        "--label",
        `${LAB_RUN_LABEL_KEY}=${dockerRunId}`,
        "--label",
        `${LAB_ROLE_LABEL_KEY}=${recoveryState.containerRole}`,
        "--network",
        "none",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges=true",
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,size=16m",
        "--pids-limit",
        "64",
        "--memory",
        "128m",
        "--cpus",
        "0.5",
        LAB_IMAGE,
        "sleep",
        "infinity"
      ],
      { timeoutMs: 15_000 }
    );
    containerId = created.stdout.trim();
    assertDockerId(containerId);
    recoveryState.containerId = containerId;
    await saveFixtureRecoveryState(evidenceRun, recoveryState);
    await runCommand("docker", ["container", "start", containerId], {
      timeoutMs: 10_000
    });
    const parserSafety = await inspectFixtureContainerSafety(
      containerId,
      recoveryState
    );
    await runCommand(
      "docker",
      ["container", "cp", absolutePcapPath, `${containerId}:/input.pcap`],
      { timeoutMs: 10_000 }
    );
    const tshark = await runCommand(
      "docker",
      [
        "container",
        "exec",
        containerId,
        "tshark",
        "-n",
        "-r",
        "/input.pcap",
        "-T",
        "fields",
        "-E",
        "header=y",
        "-E",
        "separator=/t",
        "-E",
        "occurrence=f",
        "-e",
        "frame.number",
        "-e",
        "frame.time_epoch",
        "-e",
        "frame.len",
        "-e",
        "frame.cap_len",
        "-e",
        "eth.src",
        "-e",
        "eth.dst",
        "-e",
        "eth.type",
        "-e",
        "ip.version",
        "-e",
        "ip.hdr_len",
        "-e",
        "ip.len",
        "-e",
        "arp.opcode",
        "-e",
        "arp.src.hw_mac",
        "-e",
        "arp.src.proto_ipv4",
        "-e",
        "arp.dst.hw_mac",
        "-e",
        "arp.dst.proto_ipv4",
        "-e",
        "ip.src",
        "-e",
        "ip.dst",
        "-e",
        "ip.proto",
        "-e",
        "icmp.type",
        "-e",
        "icmp.code",
        "-e",
        "icmp.ident",
        "-e",
        "icmp.seq"
      ],
      { timeoutMs: 15_000 }
    );

    const companions: string[] = [];
    for (const relativePath of fixture.companionRelativePaths) {
      companions.push(
        `--- ${relativePath} ---\n${await readFile(path.join(root, relativePath), "utf8")}`
      );
    }
    result = [
      `fixture=${fixture.pcapRelativePath}`,
      `sha256=${sha256(await readFile(path.join(root, fixture.pcapRelativePath)))}`,
      ...companions,
      "--- parser safety inspect ---",
      JSON.stringify(parserSafety, null, 2),
      "--- tshark canonical fields ---",
      tshark.stdout || "(0 frames)"
    ].join("\n");
    await writeFixtureRunArtifact(
      evidenceRun,
      "inspect.txt",
      [
        `observed_at=${new Date().toISOString()}`,
        `method=docker container exec ${containerId} tshark -n -r /input.pcap -T fields`,
        "network_mode=none",
        result
      ].join("\n") + "\n"
    );
    await appendFixtureRunEvent(evidenceRun, {
      phase: "inspect",
      kind: "observed",
      detail: "TShark canonical fields saved to inspect.txt"
    });
  } catch (error) {
    inspectionError = error;
    await appendFixtureRunEvent(evidenceRun, {
      phase: "inspect",
      kind: "error",
      detail: formatUnknownError(error)
    }).catch(() => undefined);
  }

  let cleanupError: unknown = null;
  let cleanupResult: FixtureCleanupResult | null = null;
  if (recoveryState) {
    await appendFixtureRunEvent(evidenceRun, {
      phase: "cleanup",
      kind: "cleanup",
      detail: `remove reserved ${recoveryState.containerName} after exact endpoint and run-label verification`
    }).catch(() => undefined);
    try {
      cleanupResult = await cleanupFixtureRecoveryState(recoveryState);
      containerId = cleanupResult.containerId ?? containerId;
    } catch (error) {
      cleanupError = error;
    }
  }

  let postCheck: string | null = null;
  if (recoveryState) {
    try {
      const cleanPreflight = await preflightFixtureInspector(
        recoveryState.dockerEndpoint
      );
      postCheck = [
        `checked_at=${new Date().toISOString()}`,
        `exact_container=${containerId ?? recoveryState.containerName}`,
        "exact_container_absent=true",
        `reconciliation_quiet_ms=${FIXTURE_CLEANUP_QUIET_PERIOD_MS}`,
        `reconciliation_observations=${cleanupResult?.observations ?? 0}`,
        `reconciliation_removals=${cleanupResult?.removals ?? 0}`,
        cleanPreflight
      ].join("\n");
      await writeFixtureRunArtifact(
        evidenceRun,
        "post-check.txt",
        `${postCheck}\n`
      );
      await appendFixtureRunEvent(evidenceRun, {
        phase: "post-check",
        kind: "observed",
        detail: "exact parser container and all course-labelled resources are absent"
      });
    } catch (error) {
      cleanupError ??= error;
      await appendFixtureRunEvent(evidenceRun, {
        phase: "post-check",
        kind: "error",
        detail: formatUnknownError(error)
      }).catch(() => undefined);
    }
  }

  if (cleanupError) {
    await writeFixtureRunArtifact(
      evidenceRun,
      "error.txt",
      `${formatUnknownError(cleanupError)}\n`
    ).catch(() => undefined);
    throw new Error(
      [
        `Fixture cleanup FAILED for exact container ${containerId ?? recoveryState?.containerName ?? "not-reserved"}: ${formatUnknownError(cleanupError)}`,
        inspectionError
          ? `Inspection also failed: ${formatUnknownError(inspectionError)}`
          : null,
        `failed_run=${evidenceRun.relativeDirectory}`,
        `recovery_command=pnpm network:fixture cleanup ${evidenceRun.relativeDirectory}`
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n")
    );
  }
  if (inspectionError) {
    await writeFixtureRunArtifact(
      evidenceRun,
      "error.txt",
      `${formatUnknownError(inspectionError)}\n`
    ).catch(() => undefined);
    throw new Error(
      `${formatUnknownError(inspectionError)}\nfailed_run=${evidenceRun.relativeDirectory}`
    );
  }
  if (result === null) throw new Error("Fixture inspection не вернул output.");
  if (postCheck === null) throw new Error("Fixture inspection не сохранил post-check.");
  return [
    `run=${evidenceRun.relativeDirectory}`,
    `raw_preflight=${evidenceRun.relativeDirectory}/preflight.txt`,
    `raw_events=${evidenceRun.relativeDirectory}/events.jsonl`,
    `raw_inspect=${evidenceRun.relativeDirectory}/inspect.txt`,
    `raw_post_check=${evidenceRun.relativeDirectory}/post-check.txt`,
    result,
    "--- cleanup post-check ---",
    postCheck
  ].join("\n");
}

export async function cleanupFixtureInspectorRun(
  root: string,
  runDirectory: string
): Promise<string> {
  const { run, recovery } = await readFixtureRecoveryState(root, runDirectory);
  const cleanup = await cleanupFixtureRecoveryState(recovery);
  const cleanPreflight = await preflightFixtureInspector(recovery.dockerEndpoint);
  const result = [
    "PASS fixture cleanup",
    `run=${run.relativeDirectory}`,
    `endpoint=${recovery.dockerEndpoint.endpoint}`,
    `daemon_id=${recovery.dockerEndpoint.daemonId}`,
    `reserved_container=${recovery.containerName}`,
    `reserved_role=${recovery.containerRole}`,
    `exact_container=${cleanup.containerId ?? recovery.containerId ?? "already-absent"}`,
    "exact_container_absent=true",
    `reconciliation_quiet_ms=${FIXTURE_CLEANUP_QUIET_PERIOD_MS}`,
    `reconciliation_observations=${cleanup.observations}`,
    `reconciliation_removals=${cleanup.removals}`,
    cleanPreflight
  ].join("\n");
  const artifactName =
    "manual-recovery-" +
    new Date().toISOString().replace(/[:.]/g, "-") +
    "-" +
    randomUUID().slice(0, 8) +
    ".txt";
  await writeFile(path.join(run.absoluteDirectory, artifactName), `${result}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
  return `${result}\nmanual_recovery=${run.relativeDirectory}/${artifactName}`;
}

async function cleanupFixtureRecoveryState(
  recovery: FixtureRecoveryState
): Promise<FixtureCleanupResult> {
  await requireMatchingDockerEndpoint(recovery.dockerEndpoint);
  let containerId = recovery.containerId;
  const reconciliation = await waitForCleanupQuiescence(
    async () => {
      const removed = await removeFixtureContainerOnce(recovery);
      if (removed) containerId = removed;
      return { clean: true, removals: removed ? 1 : 0 };
    },
    {
      quietPeriodMs: FIXTURE_CLEANUP_QUIET_PERIOD_MS,
      timeoutMs: FIXTURE_CLEANUP_TIMEOUT_MS,
      pollIntervalMs: FIXTURE_CLEANUP_POLL_INTERVAL_MS
    }
  );
  return { containerId, ...reconciliation };
}

async function removeFixtureContainerOnce(
  recovery: FixtureRecoveryState
): Promise<string | null> {
  const target = recovery.containerName;
  const labels = await tryCommand(
    "docker",
    [
      "container",
      "inspect",
      target,
      "--format",
      `{{.Id}}|{{.Name}}|{{index .Config.Labels "${LAB_LABEL_KEY}"}}|{{index .Config.Labels "${LAB_ROLE_LABEL_KEY}"}}|{{index .Config.Labels "${LAB_RUN_LABEL_KEY}"}}`
    ],
    { timeoutMs: 10_000, log: false }
  );
  if (labels.exitCode !== 0) {
    if (isNoSuchDockerObject(labels, "container")) return null;
    throw new Error(
      `Fixture cleanup inspect FAILED for ${target}: ${labels.stderr || labels.stdout}`
    );
  }
  const [containerId, observedName, owner, role, runId] = labels.stdout
    .trim()
    .split("|");
  if (!containerId) {
    throw new Error(`Fixture cleanup inspect не вернул ID для ${target}.`);
  }
  assertDockerId(containerId);
  if (
    (recovery.containerId !== null && recovery.containerId !== containerId) ||
    observedName !== `/${recovery.containerName}` ||
    owner !== LAB_OWNER_LABEL ||
    role !== recovery.containerRole ||
    runId !== recovery.dockerRunId
  ) {
    throw new Error(
      `Refuse cleanup: container ${target} не совпадает с persisted fixture-inspect identity.`
    );
  }
  await runCommand(
    "docker",
    ["container", "rm", "--force", containerId],
    { timeoutMs: 10_000 }
  );
  const remaining = await tryCommand(
    "docker",
    ["container", "inspect", containerId, "--format", "{{.Id}}"],
    { timeoutMs: 10_000, log: false }
  );
  if (remaining.exitCode === 0) {
    throw new Error(
      `Fixture cleanup post-check FAILED: container ${containerId} всё ещё существует.`
    );
  }
  if (!isNoSuchDockerObject(remaining, "container")) {
    throw new Error(
      `Fixture cleanup post-check inspect FAILED for ${containerId}: ${remaining.stderr || remaining.stdout}`
    );
  }
  return containerId;
}

interface FixtureEvidenceRun {
  absoluteDirectory: string;
  relativeDirectory: string;
  sequence: number;
}

interface FixtureRecoveryState {
  schemaVersion: 3;
  evidenceRunDirectory: string;
  dockerEndpoint: DockerEndpointInventory;
  dockerRunId: string;
  containerName: string;
  containerRole: "fixture-inspect";
  containerId: string | null;
}

interface FixtureCleanupResult {
  containerId: string | null;
  observations: number;
  removals: number;
}

interface FixtureContainerInspect {
  Id?: string;
  Name?: string;
  Config?: {
    Image?: string;
    Labels?: Record<string, string>;
  };
  State?: { Running?: boolean };
  HostConfig?: {
    NetworkMode?: string;
    Privileged?: boolean;
    ReadonlyRootfs?: boolean;
    CapAdd?: string[] | null;
    CapDrop?: string[] | null;
    SecurityOpt?: string[] | null;
    Binds?: string[] | null;
    PortBindings?: Record<string, unknown> | null;
    PidsLimit?: number;
    Memory?: number;
    NanoCpus?: number;
    Tmpfs?: Record<string, string> | null;
  };
  Mounts?: unknown[];
  NetworkSettings?: {
    Networks?: Record<string, unknown>;
    Ports?: Record<string, unknown> | null;
  };
}

async function inspectFixtureContainerSafety(
  containerId: string,
  recovery: FixtureRecoveryState
): Promise<Record<string, unknown>> {
  const inspected = await runCommand(
    "docker",
    ["container", "inspect", containerId],
    { timeoutMs: 10_000 }
  );
  const parsed = JSON.parse(inspected.stdout) as unknown;
  const value = Array.isArray(parsed) ? parsed[0] : null;
  if (!value || typeof value !== "object") {
    throw new Error("Fixture parser docker inspect не вернул object.");
  }
  const inspect = value as FixtureContainerInspect;
  const host = inspect.HostConfig ?? {};
  const labels = inspect.Config?.Labels ?? {};
  const networkNames = Object.keys(inspect.NetworkSettings?.Networks ?? {});
  const capDrop = host.CapDrop ?? [];
  const capAdd = host.CapAdd ?? [];
  const securityOptions = host.SecurityOpt ?? [];
  const portBindings = host.PortBindings ?? {};
  const exposedPorts = inspect.NetworkSettings?.Ports ?? {};
  const tmpfs = host.Tmpfs ?? {};
  const tmpfsOptions = (tmpfs["/tmp"] ?? "").split(",").filter(Boolean);
  const expectedTmpfsOptions = ["rw", "noexec", "nosuid", "size=16m"];
  if (
    inspect.Id !== containerId ||
    inspect.Name !== `/${recovery.containerName}` ||
    inspect.Config?.Image !== LAB_IMAGE ||
    labels[LAB_LABEL_KEY] !== LAB_OWNER_LABEL ||
    labels[LAB_RUN_LABEL_KEY] !== recovery.dockerRunId ||
    labels[LAB_ROLE_LABEL_KEY] !== recovery.containerRole ||
    inspect.State?.Running !== true ||
    host.NetworkMode !== "none" ||
    !(
      networkNames.length === 0 ||
      (networkNames.length === 1 && networkNames[0] === "none")
    ) ||
    host.Privileged !== false ||
    host.ReadonlyRootfs !== false ||
    !capDrop.includes("ALL") ||
    capAdd.length !== 0 ||
    !securityOptions.includes("no-new-privileges=true") ||
    (host.Binds ?? []).length !== 0 ||
    (inspect.Mounts ?? []).length !== 0 ||
    Object.keys(portBindings).length !== 0 ||
    Object.keys(exposedPorts).length !== 0 ||
    host.PidsLimit !== 64 ||
    host.Memory !== 128 * 1024 * 1024 ||
    host.NanoCpus !== 500_000_000 ||
    tmpfsOptions.length !== expectedTmpfsOptions.length ||
    expectedTmpfsOptions.some((option) => !tmpfsOptions.includes(option))
  ) {
    throw new Error(
      "Fixture parser не подтвердил exact offline capability/network/resource safety contract."
    );
  }
  return {
    container_id: inspect.Id,
    name: recovery.containerName,
    image: inspect.Config.Image,
    owner_label: labels[LAB_LABEL_KEY],
    run_label: labels[LAB_RUN_LABEL_KEY],
    role_label: labels[LAB_ROLE_LABEL_KEY],
    running: true,
    network_mode: host.NetworkMode,
    network_attachments: networkNames,
    privileged: host.Privileged,
    readonly_rootfs: host.ReadonlyRootfs,
    cap_drop: capDrop,
    cap_add: capAdd,
    security_options: securityOptions,
    bind_count: (host.Binds ?? []).length,
    mount_count: (inspect.Mounts ?? []).length,
    port_binding_count: Object.keys(portBindings).length,
    exposed_port_count: Object.keys(exposedPorts).length,
    pids_limit: host.PidsLimit,
    memory_bytes: host.Memory,
    nano_cpus: host.NanoCpus,
    tmpfs: tmpfs
  };
}

async function reserveFixtureEvidenceRun(
  root: string,
  fixture: FixtureDefinition
): Promise<FixtureEvidenceRun> {
  const sessionId = fixture.directory.match(/^fixtures\/(01-\d{2})(?:\/|$)/)?.[1];
  if (!sessionId) {
    throw new Error(
      `Fixture directory не содержит безопасный session id: ${fixture.directory}`
    );
  }
  const runId =
    new Date().toISOString().replace(/[:.]/g, "-") +
    "-" +
    randomUUID().slice(0, 8);
  const relativeDirectory = toPosix(
    path.join(".training", "evidence", sessionId, runId)
  );
  const absoluteDirectory = path.join(root, relativeDirectory);
  await mkdir(path.dirname(absoluteDirectory), { recursive: true });
  await mkdir(absoluteDirectory, { recursive: false });
  const rootReal = await realpath(root);
  const runReal = await realpath(absoluteDirectory);
  const expectedRoot = path.join(rootReal, ".training", "evidence");
  if (!runReal.startsWith(`${expectedRoot}${path.sep}`)) {
    throw new Error("Fixture evidence directory выходит за пределы repository.");
  }
  return {
    absoluteDirectory: runReal,
    relativeDirectory,
    sequence: 0
  };
}

async function appendFixtureRunEvent(
  run: FixtureEvidenceRun,
  event: {
    phase: string;
    kind: "action" | "observed" | "error" | "cleanup";
    detail: string;
  }
): Promise<void> {
  run.sequence += 1;
  await appendFile(
    path.join(run.absoluteDirectory, "events.jsonl"),
    JSON.stringify({
      schemaVersion: 1,
      sequence: run.sequence,
      at: new Date().toISOString(),
      ...event
    }) + "\n",
    { encoding: "utf8", flag: "a", mode: 0o600 }
  );
}

async function writeFixtureRunArtifact(
  run: FixtureEvidenceRun,
  filename:
    | "preflight.txt"
    | "inspect.txt"
    | "post-check.txt"
    | "error.txt"
    | "recovery.json",
  content: string
): Promise<void> {
  await writeFile(path.join(run.absoluteDirectory, filename), content, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
}

async function saveFixtureRecoveryState(
  run: FixtureEvidenceRun,
  recovery: FixtureRecoveryState
): Promise<void> {
  assertFixtureRecoveryState(recovery, run.relativeDirectory);
  const target = path.join(run.absoluteDirectory, "recovery.json");
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporary, JSON.stringify(recovery, null, 2) + "\n", {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
  await rename(temporary, target);
}

async function readFixtureRecoveryState(
  root: string,
  runDirectory: string
): Promise<{ run: FixtureEvidenceRun; recovery: FixtureRecoveryState }> {
  if (
    !/^\.training\/evidence\/01-(?:03|05|06)\/[A-Za-z0-9-]+$/.test(
      runDirectory
    )
  ) {
    throw new Error(
      "Fixture cleanup требует exact .training/evidence/01-0{3,5,6}/<run-id> path."
    );
  }
  const rootReal = await realpath(root);
  const requested = path.join(rootReal, runDirectory);
  const runReal = await realpath(requested).catch(() => null);
  const expectedRoot = path.join(rootReal, ".training", "evidence");
  if (!runReal || !runReal.startsWith(`${expectedRoot}${path.sep}`)) {
    throw new Error("Fixture cleanup run path отсутствует или выходит за repository.");
  }
  const recoveryPath = path.join(runReal, "recovery.json");
  const metadata = await lstat(recoveryPath).catch(() => null);
  if (!metadata || !metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("Fixture cleanup recovery.json отсутствует или небезопасен.");
  }
  const parsed = JSON.parse(await readFile(recoveryPath, "utf8")) as unknown;
  assertFixtureRecoveryState(parsed, runDirectory);
  return {
    run: {
      absoluteDirectory: runReal,
      relativeDirectory: runDirectory,
      sequence: 0
    },
    recovery: parsed
  };
}

function assertFixtureRecoveryState(
  value: unknown,
  expectedRunDirectory: string
): asserts value is FixtureRecoveryState {
  if (!value || typeof value !== "object") {
    throw new Error("Fixture recovery state повреждён.");
  }
  const recovery = value as Partial<FixtureRecoveryState>;
  if (
    recovery.schemaVersion !== 3 ||
    recovery.evidenceRunDirectory !== expectedRunDirectory ||
    !recovery.dockerEndpoint ||
    typeof recovery.dockerEndpoint.context !== "string" ||
    typeof recovery.dockerEndpoint.endpoint !== "string" ||
    !isLocalUnixDockerEndpoint(recovery.dockerEndpoint.endpoint) ||
    typeof recovery.dockerEndpoint.daemonId !== "string" ||
    !isSafeDockerDaemonId(recovery.dockerEndpoint.daemonId) ||
    !["context", "DOCKER_CONTEXT", "DOCKER_HOST"].includes(
      recovery.dockerEndpoint.source ?? ""
    ) ||
    typeof recovery.dockerRunId !== "string" ||
    !/^fixture-inspect-[0-9a-f-]{36}$/.test(recovery.dockerRunId) ||
    typeof recovery.containerName !== "string" ||
    recovery.containerName !==
      `cn-fixture-${recovery.dockerRunId.slice(-12)}` ||
    recovery.containerRole !== "fixture-inspect" ||
    (recovery.containerId !== null &&
      (typeof recovery.containerId !== "string" ||
        !DOCKER_ID_PATTERN.test(recovery.containerId)))
  ) {
    throw new Error("Fixture recovery state имеет неверную schema.");
  }
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function selectFixtures(
  root: string,
  target?: string
): Promise<readonly FixtureDefinition[]> {
  const fixtures = buildFixtureDefinitions();
  if (!target) return fixtures;
  const fixturesRoot = path.join(root, "fixtures");
  const requested = path.resolve(root, target);
  if (
    requested !== fixturesRoot &&
    !requested.startsWith(`${fixturesRoot}${path.sep}`)
  ) {
    throw new Error("Fixture target выходит за пределы fixtures/.");
  }
  const rootReal = await realpath(root);
  const parentReal = await realpath(path.dirname(requested)).catch(() => null);
  if (
    parentReal &&
    parentReal !== rootReal &&
    !parentReal.startsWith(`${rootReal}${path.sep}`)
  ) {
    throw new Error("Fixture target проходит через symlink вне repository.");
  }
  const relative = toPosix(path.relative(root, requested)).replace(/\/$/, "");
  const selected = fixtures.filter(
    (fixture) =>
      relative === fixture.directory ||
      relative === fixture.pcapRelativePath
  );
  if (selected.length === 0) {
    throw new Error(`Неизвестный fixture target: ${target}`);
  }
  return selected;
}

function knownNeighbourFixture(): FixtureDefinition {
  const request = Buffer.from(
    "0242ac1e00140242ac1e000a08004500003c424240004001a024ac1e000aac1e0014080060031234000149434d502d4c41422d3030303030303149434d502d4c41422d30303030303031",
    "hex"
  );
  const reply = Buffer.from(
    "0242ac1e000a0242ac1e001408004500003c424340004001a023ac1e0014ac1e000a000068031234000149434d502d4c41422d3030303030303149434d502d4c41422d30303030303031",
    "hex"
  );
  const pcap = createClassicPcap([
    { seconds: 1_704_067_200, microseconds: 0, frame: request },
    { seconds: 1_704_067_200, microseconds: 1_000, frame: reply }
  ]);
  if (sha256(pcap) !== KNOWN_FIXTURE_SHA256) {
    throw new Error("Internal error: known-neighbour fixture hash drift.");
  }
  const base = "fixtures/01-03/known-neighbour";
  const pcapPath = `${base}.pcap`;
  const provenancePath = `${base}.provenance.md`;
  const hashPath = `${base}.sha256.txt`;
  const textPath = `${base}.txt`;
  return {
    id: "known-neighbour",
    directory: "fixtures/01-03",
    pcapRelativePath: pcapPath,
    artifacts: new Map([
      [pcapPath, pcap],
      [hashPath, utf8(`${KNOWN_FIXTURE_SHA256}  known-neighbour.pcap\n`)],
      [
        provenancePath,
        utf8(
          "# Synthetic provenance\n\n" +
          "- Generator: packages/network-lab/src/fixtures.ts\n" +
          "- Format: classic pcap v2.4, little-endian, microsecond timestamps, Ethernet link type.\n" +
          "- Origin: deterministic synthetic bytes; no host or external traffic.\n" +
          `- Endpoints: ${alpha.ipv4} / ${alpha.mac} and ${beta.ipv4} / ${beta.mac}.\n` +
          "- Capture point model: source endpoint after neighbour mapping is known.\n" +
          "- Frames: two Ethernet frames; original and captured lengths are both 74 bytes, so neither record is truncated; no Ethernet FCS.\n" +
          "- Deterministic fields: addresses, payload, ICMP identifier/sequence, IP IDs, TTL, checksums and relative order.\n" +
          "- This fixture does not prove live host, route, gateway or kernel behaviour.\n"
        )
      ],
      [
        textPath,
        utf8(
          "frame\ttime_epoch\tframe_len\tframe_cap_len\teth_src\teth_dst\teth_type\tip_version\tip_hdr_len\tip_len\tip_src\tip_dst\tip_proto\ticmp_type\ticmp_code\ticmp_id\ticmp_seq\n" +
          `1\t1704067200.000000\t74\t74\t${alpha.mac}\t${beta.mac}\t0x0800\t4\t20\t60\t${alpha.ipv4}\t${beta.ipv4}\t1\t8\t0\t4660\t1\n` +
          `2\t1704067200.001000\t74\t74\t${beta.mac}\t${alpha.mac}\t0x0800\t4\t20\t60\t${beta.ipv4}\t${alpha.ipv4}\t1\t0\t0\t4660\t1\n`
        )
      ]
    ]),
    companionRelativePaths: [provenancePath, hashPath, textPath]
  };
}

function diagnosticFixture(
  caseId: string,
  records: readonly PcapRecord[],
  text: { baseline: string; events: string; action: string }
): FixtureDefinition {
  const directory = `fixtures/01-05/${caseId}`;
  const pcapPath = `${directory}/capture.pcap`;
  const pcap = createClassicPcap(records);
  const hash = sha256(pcap);
  const provenancePath = `${directory}/provenance.md`;
  const hashPath = `${directory}/sha256.txt`;
  const baselinePath = `${directory}/baseline.txt`;
  const eventsPath = `${directory}/events.tsv`;
  const actionPath = `${directory}/action.txt`;
  return {
    id: caseId,
    directory,
    pcapRelativePath: pcapPath,
    artifacts: new Map([
      [pcapPath, pcap],
      [hashPath, utf8(`${hash}  capture.pcap\n`)],
      [
        provenancePath,
        utf8(
          `# Synthetic provenance: ${caseId}\n\n` +
          "- Generator: packages/network-lab/src/fixtures.ts\n" +
          "- Origin: deterministic synthetic evidence; no live or external traffic.\n" +
          `- Capture point: alpha:eth0 (${alpha.ipv4}).\n` +
          "- Filter scope: ARP or IPv4 ICMP involving 172.30.0.20.\n" +
          "- Observation window: 2000 ms; frame limit: 8; Ethernet link type.\n" +
          "- Absence is usable only together with baseline, action and bounded window.\n" +
          "- Bundle localises observations; it does not encode a root-cause answer.\n"
        )
      ],
      [baselinePath, utf8(text.baseline)],
      [eventsPath, utf8(text.events)],
      [actionPath, utf8(text.action)]
    ]),
    companionRelativePaths: [
      provenancePath,
      hashPath,
      baselinePath,
      actionPath,
      eventsPath
    ]
  };
}

function novelLocalExchangeFixture(): FixtureDefinition {
  const arpRequest = buildArpFrame({
    operation: 1,
    ethernetSource: alpha.mac,
    ethernetDestination: broadcast,
    senderMac: alpha.mac,
    senderIpv4: alpha.ipv4,
    targetMac: zeroMac,
    targetIpv4: beta.ipv4
  });
  const arpReply = buildArpFrame({
    operation: 2,
    ethernetSource: beta.mac,
    ethernetDestination: alpha.mac,
    senderMac: beta.mac,
    senderIpv4: beta.ipv4,
    targetMac: alpha.mac,
    targetIpv4: alpha.ipv4
  });
  const payload = Buffer.from(
    "novel-01-06-payload".padEnd(32, "."),
    "ascii"
  );
  const request = buildIcmpEchoFrame({
    ethernetSource: alpha.mac,
    ethernetDestination: beta.mac,
    ipv4Source: alpha.ipv4,
    ipv4Destination: beta.ipv4,
    type: 8,
    identifier: 0x6206,
    sequence: 7,
    ipIdentifier: 0x6100,
    payload
  });
  const reply = buildIcmpEchoFrame({
    ethernetSource: beta.mac,
    ethernetDestination: alpha.mac,
    ipv4Source: beta.ipv4,
    ipv4Destination: alpha.ipv4,
    type: 0,
    identifier: 0x6206,
    sequence: 7,
    ipIdentifier: 0x6101,
    payload
  });
  const requestTwo = buildIcmpEchoFrame({
    ethernetSource: alpha.mac,
    ethernetDestination: beta.mac,
    ipv4Source: alpha.ipv4,
    ipv4Destination: beta.ipv4,
    type: 8,
    identifier: 0x6206,
    sequence: 8,
    ipIdentifier: 0x6102,
    payload
  });
  const replyTwo = buildIcmpEchoFrame({
    ethernetSource: beta.mac,
    ethernetDestination: alpha.mac,
    ipv4Source: beta.ipv4,
    ipv4Destination: alpha.ipv4,
    type: 0,
    identifier: 0x6206,
    sequence: 8,
    ipIdentifier: 0x6103,
    payload
  });
  const pcap = createClassicPcap([
    { seconds: 1_704_068_400, microseconds: 0, frame: arpRequest },
    { seconds: 1_704_068_400, microseconds: 250, frame: arpReply },
    { seconds: 1_704_068_400, microseconds: 900, frame: request },
    { seconds: 1_704_068_400, microseconds: 1_600, frame: reply },
    { seconds: 1_704_068_400, microseconds: 5_000, frame: requestTwo },
    { seconds: 1_704_068_400, microseconds: 5_700, frame: replyTwo }
  ]);
  const base = "fixtures/01-06/novel-local-exchange";
  const pcapPath = `${base}.pcap`;
  const provenancePath = `${base}.provenance.md`;
  const hashPath = `${base}.sha256.txt`;
  const textPath = `${base}.txt`;
  const baselinePath = `${base}.baseline.txt`;
  const hash = sha256(pcap);
  return {
    id: "novel-local-exchange",
    directory: "fixtures/01-06",
    pcapRelativePath: pcapPath,
    artifacts: new Map([
      [pcapPath, pcap],
      [hashPath, utf8(`${hash}  novel-local-exchange.pcap\n`)],
      [
        provenancePath,
        utf8(
          "# Synthetic provenance\n\n" +
          "- Generator: packages/network-lab/src/fixtures.ts\n" +
          "- Origin: deterministic synthetic bytes; no live or external traffic.\n" +
          `- Inventory: alpha ${alpha.ipv4} / ${alpha.mac}; beta ${beta.ipv4} / ${beta.mac}.\n` +
          `- Baseline companion: ${baselinePath}; alpha:eth0 is UP/LOWER_UP and the beta neighbor entry is absent before the bounded exchange.\n` +
          "- Assumption supplied by the bundle: both endpoints belong to one local Ethernet LAN.\n" +
          "- Capture point model: alpha network namespace, ARP and IPv4 ICMP, six-frame ceiling.\n" +
          "- Deterministic fields: timestamps, addresses, payload, identifiers, checksums and order.\n" +
          "- The capture does not expose endpoint internals, host routing or traffic outside its window.\n"
        )
      ],
      [
        baselinePath,
        utf8(
          "recorded_at=2024-01-01T00:19:59.000Z\n" +
          "capture_point=alpha:eth0\n" +
          "eth0_state=UP LOWER_UP\n" +
          `mac=${alpha.mac}\n` +
          `ipv4=${alpha.ipv4}\n` +
          `neighbor_${beta.ipv4}=absent\n`
        )
      ],
      [
        textPath,
        utf8(
          "frame\ttime_epoch\tframe_len\teth_src\teth_dst\teth_type\tarp_opcode\tarp_sender_ip\tarp_target_ip\tip_src\tip_dst\tip_proto\ticmp_type\ticmp_id\ticmp_seq\n" +
          `1\t1704068400.000000\t42\t${alpha.mac}\t${broadcast}\t0x0806\t1\t${alpha.ipv4}\t${beta.ipv4}\t\t\t\t\t\t\n` +
          `2\t1704068400.000250\t42\t${beta.mac}\t${alpha.mac}\t0x0806\t2\t${beta.ipv4}\t${alpha.ipv4}\t\t\t\t\t\t\n` +
          `3\t1704068400.000900\t74\t${alpha.mac}\t${beta.mac}\t0x0800\t\t\t\t${alpha.ipv4}\t${beta.ipv4}\t1\t8\t25094\t7\n` +
          `4\t1704068400.001600\t74\t${beta.mac}\t${alpha.mac}\t0x0800\t\t\t\t${beta.ipv4}\t${alpha.ipv4}\t1\t0\t25094\t7\n` +
          `5\t1704068400.005000\t74\t${alpha.mac}\t${beta.mac}\t0x0800\t\t\t\t${alpha.ipv4}\t${beta.ipv4}\t1\t8\t25094\t8\n` +
          `6\t1704068400.005700\t74\t${beta.mac}\t${alpha.mac}\t0x0800\t\t\t\t${beta.ipv4}\t${alpha.ipv4}\t1\t0\t25094\t8\n`
        )
      ]
    ]),
    companionRelativePaths: [provenancePath, hashPath, baselinePath, textPath]
  };
}

function utf8(value: string): Buffer {
  return Buffer.from(value, "utf8");
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function isAlreadyExists(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EEXIST"
  );
}

function assertDockerId(value: string): void {
  if (!DOCKER_ID_PATTERN.test(value)) {
    throw new Error(`Docker вернул неожиданный container ID: ${value}`);
  }
}

import { createHash } from "node:crypto";
import { readFile, stat, statfs } from "node:fs/promises";
import path from "node:path";
import {
  CAPTURE_LIMITS,
  DOCKER_ID_PATTERN,
  LAB_ENDPOINTS,
  LAB_IMAGE,
  LAB_LABEL_KEY,
  LAB_NETWORK,
  LAB_OWNER_LABEL,
  LAB_ROLE_LABEL_KEY,
  LAB_RUN_LABEL_KEY
} from "./constants.js";
import { runCommand, tryCommand } from "./command.js";
import {
  ipv4CidrsOverlap,
  isNoSuchDockerObject,
  requireLocalDockerEndpoint,
  requireMatchingDockerEndpoint,
  type DockerEndpointInventory
} from "./docker-safety.js";
import {
  appendEvent,
  getReservedContainerCleanupOrder,
  readState,
  readStateIfPresent,
  removeState,
  reserveState,
  runPath,
  saveState,
  writeRunArtifact,
  type DockerNamedResourceReservation,
  type DockerResourceReservation,
  type LabState
} from "./state.js";
import { waitForCleanupQuiescence } from "./reconciliation.js";

interface PreflightResult {
  checkedAt: string;
  dockerEndpoint: DockerEndpointInventory;
  dockerVersion: string;
  serverOs: string;
  serverArch: string;
  imageId: string;
  availableBytes: number;
  securityOptions: string[];
  ownerLabel: string;
  exactTargetNames: string[];
  networkInventory: {
    inspectedCount: number;
    targetSubnet: string;
    conflictCount: number;
    conflicts: Array<{ id: string; name: string; subnet: string }>;
  };
  initialResources: {
    containerRows: string[];
    networkRows: string[];
    volumeRows: string[];
  };
}

interface DockerServerVersion {
  Version?: string;
  Os?: string;
  Arch?: string;
}

interface DockerNetworkInspect {
  Id: string;
  Name: string;
  Driver: string;
  Internal: boolean;
  EnableIPv6: boolean;
  Options?: Record<string, string>;
  IPAM?: { Config?: { Subnet?: string }[] };
  Containers?: Record<string, { IPv4Address?: string; MacAddress?: string }>;
  Labels?: Record<string, string>;
}

interface DockerContainerInspect {
  Id: string;
  Name: string;
  Config: {
    Image?: string;
    Cmd?: string[];
    Labels?: Record<string, string>;
  };
  State: { Running?: boolean; ExitCode?: number };
  HostConfig: {
    Privileged?: boolean;
    ReadonlyRootfs?: boolean;
    CapAdd?: string[] | null;
    CapDrop?: string[] | null;
    SecurityOpt?: string[] | null;
    Tmpfs?: Record<string, string> | null;
    PidsLimit?: number | null;
    Memory?: number;
    NanoCpus?: number;
    NetworkMode?: string;
    PortBindings?: Record<string, unknown> | null;
  };
  Mounts?: Array<{
    Type?: string;
    Name?: string;
    Destination?: string;
    RW?: boolean;
  }>;
  NetworkSettings?: {
    Ports?: Record<string, unknown> | null;
    Networks?: Record<
      string,
      { IPAddress?: string; MacAddress?: string }
    >;
  };
}

interface HelperVolumeMount {
  source: string;
  target: string;
}

const LIVE_TMPFS_OPTIONS = [
  "rw",
  "noexec",
  "nosuid",
  "nodev",
  "size=16m"
] as const;

const BETA_ARP_OR_ICMP_FILTER =
  `(arp and (arp[14:4] = 0xac1e0014 or arp[24:4] = 0xac1e0014)) ` +
  `or (icmp and host ${LAB_ENDPOINTS.beta.ipv4})`;
const CAPTURE_CONTAINER_PATH = "/evidence/capture.pcap";
const CLEANUP_QUIET_PERIOD_MS = 3_000;
const CLEANUP_RECONCILIATION_TIMEOUT_MS = 15_000;
const CLEANUP_POLL_INTERVAL_MS = 250;

export async function preloadImage(): Promise<void> {
  await requireLocalDockerEndpoint();
  await runCommand("docker", ["image", "pull", LAB_IMAGE], {
    timeoutMs: 180_000,
    stdout: "inherit"
  });
  const inspected = await runCommand(
    "docker",
    ["image", "inspect", LAB_IMAGE, "--format", "{{.Id}}"],
    { timeoutMs: 10_000 }
  );
  process.stdout.write(`PASS image loaded: ${inspected.stdout}\n`);
}

export async function preflightLab(root: string): Promise<PreflightResult> {
  if (await readStateIfPresent(root)) {
    throw new Error(
      "Active lab state найден. Сначала выполните network:lab down."
    );
  }
  const dockerEndpoint = await requireLocalDockerEndpoint();
  const version = await runCommand(
    "docker",
    ["version", "--format", "{{json .Server}}"],
    { timeoutMs: 10_000 }
  );
  const server = JSON.parse(version.stdout) as DockerServerVersion;
  const dockerVersion = server.Version;
  const serverOs = server.Os;
  const serverArch = server.Arch;
  if (!dockerVersion || !serverOs || !serverArch) {
    throw new Error("Docker server вернул неполный version inventory.");
  }
  if (!versionAtLeast(dockerVersion, 28, 0)) {
    throw new Error(
      `Docker Engine >=28.0 нужен для gateway_mode_ipv4=isolated; observed ${dockerVersion}.`
    );
  }
  if (serverOs !== "linux") {
    throw new Error(`Нужен Docker Linux engine; observed ${serverOs}.`);
  }
  if (!["amd64", "arm64"].includes(serverArch)) {
    throw new Error(
      `Поддерживаются server arch amd64/arm64; observed ${serverArch}.`
    );
  }
  const security = await runCommand(
    "docker",
    ["info", "--format", "{{json .SecurityOptions}}"],
    { timeoutMs: 10_000 }
  );
  const securityOptions = JSON.parse(security.stdout) as unknown;
  if (
    Array.isArray(securityOptions) &&
    securityOptions.some(
      (entry) => typeof entry === "string" && entry.includes("rootless")
    )
  ) {
    throw new Error(
      "Rootless Docker не входит в проверенную matrix isolated lab v1."
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
        "Pinned image не загружен. Выполните pnpm network:lab preload."
      );
    }
    throw new Error(
      `Pinned image нельзя безопасно проверить: ${image.stderr || image.stdout || "Docker не вернул причину"}`
    );
  }
  const imageId = image.stdout.trim();
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) {
    throw new Error(`Неожиданный local image ID: ${imageId}`);
  }

  const existing = await labelledResources();
  if (
    existing.containerRows.length > 0 ||
    existing.networkRows.length > 0 ||
    existing.volumeRows.length > 0
  ) {
    throw new Error(
      "Найдены course-labelled Docker resources без active state; ничего не удалено. Проверьте network:lab status."
    );
  }
  for (const name of ["cn-alpha", "cn-beta"]) {
    const inspect = await tryCommand(
      "docker",
      ["container", "inspect", name, "--format", "{{.Id}}"],
      { timeoutMs: 10_000 }
    );
    if (inspect.exitCode === 0) {
      throw new Error(
        `Exact container name ${name} уже занят; resource не изменён.`
      );
    }
    if (!isNoSuchDockerObject(inspect, "container")) {
      throw new Error(
        `Exact container name ${name} нельзя безопасно проверить: ${inspect.stderr || inspect.stdout}`
      );
    }
  }
  const network = await tryCommand(
    "docker",
    ["network", "inspect", "cn-lab", "--format", "{{.Id}}"],
    { timeoutMs: 10_000 }
  );
  if (network.exitCode === 0) {
    throw new Error("Exact network name cn-lab уже занят; resource не изменён.");
  }
  if (!isNoSuchDockerObject(network, "network")) {
    throw new Error(
      `Exact network name cn-lab нельзя безопасно проверить: ${network.stderr || network.stdout}`
    );
  }
  const networkInventory = await inspectNetworkSubnets();
  if (networkInventory.conflicts.length > 0) {
    const detail = networkInventory.conflicts
      .map((item) => `${item.name}(${item.subnet})`)
      .join(", ");
    throw new Error(
      `Fixed lab subnet ${LAB_NETWORK.subnet} пересекается с existing Docker network: ${detail}. Ничего не изменено.`
    );
  }

  const disk = await statfs(root);
  const availableBytes = disk.bavail * disk.bsize;
  if (availableBytes < 32 * 1024 * 1024) {
    throw new Error("Недостаточно 32 MiB свободного места для bounded evidence.");
  }
  const result = {
    checkedAt: new Date().toISOString(),
    dockerEndpoint,
    dockerVersion,
    serverOs,
    serverArch,
    imageId,
    availableBytes,
    securityOptions: Array.isArray(securityOptions)
      ? securityOptions.filter((entry): entry is string => typeof entry === "string")
      : [],
    ownerLabel: `${LAB_LABEL_KEY}=${LAB_OWNER_LABEL}`,
    exactTargetNames: ["cn-lab", "cn-alpha", "cn-beta"],
    networkInventory,
    initialResources: existing
  };
  process.stdout.write(
    [
      "PASS network lab preflight",
      `docker_context=${dockerEndpoint.context} endpoint=${dockerEndpoint.endpoint} endpoint_source=${dockerEndpoint.source} daemon_id=${dockerEndpoint.daemonId}`,
      `docker=${dockerVersion} server=${serverOs}/${serverArch}`,
      `image=${LAB_IMAGE}`,
      `image_id=${imageId}`,
      `available_bytes=${availableBytes}`,
      "gateway_mode_ipv4=isolated supported by version gate",
      `owner_label=${LAB_LABEL_KEY}=${LAB_OWNER_LABEL}`,
      `exact_targets=cn-lab,cn-alpha,cn-beta`,
      `target_subnet=${LAB_NETWORK.subnet} inspected_networks=${networkInventory.inspectedCount} subnet_conflicts=${networkInventory.conflictCount}`,
      `labelled_containers=${existing.containerRows.length} labelled_networks=${existing.networkRows.length} labelled_volumes=${existing.volumeRows.length}`
    ].join("\n") + "\n"
  );
  return result;
}

export async function upLab(
  root: string,
  sessionId: string
): Promise<void> {
  if (sessionId !== "01-02" && sessionId !== "01-04") {
    throw new Error("up разрешён только для session 01-02 или 01-04.");
  }
  const preflight = await preflightLab(root);
  const state = await reserveState(root, sessionId, preflight.dockerEndpoint);
  try {
    await writeRunArtifact(
      root,
      state,
      "preflight.json",
      JSON.stringify(
        {
          schemaVersion: 1,
          sessionId,
          run: state.runDirectory,
          ...preflight,
          image: LAB_IMAGE,
          expected: {
            isolated: true,
            internal: true,
            ipv4Only: true,
            publishedPorts: 0,
            privileged: false
          }
        },
        null,
        2
      ) + "\n"
    );
    await appendEvent(root, state, {
      phase: "up",
      kind: "expected",
      detail:
        "create one internal isolated IPv4 bridge and two fixed endpoints without host exposure"
    });
    await appendEvent(root, state, {
      phase: "up",
      kind: "action",
      detail: "begin exact network creation for cn-lab"
    });
    await assertStateDockerEndpoint(state);
    const network = await runCommand(
      "docker",
      [
        "network",
        "create",
        "--driver",
        LAB_NETWORK.driver,
        "--internal",
        "--ipv6=false",
        "--subnet",
        LAB_NETWORK.subnet,
        "--opt",
        `${LAB_NETWORK.gatewayModeOption}=${LAB_NETWORK.gatewayMode}`,
        "--label",
        `${LAB_LABEL_KEY}=${LAB_OWNER_LABEL}`,
        "--label",
        `${LAB_RUN_LABEL_KEY}=${state.runId}`,
        "--label",
        `${LAB_ROLE_LABEL_KEY}=network`,
        state.network.name
      ],
      { timeoutMs: 15_000 }
    );
    state.network.id = network.stdout.trim();
    assertDockerId(state.network.id);
    await saveState(root, state);

    await createEndpoint(
      root,
      state,
      state.containers.alpha,
      LAB_ENDPOINTS.alpha.ipv4,
      LAB_ENDPOINTS.alpha.mac
    );
    await createEndpoint(
      root,
      state,
      state.containers.beta,
      LAB_ENDPOINTS.beta.ipv4,
      LAB_ENDPOINTS.beta.mac
    );
    await runCommand(
      "docker",
      [
        "container",
        "start",
        requireId(state.containers.alpha.id, "alpha"),
        requireId(state.containers.beta.id, "beta")
      ],
      { timeoutMs: 15_000 }
    );
    await appendEvent(root, state, {
      phase: "up",
      kind: "observed",
      detail:
        "network and two endpoint containers created and started by exact IDs"
    });
    process.stdout.write(
      `PASS lab up\nsession=${state.sessionId}\nrun=${state.runDirectory}\n`
    );
  } catch (error) {
    await recordError(root, state, "up", error);
    await downLab(root).catch((cleanupError) => {
      process.stderr.write(
        `Cleanup after up failure also failed: ${formatError(cleanupError)}\n`
      );
    });
    throw error;
  }
}

export async function baselineLab(root: string): Promise<void> {
  const state = await readState(root);
  await assertStateDockerEndpoint(state);
  try {
    await collectAndSaveBaseline(root, state);
    process.stdout.write(
      `PASS baseline\nrun=${state.runDirectory}\nartifact=baseline.txt\n`
    );
  } catch (error) {
    await recordError(root, state, "baseline", error);
    await downLab(root).catch((cleanupError) => {
      process.stderr.write(
        `Cleanup after baseline failure also failed: ${formatError(cleanupError)}\n`
      );
    });
    throw error;
  }
}

export async function captureLab(root: string): Promise<void> {
  const state = await readState(root);
  await assertStateDockerEndpoint(state);
  if (state.sessionId !== "01-04") {
    throw new Error("Live cold/warm capture разрешён только для session 01-04.");
  }
  try {
    if (!state.baselinePassed) {
      await collectAndSaveBaseline(root, state);
    }
    const alphaId = requireId(state.containers.alpha.id, "alpha");
    await appendEvent(root, state, {
      phase: "cold",
      kind: "expected",
      detail:
        "after exact target neighbour flush, ARP resolution precedes one ICMP Echo request/reply"
    });
    await flushTargetNeighbour(root, state, alphaId);
    await capturePhase(root, state, "cold");

    await appendEvent(root, state, {
      phase: "warm",
      kind: "expected",
      detail:
        "with target neighbour mapping retained, one ICMP Echo request/reply occurs without required ARP resolution"
    });
    await capturePhase(root, state, "warm");
    await appendEvent(root, state, {
      phase: "capture",
      kind: "observed",
      detail: "cold and warm bounded source-namespace bundles completed"
    });
    process.stdout.write(
      `PASS cold/warm capture\nrun=${state.runDirectory}\nphases=cold,warm\n`
    );
  } catch (error) {
    await recordError(root, state, "capture", error);
    await downLab(root).catch((cleanupError) => {
      process.stderr.write(
        `Cleanup after capture failure also failed: ${formatError(cleanupError)}\n`
      );
    });
    throw error;
  }
}

export async function shellLab(
  root: string,
  endpoint: "src" | "dst" | "alpha" | "beta"
): Promise<void> {
  const state = await readState(root);
  await assertStateDockerEndpoint(state);
  const isSource = endpoint === "src" || endpoint === "alpha";
  const containerId = requireId(
    isSource ? state.containers.alpha.id : state.containers.beta.id,
    isSource ? "alpha" : "beta"
  );
  process.stderr.write(
    `Isolated shell: ${isSource ? "alpha/src" : "beta/dst"} namespace; no external route, ports, mounts or added capabilities.\n`
  );
  await runCommand(
    "docker",
    ["container", "exec", "-it", containerId, "sh"],
    { stdin: "inherit", stdout: "inherit" }
  );
}

export async function downLab(root: string): Promise<void> {
  const state = await readStateIfPresent(root);
  if (!state) {
    process.stdout.write("PASS down: active lab state отсутствует.\n");
    return;
  }
  await assertStateDockerEndpoint(state);
  await appendEvent(root, state, {
    phase: "cleanup",
    kind: "cleanup",
    detail: "remove only state-recorded resources after label verification"
  });
  const failures: string[] = [];
  const containers = getReservedContainerCleanupOrder(state);
  for (const reservation of containers) {
    try {
      await removeExactContainer(state, reservation);
    } catch (error) {
      failures.push(formatError(error));
    }
  }
  for (const reservation of state.volumes) {
    try {
      await removeExactVolume(state, reservation);
    } catch (error) {
      failures.push(formatError(error));
    }
  }
  try {
    await removeExactNetwork(state, state.network);
  } catch (error) {
    failures.push(formatError(error));
  }
  if (failures.length > 0) {
    await appendEvent(root, state, {
      phase: "cleanup",
      kind: "error",
      detail: `exact cleanup incomplete: ${failures.join(" | ")}`
    });
    throw new Error(failures.join("\n"));
  }

  const reconciliation = await reconcileReservedResources(state);
  await assertStateDockerEndpoint(state);
  const resources = await labelledResources();
  const postCheck = [
    `checked_at=${new Date().toISOString()}`,
    `run=${state.runDirectory}`,
    `owner_label=${LAB_LABEL_KEY}=${LAB_OWNER_LABEL}`,
    "method=docker container/network/volume ls filtered by exact course owner label",
    "exact_state_containers=0",
    "exact_state_networks=0",
    "exact_state_volumes=0",
    `reconciliation_quiet_ms=${CLEANUP_QUIET_PERIOD_MS}`,
    `reconciliation_observations=${reconciliation.observations}`,
    `reconciliation_removals=${reconciliation.removals}`,
    `labelled_containers=${resources.containerRows.length}`,
    `labelled_networks=${resources.networkRows.length}`,
    `labelled_volumes=${resources.volumeRows.length}`
  ].join("\n") + "\n";
  if (!isLabelledPostCheckClean(resources)) {
    await writeRunArtifact(
      root,
      state,
      `post-check-failed-${state.sequence}.txt`,
      postCheck
    );
    await appendEvent(root, state, {
      phase: "post-check",
      kind: "error",
      detail:
        `labelled resources remain: containers=${resources.containerRows.length} networks=${resources.networkRows.length} volumes=${resources.volumeRows.length}; active state retained`
    });
    throw new Error(
      "Post-check found course-labelled resources; active state retained and PASS not reported."
    );
  }
  await writeRunArtifact(root, state, "post-check.txt", postCheck).catch(
    async (error) => {
      if (!String(error).includes("EEXIST")) throw error;
    }
  );
  await appendEvent(root, state, {
    phase: "post-check",
    kind: "observed",
    detail: "exact state and course-labelled Docker resource counts are zero"
  });
  await removeState(root);
  process.stdout.write(`PASS down\n${postCheck}`);
}

export function isLabelledPostCheckClean(resources: {
  containerRows: readonly string[];
  networkRows: readonly string[];
  volumeRows: readonly string[];
}): boolean {
  return (
    resources.containerRows.length === 0 &&
    resources.networkRows.length === 0 &&
    resources.volumeRows.length === 0
  );
}

export function validateLiveCapture(
  phase: "cold" | "warm",
  normalizedTsv: string,
  neighbourBefore: string
): string[] {
  const rows = parseTsv(normalizedTsv);
  const problems: string[] = [];
  if (rows.length === 0) {
    return ["capture не содержит decoded frames"];
  }
  if (rows.length > CAPTURE_LIMITS.framesPerPhase) {
    problems.push(
      `frame count ${rows.length} превышает limit ${CAPTURE_LIMITS.framesPerPhase}`
    );
  }

  const arpRequest = findRow(
    rows,
    (row) =>
      row["arp.opcode"] === "1" &&
      row["arp.src.proto_ipv4"] === LAB_ENDPOINTS.alpha.ipv4 &&
      row["arp.dst.proto_ipv4"] === LAB_ENDPOINTS.beta.ipv4
  );
  const arpReply = findRow(
    rows,
    (row) =>
      row["arp.opcode"] === "2" &&
      row["arp.src.proto_ipv4"] === LAB_ENDPOINTS.beta.ipv4 &&
      row["arp.dst.proto_ipv4"] === LAB_ENDPOINTS.alpha.ipv4
  );
  const echoRequest = findRow(
    rows,
    (row) =>
      row["ip.src"] === LAB_ENDPOINTS.alpha.ipv4 &&
      row["ip.dst"] === LAB_ENDPOINTS.beta.ipv4 &&
      row["icmp.type"] === "8" &&
      row["icmp.code"] === "0"
  );
  const echoReply = findRow(
    rows,
    (row) =>
      row["ip.src"] === LAB_ENDPOINTS.beta.ipv4 &&
      row["ip.dst"] === LAB_ENDPOINTS.alpha.ipv4 &&
      row["icmp.type"] === "0" &&
      row["icmp.code"] === "0"
  );

  if (phase === "cold") {
    if (arpRequest < 0) problems.push("нет ARP request к beta IPv4");
    if (arpReply < 0) problems.push("нет matching ARP reply от beta");
    if (arpRequest >= 0) {
      const request = rows[arpRequest];
      if (
        request?.["eth.src"]?.toLowerCase() !== LAB_ENDPOINTS.alpha.mac ||
        request?.["eth.dst"]?.toLowerCase() !== "ff:ff:ff:ff:ff:ff" ||
        request?.["arp.src.hw_mac"]?.toLowerCase() !== LAB_ENDPOINTS.alpha.mac
      ) {
        problems.push("ARP request не содержит expected alpha/broadcast MAC fields");
      }
    }
    if (arpReply >= 0) {
      const reply = rows[arpReply];
      if (
        reply?.["eth.src"]?.toLowerCase() !== LAB_ENDPOINTS.beta.mac ||
        reply?.["eth.dst"]?.toLowerCase() !== LAB_ENDPOINTS.alpha.mac ||
        reply?.["arp.src.hw_mac"]?.toLowerCase() !== LAB_ENDPOINTS.beta.mac ||
        reply?.["arp.dst.hw_mac"]?.toLowerCase() !== LAB_ENDPOINTS.alpha.mac
      ) {
        problems.push("ARP reply не рекламирует expected beta-to-alpha MAC mapping");
      }
    }
    if (arpRequest >= 0 && arpReply >= 0 && !(arpRequest < arpReply)) {
      problems.push("ARP reply не следует после ARP request");
    }
    if (arpReply >= 0 && echoRequest >= 0 && !(arpReply < echoRequest)) {
      problems.push("ICMP request наблюдался раньше matching ARP reply");
    }
  } else {
    const before = neighbourBefore.toLowerCase();
    if (
      !before.includes(LAB_ENDPOINTS.beta.ipv4) ||
      !before.includes(LAB_ENDPOINTS.beta.mac)
    ) {
      problems.push("neighbor-before не содержит expected beta IPv4-to-MAC mapping");
    }
    const firstTargetArp = rows.findIndex(
      (row) =>
        row["arp.src.proto_ipv4"] === LAB_ENDPOINTS.beta.ipv4 ||
        row["arp.dst.proto_ipv4"] === LAB_ENDPOINTS.beta.ipv4
    );
    if (firstTargetArp >= 0 && echoRequest >= 0 && firstTargetArp < echoRequest) {
      problems.push("warm ICMP request потребовал предшествующий ARP exchange");
    }
  }

  if (echoRequest < 0) problems.push("нет ICMP Echo Request alpha -> beta");
  if (echoReply < 0) problems.push("нет ICMP Echo Reply beta -> alpha");
  if (echoRequest >= 0) {
    const request = rows[echoRequest];
    if (
      request?.["eth.src"]?.toLowerCase() !== LAB_ENDPOINTS.alpha.mac ||
      request?.["eth.dst"]?.toLowerCase() !== LAB_ENDPOINTS.beta.mac
    ) {
      problems.push("ICMP Echo Request имеет unexpected Ethernet direction");
    }
  }
  if (echoReply >= 0) {
    const reply = rows[echoReply];
    if (
      reply?.["eth.src"]?.toLowerCase() !== LAB_ENDPOINTS.beta.mac ||
      reply?.["eth.dst"]?.toLowerCase() !== LAB_ENDPOINTS.alpha.mac
    ) {
      problems.push("ICMP Echo Reply имеет unexpected Ethernet direction");
    }
  }
  if (echoRequest >= 0 && echoReply >= 0 && !(echoRequest < echoReply)) {
    problems.push("ICMP Echo Reply не следует после request");
  }
  if (echoRequest >= 0 && echoReply >= 0) {
    const request = rows[echoRequest];
    const reply = rows[echoReply];
    const requestId = request?.["icmp.ident"] ?? "";
    const requestSequence = request?.["icmp.seq"] ?? "";
    const replyId = reply?.["icmp.ident"] ?? "";
    const replySequence = reply?.["icmp.seq"] ?? "";
    if (!requestId || !requestSequence || !replyId || !replySequence) {
      problems.push("ICMP pair не содержит identifier/sequence evidence");
    } else if (requestId !== replyId || requestSequence !== replySequence) {
      problems.push("ICMP Echo Reply не совпадает с request по identifier/sequence");
    }
  }
  return problems;
}

function parseTsv(source: string): Record<string, string>[] {
  const lines = source.trim().split(/\r?\n/);
  const header = lines.shift()?.split("\t") ?? [];
  if (header.length === 0) return [];
  return lines
    .filter((line) => line.length > 0)
    .map((line) => {
      const values = line.split("\t");
      return Object.fromEntries(
        header.map((key, index) => [key, values[index] ?? ""])
      );
    });
}

export function hasRequiredLinkFlags(link: string): boolean {
  const flags = link.match(/<([^>]+)>/)?.[1]?.split(",") ?? [];
  return flags.includes("UP") && flags.includes("LOWER_UP");
}

function findRow(
  rows: readonly Record<string, string>[],
  predicate: (row: Record<string, string>) => boolean
): number {
  return rows.findIndex(predicate);
}

export async function statusLab(root: string): Promise<void> {
  const activeState = await readStateIfPresent(root);
  if (activeState) {
    await assertStateDockerEndpoint(activeState);
  } else {
    await requireLocalDockerEndpoint();
  }
  const resources = await labelledResources();
  process.stdout.write(
    [
      `containers: ${resources.containerRows.length}`,
      ...resources.containerRows,
      `networks: ${resources.networkRows.length}`,
      ...resources.networkRows,
      `volumes: ${resources.volumeRows.length}`,
      ...resources.volumeRows
    ].join("\n") + "\n"
  );
}

async function assertStateDockerEndpoint(state: LabState): Promise<void> {
  await requireMatchingDockerEndpoint(state.dockerEndpoint);
}

async function createEndpoint(
  root: string,
  state: LabState,
  reservation: DockerResourceReservation,
  ipv4: string,
  mac: string
): Promise<void> {
  await assertStateDockerEndpoint(state);
  const networkId = requireId(state.network.id, "network");
  const created = await runCommand(
    "docker",
    [
      "container",
      "create",
      "--pull",
      "never",
      "--name",
      reservation.name,
      "--label",
      `${LAB_LABEL_KEY}=${LAB_OWNER_LABEL}`,
      "--label",
      `${LAB_RUN_LABEL_KEY}=${state.runId}`,
      "--label",
      `${LAB_ROLE_LABEL_KEY}=${reservation.role}`,
      "--network",
      networkId,
      "--ip",
      ipv4,
      "--mac-address",
      mac,
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges=true",
      "--read-only",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,nodev,size=16m",
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
  const id = created.stdout.trim();
  assertDockerId(id);
  reservation.id = id;
  await saveState(root, state);
}

async function collectAndSaveBaseline(
  root: string,
  state: LabState
): Promise<void> {
  if (state.baselinePassed) {
    throw new Error("Baseline уже сохранён для этого unique run.");
  }
  await appendEvent(root, state, {
    phase: "baseline",
    kind: "expected",
    detail:
      "both fixed endpoints are running with eth0 UP, exact IPv4/MAC, no default route or global IPv6"
  });
  const networkId = requireId(state.network.id, "network");
  const alphaId = requireId(state.containers.alpha.id, "alpha");
  const betaId = requireId(state.containers.beta.id, "beta");
  const network = (
    JSON.parse(
      (
        await runCommand("docker", ["network", "inspect", networkId], {
          timeoutMs: 10_000
        })
      ).stdout
    ) as DockerNetworkInspect[]
  )[0];
  if (!network) throw new Error("Network inspect пуст.");
  validateNetwork(network, state, alphaId, betaId);

  const endpointInspects = JSON.parse(
    (
      await runCommand(
        "docker",
        ["container", "inspect", alphaId, betaId],
        { timeoutMs: 10_000 }
      )
    ).stdout
  ) as DockerContainerInspect[];
  const alphaInspect = endpointInspects.find((item) => item.Id === alphaId);
  const betaInspect = endpointInspects.find((item) => item.Id === betaId);
  if (!alphaInspect || !betaInspect) {
    throw new Error("Endpoint inspect не вернул exact IDs.");
  }
  validateEndpoint(
    alphaInspect,
    state,
    "cn-alpha",
    LAB_ENDPOINTS.alpha.ipv4,
    LAB_ENDPOINTS.alpha.mac
  );
  validateEndpoint(
    betaInspect,
    state,
    "cn-beta",
    LAB_ENDPOINTS.beta.ipv4,
    LAB_ENDPOINTS.beta.mac
  );

  const alpha = await endpointLinuxBaseline(alphaId);
  const beta = await endpointLinuxBaseline(betaId);
  if (
    !hasRequiredLinkFlags(alpha.link) ||
    !alpha.link.toLowerCase().includes(LAB_ENDPOINTS.alpha.mac) ||
    !alpha.ipv4.includes(`${LAB_ENDPOINTS.alpha.ipv4}/24`) ||
    alpha.defaultRoute !== "" ||
    alpha.globalIpv6 !== ""
  ) {
    throw new Error("alpha Linux baseline не совпал с fixed IPv4-only inventory.");
  }
  if (
    !hasRequiredLinkFlags(beta.link) ||
    !beta.link.toLowerCase().includes(LAB_ENDPOINTS.beta.mac) ||
    !beta.ipv4.includes(`${LAB_ENDPOINTS.beta.ipv4}/24`) ||
    beta.defaultRoute !== "" ||
    beta.globalIpv6 !== ""
  ) {
    throw new Error("beta Linux baseline не совпал с fixed IPv4-only inventory.");
  }
  const echoIgnore = await runCommand(
    "docker",
    [
      "container",
      "exec",
      betaId,
      "sysctl",
      "-n",
      "net.ipv4.icmp_echo_ignore_all"
    ],
    { timeoutMs: 10_000 }
  );
  if (echoIgnore.stdout !== "0") {
    throw new Error("beta kernel настроен игнорировать ICMP Echo.");
  }

  await writeRunArtifact(
    root,
    state,
    "topology-inspect.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        observedAt: new Date().toISOString(),
        run: state.runDirectory,
        network: {
          id: network.Id,
          name: network.Name,
          driver: network.Driver,
          internal: network.Internal,
          enableIpv6: network.EnableIPv6,
          subnet: network.IPAM?.Config?.[0]?.Subnet ?? null,
          gatewayModeIpv4:
            network.Options?.[LAB_NETWORK.gatewayModeOption] ?? null,
          runLabel: network.Labels?.[LAB_RUN_LABEL_KEY] ?? null
        },
        endpoints: {
          alpha: normalizedEndpointInspect(alphaInspect),
          beta: normalizedEndpointInspect(betaInspect)
        }
      },
      null,
      2
    ) + "\n"
  );

  const text = [
    `observed_at=${new Date().toISOString()}`,
    `run=${state.runDirectory}`,
    `network_id=${networkId}`,
    "network_driver=bridge",
    "network_internal=true",
    "network_ipv6=false",
    `gateway_mode_ipv4=${LAB_NETWORK.gatewayMode}`,
    "",
    "[alpha ip -br link show dev eth0]",
    alpha.link,
    "[alpha ip -4 -o addr show dev eth0]",
    alpha.ipv4,
    "[alpha ip -4 route show]",
    alpha.routes || "(none)",
    "[alpha ip -4 route show default]",
    alpha.defaultRoute || "(none)",
    "[alpha ip -6 -o addr show scope global]",
    alpha.globalIpv6 || "(none)",
    "",
    "[beta ip -br link show dev eth0]",
    beta.link,
    "[beta ip -4 -o addr show dev eth0]",
    beta.ipv4,
    "[beta ip -4 route show]",
    beta.routes || "(none)",
    "[beta ip -4 route show default]",
    beta.defaultRoute || "(none)",
    "[beta ip -6 -o addr show scope global]",
    beta.globalIpv6 || "(none)",
    "[beta sysctl -n net.ipv4.icmp_echo_ignore_all]",
    echoIgnore.stdout
  ].join("\n") + "\n";
  await writeRunArtifact(root, state, "baseline.txt", text);
  state.baselinePassed = true;
  await saveState(root, state);
  await appendEvent(root, state, {
    phase: "baseline",
    kind: "observed",
    detail:
      "fixed interfaces, IPv4/MAC, internal isolated network, capability and exposure invariants passed"
  });
}

async function endpointLinuxBaseline(containerId: string): Promise<{
  link: string;
  ipv4: string;
  routes: string;
  defaultRoute: string;
  globalIpv6: string;
}> {
  const exec = async (args: string[]) =>
    (
      await runCommand(
        "docker",
        ["container", "exec", containerId, ...args],
        { timeoutMs: 10_000 }
      )
    ).stdout;
  return {
    link: await exec(["ip", "-br", "link", "show", "dev", "eth0"]),
    ipv4: await exec(["ip", "-4", "-o", "addr", "show", "dev", "eth0"]),
    routes: await exec(["ip", "-4", "route", "show"]),
    defaultRoute: await exec(["ip", "-4", "route", "show", "default"]),
    globalIpv6: await exec(["ip", "-6", "-o", "addr", "show", "scope", "global"])
  };
}

async function capturePhase(
  root: string,
  state: LabState,
  phase: "cold" | "warm"
): Promise<void> {
  const alphaId = requireId(state.containers.alpha.id, "alpha");
  const phaseDirectory = runPath(root, state, phase);
  const pcapPath = path.join(phaseDirectory, "capture.pcap");
  const before = await runCommand(
    "docker",
    [
      "container",
      "exec",
      alphaId,
      "ip",
      "-4",
      "neigh",
      "show",
      "to",
      LAB_ENDPOINTS.beta.ipv4,
      "dev",
      "eth0"
    ],
    { timeoutMs: 10_000 }
  );
  await writeRunArtifact(
    root,
    state,
    `${phase}/expected.txt`,
    [
      `recorded_at=${new Date().toISOString()}`,
      `phase=${phase}`,
      `source=${LAB_ENDPOINTS.alpha.ipv4}`,
      `target=${LAB_ENDPOINTS.beta.ipv4}`,
      "action=one bounded IPv4 ICMP Echo probe",
      `capture_duration_seconds=${CAPTURE_LIMITS.durationSeconds}`,
      `capture_frame_limit=${CAPTURE_LIMITS.framesPerPhase}`,
      "capture_point=source network namespace eth0"
    ].join("\n") + "\n"
  );
  await writeRunArtifact(
    root,
    state,
    `${phase}/neighbor-before.txt`,
    before.stdout + "\n"
  );

  const captureVolume = await createCaptureVolume(root, state, phase);
  const captureId = await createHelper(
    root,
    state,
    `capture-${phase}`,
    ["NET_RAW"],
    [
      "sh",
      "-c",
      'tshark "$@"; status=$?; printf "%s\\n" "$status" > /tmp/capture.exit; exec sleep infinity',
      "capture",
      "-q",
      "-n",
      "-p",
      "-i",
      "eth0",
      "-f",
      BETA_ARP_OR_ICMP_FILTER,
      "-c",
      String(CAPTURE_LIMITS.framesPerPhase),
      "-a",
      `duration:${CAPTURE_LIMITS.durationSeconds}`,
      "-a",
      "filesize:1024",
      "-F",
      "pcap",
      "-w",
      CAPTURE_CONTAINER_PATH
    ],
    `container:${alphaId}`,
    [{ source: captureVolume, target: "/evidence" }]
  );
  await runCommand("docker", ["container", "start", captureId], {
    timeoutMs: 10_000
  });
  await waitForCaptureReady(captureId);

  await appendEvent(root, state, {
    phase,
    kind: "action",
    detail:
      "capture ready in alpha namespace; start exactly one bounded Echo probe to 172.30.0.20"
  });
  const probeId = await createHelper(
    root,
    state,
    `probe-${phase}`,
    ["NET_RAW"],
    [
      "ping",
      "-4",
      "-n",
      "-c",
      String(CAPTURE_LIMITS.pingCount),
      "-W",
      String(CAPTURE_LIMITS.pingWaitSeconds),
      "-s",
      "32",
      "-I",
      LAB_ENDPOINTS.alpha.ipv4,
      LAB_ENDPOINTS.beta.ipv4
    ],
    `container:${alphaId}`
  );
  await runCommand("docker", ["container", "start", probeId], {
    timeoutMs: 10_000
  });
  await waitContainerSuccess(probeId, 8_000);
  const ping = await runCommand(
    "docker",
    ["container", "logs", probeId],
    { timeoutMs: 10_000 }
  );
  await writeRunArtifact(
    root,
    state,
    `${phase}/probe.txt`,
    ping.stdout + "\n"
  );

  await waitForCaptureFinished(
    captureId,
    (CAPTURE_LIMITS.durationSeconds + 5) * 1000
  );
  await runCommand(
    "docker",
    ["container", "cp", `${captureId}:${CAPTURE_CONTAINER_PATH}`, pcapPath],
    { timeoutMs: 10_000 }
  );
  const pcapStat = await stat(pcapPath);
  if (pcapStat.size <= 24 || pcapStat.size > CAPTURE_LIMITS.maxBytes) {
    throw new Error(
      `${phase} capture size ${pcapStat.size} нарушает bounds.`
    );
  }
  const pcap = await readFile(pcapPath);
  const hash = createHash("sha256").update(pcap).digest("hex");
  await writeRunArtifact(
    root,
    state,
    `${phase}/capture.sha256.txt`,
    `${hash}  capture.pcap\n`
  );
  const normalized = await analyzeLivePcap(captureId);
  await writeRunArtifact(
    root,
    state,
    `${phase}/events.tsv`,
    normalized + "\n"
  );
  const semanticProblems = validateLiveCapture(
    phase,
    normalized,
    before.stdout
  );
  if (semanticProblems.length > 0) {
    throw new Error(
      `${phase} capture не доказал целевую sequence:\n- ${semanticProblems.join("\n- ")}`
    );
  }
  const after = await runCommand(
    "docker",
    [
      "container",
      "exec",
      alphaId,
      "ip",
      "-4",
      "neigh",
      "show",
      "to",
      LAB_ENDPOINTS.beta.ipv4,
      "dev",
      "eth0"
    ],
    { timeoutMs: 10_000 }
  );
  await writeRunArtifact(
    root,
    state,
    `${phase}/neighbor-after.txt`,
    after.stdout + "\n"
  );
  await writeRunArtifact(
    root,
    state,
    `${phase}/provenance.json`,
    JSON.stringify(
      {
        schemaVersion: 1,
        phase,
        syntheticTopology: true,
        capturePoint: "alpha network namespace eth0",
        filter: BETA_ARP_OR_ICMP_FILTER,
        target: LAB_ENDPOINTS.beta.ipv4,
        durationSeconds: CAPTURE_LIMITS.durationSeconds,
        frameLimit: CAPTURE_LIMITS.framesPerPhase,
        maxBytes: CAPTURE_LIMITS.maxBytes,
        pcapFormat: "classic pcap",
        sha256: hash,
        variableFields: [
          "absolute timestamps",
          "IP identifier",
          "ICMP identifier",
          "checksums"
        ]
      },
      null,
      2
    ) + "\n"
  );
  await removeAndForgetHelpers(root, state, [probeId, captureId]);
  await removeAndForgetVolume(root, state, captureVolume);
}

async function flushTargetNeighbour(
  root: string,
  state: LabState,
  alphaId: string
): Promise<void> {
  const helperId = await createHelper(
    root,
    state,
    "neigh-flush",
    ["NET_ADMIN"],
    [
      "ip",
      "-4",
      "neigh",
      "flush",
      "to",
      LAB_ENDPOINTS.beta.ipv4,
      "dev",
      "eth0"
    ],
    `container:${alphaId}`
  );
  try {
    await runCommand("docker", ["container", "start", helperId], {
      timeoutMs: 10_000
    });
    await waitContainerSuccess(helperId, 8_000);
  } finally {
    await removeAndForgetHelpers(root, state, [helperId]);
  }
}

async function createHelper(
  root: string,
  state: LabState,
  role: string,
  capabilities: string[],
  command: string[],
  networkMode: string,
  mounts: HelperVolumeMount[] = []
): Promise<string> {
  const name = `cn-${role}-${state.runId.slice(-8)}`;
  if (
    state.containers.helpers.some(
      (reservation) => reservation.name === name
    )
  ) {
    throw new Error(`Helper reservation ${name} уже существует в active state.`);
  }
  const reservation: DockerResourceReservation = { name, role, id: null };
  state.containers.helpers.push(reservation);
  await saveState(root, state);
  await assertStateDockerEndpoint(state);
  const args = [
    "container",
    "create",
    "--pull",
    "never",
    "--name",
    name,
    "--label",
    `${LAB_LABEL_KEY}=${LAB_OWNER_LABEL}`,
    "--label",
    `${LAB_RUN_LABEL_KEY}=${state.runId}`,
    "--label",
    `${LAB_ROLE_LABEL_KEY}=${role}`,
    "--network",
    networkMode,
    "--cap-drop",
    "ALL"
  ];
  for (const capability of capabilities) {
    args.push("--cap-add", capability);
  }
  for (const mount of mounts) {
    args.push(
      "--mount",
      `type=volume,source=${mount.source},target=${mount.target},volume-nocopy`
    );
  }
  args.push(
    "--security-opt",
    "no-new-privileges=true",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,nodev,size=16m",
    "--pids-limit",
    "64",
    "--memory",
    "128m",
    "--cpus",
    "0.5",
    LAB_IMAGE,
    ...command
  );
  const created = await runCommand("docker", args, { timeoutMs: 15_000 });
  const id = created.stdout.trim();
  assertDockerId(id);
  reservation.id = id;
  await saveState(root, state);
  const safety = await inspectAndValidateHelper(
    state,
    reservation,
    capabilities,
    command,
    networkMode,
    mounts
  );
  await writeRunArtifact(
    root,
    state,
    `helpers/${role}.json`,
    JSON.stringify(safety, null, 2) + "\n"
  );
  return id;
}

async function inspectAndValidateHelper(
  state: LabState,
  reservation: DockerResourceReservation,
  capabilities: string[],
  command: string[],
  networkMode: string,
  expectedMounts: HelperVolumeMount[]
): Promise<object> {
  const id = requireId(reservation.id, reservation.role);
  const inspected = JSON.parse(
    (
      await runCommand("docker", ["container", "inspect", id], {
        timeoutMs: 10_000
      })
    ).stdout
  ) as DockerContainerInspect[];
  const container = inspected[0];
  if (!container) {
    throw new Error(`Helper ${reservation.name} inspect не вернул object.`);
  }
  const labels = container.Config.Labels ?? {};
  const mounts = container.Mounts ?? [];
  const exactMounts =
    mounts.length === expectedMounts.length &&
    expectedMounts.every((expected) =>
      mounts.some(
        (observed) =>
          observed.Type === "volume" &&
          observed.Name === expected.source &&
          observed.Destination === expected.target &&
          observed.RW === true
      )
    );
  if (
    container.Id !== id ||
    container.Name !== `/${reservation.name}` ||
    container.Config.Image !== LAB_IMAGE ||
    !sameStringArray(container.Config.Cmd ?? [], command) ||
    labels[LAB_LABEL_KEY] !== LAB_OWNER_LABEL ||
    labels[LAB_RUN_LABEL_KEY] !== state.runId ||
    labels[LAB_ROLE_LABEL_KEY] !== reservation.role ||
    container.State.Running !== false ||
    container.HostConfig.NetworkMode !== networkMode ||
    !hasExactLiveContainerGuardrails(container, capabilities) ||
    !exactMounts
  ) {
    throw new Error(
      `Helper ${reservation.name} не подтвердил exact identity/network/capability/resource/mount contract: ${JSON.stringify(
        {
          id: container.Id,
          name: container.Name,
          image: container.Config.Image,
          command: container.Config.Cmd,
          labels,
          running: container.State.Running,
          networkMode: container.HostConfig.NetworkMode,
          safety: normalizedContainerSafety(container),
          mounts
        }
      )}`
    );
  }
  return {
    schemaVersion: 1,
    observedAt: new Date().toISOString(),
    id: container.Id,
    name: container.Name.replace(/^\//, ""),
    role: reservation.role,
    image: container.Config.Image ?? null,
    ownerLabel: labels[LAB_LABEL_KEY] ?? null,
    runLabel: labels[LAB_RUN_LABEL_KEY] ?? null,
    networkMode: container.HostConfig.NetworkMode ?? null,
    ...normalizedContainerSafety(container),
    command: container.Config.Cmd ?? [],
    mounts: mounts.map((mount) => ({
      type: mount.Type ?? null,
      name: mount.Name ?? null,
      destination: mount.Destination ?? null,
      writable: mount.RW === true
    }))
  };
}

async function analyzeLivePcap(captureId: string): Promise<string> {
  const result = await runCommand(
    "docker",
    [
      "container",
      "exec",
      captureId,
      "tshark",
      "-n",
      "-r",
      CAPTURE_CONTAINER_PATH,
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
      "frame.time_relative",
      "-e",
      "frame.len",
      "-e",
      "eth.src",
      "-e",
      "eth.dst",
      "-e",
      "eth.type",
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
  return result.stdout;
}

async function waitForCaptureReady(containerId: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await tryCommand(
      "docker",
      [
        "container",
        "exec",
        containerId,
        "test",
        "-s",
        CAPTURE_CONTAINER_PATH
      ],
      { timeoutMs: 2_000 }
    );
    if (result.exitCode === 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Capture helper не подтвердил ready marker за 5 seconds.");
}

async function waitForCaptureFinished(
  containerId: string,
  timeoutMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await tryCommand(
      "docker",
      ["container", "exec", containerId, "test", "-s", "/tmp/capture.exit"],
      { timeoutMs: 2_000 }
    );
    if (ready.exitCode === 0) {
      const status = await runCommand(
        "docker",
        ["container", "exec", containerId, "cat", "/tmp/capture.exit"],
        { timeoutMs: 2_000 }
      );
      if (status.stdout.trim() !== "0") {
        const logs = await tryCommand(
          "docker",
          ["container", "logs", containerId],
          { timeoutMs: 2_000 }
        );
        throw new Error(
          `Capture helper завершил TShark с code ${status.stdout.trim()}: ${logs.stderr || logs.stdout}`
        );
      }
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Capture helper не завершил bounded TShark за timeout.");
}

async function waitContainerSuccess(
  containerId: string,
  timeoutMs: number
): Promise<void> {
  const waited = await runCommand(
    "docker",
    ["container", "wait", containerId],
    { timeoutMs }
  );
  if (waited.stdout.trim() !== "0") {
    const logs = await tryCommand(
      "docker",
      ["container", "logs", containerId],
      { timeoutMs: 5_000 }
    );
    throw new Error(
      `Helper ${containerId} exit=${waited.stdout.trim()}: ${logs.stderr || logs.stdout}`
    );
  }
}

async function removeAndForgetHelpers(
  root: string,
  state: LabState,
  ids: string[]
): Promise<void> {
  for (const id of ids) {
    const reservation = state.containers.helpers.find(
      (candidate) => candidate.id === id
    );
    if (!reservation) {
      throw new Error(`Helper ${id} отсутствует в persisted reservations.`);
    }
    await removeExactContainer(state, reservation);
    state.containers.helpers = state.containers.helpers.filter(
      (candidate) => candidate !== reservation
    );
    await saveState(root, state);
  }
}

async function createCaptureVolume(
  root: string,
  state: LabState,
  phase: "cold" | "warm"
): Promise<string> {
  const name = `cn-capture-${phase}-${state.runId.slice(-8)}`;
  assertCaptureVolumeName(name);
  if (state.volumes.some((reservation) => reservation.name === name)) {
    throw new Error(`Capture volume ${name} уже записан в active state.`);
  }

  // Reserve the exact target before Docker mutates state. If creation partially
  // succeeds and the command fails, the outer cleanup still knows what to inspect.
  const reservation: DockerNamedResourceReservation = {
    name,
    role: "capture-data"
  };
  state.volumes.push(reservation);
  await saveState(root, state);
  await assertStateDockerEndpoint(state);
  if ((await inspectCaptureVolume(name)) !== null) {
    throw new Error(
      `Exact capture volume name ${name} уже занят; existing volume не изменён.`
    );
  }
  const created = await runCommand(
    "docker",
    [
      "volume",
      "create",
      "--label",
      `${LAB_LABEL_KEY}=${LAB_OWNER_LABEL}`,
      "--label",
      `${LAB_RUN_LABEL_KEY}=${state.runId}`,
      "--label",
      `${LAB_ROLE_LABEL_KEY}=${reservation.role}`,
      name
    ],
    { timeoutMs: 10_000 }
  );
  if (created.stdout.trim() !== name) {
    throw new Error(
      `Docker volume create вернул unexpected name: ${created.stdout.trim()}`
    );
  }
  const labels = await inspectCaptureVolume(name, true);
  if (
    labels?.name !== reservation.name ||
    labels?.owner !== LAB_OWNER_LABEL ||
    labels.run !== state.runId ||
    labels.role !== reservation.role
  ) {
    throw new Error(`Capture volume ${name} не подтвердил exact labels.`);
  }
  return name;
}

async function removeAndForgetVolume(
  root: string,
  state: LabState,
  name: string
): Promise<void> {
  const reservation = state.volumes.find(
    (candidate) => candidate.name === name
  );
  if (!reservation) {
    throw new Error(`Capture volume ${name} отсутствует в persisted reservations.`);
  }
  await removeExactVolume(state, reservation);
  state.volumes = state.volumes.filter(
    (candidate) => candidate !== reservation
  );
  await saveState(root, state);
}

async function removeExactContainer(
  state: LabState,
  reservation: DockerResourceReservation
): Promise<boolean> {
  const inspected = await tryCommand(
    "docker",
    [
      "container",
      "inspect",
      reservation.name,
      "--format",
      `{{.Id}}|{{.Name}}|{{index .Config.Labels "${LAB_LABEL_KEY}"}}|{{index .Config.Labels "${LAB_ROLE_LABEL_KEY}"}}|{{index .Config.Labels "${LAB_RUN_LABEL_KEY}"}}`
    ],
    { timeoutMs: 10_000, log: false }
  );
  if (inspected.exitCode !== 0) {
    if (isNoSuchDockerObject(inspected, "container")) return false;
    throw new Error(
      `Container ${reservation.name} inspect failed: ${inspected.stderr || inspected.stdout}`
    );
  }
  const [id, observedName, owner, role, run] = inspected.stdout
    .trim()
    .split("|");
  assertDockerId(id ?? "");
  if (
    observedName !== `/${reservation.name}` ||
    owner !== LAB_OWNER_LABEL ||
    role !== reservation.role ||
    run !== state.runId ||
    (reservation.id !== null && reservation.id !== id)
  ) {
    throw new Error(
      `Refuse cleanup: container ${reservation.name} не совпадает с persisted name/ID/owner/run/role identity.`
    );
  }
  await runCommand(
    "docker",
    ["container", "rm", "--volumes", "--force", id!],
    { timeoutMs: 15_000 }
  );
  const remaining = await tryCommand(
    "docker",
    ["container", "inspect", id!, "--format", "{{.Id}}"],
    { timeoutMs: 10_000, log: false }
  );
  if (
    remaining.exitCode === 0 ||
    !isNoSuchDockerObject(remaining, "container")
  ) {
    throw new Error(
      `Container ${id} absence post-check failed: ${remaining.stderr || remaining.stdout}`
    );
  }
  return true;
}

async function removeExactNetwork(
  state: LabState,
  reservation: DockerResourceReservation
): Promise<boolean> {
  const inspected = await tryCommand(
    "docker",
    [
      "network",
      "inspect",
      reservation.name,
      "--format",
      `{{.Id}}|{{.Name}}|{{index .Labels "${LAB_LABEL_KEY}"}}|{{index .Labels "${LAB_ROLE_LABEL_KEY}"}}|{{index .Labels "${LAB_RUN_LABEL_KEY}"}}`
    ],
    { timeoutMs: 10_000, log: false }
  );
  if (inspected.exitCode !== 0) {
    if (isNoSuchDockerObject(inspected, "network")) return false;
    throw new Error(
      `Network ${reservation.name} inspect failed: ${inspected.stderr || inspected.stdout}`
    );
  }
  const [id, observedName, owner, role, run] = inspected.stdout
    .trim()
    .split("|");
  assertDockerId(id ?? "");
  if (
    observedName !== reservation.name ||
    owner !== LAB_OWNER_LABEL ||
    role !== reservation.role ||
    run !== state.runId ||
    (reservation.id !== null && reservation.id !== id)
  ) {
    throw new Error(
      `Refuse cleanup: network ${reservation.name} не совпадает с persisted name/ID/owner/run/role identity.`
    );
  }
  await runCommand("docker", ["network", "rm", id!], {
    timeoutMs: 15_000
  });
  const remaining = await tryCommand(
    "docker",
    ["network", "inspect", id!, "--format", "{{.Id}}"],
    { timeoutMs: 10_000, log: false }
  );
  if (remaining.exitCode === 0 || !isNoSuchDockerObject(remaining, "network")) {
    throw new Error(
      `Network ${id} absence post-check failed: ${remaining.stderr || remaining.stdout}`
    );
  }
  return true;
}

async function removeExactVolume(
  state: LabState,
  reservation: DockerNamedResourceReservation
): Promise<boolean> {
  assertCaptureVolumeName(reservation.name);
  const labels = await inspectCaptureVolume(reservation.name);
  if (labels === null) return false;
  if (
    labels.name !== reservation.name ||
    labels.owner !== LAB_OWNER_LABEL ||
    labels.run !== state.runId ||
    labels.role !== reservation.role
  ) {
    throw new Error(
      `Refuse cleanup: volume ${reservation.name} не совпадает с persisted name/owner/run/role identity.`
    );
  }
  await runCommand("docker", ["volume", "rm", reservation.name], {
    timeoutMs: 15_000
  });
  if ((await inspectCaptureVolume(reservation.name, false)) !== null) {
    throw new Error(
      `Volume ${reservation.name} всё ещё существует после exact cleanup.`
    );
  }
  return true;
}

async function reconcileReservedResources(state: LabState): Promise<{
  observations: number;
  removals: number;
}> {
  const containers = getReservedContainerCleanupOrder(state);
  return waitForCleanupQuiescence(
    async () => {
      let removals = 0;
      for (const reservation of containers) {
        if (await removeExactContainer(state, reservation)) removals += 1;
      }
      for (const reservation of state.volumes) {
        if (await removeExactVolume(state, reservation)) removals += 1;
      }
      if (await removeExactNetwork(state, state.network)) removals += 1;
      const labelled = await labelledResources(true);
      return { clean: isLabelledPostCheckClean(labelled), removals };
    },
    {
      quietPeriodMs: CLEANUP_QUIET_PERIOD_MS,
      timeoutMs: CLEANUP_RECONCILIATION_TIMEOUT_MS,
      pollIntervalMs: CLEANUP_POLL_INTERVAL_MS
    }
  );
}

async function inspectCaptureVolume(name: string, log = true): Promise<{
  name: string;
  owner: string;
  run: string;
  role: string;
} | null> {
  assertCaptureVolumeName(name);
  const inspected = await tryCommand(
    "docker",
    [
      "volume",
      "inspect",
      name,
      "--format",
      `{{.Name}}\t{{index .Labels "${LAB_LABEL_KEY}"}}\t{{index .Labels "${LAB_RUN_LABEL_KEY}"}}\t{{index .Labels "${LAB_ROLE_LABEL_KEY}"}}`
    ],
    { timeoutMs: 10_000, log }
  );
  if (inspected.exitCode !== 0) {
    if (/no such volume/i.test(`${inspected.stdout}\n${inspected.stderr}`)) {
      return null;
    }
    throw new Error(
      `Volume ${name} inspect failed: ${inspected.stderr || inspected.stdout}`
    );
  }
  const [observedName = "", owner = "", run = "", role = ""] = inspected.stdout
    .trim()
    .split("\t");
  return { name: observedName, owner, run, role };
}

function validateNetwork(
  network: DockerNetworkInspect,
  state: LabState,
  alphaId: string,
  betaId: string
): void {
  const containers = network.Containers ?? {};
  const alphaEndpoint = containers[alphaId];
  const betaEndpoint = containers[betaId];
  if (
    network.Id !== state.network.id ||
    network.Name !== state.network.name ||
    network.Driver !== "bridge" ||
    network.Internal !== true ||
    network.EnableIPv6 !== false ||
    network.Options?.[LAB_NETWORK.gatewayModeOption] !== LAB_NETWORK.gatewayMode ||
    network.IPAM?.Config?.[0]?.Subnet !== LAB_NETWORK.subnet ||
    network.Labels?.[LAB_RUN_LABEL_KEY] !== state.runId ||
    alphaEndpoint?.IPv4Address !== `${LAB_ENDPOINTS.alpha.ipv4}/24` ||
    alphaEndpoint.MacAddress?.toLowerCase() !== LAB_ENDPOINTS.alpha.mac ||
    betaEndpoint?.IPv4Address !== `${LAB_ENDPOINTS.beta.ipv4}/24` ||
    betaEndpoint.MacAddress?.toLowerCase() !== LAB_ENDPOINTS.beta.mac
  ) {
    throw new Error("Docker network baseline нарушает isolated fixed topology.");
  }
}

function validateEndpoint(
  inspect: DockerContainerInspect,
  state: LabState,
  expectedName: "cn-alpha" | "cn-beta",
  ipv4: string,
  mac: string
): void {
  const reservation =
    expectedName === "cn-alpha"
      ? state.containers.alpha
      : state.containers.beta;
  const networks = Object.values(inspect.NetworkSettings?.Networks ?? {});
  const endpoint = networks[0];
  if (
    inspect.Id !== reservation.id ||
    inspect.Name !== `/${expectedName}` ||
    inspect.Config.Image !== LAB_IMAGE ||
    inspect.Config.Labels?.[LAB_LABEL_KEY] !== LAB_OWNER_LABEL ||
    inspect.Config.Labels?.[LAB_RUN_LABEL_KEY] !== state.runId ||
    inspect.Config.Labels?.[LAB_ROLE_LABEL_KEY] !== reservation.role ||
    inspect.State.Running !== true ||
    !hasExactLiveContainerGuardrails(inspect, []) ||
    (inspect.Mounts ?? []).length !== 0 ||
    networks.length !== 1 ||
    endpoint?.IPAddress !== ipv4 ||
    endpoint.MacAddress?.toLowerCase() !== mac
  ) {
    throw new Error(
      `Endpoint ${inspect.Id} нарушает image/capability/exposure/inventory baseline.`
    );
  }
}

function normalizedEndpointInspect(inspect: DockerContainerInspect): object {
  const networks = Object.values(inspect.NetworkSettings?.Networks ?? {});
  const endpoint = networks[0];
  return {
    id: inspect.Id,
    name: inspect.Name.replace(/^\//, ""),
    image: inspect.Config.Image ?? null,
    ownerLabel: inspect.Config.Labels?.[LAB_LABEL_KEY] ?? null,
    runLabel: inspect.Config.Labels?.[LAB_RUN_LABEL_KEY] ?? null,
    roleLabel: inspect.Config.Labels?.[LAB_ROLE_LABEL_KEY] ?? null,
    running: inspect.State.Running === true,
    ...normalizedContainerSafety(inspect),
    networkMode: inspect.HostConfig.NetworkMode ?? null,
    mountCount: inspect.Mounts?.length ?? 0,
    ipv4: endpoint?.IPAddress ?? null,
    mac: endpoint?.MacAddress?.toLowerCase() ?? null
  };
}

function hasExactLiveContainerGuardrails(
  inspect: DockerContainerInspect,
  expectedCapAdd: string[]
): boolean {
  const host = inspect.HostConfig;
  const tmpfsOptions = (host.Tmpfs?.["/tmp"] ?? "")
    .split(",")
    .filter(Boolean);
  return (
    host.Privileged === false &&
    host.ReadonlyRootfs === true &&
    sameCapabilitySet(host.CapDrop ?? [], ["ALL"]) &&
    sameCapabilitySet(host.CapAdd ?? [], expectedCapAdd) &&
    (host.SecurityOpt ?? []).includes("no-new-privileges=true") &&
    sameStringSet(tmpfsOptions, [...LIVE_TMPFS_OPTIONS]) &&
    host.PidsLimit === 64 &&
    host.Memory === 128 * 1024 * 1024 &&
    host.NanoCpus === 500_000_000 &&
    Object.keys(host.PortBindings ?? {}).length === 0 &&
    Object.keys(inspect.NetworkSettings?.Ports ?? {}).length === 0
  );
}

function normalizedContainerSafety(inspect: DockerContainerInspect): object {
  return {
    privileged: inspect.HostConfig.Privileged === true,
    readonlyRootfs: inspect.HostConfig.ReadonlyRootfs === true,
    capDrop: inspect.HostConfig.CapDrop ?? [],
    capAdd: inspect.HostConfig.CapAdd ?? [],
    securityOptions: inspect.HostConfig.SecurityOpt ?? [],
    tmpfs: inspect.HostConfig.Tmpfs ?? {},
    pidsLimit: inspect.HostConfig.PidsLimit ?? null,
    memoryBytes: inspect.HostConfig.Memory ?? null,
    nanoCpus: inspect.HostConfig.NanoCpus ?? null,
    portBindingCount: Object.keys(inspect.HostConfig.PortBindings ?? {}).length,
    exposedPortCount: Object.keys(inspect.NetworkSettings?.Ports ?? {}).length
  };
}

function sameStringArray(actual: string[], expected: string[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function sameStringSet(actual: string[], expected: string[]): boolean {
  return (
    actual.length === expected.length &&
    expected.every((value) => actual.includes(value))
  );
}

function sameCapabilitySet(actual: string[], expected: string[]): boolean {
  return sameStringSet(
    actual.map(normalizeCapability),
    expected.map(normalizeCapability)
  );
}

function normalizeCapability(value: string): string {
  return value.toUpperCase().replace(/^CAP_/, "");
}

async function inspectNetworkSubnets(): Promise<{
  inspectedCount: number;
  targetSubnet: string;
  conflictCount: number;
  conflicts: Array<{ id: string; name: string; subnet: string }>;
}> {
  const listed = await runCommand(
    "docker",
    ["network", "ls", "--format", "{{.ID}}"],
    { timeoutMs: 10_000 }
  );
  const ids = nonemptyLines(listed.stdout);
  if (ids.some((id) => !/^[a-f0-9]{12,64}$/.test(id))) {
    throw new Error("Docker network inventory содержит unexpected ID.");
  }
  if (ids.length === 0) {
    return {
      inspectedCount: 0,
      targetSubnet: LAB_NETWORK.subnet,
      conflictCount: 0,
      conflicts: []
    };
  }
  const inspected = JSON.parse(
    (
      await runCommand("docker", ["network", "inspect", ...ids], {
        timeoutMs: 15_000
      })
    ).stdout
  ) as DockerNetworkInspect[];
  const conflicts = inspected.flatMap((network) =>
    (network.IPAM?.Config ?? [])
      .map((config) => config.Subnet)
      .filter((subnet): subnet is string => Boolean(subnet))
      .filter((subnet) => ipv4CidrsOverlap(subnet, LAB_NETWORK.subnet))
      .map((subnet) => ({
        id: network.Id,
        name: network.Name,
        subnet
      }))
  );
  return {
    inspectedCount: inspected.length,
    targetSubnet: LAB_NETWORK.subnet,
    conflictCount: conflicts.length,
    conflicts
  };
}

async function labelledResources(quiet = false): Promise<{
  containerRows: string[];
  networkRows: string[];
  volumeRows: string[];
}> {
  const label = `${LAB_LABEL_KEY}=${LAB_OWNER_LABEL}`;
  const containers = await runCommand(
    "docker",
    [
      "container",
      "ls",
      "-a",
      "--filter",
      `label=${label}`,
      "--format",
      "{{.ID}}\t{{.Names}}\t{{.Status}}"
    ],
    { timeoutMs: 10_000, log: !quiet }
  );
  const networks = await runCommand(
    "docker",
    [
      "network",
      "ls",
      "--filter",
      `label=${label}`,
      "--format",
      "{{.ID}}\t{{.Name}}\t{{.Driver}}"
    ],
    { timeoutMs: 10_000, log: !quiet }
  );
  const volumes = await runCommand(
    "docker",
    [
      "volume",
      "ls",
      "--filter",
      `label=${label}`,
      "--format",
      "{{.Name}}\t{{.Driver}}"
    ],
    { timeoutMs: 10_000, log: !quiet }
  );
  return {
    containerRows: nonemptyLines(containers.stdout),
    networkRows: nonemptyLines(networks.stdout),
    volumeRows: nonemptyLines(volumes.stdout)
  };
}

function assertCaptureVolumeName(name: string): void {
  if (!/^cn-capture-(?:cold|warm)-[a-f0-9]{8}$/.test(name)) {
    throw new Error(`Unsafe capture volume name: ${name}`);
  }
}

async function recordError(
  root: string,
  state: LabState,
  phase: string,
  error: unknown
): Promise<void> {
  await appendEvent(root, state, {
    phase,
    kind: "error",
    detail: formatError(error).slice(0, 500)
  }).catch(() => undefined);
}

function requireId(value: string | null, role: string): string {
  if (!value) throw new Error(`Missing ${role} ID in active state.`);
  assertDockerId(value);
  return value;
}

function assertDockerId(value: string): void {
  if (!DOCKER_ID_PATTERN.test(value)) {
    throw new Error(`Unsafe Docker ID: ${value}`);
  }
}

function versionAtLeast(
  value: string,
  requiredMajor: number,
  requiredMinor: number
): boolean {
  const [major = 0, minor = 0] = value.split(".").map(Number);
  return (
    major > requiredMajor ||
    (major === requiredMajor && minor >= requiredMinor)
  );
}

function nonemptyLines(value: string): string[] {
  return value.split(/\r?\n/).filter((line) => line.trim().length > 0);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

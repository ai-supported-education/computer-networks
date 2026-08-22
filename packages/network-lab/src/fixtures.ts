import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath } from "node:fs/promises";
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
  buildArpFrame,
  buildIcmpEchoFrame,
  createClassicPcap,
  sha256,
  type PcapRecord
} from "./pcap.js";

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

export async function inspectFixture(
  root: string,
  target: string
): Promise<string> {
  const [fixture] = await selectFixtures(root, target);
  if (!fixture) throw new Error(`Fixture не найден: ${target}`);
  await verifyFixtures(root, target);

  const runId = `fixture-inspect-${randomUUID()}`;
  const name = `cn-fixture-${runId.slice(-12)}`;
  const absolutePcapPath = path.join(root, fixture.pcapRelativePath);
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
      `${LAB_RUN_LABEL_KEY}=${runId}`,
      "--label",
      `${LAB_ROLE_LABEL_KEY}=fixture-inspect`,
      "--network",
      "none",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges=true",
      "--read-only",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=16m",
      "--mount",
      `type=bind,source=${absolutePcapPath},target=/input.pcap,readonly`,
      LAB_IMAGE,
      "sleep",
      "infinity"
    ],
    { timeoutMs: 15_000 }
  );
  const containerId = created.stdout.trim();
  assertDockerId(containerId);

  try {
    await runCommand("docker", ["container", "start", containerId], {
      timeoutMs: 10_000
    });
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
    return [
      `fixture=${fixture.pcapRelativePath}`,
      `sha256=${sha256(await readFile(path.join(root, fixture.pcapRelativePath)))}`,
      ...companions,
      "--- tshark canonical fields ---",
      tshark.stdout || "(0 frames)"
    ].join("\n");
  } finally {
    const cleanup = await tryCommand(
      "docker",
      ["container", "rm", "--force", containerId],
      { timeoutMs: 10_000 }
    );
    if (cleanup.exitCode !== 0) {
      process.stderr.write(
        `Cleanup warning for exact container ${containerId}: ${cleanup.stderr}\n`
      );
    }
  }
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
          "- Frames: two captured Ethernet frames, 74 bytes each, no Ethernet FCS.\n" +
          "- Deterministic fields: addresses, payload, ICMP identifier/sequence, IP IDs, TTL, checksums and relative order.\n" +
          "- This fixture does not prove live host, route, gateway or kernel behaviour.\n"
        )
      ],
      [
        textPath,
        utf8(
          "frame\ttime_epoch\tframe_len\teth_src\teth_dst\teth_type\tip_src\tip_dst\tip_proto\ticmp_type\ticmp_code\ticmp_id\ticmp_seq\n" +
          `1\t1704067200.000000\t74\t${alpha.mac}\t${beta.mac}\t0x0800\t${alpha.ipv4}\t${beta.ipv4}\t1\t8\t0\t4660\t1\n` +
          `2\t1704067200.001000\t74\t${beta.mac}\t${alpha.mac}\t0x0800\t${beta.ipv4}\t${alpha.ipv4}\t1\t0\t0\t4660\t1\n`
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
          "- Assumption supplied by the bundle: both endpoints belong to one local Ethernet LAN.\n" +
          "- Capture point model: alpha network namespace, ARP and IPv4 ICMP, six-frame ceiling.\n" +
          "- Deterministic fields: timestamps, addresses, payload, identifiers, checksums and order.\n" +
          "- The capture does not expose endpoint internals, host routing or traffic outside its window.\n"
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
    companionRelativePaths: [provenancePath, hashPath, textPath]
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

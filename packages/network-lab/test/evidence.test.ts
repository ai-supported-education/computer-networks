import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateNetworkEvidence } from "../src/evidence.js";

const repository = path.resolve(import.meta.dirname, "../../..");

describe("network evidence artifact contract", () => {
  it("keeps the target Echo pairs out of the 01-06 learner starter", async () => {
    const sessionDirectory = path.join(
      repository,
      "modules/01-one-packet-one-lan/sessions/01-06"
    );
    const learnerText = [
      await readFile(path.join(sessionDirectory, "README.md"), "utf8"),
      await readFile(path.join(sessionDirectory, "packet-path.md"), "utf8")
    ].join("\n");

    expect(learnerText).not.toMatch(/echo_frame\s*=\s*[3-6]/i);
    expect(learnerText).not.toMatch(/(?:3\s*[→-]\s*4|5\s*[→-]\s*6)/);
    expect(learnerText).toContain("echo_frame=<observed frame number>");
  });

  it("fails every real TODO starter from 01-02 through 01-06", async () => {
    for (const sessionId of ["01-02", "01-03", "01-04", "01-05", "01-06"]) {
      const result = await validateNetworkEvidence(
        path.join(
          repository,
          "modules",
          "01-one-packet-one-lan",
          "sessions",
          sessionId
        ),
        sessionId,
        repository
      );
      expect(result.ok, sessionId).toBe(false);
      expect(result.messages.join("\n"), sessionId).toContain("TODO");
    }
  });

  it("fails the TODO starter and passes minimally completed 01-02 artifacts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-evidence-"));
    await mkdir(path.join(root, "evidence"), { recursive: true });
    await writeFile(
      path.join(root, "evidence", "baseline.md"),
      baseline("TODO: learner must replace this.")
    );
    await writeFile(
      path.join(root, "evidence", "post-check.md"),
      postCheck()
    );
    const starter = await validateNetworkEvidence(root, "01-02");
    expect(starter.ok).toBe(false);
    expect(starter.messages.join("\n")).toContain("TODO");

    await writeFile(
      path.join(root, "evidence", "baseline.md"),
      baseline("Expected was recorded at 2026-08-23T00:00:00Z before up.")
    );
    const complete = await validateNetworkEvidence(root, "01-02");
    expect(complete).toEqual({
      ok: true,
      messages: [
        "network-evidence PASS: evidence/baseline.md, evidence/post-check.md"
      ]
    });

    await writeFile(
      path.join(root, "evidence", "baseline.md"),
      baseline("Expected was recorded at 2026-08-23T00:00:00Z before up.")
        .replace("## Source facts", "## Unlabelled inputs")
    );
    const missingSourceFacts = await validateNetworkEvidence(root, "01-02");
    expect(missingSourceFacts.ok).toBe(false);
    expect(missingSourceFacts.messages.join("\n")).toContain("source facts");

    await writeFile(
      path.join(root, "evidence", "baseline.md"),
      baseline("Expected was recorded at 2026-08-23T00:00:00Z before up.")
        .replace("## Assumptions before action", "## Unlabelled beliefs")
    );
    const missingAssumptions = await validateNetworkEvidence(root, "01-02");
    expect(missingAssumptions.ok).toBe(false);
    expect(missingAssumptions.messages.join("\n")).toContain(
      "assumptions before action"
    );

    await writeFile(
      path.join(root, "evidence", "post-check.md"),
      postCheck("run-b")
    );
    const mixedRuns = await validateNetworkEvidence(root, "01-02");
    expect(mixedRuns.ok).toBe(false);
    expect(mixedRuns.messages.join("\n")).toContain("один exact unique run id");

    await writeFile(
      path.join(root, "evidence", "post-check.md"),
      postCheck()
    );
    await writeFile(
      path.join(root, "evidence", "baseline.md"),
      baseline("Expected was recorded at 2026-08-23T00:00:00Z before up.")
        .replace(
          "The raw record contains interface eth0, flags UP and LOWER_UP, MAC 02:42:ac:1e:00:0a and IPv4 172.30.0.10 for alpha.",
          "The raw record contains interface eth0, flags UP and LOWER_UP twice: UP LOWER_UP, MAC 02:42:ac:1e:00:0a and IPv4 172.30.0.10 for alpha."
        )
        .replace(
          "The raw record contains interface eth0, flags UP and LOWER_UP, MAC 02:42:ac:1e:00:14 and IPv4 172.30.0.20 for beta.",
          "The raw record contains interface eth0, MAC 02:42:ac:1e:00:14 and IPv4 172.30.0.20 for beta."
        )
    );
    const flagsOnlyInAlpha = await validateNetworkEvidence(root, "01-02");
    expect(flagsOnlyInAlpha.ok).toBe(false);
    expect(flagsOnlyInAlpha.messages.join("\n")).toContain(
      "Observed beta должен отдельно содержать UP и LOWER_UP"
    );

    await writeFile(
      path.join(root, "evidence", "baseline.md"),
      baseline("Expected was recorded at 2026-08-23T00:00:00Z before up.")
        .replace("IPv4 172.30.0.20", "IPv4 not-observed")
    );
    const missingBetaAddress = await validateNetworkEvidence(root, "01-02");
    expect(missingBetaAddress.ok).toBe(false);
    expect(missingBetaAddress.messages.join("\n")).toContain(
      "Observed beta должен отдельно содержать eth0, MAC"
    );
  });

  it("fails closed for an unsupported session id", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-evidence-"));
    const result = await validateNetworkEvidence(root, "99-99");
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toContain("99-99");
  });

  it.each([
    ["01-03", "frame-map.md", completedFrameMap()],
    ["01-04", "evidence/comparison.md", completedComparison()],
    ["01-05", "diagnosis.md", completedDiagnosis()],
    ["01-06", "packet-path.md", completedPacketPath()]
  ])("passes a minimally complete %s artifact", async (sessionId, file, markdown) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-evidence-"));
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), markdown);
    const result = await validateNetworkEvidence(root, sessionId, repository);
    expect(result, result.messages.join("\n")).toMatchObject({ ok: true });
  });

  it("requires source facts and assumptions in 01-03", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-evidence-"));
    await writeFile(
      path.join(root, "frame-map.md"),
      completedFrameMap().replace("## Source facts", "## Unlabelled inputs")
    );
    const missingFacts = await validateNetworkEvidence(root, "01-03", repository);
    expect(missingFacts.ok).toBe(false);
    expect(missingFacts.messages.join("\n")).toContain("source facts");

    await writeFile(
      path.join(root, "frame-map.md"),
      completedFrameMap().replace(
        "## Assumptions before action",
        "## Unlabelled beliefs"
      )
    );
    const missingAssumptions = await validateNetworkEvidence(
      root,
      "01-03",
      repository
    );
    expect(missingAssumptions.ok).toBe(false);
    expect(missingAssumptions.messages.join("\n")).toContain(
      "assumptions before action"
    );
  });

  it("rejects mixed or misordered offline fixture evidence runs", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-evidence-"));

    await writeFile(
      path.join(root, "frame-map.md"),
      completedFrameMap().replace("run-a/post-check.txt", "run-b/post-check.txt")
    );
    const mixed = await validateNetworkEvidence(root, "01-03");
    expect(mixed.ok).toBe(false);
    expect(mixed.messages.join("\n")).toContain("exact unique");

    await writeFile(
      path.join(root, "packet-path.md"),
      completedPacketPath().replace(
        "2026-08-23T00:00:00Z before inspect",
        "2026-08-23T00:05:00Z before inspect"
      )
    );
    const misordered = await validateNetworkEvidence(root, "01-06", repository);
    expect(misordered.ok).toBe(false);
    expect(misordered.messages.join("\n")).toContain(
      "Expected timestamp должен быть раньше"
    );
  });

  it.each([
    [
      "reply identifier",
      "echo_frame=4",
      "icmp.ident=25094",
      "icmp.ident=99",
      "icmp.ident"
    ],
    [
      "reply sequence",
      "echo_frame=4",
      "icmp.seq=7",
      "icmp.seq=99",
      "icmp.seq"
    ],
    [
      "Ethernet direction",
      "echo_frame=4",
      "eth.dst=02:42:ac:1e:00:0a",
      "eth.dst=02:42:ac:1e:00:14",
      "addresses"
    ],
    [
      "IPv4 direction",
      "echo_frame=4",
      "ip.dst=172.30.0.10",
      "ip.dst=172.30.0.20",
      "addresses"
    ]
  ])(
    "rejects 01-06 with a mismatched %s",
    async (_case, frameMarker, from, to, message) => {
      const root = await mkdtemp(path.join(os.tmpdir(), "network-evidence-"));
      await writeFile(
        path.join(root, "packet-path.md"),
        replaceInEchoFrame(completedPacketPath(), frameMarker, from, to)
      );

      const result = await validateNetworkEvidence(root, "01-06", repository);

      expect(result.ok).toBe(false);
      expect(result.messages.join("\n")).toContain("pair=3-4");
      expect(result.messages.join("\n")).toContain(message);
    }
  );

  it("rejects 01-06 when two exchanges reuse the same sequence", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-evidence-"));
    await writeFile(
      path.join(root, "packet-path.md"),
      replaceInEchoFrame(
        replaceInEchoFrame(
          completedPacketPath(),
          "echo_frame=5",
          "icmp.seq=8",
          "icmp.seq=7"
        ),
        "echo_frame=6",
        "icmp.seq=8",
        "icmp.seq=7"
      )
    );

    const result = await validateNetworkEvidence(root, "01-06", repository);

    expect(result.ok).toBe(false);
    expect(result.messages.join("\n")).toContain("должны различаться");
  });

  it("rejects 01-06 with invented but internally matching ICMP values", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-evidence-"));
    const invented = completedPacketPath()
      .replaceAll("icmp.ident=25094", "icmp.ident=1")
      .replaceAll("icmp.seq=7", "icmp.seq=101")
      .replaceAll("icmp.seq=8", "icmp.seq=102");
    await writeFile(path.join(root, "packet-path.md"), invented);

    const result = await validateNetworkEvidence(root, "01-06", repository);

    expect(result.ok).toBe(false);
    expect(result.messages.join("\n")).toContain("versioned fixture observation");
  });

  it("rejects 01-06 with a duplicate Echo frame row", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-evidence-"));
    const row = completedPacketPath().match(/^echo_frame=3.*$/m)?.[0] ?? "";
    await writeFile(
      path.join(root, "packet-path.md"),
      completedPacketPath().replace(row, `${row}\n${row}`)
    );

    const result = await validateNetworkEvidence(root, "01-06", repository);

    expect(result.ok).toBe(false);
    expect(result.messages.join("\n")).toContain(
      "ровно одна Echo correlation row echo_frame=3"
    );
  });

  it("rejects 01-06 with a duplicate Echo pair correlation section", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-evidence-"));
    const duplicate = [
      "## Echo pair correlation",
      completedPacketPath().match(/^echo_frame=3.*$/m)?.[0] ?? ""
    ].join("\n");
    await writeFile(
      path.join(root, "packet-path.md"),
      completedPacketPath().replace(
        "## Causal stages",
        `${duplicate}\n\n## Causal stages`
      )
    );

    const result = await validateNetworkEvidence(root, "01-06", repository);

    expect(result.ok).toBe(false);
    expect(result.messages.join("\n")).toContain(
      "ровно одна section Echo pair correlation"
    );
  });

  it("rejects 01-06 with a malformed Echo frame row", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-evidence-"));
    await writeFile(
      path.join(root, "packet-path.md"),
      replaceInEchoFrame(
        completedPacketPath(),
        "echo_frame=6",
        " icmp.type=0",
        ""
      )
    );

    const result = await validateNetworkEvidence(root, "01-06", repository);

    expect(result.ok).toBe(false);
    expect(result.messages.join("\n")).toContain(
      "row echo_frame=6 должна содержать parseable"
    );
  });

  it("rejects 01-03 evidence without explicit zero labelled-resource counts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-evidence-"));
    await writeFile(
      path.join(root, "frame-map.md"),
      completedFrameMap().replace(
        "; labelled containers=0, networks=0, volumes=0",
        ""
      )
    );

    const result = await validateNetworkEvidence(root, "01-03");

    expect(result.ok).toBe(false);
    expect(result.messages.join("\n")).toContain(
      "нулевой labelled resource post-check"
    );
  });

});

function baseline(expected: string, runId = "run-a"): string {
  return `# Baseline

## Source facts
The versioned lab contract supplies the exact names, addresses and image identity.

## Assumptions before action
No additional assumptions: preflight and raw observations verify the relevant state.

## Expected before action
${expected}

## Initial state and preflight
At .training/evidence/01-02/${runId}/preflight.json the Docker endpoint=unix:///var/run/docker.sock, networkInventory conflictCount=0, initial labelled_containers=0, labelled_networks=0 and labelled_volumes=0 for exact targets.

## Action start
The bounded action started at 2026-08-23T00:01:00Z in .training/evidence/01-02/${runId}/events.jsonl.

## Raw evidence reference
Observed data: .training/evidence/01-02/${runId}/preflight.json, .training/evidence/01-02/${runId}/events.jsonl, .training/evidence/01-02/${runId}/topology-inspect.json and .training/evidence/01-02/${runId}/baseline.txt.

## Observed topology guardrails
The normalized observation records internal=true and published_ports=0 with no added endpoint capabilities.

## Observed alpha
The raw record contains interface eth0, flags UP and LOWER_UP, MAC 02:42:ac:1e:00:0a and IPv4 172.30.0.10 for alpha.

## Observed beta
The raw record contains interface eth0, flags UP and LOWER_UP, MAC 02:42:ac:1e:00:14 and IPv4 172.30.0.20 for beta.

## Inference and unknowns
The inventory is consistent; behaviour outside this namespace remains unknown.
`;
}

function postCheck(runId = "run-a"): string {
  return `# Post-check

## Cleanup action
Exact-ID cleanup completed at 2026-08-23T00:02:00Z.

## Raw post-check evidence
Observed method and owner label: .training/evidence/01-02/${runId}/post-check.txt

## Observed status
containers: 0
networks: 0
volumes: 0

## Final state
All course-labelled resources are absent after cleanup.
`;
}

function completedFrameMap(): string {
  return `# Frame map

## Source facts
Versioned provenance supplies the fixture path, canonical hash and two-frame count.

## Assumptions before action
No additional assumptions: provenance and the bounded inspector verify required inputs.

## Expected before action
Expected fixture identity and two bounded records were written at 2026-08-23T00:00:00Z before inspect.

## Inspector action and raw evidence
Action started at 2026-08-23T00:01:00Z. Raw files: .training/evidence/01-03/run-a/preflight.txt, .training/evidence/01-03/run-a/events.jsonl, .training/evidence/01-03/run-a/inspect.txt and .training/evidence/01-03/run-a/post-check.txt.

## Fixture identity
Path fixtures/01-03/known-neighbour.pcap has observed SHA 8a4036d450c9f0953c50286f2dc99d429873900e8f92f22a1d2f8f6f1b6dc64f.

## Frame 1 observations
Frame 1 contains observed Ethernet, IPv4 and ICMP fields from raw inspect.txt.

## Frame 1 boundary arithmetic
IPv4 ip.len is 60 bytes; frame.cap_len is 74 bytes and equals frame.len for this record.

## Frame 2 observations
Frame 2 contains the reverse observed address pairs and ICMP fields.

## Frame 2 boundary arithmetic
This independent check gives ip.len 60 bytes and frame.cap_len 74 bytes; frame.len matches without truncation.

## Inference
The ordered records are consistent with one bounded synthetic exchange.

## Unknowns and applicability limits
- Live kernel processing remains unknown.
- Traffic outside the capture remains unknown.

## Offline inspector cleanup
Cleanup completed at 2026-08-23T00:02:00Z; exact_container_absent=true; labelled containers=0, networks=0, volumes=0 and final status is clean.
`;
}

function completedComparison(): string {
  return `# Comparison

## Source facts
RFC 826 and the versioned lab inventory supply the ARP format and fixed addresses.

## Assumptions before action
The chapter assumes both fixed endpoints are in one LAN; CIDR proof is deferred.

## Expected before action
Predictions were recorded at 2026-08-23T00:00:00Z before either bounded action started.

### Cold prediction
The first bounded timeline may require neighbour resolution before Echo.

### Warm prediction
The second bounded timeline may reuse an observed neighbour entry.

## Action start and raw evidence
The action started at 2026-08-23T00:01:00Z; markers are in .training/evidence/01-04/run-a/events.jsonl.

## Preflight and topology evidence
.training/evidence/01-04/run-a/preflight.json records endpoint=unix:///var/run/docker.sock and networkInventory conflictCount=0; topology-inspect.json and baseline.txt prove the exact bounded topology. Helper safety is observed in helpers/neigh-flush.json.

## Cold observations
Cold ARP then ICMP observations cite .training/evidence/01-04/run-a/cold/neighbor-before.txt, cold/neighbor-after.txt, cold/capture.pcap, cold/capture.sha256.txt, cold/events.tsv, helpers/capture-cold.json and helpers/probe-cold.json. The ARP reply arp.src.hw_mac advertises 02:42:ac:1e:00:14. SHA aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa; matching identifier 7 sequence 1.

## Warm observations
Warm ICMP observations cite .training/evidence/01-04/run-a/warm/neighbor-before.txt, warm/neighbor-after.txt, warm/capture.pcap, warm/capture.sha256.txt, warm/events.tsv, helpers/capture-warm.json and helpers/probe-warm.json. SHA bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb; matching identifier 8 sequence 2.

## Comparison and inference
The comparison separates captured observations from the bounded inference.

## Alternative explanations and variable fields
Capture timing is an alternative; timestamps, IDs and checksums are variable.

## Cleanup and post-check
Exact cleanup completed at 2026-08-23T00:02:00Z; .training/evidence/01-04/run-a/post-check.txt reports containers=0, networks=0 and volumes=0.
`;
}

function completedDiagnosis(): string {
  const section = (title: string, fixture: string) => `## ${title}

### Verified inputs and observations
Hash and provenance checked at ${fixture}baseline.txt:1 and ${fixture}events.tsv:2; citations identify bounded records.

### Last proven stage
The last stage is stated from the cited observed record only.

### Earliest disproven or not-proven transition
The earliest unsupported transition is separated from later unknown stages.

### Bounded inference
The inference localises an evidence boundary without asserting root cause.

### Remaining unknowns
- Endpoint internals remain unknown.
- Capture behaviour outside the window remains unknown.

### Next discriminating observation
A bounded read-only observation is proposed without running another probe.

`;
  return (
    "# Diagnosis\n\n" +
    "## Source facts\nThree versioned fixture bundles supply provenance, hashes and capture bounds.\n\n" +
    "## Assumptions before inspector actions\nNo additional assumptions are needed before the offline inspections.\n\n" +
    "## Expected before inspector actions\nExpected bounded offline parsing was recorded at 2026-08-23T00:00:00Z before all inspect actions.\n\n" +
    "## Inspector run ledger\n" +
    "- Case A inspect_action_at=2026-08-23T00:01:00Z cleanup_at=2026-08-23T00:01:10Z labelled=0/0/0 .training/evidence/01-05/run-a/preflight.txt .training/evidence/01-05/run-a/events.jsonl .training/evidence/01-05/run-a/inspect.txt .training/evidence/01-05/run-a/post-check.txt\n" +
    "- Case B inspect_action_at=2026-08-23T00:02:00Z cleanup_at=2026-08-23T00:02:10Z labelled=0/0/0 .training/evidence/01-05/run-b/preflight.txt .training/evidence/01-05/run-b/events.jsonl .training/evidence/01-05/run-b/inspect.txt .training/evidence/01-05/run-b/post-check.txt\n" +
    "- Case C inspect_action_at=2026-08-23T00:03:00Z cleanup_at=2026-08-23T00:03:10Z labelled=0/0/0 .training/evidence/01-05/run-c/preflight.txt .training/evidence/01-05/run-c/events.jsonl .training/evidence/01-05/run-c/inspect.txt .training/evidence/01-05/run-c/post-check.txt\n\n" +
    section(
      "Case A - interface-not-ready",
      "fixtures/01-05/interface-not-ready/"
    ) +
    section("Case B - arp-no-reply", "fixtures/01-05/arp-no-reply/") +
    section("Case C - icmp-no-reply", "fixtures/01-05/icmp-no-reply/") +
    "## Cross-case comparison\nThe shared high-level symptom does not erase the different observed boundaries.\n\n" +
    "## Offline inspector cleanup\nexact_container_absent=true for case A.\nexact_container_absent=true for case B.\nexact_container_absent=true for case C.\n"
  );
}

function completedPacketPath(): string {
  return `# Packet path

## Expected before action
Expected bounded synthetic evidence was recorded at 2026-08-23T00:00:00Z before inspect.

## Inspector action and raw evidence
Action started at 2026-08-23T00:01:00Z. Raw files: .training/evidence/01-06/run-a/preflight.txt, .training/evidence/01-06/run-a/events.jsonl, .training/evidence/01-06/run-a/inspect.txt and .training/evidence/01-06/run-a/post-check.txt.

## Fixture identity and provenance
Verified fixtures/01-06/novel-local-exchange.pcap and fixtures/01-06/novel-local-exchange.baseline.txt against synthetic provenance and hash.

## Source facts
Fixed endpoint inventory and capture bounds come from versioned provenance.

## Assumptions
The supplied one-LAN assumption is limited to this synthetic bundle.

## Frame inventory
Frame 1 records ARP fields.
Frame 2 records reverse ARP fields.
Frame 3 records IPv4 and ICMP fields.
Frame 4 records reverse IPv4 and ICMP fields.
Frame 5 records the next IPv4 and ICMP fields.
Frame 6 records their reverse IPv4 and ICMP fields.

## Echo pair correlation
echo_frame=3 eth.src=02:42:ac:1e:00:0a eth.dst=02:42:ac:1e:00:14 ip.src=172.30.0.10 ip.dst=172.30.0.20 icmp.type=8 icmp.ident=25094 icmp.seq=7
echo_frame=4 eth.src=02:42:ac:1e:00:14 eth.dst=02:42:ac:1e:00:0a ip.src=172.30.0.20 ip.dst=172.30.0.10 icmp.type=0 icmp.ident=25094 icmp.seq=7
echo_frame=5 eth.src=02:42:ac:1e:00:0a eth.dst=02:42:ac:1e:00:14 ip.src=172.30.0.10 ip.dst=172.30.0.20 icmp.type=8 icmp.ident=25094 icmp.seq=8
echo_frame=6 eth.src=02:42:ac:1e:00:14 eth.dst=02:42:ac:1e:00:0a ip.src=172.30.0.20 ip.dst=172.30.0.10 icmp.type=0 icmp.ident=25094 icmp.seq=8

## Causal stages
Each bounded stage arrow cites a numbered observation from the inventory.

## Observations
Only extracted Ethernet, ARP, IPv4 and ICMP fields are listed here.

## Inferences
The conclusion combines supplied facts and observed ordering within this fixture.

## Unknowns
- Kernel internals remain unknown.
- Route lookup remains unknown.
- Events outside the window remain unknown.

## Counterfactual
A missing reverse record with the same identifiers would contradict completeness.

## Final bounded conclusion
The six records support only a bounded conclusion for this synthetic LAN.

## Cleanup status
Cleanup ended at 2026-08-23T00:02:00Z with exact_container_absent=true, labelled_containers=0, labelled_networks=0 and labelled_volumes=0.
`;
}

function replaceInEchoFrame(
  markdown: string,
  frameMarker: string,
  from: string,
  to: string
): string {
  return markdown
    .split("\n")
    .map((line) =>
      line.startsWith(frameMarker) ? line.replace(from, to) : line
    )
    .join("\n");
}

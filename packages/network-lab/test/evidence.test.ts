import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateNetworkEvidence } from "../src/evidence.js";

describe("network evidence artifact contract", () => {
  it("fails every real TODO starter from 01-02 through 01-06", async () => {
    const repository = path.resolve(import.meta.dirname, "../../..");
    for (const sessionId of ["01-02", "01-03", "01-04", "01-05", "01-06"]) {
      const result = await validateNetworkEvidence(
        path.join(
          repository,
          "modules",
          "01-one-packet-one-lan",
          "sessions",
          sessionId
        ),
        sessionId
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
    const result = await validateNetworkEvidence(root, sessionId);
    expect(result, result.messages.join("\n")).toMatchObject({ ok: true });
  });

});

function baseline(expected: string): string {
  return `# Baseline

## Expected before action
${expected}

## Action start
The bounded action started at 2026-08-23T00:01:00Z.

## Raw evidence reference
Observed data: .training/evidence/01-02/run-a/baseline.txt

## Observed alpha
The raw record contains interface, link, MAC and IPv4 fields for alpha.

## Observed beta
The raw record contains interface, link, MAC and IPv4 fields for beta.

## Inference and unknowns
The inventory is consistent; behaviour outside this namespace remains unknown.
`;
}

function postCheck(): string {
  return `# Post-check

## Cleanup action
Exact-ID cleanup completed at 2026-08-23T00:02:00Z.

## Observed status
containers: 0
networks: 0

## Final state
All course-labelled resources are absent after cleanup.
`;
}

function completedFrameMap(): string {
  return `# Frame map

## Fixture identity
Path fixtures/01-03/known-neighbour.pcap has observed SHA 8a4036d450c9f0953c50286f2dc99d429873900e8f92f22a1d2f8f6f1b6dc64f.

## Frame 1 observations
Frame 1 contains observed Ethernet, IPv4 and ICMP fields from extraction.

## Frame 1 boundary arithmetic
IPv4 total length is 60 bytes and the captured frame length is 74 bytes.

## Frame 2 observations
Frame 2 contains the reverse observed address pairs and ICMP fields.

## Frame 2 boundary arithmetic
This independent check also gives 60 bytes and 74 bytes for this fixture.

## Inference
The ordered records are consistent with one bounded synthetic exchange.

## Unknowns and applicability limits
Live kernel processing and traffic outside the capture remain unknown.
`;
}

function completedComparison(): string {
  return `# Comparison

## Expected before action
Predictions were recorded before either bounded action started.

### Cold prediction
The first bounded timeline may require neighbour resolution before Echo.

### Warm prediction
The second bounded timeline may reuse an observed neighbour entry.

## Action start and raw evidence
UTC markers and raw files are under .training/evidence/01-04/run-a/.

## Cold observations
Cold neighbor-before/after evidence cites cold/capture.pcap and cold/events.tsv.

## Warm observations
Warm neighbor-before/after evidence cites warm/capture.pcap and warm/events.tsv.

## Comparison and inference
The comparison separates captured observations from the bounded inference.

## Alternative explanations and variable fields
Capture timing is an alternative; timestamps, IDs and checksums are variable.

## Cleanup and post-check
Exact cleanup completed and the final status reported zero labelled resources.
`;
}

function completedDiagnosis(): string {
  const section = (title: string, fixture: string) => `## ${title}

### Verified inputs and observations
Hash and provenance checked at ${fixture}; citations identify bounded records.

### Last proven stage
The last stage is stated from the cited observed record only.

### Earliest disproven or not-proven transition
The earliest unsupported transition is separated from later unknown stages.

### Bounded inference
The inference localises an evidence boundary without asserting root cause.

### Remaining unknowns
Endpoint internals and capture behaviour outside the window remain unknown.

### Next discriminating observation
A bounded read-only observation is proposed without running another probe.

`;
  return (
    "# Diagnosis\n\n" +
    section(
      "Case A - interface-not-ready",
      "fixtures/01-05/interface-not-ready/"
    ) +
    section("Case B - arp-no-reply", "fixtures/01-05/arp-no-reply/") +
    section("Case C - icmp-no-reply", "fixtures/01-05/icmp-no-reply/") +
    "## Cross-case comparison\nThe shared high-level symptom does not erase the different observed boundaries.\n"
  );
}

function completedPacketPath(): string {
  return `# Packet path

## Fixture identity and provenance
Verified fixtures/01-06/novel-local-exchange.pcap against its synthetic provenance and hash.

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

## Causal stages
Each bounded stage arrow cites a numbered observation from the inventory.

## Observations
Only extracted Ethernet, ARP, IPv4 and ICMP fields are listed here.

## Inferences
The conclusion combines supplied facts and observed ordering within this fixture.

## Unknowns
Kernel internals, route lookup and events outside the window remain unknown.

## Counterfactual
A missing reverse record with the same identifiers would contradict completeness.

## Final bounded conclusion
The six records support only a bounded conclusion for this synthetic LAN.

## Cleanup status
Offline inspection ended with containers: 0 and networks: 0.
`;
}

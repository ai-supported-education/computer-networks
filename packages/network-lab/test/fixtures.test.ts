import { describe, expect, it } from "vitest";
import { KNOWN_FIXTURE_SHA256 } from "../src/constants.js";
import { buildFixtureDefinitions } from "../src/fixtures.js";
import { sha256 } from "../src/pcap.js";

describe("deterministic packet fixtures", () => {
  it("keeps the required two-frame known-neighbour bytes", () => {
    const fixture = getFixture("known-neighbour");
    const pcap = fixture.artifacts.get(fixture.pcapRelativePath);
    expect(pcap).toBeDefined();
    expect(pcap?.length).toBe(204);
    expect(sha256(pcap!)).toBe(KNOWN_FIXTURE_SHA256);
    expect(countPcapRecords(pcap!)).toBe(2);
  });

  it("ships three bounded diagnostic bundles and a six-frame novel fixture", () => {
    const fixtures = buildFixtureDefinitions();
    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      "known-neighbour",
      "interface-not-ready",
      "arp-no-reply",
      "icmp-no-reply",
      "novel-local-exchange"
    ]);
    expect(countPcapRecords(getPcap("interface-not-ready"))).toBe(0);
    expect(countPcapRecords(getPcap("arp-no-reply"))).toBe(3);
    expect(countPcapRecords(getPcap("icmp-no-reply"))).toBe(3);
    expect(countPcapRecords(getPcap("novel-local-exchange"))).toBe(6);
    expect(
      getFixture("novel-local-exchange").artifacts.has(
        "fixtures/01-06/novel-local-exchange.baseline.txt"
      )
    ).toBe(true);
    for (const caseId of [
      "interface-not-ready",
      "arp-no-reply",
      "icmp-no-reply"
    ]) {
      const fixture = getFixture(caseId);
      expect([...fixture.artifacts.keys()]).toEqual(
        expect.arrayContaining([
          `fixtures/01-05/${caseId}/capture.pcap`,
          `fixtures/01-05/${caseId}/provenance.md`,
          `fixtures/01-05/${caseId}/sha256.txt`,
          `fixtures/01-05/${caseId}/baseline.txt`,
          `fixtures/01-05/${caseId}/events.tsv`,
          `fixtures/01-05/${caseId}/action.txt`
        ])
      );
    }
  });

  it("rebuilds byte-identical artifacts", () => {
    const first = buildFixtureDefinitions();
    const second = buildFixtureDefinitions();
    expect(
      first.flatMap((fixture) =>
        [...fixture.artifacts].map(([name, bytes]) => [name, sha256(bytes)])
      )
    ).toEqual(
      second.flatMap((fixture) =>
        [...fixture.artifacts].map(([name, bytes]) => [name, sha256(bytes)])
      )
    );
  });
});

function getFixture(id: string) {
  const fixture = buildFixtureDefinitions().find((item) => item.id === id);
  if (!fixture) throw new Error(`Missing fixture ${id}`);
  return fixture;
}

function getPcap(id: string): Buffer {
  const fixture = getFixture(id);
  const pcap = fixture.artifacts.get(fixture.pcapRelativePath);
  if (!pcap) throw new Error(`Missing pcap ${id}`);
  return pcap;
}

function countPcapRecords(pcap: Buffer): number {
  let offset = 24;
  let count = 0;
  while (offset < pcap.length) {
    const includedLength = pcap.readUInt32LE(offset + 8);
    offset += 16 + includedLength;
    count += 1;
  }
  expect(offset).toBe(pcap.length);
  return count;
}

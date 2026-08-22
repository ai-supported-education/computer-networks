import { describe, expect, it } from "vitest";
import {
  hasRequiredLinkFlags,
  isLabelledPostCheckClean,
  validateLiveCapture
} from "../src/lab.js";

describe("cleanup post-check gate", () => {
  it("allows PASS only when every labelled resource set is empty", () => {
    expect(
      isLabelledPostCheckClean({
        containerRows: [],
        networkRows: [],
        volumeRows: []
      })
    ).toBe(true);
    expect(
      isLabelledPostCheckClean({
        containerRows: ["abc cn-alpha exited"],
        networkRows: [],
        volumeRows: []
      })
    ).toBe(false);
    expect(
      isLabelledPostCheckClean({
        containerRows: [],
        networkRows: ["def cn-lab bridge"],
        volumeRows: []
      })
    ).toBe(false);
    expect(
      isLabelledPostCheckClean({
        containerRows: [],
        networkRows: [],
        volumeRows: ["cn-capture-cold-deadbeef local"]
      })
    ).toBe(false);
  });
});

describe("live capture semantic gate", () => {
  const columns = [
    "frame.number",
    "eth.src",
    "eth.dst",
    "arp.opcode",
    "arp.src.hw_mac",
    "arp.src.proto_ipv4",
    "arp.dst.hw_mac",
    "arp.dst.proto_ipv4",
    "ip.src",
    "ip.dst",
    "icmp.type",
    "icmp.code",
    "icmp.ident",
    "icmp.seq"
  ];
  const header = columns.join("\t");
  const row = (values: Record<string, string>) =>
    columns.map((column) => values[column] ?? "").join("\t");
  const arpRequest = row({
    "frame.number": "1",
    "eth.src": "02:42:ac:1e:00:0a",
    "eth.dst": "ff:ff:ff:ff:ff:ff",
    "arp.opcode": "1",
    "arp.src.hw_mac": "02:42:ac:1e:00:0a",
    "arp.src.proto_ipv4": "172.30.0.10",
    "arp.dst.hw_mac": "00:00:00:00:00:00",
    "arp.dst.proto_ipv4": "172.30.0.20"
  });
  const arpReply = (advertisedMac = "02:42:ac:1e:00:14") =>
    row({
      "frame.number": "2",
      "eth.src": "02:42:ac:1e:00:14",
      "eth.dst": "02:42:ac:1e:00:0a",
      "arp.opcode": "2",
      "arp.src.hw_mac": advertisedMac,
      "arp.src.proto_ipv4": "172.30.0.20",
      "arp.dst.hw_mac": "02:42:ac:1e:00:0a",
      "arp.dst.proto_ipv4": "172.30.0.10"
    });
  const echoRequest = (identifier = "4660", sequence = "1") =>
    row({
      "frame.number": "3",
      "eth.src": "02:42:ac:1e:00:0a",
      "eth.dst": "02:42:ac:1e:00:14",
      "ip.src": "172.30.0.10",
      "ip.dst": "172.30.0.20",
      "icmp.type": "8",
      "icmp.code": "0",
      "icmp.ident": identifier,
      "icmp.seq": sequence
    });
  const echoReply = (identifier = "4660", sequence = "1") =>
    row({
      "frame.number": "4",
      "eth.src": "02:42:ac:1e:00:14",
      "eth.dst": "02:42:ac:1e:00:0a",
      "ip.src": "172.30.0.20",
      "ip.dst": "172.30.0.10",
      "icmp.type": "0",
      "icmp.code": "0",
      "icmp.ident": identifier,
      "icmp.seq": sequence
    });

  it("accepts a cold resolution followed by a complete Echo pair", () => {
    const tsv = [
      header,
      arpRequest,
      arpReply(),
      echoRequest(),
      echoReply()
    ].join("\n");

    expect(validateLiveCapture("cold", tsv, "")).toEqual([]);
  });

  it("accepts warm reuse and rejects an incomplete cold capture", () => {
    const warm = [
      header,
      echoRequest("4660", "2"),
      echoReply("4660", "2")
    ].join("\n");
    expect(
      validateLiveCapture(
        "warm",
        warm,
        "172.30.0.20 dev eth0 lladdr 02:42:ac:1e:00:14 REACHABLE"
      )
    ).toEqual([]);

    const incompleteCold = [
      header,
      arpRequest,
      arpReply(),
      echoRequest()
    ].join("\n");
    expect(validateLiveCapture("cold", incompleteCold, "")).toContain(
      "нет ICMP Echo Reply beta -> alpha"
    );
  });

  it("rejects a reply from the right addresses with a different Echo identity", () => {
    const mismatch = [
      header,
      arpRequest,
      arpReply(),
      echoRequest("111", "1"),
      echoReply("222", "9")
    ].join("\n");

    expect(validateLiveCapture("cold", mismatch, "")).toContain(
      "ICMP Echo Reply не совпадает с request по identifier/sequence"
    );
  });

  it("rejects an ARP reply that advertises the wrong beta MAC", () => {
    const wrongMapping = [
      header,
      arpRequest,
      arpReply("02:42:ac:1e:00:99"),
      echoRequest(),
      echoReply()
    ].join("\n");

    expect(validateLiveCapture("cold", wrongMapping, "")).toContain(
      "ARP reply не рекламирует expected beta-to-alpha MAC mapping"
    );
  });

  it("rejects target ARP before the first warm Echo but allows later ARP", () => {
    const mapping =
      "172.30.0.20 dev eth0 lladdr 02:42:ac:1e:00:14 REACHABLE";
    const preEchoArp = [
      header,
      arpRequest,
      arpReply(),
      echoRequest(),
      echoReply()
    ].join("\n");
    expect(validateLiveCapture("warm", preEchoArp, mapping)).toContain(
      "warm ICMP request потребовал предшествующий ARP exchange"
    );

    const laterArp = [
      header,
      echoRequest(),
      echoReply(),
      arpRequest,
      arpReply()
    ].join("\n");
    expect(validateLiveCapture("warm", laterArp, mapping)).toEqual([]);
  });
});

describe("Linux link-state gate", () => {
  it("requires both UP and LOWER_UP flags", () => {
    expect(
      hasRequiredLinkFlags(
        "eth0 UP 02:42:ac:1e:00:0a <BROADCAST,MULTICAST,UP,LOWER_UP>"
      )
    ).toBe(true);
    expect(
      hasRequiredLinkFlags("eth0 UP 02:42:ac:1e:00:0a <BROADCAST,MULTICAST,UP>")
    ).toBe(false);
    expect(
      hasRequiredLinkFlags(
        "eth0 DOWN 02:42:ac:1e:00:0a <BROADCAST,MULTICAST,LOWER_UP>"
      )
    ).toBe(false);
  });
});

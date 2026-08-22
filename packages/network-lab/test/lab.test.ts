import { describe, expect, it } from "vitest";
import {
  isLabelledPostCheckClean,
  validateLiveCapture
} from "../src/lab.js";

describe("cleanup post-check gate", () => {
  it("allows PASS only when both labelled resource sets are empty", () => {
    expect(
      isLabelledPostCheckClean({ containerRows: [], networkRows: [] })
    ).toBe(true);
    expect(
      isLabelledPostCheckClean({
        containerRows: ["abc cn-alpha exited"],
        networkRows: []
      })
    ).toBe(false);
    expect(
      isLabelledPostCheckClean({
        containerRows: [],
        networkRows: ["def cn-lab bridge"]
      })
    ).toBe(false);
  });
});

describe("live capture semantic gate", () => {
  const header =
    "frame.number\tarp.opcode\tarp.src.proto_ipv4\tarp.dst.proto_ipv4\tip.src\tip.dst\ticmp.type\ticmp.code";

  it("accepts a cold resolution followed by a complete Echo pair", () => {
    const tsv = [
      header,
      "1\t1\t172.30.0.10\t172.30.0.20\t\t\t\t",
      "2\t2\t172.30.0.20\t172.30.0.10\t\t\t\t",
      "3\t\t\t\t172.30.0.10\t172.30.0.20\t8\t0",
      "4\t\t\t\t172.30.0.20\t172.30.0.10\t0\t0"
    ].join("\n");

    expect(validateLiveCapture("cold", tsv, "")).toEqual([]);
  });

  it("accepts warm reuse and rejects an incomplete cold capture", () => {
    const warm = [
      header,
      "1\t\t\t\t172.30.0.10\t172.30.0.20\t8\t0",
      "2\t\t\t\t172.30.0.20\t172.30.0.10\t0\t0"
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
      "1\t1\t172.30.0.10\t172.30.0.20\t\t\t\t",
      "2\t2\t172.30.0.20\t172.30.0.10\t\t\t\t",
      "3\t\t\t\t172.30.0.10\t172.30.0.20\t8\t0"
    ].join("\n");
    expect(validateLiveCapture("cold", incompleteCold, "")).toContain(
      "нет ICMP Echo Reply beta -> alpha"
    );
  });
});

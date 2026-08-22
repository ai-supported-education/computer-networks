import { describe, expect, it } from "vitest";
import {
  ipv4CidrsOverlap,
  isLocalUnixDockerEndpoint,
  isNoSuchDockerObject
} from "../src/docker-safety.js";

describe("Docker endpoint boundary", () => {
  it("accepts only absolute local unix sockets", () => {
    expect(isLocalUnixDockerEndpoint("unix:///var/run/docker.sock")).toBe(true);
    expect(
      isLocalUnixDockerEndpoint("unix:///Users/student/.docker/run/docker.sock")
    ).toBe(true);
    expect(isLocalUnixDockerEndpoint("ssh://prod.example")).toBe(false);
    expect(isLocalUnixDockerEndpoint("tcp://127.0.0.1:2375")).toBe(false);
    expect(isLocalUnixDockerEndpoint("unix://relative.sock")).toBe(false);
  });
});

describe("fixed subnet preflight", () => {
  it("detects exact, broader and narrower IPv4 overlaps", () => {
    expect(ipv4CidrsOverlap("172.30.0.0/24", "172.30.0.0/24")).toBe(true);
    expect(ipv4CidrsOverlap("172.30.0.0/16", "172.30.0.0/24")).toBe(true);
    expect(ipv4CidrsOverlap("172.30.0.128/25", "172.30.0.0/24")).toBe(true);
    expect(ipv4CidrsOverlap("172.31.0.0/24", "172.30.0.0/24")).toBe(false);
    expect(ipv4CidrsOverlap("2001:db8::/64", "172.30.0.0/24")).toBe(false);
  });
});

describe("exact cleanup absence classification", () => {
  it("distinguishes a missing object from daemon and permission failures", () => {
    expect(
      isNoSuchDockerObject(
        { stdout: "", stderr: "Error: No such container: abc" },
        "container"
      )
    ).toBe(true);
    expect(
      isNoSuchDockerObject(
        { stdout: "", stderr: "permission denied connecting to Docker daemon" },
        "container"
      )
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  dockerDaemonIdentityMatches,
  ipv4CidrsOverlap,
  isLocalUnixDockerEndpoint,
  isNoSuchDockerObject,
  isSafeDockerDaemonId
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

  it("binds a run to both socket path and daemon identity", () => {
    const expected = {
      endpoint: "unix:///var/run/docker.sock",
      daemonId: "engine-a"
    };
    expect(dockerDaemonIdentityMatches(expected, expected)).toBe(true);
    expect(
      dockerDaemonIdentityMatches(expected, {
        ...expected,
        daemonId: "engine-b"
      })
    ).toBe(false);
    expect(
      dockerDaemonIdentityMatches(expected, {
        endpoint: "unix:///tmp/docker.sock",
        daemonId: "engine-a"
      })
    ).toBe(false);
    expect(isSafeDockerDaemonId("c125843b-1fe0-48f6-a0d2-e47c7ad83910"))
      .toBe(true);
    expect(isSafeDockerDaemonId("engine\nspoof")).toBe(false);
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
    expect(
      isNoSuchDockerObject(
        {
          stdout: "",
          stderr: "Error response from daemon: network abc not found"
        },
        "network"
      )
    ).toBe(true);
  });
});

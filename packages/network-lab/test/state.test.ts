import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getReservedContainerCleanupOrder,
  readState,
  reserveState,
  saveState
} from "../src/state.js";

describe("persisted Docker recovery state", () => {
  it("reserves live resource names before any Docker ID exists", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-state-"));
    const state = await reserveState(root, "01-04", {
      context: "desktop-linux",
      endpoint: "unix:///tmp/docker.sock",
      source: "context",
      daemonId: "engine-a"
    });

    expect(state.schemaVersion).toBe(3);
    expect(state.network).toEqual({
      name: "cn-lab",
      role: "network",
      id: null
    });
    expect(state.volumes).toEqual([]);
    state.containers.helpers.push({
      name: `cn-capture-cold-${state.runId.slice(-8)}`,
      role: "capture-cold",
      id: null
    });
    state.volumes.push({
      name: `cn-capture-cold-${state.runId.slice(-8)}`,
      role: "capture-data"
    });
    await saveState(root, state);
    expect(getReservedContainerCleanupOrder(state)).toEqual([
      {
        name: `cn-capture-cold-${state.runId.slice(-8)}`,
        role: "capture-cold",
        id: null
      },
      { name: "cn-beta", role: "beta", id: null },
      { name: "cn-alpha", role: "alpha", id: null }
    ]);
    expect(await readState(root)).toEqual(state);
  });

  it("rejects an unsafe persisted daemon identity", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-state-"));
    const state = await reserveState(root, "01-02", {
      context: "default",
      endpoint: "unix:///tmp/docker.sock",
      source: "context",
      daemonId: "engine-a"
    });
    state.dockerEndpoint.daemonId = "engine-a\nspoof";

    await expect(saveState(root, state)).rejects.toThrow(
      "Lab state имеет неверную schema"
    );
  });

  it("binds the evidence directory exactly to session and run IDs", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-state-"));
    const state = await reserveState(root, "01-02", {
      context: "default",
      endpoint: "unix:///tmp/docker.sock",
      source: "context",
      daemonId: "engine-a"
    });
    state.runDirectory = ".training/evidence/01-02/../../escape";

    await expect(saveState(root, state)).rejects.toThrow(
      "Lab state имеет неверную schema"
    );
  });
});

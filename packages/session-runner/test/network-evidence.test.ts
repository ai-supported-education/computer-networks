import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runSessionChecks } from "../src/checks.js";
import type { CourseModule, FlatSession } from "../src/types.js";
import { getSessionDirectory } from "../src/workspace.js";

const moduleDefinition: CourseModule = {
  id: "01",
  slug: "network",
  title: "Network",
  goal: "Network",
  sessions: []
};

const session: FlatSession = {
  index: 1,
  module: moduleDefinition,
  isCapstone: false,
  definition: {
    id: "01-02",
    title: "Baseline",
    minutes: 45,
    kind: "observe",
    outcome: "Evidence",
    done: "Evidence complete",
    checks: ["network-evidence", "review"],
    evidence: {
      produces: ["baseline"],
      verifiedBy: ["automated", "agent"]
    },
    requires: [],
    introduces: ["network-evidence"],
    defers: []
  }
};

describe("session runner network-evidence adapter", () => {
  it("fails a TODO artifact through the registered check label", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-check-"));
    const directory = getSessionDirectory(root, session);
    await mkdir(path.join(directory, "evidence"), { recursive: true });
    await writeFile(path.join(directory, "README.md"), "# Baseline\n");
    await writeFile(
      path.join(directory, "evidence", "baseline.md"),
      "# Baseline\n\n## Expected before action\nTODO\n"
    );
    await writeFile(
      path.join(directory, "evidence", "post-check.md"),
      "# Post-check\n"
    );
    const result = await runSessionChecks(root, session);
    expect(result.passed).toBe(false);
    expect(result.results[0]).toMatchObject({
      label: "network-evidence",
      status: "failed",
      exitCode: 1
    });
    expect(result.results[1]?.status).toBe("manual");
  });
});

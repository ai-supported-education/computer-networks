import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findRepositoryRoot } from "../src/workspace.js";

describe("course repository discovery", () => {
  it("discovers a renamed course from a nested directory", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-course-root-"));
    const nested = path.join(root, "modules", "01", "sessions", "01-01");
    await mkdir(path.join(root, "curriculum"), { recursive: true });
    await mkdir(nested, { recursive: true });
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "@example/renamed-course",
        scripts: {
          "session:validate": "runner validate",
          "network:lab": "lab"
        }
      })
    );
    await writeFile(path.join(root, "curriculum", "course.json"), "{}\n");

    await expect(findRepositoryRoot(nested)).resolves.toBe(root);
  });

  it("does not mistake an unrelated package for a course", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "network-not-course-"));
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ scripts: { "network:lab": "lab" } })
    );

    await expect(findRepositoryRoot(root)).rejects.toThrow(
      "Не найден корень course repository"
    );
  });
});

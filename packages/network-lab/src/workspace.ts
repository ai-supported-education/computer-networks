import { access, readFile } from "node:fs/promises";
import path from "node:path";

export async function findRepositoryRoot(start = process.cwd()): Promise<string> {
  let current = path.resolve(start);
  while (true) {
    try {
      const manifest = JSON.parse(
        await readFile(path.join(current, "package.json"), "utf8")
      ) as { scripts?: Record<string, string> };
      if (
        manifest.scripts?.["session:validate"] &&
        manifest.scripts?.["network:lab"] &&
        (await hasCourseManifest(current))
      ) {
        return current;
      }
    } catch {
      // Continue with the parent directory.
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(
        "Не найден корень course repository. Запустите команду из checkout."
      );
    }
    current = parent;
  }
}

async function hasCourseManifest(root: string): Promise<boolean> {
  try {
    await access(path.join(root, "curriculum", "course.json"));
    return true;
  } catch {
    return false;
  }
}

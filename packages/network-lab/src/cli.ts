import {
  baselineLab,
  captureLab,
  downLab,
  preflightLab,
  preloadImage,
  shellLab,
  statusLab,
  upLab
} from "./lab.js";
import { findRepositoryRoot } from "./workspace.js";

async function main(): Promise<void> {
  const root = await findRepositoryRoot();
  const [command, ...args] = process.argv.slice(2);
  if (!command) throw new Error(usage());

  if (command === "preload" && args.length === 0) return preloadImage();
  if (command === "preflight" && args.length === 0) {
    await preflightLab(root);
    return;
  }
  if (command === "up" && args.length === 1 && args[0]) {
    return upLab(root, args[0]);
  }
  if (command === "baseline" && args.length === 0) return baselineLab(root);
  if (command === "capture" && args.length === 0) return captureLab(root);
  if (
    command === "shell" &&
    args.length === 1 &&
    (args[0] === "src" ||
      args[0] === "dst" ||
      args[0] === "alpha" ||
      args[0] === "beta")
  ) {
    return shellLab(root, args[0]);
  }
  if (command === "down" && args.length === 0) return downLab(root);
  if (command === "status" && args.length === 0) return statusLab(root);
  throw new Error(usage());
}

function usage(): string {
  return (
    "Usage: pnpm network:lab " +
    "<preload|preflight|up 01-02|up 01-04|baseline|capture|shell <src|dst>|down|status>"
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`network:lab FAILED: ${message}\n`);
  process.exitCode = 1;
});

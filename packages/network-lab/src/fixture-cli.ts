import {
  cleanupFixtureInspector,
  generateFixtures,
  inspectFixture,
  preflightFixtureInspector,
  verifyFixtures
} from "./fixtures.js";
import { preloadImage } from "./lab.js";
import { findRepositoryRoot } from "./workspace.js";

async function main(): Promise<void> {
  const root = await findRepositoryRoot();
  const [command = "verify", target, ...extra] = process.argv.slice(2);
  if (extra.length > 0) throw new Error("Слишком много аргументов.");

  if (command === "generate") {
    if (target) throw new Error("generate не принимает target.");
    const written = await generateFixtures(root);
    process.stdout.write(
      written.length > 0
        ? `Созданы deterministic artifacts:\n${written.join("\n")}\n`
        : "Fixtures уже совпадают; ничего не перезаписано.\n"
    );
    return;
  }
  if (command === "verify") {
    const verified = await verifyFixtures(root, target);
    process.stdout.write(`PASS fixture identity\n${verified.join("\n")}\n`);
    return;
  }
  if (command === "preload") {
    if (target) throw new Error("preload не принимает target.");
    await preloadImage();
    return;
  }
  if (command === "preflight") {
    if (target) throw new Error("preflight не принимает target.");
    process.stdout.write(`${await preflightFixtureInspector()}\n`);
    return;
  }
  if (command === "inspect") {
    if (!target) {
      throw new Error("inspect требует fixture file или bundle directory.");
    }
    process.stdout.write(`${await inspectFixture(root, target)}\n`);
    return;
  }
  if (command === "cleanup") {
    if (!target) {
      throw new Error("cleanup требует exact container ID из предыдущей ошибки.");
    }
    await cleanupFixtureInspector(target);
    process.stdout.write(`PASS fixture cleanup exact_container=${target}\n`);
    return;
  }
  throw new Error(
    "Usage: pnpm network:fixture [preload | preflight | verify [target] | inspect <target> | cleanup <container-id> | generate]"
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`network:fixture FAILED: ${message}\n`);
  process.exitCode = 1;
});

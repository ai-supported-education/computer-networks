import {
  generateFixtures,
  inspectFixture,
  verifyFixtures
} from "./fixtures.js";
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
  if (command === "inspect") {
    if (!target) {
      throw new Error("inspect требует fixture file или bundle directory.");
    }
    process.stdout.write(`${await inspectFixture(root, target)}\n`);
    return;
  }
  throw new Error(
    "Usage: pnpm network:fixture [verify [target] | inspect <target> | generate]"
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`network:fixture FAILED: ${message}\n`);
  process.exitCode = 1;
});

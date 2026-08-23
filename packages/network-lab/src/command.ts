import { spawn } from "node:child_process";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunCommandOptions {
  cwd?: string;
  log?: boolean;
  timeoutMs?: number;
  stdin?: "inherit" | "ignore";
  stdout?: "capture" | "inherit";
}

export class CommandError extends Error {
  readonly command: string;
  readonly result: CommandResult | null;

  constructor(command: string, message: string, result: CommandResult | null) {
    super(message);
    this.name = "CommandError";
    this.command = command;
    this.result = result;
  }
}

export function formatCommand(command: string, args: readonly string[]): string {
  return [command, ...args].map(quoteArgument).join(" ");
}

export async function runCommand(
  command: string,
  args: readonly string[],
  options: RunCommandOptions = {}
): Promise<CommandResult> {
  const printable = formatCommand(command, args);
  if (options.log !== false) process.stderr.write(`+ ${printable}\n`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: process.env,
      shell: false,
      stdio: [
        options.stdin === "inherit" ? "inherit" : "ignore",
        options.stdout === "inherit" ? "inherit" : "pipe",
        options.stdout === "inherit" ? "inherit" : "pipe"
      ]
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;

    if (child.stdout) {
      child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    }
    if (child.stderr) {
      child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    }

    const timeout = options.timeoutMs
      ? setTimeout(() => {
          if (!settled) {
            child.kill("SIGKILL");
          }
        }, options.timeoutMs)
      : null;

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      reject(
        new CommandError(
          printable,
          `Не удалось запустить ${printable}: ${error.message}`,
          null
        )
      );
    });

    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      const result: CommandResult = {
        stdout: Buffer.concat(stdout).toString("utf8").trim(),
        stderr: Buffer.concat(stderr).toString("utf8").trim(),
        exitCode: code ?? 128
      };
      if (signal) {
        reject(
          new CommandError(
            printable,
            `Команда превысила limit или завершена сигналом ${signal}: ${printable}`,
            result
          )
        );
      } else if (result.exitCode !== 0) {
        const detail = result.stderr || result.stdout || "нет вывода";
        reject(
          new CommandError(
            printable,
            `Команда завершилась с code ${result.exitCode}: ${detail}`,
            result
          )
        );
      } else {
        resolve(result);
      }
    });
  });
}

export async function tryCommand(
  command: string,
  args: readonly string[],
  options: RunCommandOptions = {}
): Promise<CommandResult> {
  try {
    return await runCommand(command, args, options);
  } catch (error) {
    if (error instanceof CommandError && error.result) {
      return error.result;
    }
    throw error;
  }
}

function quoteArgument(value: string): string {
  if (/^[a-zA-Z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

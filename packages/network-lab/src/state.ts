import { randomUUID } from "node:crypto";
import {
  appendFile,
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { DOCKER_ID_PATTERN } from "./constants.js";

export interface LabState {
  schemaVersion: 1;
  runId: string;
  sessionId: "01-02" | "01-04";
  createdAt: string;
  runDirectory: string;
  sequence: number;
  baselinePassed: boolean;
  networkId: string | null;
  containerIds: {
    alpha: string | null;
    beta: string | null;
    helpers: string[];
  };
}

export interface LabEvent {
  schemaVersion: 1;
  sequence: number;
  at: string;
  phase: string;
  kind: "expected" | "action" | "observed" | "error" | "cleanup";
  detail: string;
}

export async function reserveState(
  root: string,
  sessionId: "01-02" | "01-04"
): Promise<LabState> {
  const stateFile = getStateFile(root);
  const existing = await lstat(stateFile).catch(() => null);
  if (existing) {
    throw new Error(
      "Уже есть active lab state. Выполните network:lab status/down."
    );
  }
  const now = new Date();
  const runId =
    now.toISOString().replace(/[:.]/g, "-") + "-" + randomUUID().slice(0, 8);
  const runDirectory = toPosix(
    path.join(".training", "evidence", sessionId, runId)
  );
  const state: LabState = {
    schemaVersion: 1,
    runId,
    sessionId,
    createdAt: now.toISOString(),
    runDirectory,
    sequence: 0,
    baselinePassed: false,
    networkId: null,
    containerIds: {
      alpha: null,
      beta: null,
      helpers: []
    }
  };
  await mkdir(path.dirname(stateFile), { recursive: true });
  const handle = await open(stateFile, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(state, null, 2) + "\n");
  } finally {
    await handle.close();
  }
  try {
    await mkdir(path.dirname(path.join(root, runDirectory)), {
      recursive: true
    });
    await mkdir(path.join(root, runDirectory), { recursive: false });
  } catch (error) {
    await unlink(stateFile).catch(() => undefined);
    throw error;
  }
  return state;
}

export async function readState(root: string): Promise<LabState> {
  const stateFile = getStateFile(root);
  const metadata = await lstat(stateFile).catch(() => null);
  if (!metadata || !metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("Active lab state не найден.");
  }
  const parsed = JSON.parse(await readFile(stateFile, "utf8")) as unknown;
  assertState(parsed);
  return parsed;
}

export async function readStateIfPresent(
  root: string
): Promise<LabState | null> {
  const exists = await lstat(getStateFile(root)).catch(() => null);
  return exists ? readState(root) : null;
}

export async function saveState(root: string, state: LabState): Promise<void> {
  assertState(state);
  const stateFile = getStateFile(root);
  const temporary = `${stateFile}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporary, JSON.stringify(state, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600
  });
  await rename(temporary, stateFile);
}

export async function appendEvent(
  root: string,
  state: LabState,
  event: Omit<LabEvent, "schemaVersion" | "sequence" | "at">
): Promise<void> {
  state.sequence += 1;
  await saveState(root, state);
  const record: LabEvent = {
    schemaVersion: 1,
    sequence: state.sequence,
    at: new Date().toISOString(),
    ...event
  };
  await appendFile(
    path.join(root, state.runDirectory, "events.jsonl"),
    JSON.stringify(record) + "\n",
    { encoding: "utf8", flag: "a", mode: 0o600 }
  );
}

export async function writeRunArtifact(
  root: string,
  state: LabState,
  relativePath: string,
  content: string | Buffer
): Promise<void> {
  const runRoot = path.join(root, state.runDirectory);
  const target = path.resolve(runRoot, relativePath);
  if (!target.startsWith(`${runRoot}${path.sep}`)) {
    throw new Error("Artifact path выходит за пределы run directory.");
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, { flag: "wx", mode: 0o600 });
}

export async function removeState(root: string): Promise<void> {
  await unlink(getStateFile(root));
}

export function runPath(root: string, state: LabState, ...parts: string[]): string {
  return path.join(root, state.runDirectory, ...parts);
}

function getStateFile(root: string): string {
  return path.join(root, ".training", "network-lab", "state.json");
}

function assertState(value: unknown): asserts value is LabState {
  if (!value || typeof value !== "object") {
    throw new Error("Lab state повреждён.");
  }
  const state = value as Partial<LabState>;
  if (
    state.schemaVersion !== 1 ||
    typeof state.runId !== "string" ||
    !/^[a-zA-Z0-9-]+$/.test(state.runId) ||
    (state.sessionId !== "01-02" && state.sessionId !== "01-04") ||
    typeof state.runDirectory !== "string" ||
    !state.runDirectory.startsWith(`.training/evidence/${state.sessionId}/`) ||
    typeof state.sequence !== "number" ||
    typeof state.baselinePassed !== "boolean" ||
    !state.containerIds ||
    (state.networkId !== null && typeof state.networkId !== "string") ||
    (state.containerIds.alpha !== null &&
      typeof state.containerIds.alpha !== "string") ||
    (state.containerIds.beta !== null &&
      typeof state.containerIds.beta !== "string") ||
    !Array.isArray(state.containerIds.helpers) ||
    state.containerIds.helpers.some((id) => typeof id !== "string")
  ) {
    throw new Error("Lab state имеет неверную schema.");
  }
  const ids: (string | null)[] = [
    state.networkId,
    state.containerIds.alpha,
    state.containerIds.beta,
    ...state.containerIds.helpers
  ];
  for (const id of ids) {
    if (id !== null && !DOCKER_ID_PATTERN.test(id)) {
      throw new Error("Lab state содержит небезопасный Docker ID.");
    }
  }
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

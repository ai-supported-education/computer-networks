import { runCommand, type CommandResult } from "./command.js";

export interface DockerEndpointAddress {
  context: string;
  endpoint: string;
  source: "context" | "DOCKER_CONTEXT" | "DOCKER_HOST";
}

export interface DockerEndpointInventory extends DockerEndpointAddress {
  daemonId: string;
}

export async function resolveLocalDockerEndpoint(): Promise<DockerEndpointAddress> {
  const contextResult = await runCommand("docker", ["context", "show"], {
    timeoutMs: 10_000
  });
  const context = contextResult.stdout.trim();
  if (!context || context.length > 255 || context.includes("\0")) {
    throw new Error(`Docker context имеет unexpected name: ${context || "(empty)"}`);
  }
  const inspected = await runCommand(
    "docker",
    [
      "context",
      "inspect",
      context,
      "--format",
      "{{json .Endpoints.docker.Host}}"
    ],
    { timeoutMs: 10_000 }
  );
  const contextEndpoint = JSON.parse(inspected.stdout) as unknown;
  if (typeof contextEndpoint !== "string" || contextEndpoint.length === 0) {
    throw new Error("Docker context не содержит endpoint host.");
  }

  const contextOverride = process.env.DOCKER_CONTEXT?.trim();
  const hostOverride = process.env.DOCKER_HOST?.trim();
  const endpoint = contextOverride
    ? contextEndpoint
    : hostOverride || contextEndpoint;
  const source: DockerEndpointAddress["source"] = contextOverride
    ? "DOCKER_CONTEXT"
    : hostOverride
      ? "DOCKER_HOST"
      : "context";

  if (!isLocalUnixDockerEndpoint(endpoint)) {
    throw new Error(
      `Refuse Docker action: active endpoint from ${source} is not a local unix socket (${endpoint}).`
    );
  }
  return { context, endpoint, source };
}

export async function requireLocalDockerEndpoint(): Promise<DockerEndpointInventory> {
  const address = await resolveLocalDockerEndpoint();
  return { ...address, daemonId: await readDockerDaemonId() };
}

export async function requireMatchingDockerEndpoint(
  expected: DockerEndpointInventory
): Promise<DockerEndpointInventory> {
  const address = await resolveLocalDockerEndpoint();
  if (address.endpoint !== expected.endpoint) {
    throw new Error(
      `Refuse Docker action: active run belongs to ${expected.endpoint}, current local endpoint is ${address.endpoint}. Restore the original Docker context first.`
    );
  }
  const current = { ...address, daemonId: await readDockerDaemonId() };
  if (!dockerDaemonIdentityMatches(expected, current)) {
    throw new Error(
      `Refuse Docker action: endpoint ${address.endpoint} now serves daemon ${current.daemonId}, but active run belongs to daemon ${expected.daemonId}. Restore the original Docker engine first.`
    );
  }
  return current;
}

export function dockerDaemonIdentityMatches(
  expected: Pick<DockerEndpointInventory, "endpoint" | "daemonId">,
  current: Pick<DockerEndpointInventory, "endpoint" | "daemonId">
): boolean {
  return (
    expected.endpoint === current.endpoint &&
    expected.daemonId === current.daemonId
  );
}

export function isLocalUnixDockerEndpoint(endpoint: string): boolean {
  if (!endpoint.startsWith("unix://")) return false;
  const socketPath = endpoint.slice("unix://".length);
  return socketPath.startsWith("/") && socketPath.length > 1 && !socketPath.includes("\0");
}

export function isSafeDockerDaemonId(value: string): boolean {
  return /^[A-Za-z0-9:._-]{1,255}$/.test(value);
}

export function isNoSuchDockerObject(
  result: Pick<CommandResult, "stdout" | "stderr">,
  kind: "container" | "image" | "network" | "volume"
): boolean {
  const message = `${result.stdout}\n${result.stderr}`;
  return (
    new RegExp(`no such ${kind}(?:\\b|:)`, "i").test(message) ||
    (kind === "network" && /\bnetwork\b[^\n]*\bnot found\b/i.test(message))
  );
}

export function ipv4CidrsOverlap(first: string, second: string): boolean {
  const left = ipv4Range(first);
  const right = ipv4Range(second);
  if (!left || !right) return false;
  return left.start <= right.end && right.start <= left.end;
}

function ipv4Range(cidr: string): { start: bigint; end: bigint } | null {
  const [address, prefixText, ...extra] = cidr.split("/");
  if (!address || !prefixText || extra.length > 0 || address.includes(":")) {
    return null;
  }
  const prefix = Number(prefixText);
  const octetTexts = address.split(".");
  const octets = octetTexts.map(Number);
  if (
    !Number.isInteger(prefix) ||
    prefix < 0 ||
    prefix > 32 ||
    octets.length !== 4 ||
    octets.some(
      (octet, index) =>
        !Number.isInteger(octet) ||
        octet < 0 ||
        octet > 255 ||
        String(octet) !== octetTexts[index]
    )
  ) {
    return null;
  }
  let value = 0n;
  for (const octet of octets) value = (value << 8n) | BigInt(octet);
  const hostBits = BigInt(32 - prefix);
  const hostMask = hostBits === 0n ? 0n : (1n << hostBits) - 1n;
  const start = value & (0xffffffffn ^ hostMask);
  return { start, end: start + hostMask };
}

async function readDockerDaemonId(): Promise<string> {
  const result = await runCommand(
    "docker",
    ["info", "--format", "{{json .ID}}"],
    { timeoutMs: 10_000 }
  );
  const parsed = JSON.parse(result.stdout) as unknown;
  if (typeof parsed !== "string" || !isSafeDockerDaemonId(parsed)) {
    throw new Error("Docker daemon вернул небезопасный или пустой Engine ID.");
  }
  return parsed;
}

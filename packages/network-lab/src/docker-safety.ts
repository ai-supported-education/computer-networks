import { runCommand, type CommandResult } from "./command.js";

export interface DockerEndpointInventory {
  context: string;
  endpoint: string;
  source: "context" | "DOCKER_CONTEXT" | "DOCKER_HOST";
}

export async function requireLocalDockerEndpoint(): Promise<DockerEndpointInventory> {
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
  const source: DockerEndpointInventory["source"] = contextOverride
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

export function isLocalUnixDockerEndpoint(endpoint: string): boolean {
  if (!endpoint.startsWith("unix://")) return false;
  const socketPath = endpoint.slice("unix://".length);
  return socketPath.startsWith("/") && socketPath.length > 1 && !socketPath.includes("\0");
}

export function isNoSuchDockerObject(
  result: Pick<CommandResult, "stdout" | "stderr">,
  kind: "container" | "volume"
): boolean {
  const message = `${result.stdout}\n${result.stderr}`;
  return new RegExp(`no such ${kind}(?:\\b|:)`, "i").test(message);
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

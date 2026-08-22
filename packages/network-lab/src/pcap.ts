import { createHash } from "node:crypto";

export interface PcapRecord {
  seconds: number;
  microseconds: number;
  frame: Buffer;
}

export function createClassicPcap(records: readonly PcapRecord[]): Buffer {
  const chunks: Buffer[] = [];
  const header = Buffer.alloc(24);
  header.writeUInt32LE(0xa1b2c3d4, 0);
  header.writeUInt16LE(2, 4);
  header.writeUInt16LE(4, 6);
  header.writeInt32LE(0, 8);
  header.writeUInt32LE(0, 12);
  header.writeUInt32LE(65_535, 16);
  header.writeUInt32LE(1, 20);
  chunks.push(header);

  for (const record of records) {
    const recordHeader = Buffer.alloc(16);
    recordHeader.writeUInt32LE(record.seconds, 0);
    recordHeader.writeUInt32LE(record.microseconds, 4);
    recordHeader.writeUInt32LE(record.frame.length, 8);
    recordHeader.writeUInt32LE(record.frame.length, 12);
    chunks.push(recordHeader, record.frame);
  }

  return Buffer.concat(chunks);
}

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function buildArpFrame(options: {
  operation: 1 | 2;
  ethernetSource: string;
  ethernetDestination: string;
  senderMac: string;
  senderIpv4: string;
  targetMac: string;
  targetIpv4: string;
}): Buffer {
  const frame = Buffer.alloc(42);
  macBytes(options.ethernetDestination).copy(frame, 0);
  macBytes(options.ethernetSource).copy(frame, 6);
  frame.writeUInt16BE(0x0806, 12);
  frame.writeUInt16BE(1, 14);
  frame.writeUInt16BE(0x0800, 16);
  frame.writeUInt8(6, 18);
  frame.writeUInt8(4, 19);
  frame.writeUInt16BE(options.operation, 20);
  macBytes(options.senderMac).copy(frame, 22);
  ipv4Bytes(options.senderIpv4).copy(frame, 28);
  macBytes(options.targetMac).copy(frame, 32);
  ipv4Bytes(options.targetIpv4).copy(frame, 38);
  return frame;
}

export function buildIcmpEchoFrame(options: {
  ethernetSource: string;
  ethernetDestination: string;
  ipv4Source: string;
  ipv4Destination: string;
  type: 0 | 8;
  identifier: number;
  sequence: number;
  ipIdentifier: number;
  payload: Buffer;
  ttl?: number;
}): Buffer {
  const icmp = Buffer.alloc(8 + options.payload.length);
  icmp.writeUInt8(options.type, 0);
  icmp.writeUInt8(0, 1);
  icmp.writeUInt16BE(options.identifier, 4);
  icmp.writeUInt16BE(options.sequence, 6);
  options.payload.copy(icmp, 8);
  icmp.writeUInt16BE(internetChecksum(icmp), 2);

  const ipv4 = Buffer.alloc(20);
  ipv4.writeUInt8(0x45, 0);
  ipv4.writeUInt8(0, 1);
  ipv4.writeUInt16BE(ipv4.length + icmp.length, 2);
  ipv4.writeUInt16BE(options.ipIdentifier, 4);
  ipv4.writeUInt16BE(0x4000, 6);
  ipv4.writeUInt8(options.ttl ?? 64, 8);
  ipv4.writeUInt8(1, 9);
  ipv4Bytes(options.ipv4Source).copy(ipv4, 12);
  ipv4Bytes(options.ipv4Destination).copy(ipv4, 16);
  ipv4.writeUInt16BE(internetChecksum(ipv4), 10);

  const ethernet = Buffer.alloc(14);
  macBytes(options.ethernetDestination).copy(ethernet, 0);
  macBytes(options.ethernetSource).copy(ethernet, 6);
  ethernet.writeUInt16BE(0x0800, 12);
  return Buffer.concat([ethernet, ipv4, icmp]);
}

function internetChecksum(input: Buffer): number {
  let sum = 0;
  for (let index = 0; index < input.length; index += 2) {
    sum +=
      index + 1 < input.length
        ? input.readUInt16BE(index)
        : input.readUInt8(index) << 8;
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  return (~sum) & 0xffff;
}

function macBytes(value: string): Buffer {
  const parts = value.split(":");
  if (
    parts.length !== 6 ||
    parts.some((part) => !/^[a-fA-F0-9]{2}$/.test(part))
  ) {
    throw new Error(`Некорректный MAC: ${value}`);
  }
  return Buffer.from(parts.map((part) => Number.parseInt(part, 16)));
}

function ipv4Bytes(value: string): Buffer {
  const parts = value.split(".");
  if (
    parts.length !== 4 ||
    parts.some((part) => {
      const number = Number(part);
      return !Number.isInteger(number) || number < 0 || number > 255;
    })
  ) {
    throw new Error(`Некорректный IPv4: ${value}`);
  }
  return Buffer.from(parts.map(Number));
}

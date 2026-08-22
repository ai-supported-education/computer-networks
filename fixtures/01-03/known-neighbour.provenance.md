# Synthetic provenance

- Generator: packages/network-lab/src/fixtures.ts
- Format: classic pcap v2.4, little-endian, microsecond timestamps, Ethernet link type.
- Origin: deterministic synthetic bytes; no host or external traffic.
- Endpoints: 172.30.0.10 / 02:42:ac:1e:00:0a and 172.30.0.20 / 02:42:ac:1e:00:14.
- Capture point model: source endpoint after neighbour mapping is known.
- Frames: two Ethernet frames; original and captured lengths are both 74 bytes, so neither record is truncated; no Ethernet FCS.
- Deterministic fields: addresses, payload, ICMP identifier/sequence, IP IDs, TTL, checksums and relative order.
- This fixture does not prove live host, route, gateway or kernel behaviour.

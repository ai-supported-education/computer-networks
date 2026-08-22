# Synthetic provenance: arp-no-reply

- Generator: packages/network-lab/src/fixtures.ts
- Origin: deterministic synthetic evidence; no live or external traffic.
- Capture point: alpha:eth0 (172.30.0.10).
- Filter scope: ARP or IPv4 ICMP involving 172.30.0.20.
- Observation window: 2000 ms; frame limit: 8; Ethernet link type.
- Absence is usable only together with baseline, action and bounded window.
- Bundle localises observations; it does not encode a root-cause answer.

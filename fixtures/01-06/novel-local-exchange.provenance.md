# Synthetic provenance

- Generator: packages/network-lab/src/fixtures.ts
- Origin: deterministic synthetic bytes; no live or external traffic.
- Inventory: alpha 172.30.0.10 / 02:42:ac:1e:00:0a; beta 172.30.0.20 / 02:42:ac:1e:00:14.
- Baseline companion: fixtures/01-06/novel-local-exchange.baseline.txt; alpha:eth0 is UP/LOWER_UP and the beta neighbor entry is absent before the bounded exchange.
- Assumption supplied by the bundle: both endpoints belong to one local Ethernet LAN.
- Capture point model: alpha network namespace, ARP and IPv4 ICMP, six-frame ceiling.
- Deterministic fields: timestamps, addresses, payload, identifiers, checksums and order.
- The capture does not expose endpoint internals, host routing or traffic outside its window.

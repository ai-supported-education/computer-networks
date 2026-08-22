# Catalog of synthetic packet fixtures

Этот каталог является reviewer-visible text companion для binary fixtures.
Все пакеты собраны детерминированным генератором
packages/network-lab/src/fixtures.ts и не содержат host, user или external
traffic. Canonical identity проверяется командой pnpm network:fixture verify.

## Общий inventory

| Endpoint | IPv4 | MAC |
| --- | --- | --- |
| alpha / source | 172.30.0.10 | 02:42:ac:1e:00:0a |
| beta / destination | 172.30.0.20 | 02:42:ac:1e:00:14 |

Binary format: classic pcap v2.4, little-endian, microsecond timestamps,
Ethernet link type, snaplen 65535. Ethernet FCS не записан. Addresses, payload,
fixture timestamps, identifiers, checksums и frame order детерминированы внутри
versioned fixtures. В live capture timestamps, IP/ICMP identifiers и checksums
могут меняться и не являются invariant.

## 01-03 known-neighbour

- Path: fixtures/01-03/known-neighbour.pcap
- SHA-256: 8a4036d450c9f0953c50286f2dc99d429873900e8f92f22a1d2f8f6f1b6dc64f
- Provenance: fixtures/01-03/known-neighbour.provenance.md
- Canonical text: fixtures/01-03/known-neighbour.txt
- Capture model: source endpoint after neighbour mapping is known.

| frame | time_epoch | len | Ethernet src to dst | IPv4 src to dst | proto | ICMP type/id/seq |
| ---: | ---: | ---: | --- | --- | ---: | --- |
| 1 | 1704067200.000000 | 74 | ...:0a to ...:14 | .10 to .20 | 1 | 8 / 4660 / 1 |
| 2 | 1704067200.001000 | 74 | ...:14 to ...:0a | .20 to .10 | 1 | 0 / 4660 / 1 |

## 01-05 evidence bundles

Каждый bundle содержит capture.pcap, sha256.txt, provenance.md, baseline.txt,
action.txt и derived events.tsv. Таблицы перечисляют observed records и bounds,
но не назначают root cause.

### interface-not-ready

- Directory: fixtures/01-05/interface-not-ready/
- SHA-256: acc530668c8bc60b2d229281130b1899bfc81d70fdada5c34b3236c628f739c8
- Raw metadata: valid 24-byte empty pcap, zero packet records.
- Bound: source alpha:eth0, target .20, 2000 ms, at most 8 frames.
- Baseline companion records eth0 state DOWN; action companion records one
  requested bounded Echo probe.

| frame | elapsed | protocol | observed record |
| --- | --- | --- | --- |
| none | bounded window | none | no relevant frame record |

### arp-no-reply

- Directory: fixtures/01-05/arp-no-reply/
- SHA-256: 46ded4b8104f7e279d33365a1b2a551e01c4c4cc2b10f1993c80d832cf966523
- Bound: source alpha:eth0, target .20, 2000 ms, at most 8 frames.

| frame | elapsed_ms | protocol | observed record |
| ---: | ---: | --- | --- |
| 1 | 0 | ARP | request who-has .20 tell .10 |
| 2 | 500 | ARP | request who-has .20 tell .10 |
| 3 | 1000 | ARP | request who-has .20 tell .10 |

### icmp-no-reply

- Directory: fixtures/01-05/icmp-no-reply/
- SHA-256: adaecae9a461e515f709f7f39480bc24523a7381556e092965bf1d180000d041
- Bound: source alpha:eth0, target .20, 2000 ms, at most 8 frames.

| frame | elapsed_ms | protocol | observed record |
| ---: | ---: | --- | --- |
| 1 | 0.0 | ARP | request who-has .20 tell .10 |
| 2 | 0.3 | ARP | reply .20 is-at ...:14 |
| 3 | 0.9 | ICMP | Echo type 8 .10 to .20, id 20741, seq 1 |

## 01-06 novel-local-exchange

- Path: fixtures/01-06/novel-local-exchange.pcap
- SHA-256: e8e22341c995edf8fb1ad045d5fd089d3130490e5a506b85889b2a9ada3f4ddd
- Provenance: fixtures/01-06/novel-local-exchange.provenance.md
- Canonical text: fixtures/01-06/novel-local-exchange.txt
- Supplied assumption: both endpoints belong to one local Ethernet LAN.
- Capture model: source namespace, ARP and IPv4/ICMP, six-frame ceiling.

| frame | time_epoch | len | Ethernet src to dst | decoded fields |
| ---: | ---: | ---: | --- | --- |
| 1 | 1704068400.000000 | 42 | ...:0a to broadcast | ARP opcode 1, .10 to .20 |
| 2 | 1704068400.000250 | 42 | ...:14 to ...:0a | ARP opcode 2, .20 to .10 |
| 3 | 1704068400.000900 | 74 | ...:0a to ...:14 | IPv4 .10 to .20, ICMP type 8, id 25094, seq 7 |
| 4 | 1704068400.001600 | 74 | ...:14 to ...:0a | IPv4 .20 to .10, ICMP type 0, id 25094, seq 7 |
| 5 | 1704068400.005000 | 74 | ...:0a to ...:14 | IPv4 .10 to .20, ICMP type 8, id 25094, seq 8 |
| 6 | 1704068400.005700 | 74 | ...:14 to ...:0a | IPv4 .20 to .10, ICMP type 0, id 25094, seq 8 |

Catalog rows are normalized observations, not diagnostic conclusions. Captures
do not expose endpoint process internals, route selection, gateway behaviour or
traffic outside their stated observation window.

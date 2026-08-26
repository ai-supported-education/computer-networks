# Каталог искусственных наборов сетевых пакетов

Этот каталог доступен учащемуся и перечисляет бинарные учебные наборы. Все пакеты
собраны детерминированным генератором
`packages/network-lab/src/fixtures.ts` и не содержат трафик хоста, пользователя
или внешней сети. Путь и SHA-256 набора проверяет команда
`pnpm network:fixture verify`.

## Общие исходные данные

| Endpoint | IPv4 | MAC |
| --- | --- | --- |
| alpha / source | 172.30.0.10 | 02:42:ac:1e:00:0a |
| beta / destination | 172.30.0.20 | 02:42:ac:1e:00:14 |

Формат файлов: classic pcap v2.4, порядок байтов little-endian, отметки времени с
точностью до микросекунд, тип канала Ethernet, `snaplen=65535`. Контрольная сумма
кадра Ethernet (FCS) не записана. Адреса, payload, отметки времени, идентификаторы,
checksums и порядок кадров фиксированы внутри версионируемых учебных наборов. В
живом захвате отметки времени, IP/ICMP identifiers и checksums могут меняться,
поэтому их нельзя использовать как неизменный эталон.

## 01-03 known-neighbour

- Path: fixtures/01-03/known-neighbour.pcap
- SHA-256: 8a4036d450c9f0953c50286f2dc99d429873900e8f92f22a1d2f8f6f1b6dc64f
- Provenance: fixtures/01-03/known-neighbour.provenance.md
- Canonical text: fixtures/01-03/known-neighbour.txt
- Capture model: source endpoint after neighbour mapping is known.

| frame | time_epoch | original/captured len | Ethernet src to dst | IPv4 src to dst | proto | ICMP type/id/seq |
| ---: | ---: | ---: | --- | --- | ---: | --- |
| 1 | 1704067200.000000 | 74 / 74 | ...:0a to ...:14 | .10 to .20 | 1 | 8 / 4660 / 1 |
| 2 | 1704067200.001000 | 74 / 74 | ...:14 to ...:0a | .20 to .10 | 1 | 0 / 4660 / 1 |

## 01-05 evidence bundles

Каждый набор содержит `capture.pcap`, `sha256.txt`, `provenance.md`,
`baseline.txt`, `action.txt` и полученный из захвата `events.tsv`. Таблицы ниже
фиксируют заявления каталога о записях и границах наблюдения, но не назначают
первопричину. До воспроизведения через `inspect` это исходные данные (`Source
facts`), а не наблюдения учащегося (`Observed`).

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
- Baseline: fixtures/01-06/novel-local-exchange.baseline.txt (`alpha:eth0`
  `UP LOWER_UP`, fixed MAC/IPv4, beta neighbor entry absent).
- Supplied assumption: both endpoints belong to one local Ethernet LAN.
- Capture model: source namespace, ARP and IPv4/ICMP, six-frame ceiling.

Target-specific normalized rows здесь намеренно не продублированы: их извлечение
из versioned pcap через обязательный `pnpm network:fixture inspect` является
частью задания 01-06. Catalog фиксирует identity, provenance и observation bound,
но не служит готовым frame inventory.

Строки каталога описывают нормализованные записи, но не являются диагностическими
выводами. Захваты не показывают внутреннюю работу процессов на узлах, выбор
маршрута, поведение gateway или трафик за пределами указанного окна наблюдения.

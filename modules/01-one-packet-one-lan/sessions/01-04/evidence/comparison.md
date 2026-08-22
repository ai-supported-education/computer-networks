# Cold/warm comparison 01-04

## Expected before action

TODO: UTC timestamp записи до `pnpm network:lab up 01-04`.

### Cold prediction

TODO: ожидаемый порядок events до запуска.

### Warm prediction

TODO: ожидаемое отличие второго run до запуска.

## Action start and raw evidence

TODO: UTC start marker из `events.jsonl` и один unique
`.training/evidence/01-04/<run-id>/`.

## Preflight and topology evidence

TODO: exact ссылки/observations из `preflight.json`, `topology-inspect.json` и
`baseline.txt`: local `unix://` Docker endpoint, `conflictCount=0`, initial
container/network/volume counts, target/interface, isolation, limits и exposure.

## Cold observations

TODO: `cold/neighbor-before.txt`, `cold/neighbor-after.txt`, `cold/capture.pcap`,
`cold/capture.sha256.txt`, `cold/events.tsv`, ARP order, advertised beta
`arp.src.hw_mac=02:42:ac:1e:00:14`, Ethernet directions и matching ICMP id/seq.

## Warm observations

TODO: `warm/neighbor-before.txt`, `warm/neighbor-after.txt`, `warm/capture.pcap`,
`warm/capture.sha256.txt`, `warm/events.tsv`, mapping и matching ICMP id/seq.

## Comparison and inference

TODO: причинно объясните различие, отделив observed от inference.

## Alternative explanations and variable fields

TODO: минимум одна альтернатива и список полей, которые не сравнивались как
фиксированные.

## Cleanup and post-check

TODO: команда/timestamp, `.training/evidence/01-04/<тот-же-run-id>/post-check.txt`,
фактические `containers=0`, `networks=0`, `volumes=0`, exact/labelled counts.

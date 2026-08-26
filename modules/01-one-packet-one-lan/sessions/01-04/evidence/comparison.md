# Cold/warm comparison 01-04

Сначала запишите оба прогноза. Затем используйте `Cold observations` и
`Warm observations` только для данных из одного выбранного запуска.

## Source facts

TODO: процитируйте формат ARP Request/Reply из RFC 826 и фиксированные адреса
узлов из `lab-environment.md`. Не переносите сюда результаты живого запуска.

## Assumptions before action

TODO: явно запишите используемое в этой главе допущение об одной LAN и границу его
применимости; другие допущения перечислите отдельно либо обоснуйте их отсутствие.

## Expected before action

TODO: отметка времени UTC, записанная до `pnpm network:lab up 01-04`.

### Cold prediction

TODO: ожидаемый порядок событий до запуска.

### Warm prediction

TODO: ожидаемое отличие второй фазы того же запуска.

## Action start and raw evidence

TODO: отметка начала UTC из `events.jsonl` и один уникальный
`.training/evidence/01-04/<run-id>/`.

## Preflight and topology evidence

TODO: точные ссылки и `Observations` из `preflight.json`, `topology-inspect.json`
и `baseline.txt`: локальный Docker endpoint `unix://`, `conflictCount=0`, initial
container/network/volume counts, target/interface, isolation, limits и exposure.
Добавьте `helpers/neigh-flush.json` с фактически подтверждёнными guardrails.

## Cold observations

TODO: `cold/neighbor-before.txt`, `cold/neighbor-after.txt`, `cold/capture.pcap`,
`cold/capture.sha256.txt`, `cold/events.tsv`, ARP order, advertised beta
`arp.src.hw_mac`, Ethernet directions, matching ICMP id/seq и runtime snapshots
`helpers/capture-cold.json`, `helpers/probe-cold.json`. Затем отдельно сравните
наблюдаемый `arp.src.hw_mac` с адресом beta из Source facts.

## Warm observations

TODO: `warm/neighbor-before.txt`, `warm/neighbor-after.txt`, `warm/capture.pcap`,
`warm/capture.sha256.txt`, `warm/events.tsv`, mapping и matching ICMP id/seq.
Сошлитесь также на `helpers/capture-warm.json` и `helpers/probe-warm.json`.

## Comparison and inference

TODO: причинно объясните различие, отделив `Observed` от `Inference`.

## Alternative explanations and variable fields

TODO: минимум одно альтернативное объяснение и список полей, которые не сравнивались как
фиксированные.

## Cleanup and post-check

TODO: команда и отметка времени, `.training/evidence/01-04/<тот-же-run-id>/post-check.txt`,
фактические `containers=0`, `networks=0`, `volumes=0`, exact/labelled counts.

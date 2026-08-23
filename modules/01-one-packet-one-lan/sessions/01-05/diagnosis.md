# Diagnosis 01-05

## Expected before inspector actions

TODO: один ISO UTC timestamp до первого `inspect`, expected operational contract и
assumptions без заранее заполненных диагнозов или target fields. Допустимая форма
Expected описывает три verified identities, три отдельных network-none runs,
четыре raw artifacts и clean post-check каждого; protocol events пока unknown.

## Inspector run ledger

TODO: для Case A/B/C — отдельный `.training/evidence/01-05/<run-id>/`,
`inspect_action_at`, `cleanup_at`, ссылки на `preflight.txt`, `events.jsonl`,
`inspect.txt`, `post-check.txt`, exact cleanup marker и labelled counts `0/0/0`.
Не подставляйте сюда timestamp synthetic probe из fixture `action.txt`.

## Case A — interface-not-ready

### Verified inputs and observations

TODO: hash/provenance и точные citations на `baseline.txt`, `action.txt` и
`events.tsv`/bounded empty-capture metadata.

### Last proven stage

TODO

### Earliest disproven or not-proven transition

TODO

### Bounded inference

TODO

### Remaining unknowns

TODO: минимум две.

### Next discriminating observation

TODO: только предложите bounded read-only evidence, не запускайте новый probe;
назовите competing hypotheses и разные ожидаемые результаты observation.

## Case B — arp-no-reply

### Verified inputs and observations

TODO: hash/provenance и точные citations на `baseline.txt`, `action.txt` и
`events.tsv`/bounded empty-capture metadata.

### Last proven stage

TODO

### Earliest disproven or not-proven transition

TODO

### Bounded inference

TODO

### Remaining unknowns

TODO: минимум две.

### Next discriminating observation

TODO

## Case C — icmp-no-reply

### Verified inputs and observations

TODO: hash/provenance и точные citations на `baseline.txt`, `action.txt` и
`events.tsv`/bounded empty-capture metadata.

### Last proven stage

TODO

### Earliest disproven or not-proven transition

TODO

### Bounded inference

TODO

### Remaining unknowns

TODO: минимум две.

### Next discriminating observation

TODO

## Cross-case comparison

TODO: почему одинаковый верхнеуровневый symptom не означает одинаковую causal
boundary.

## Offline inspector cleanup

TODO: три фактических `exact_container_absent=true` из post-check тех же runs и
итоговый `pnpm network:lab status`.

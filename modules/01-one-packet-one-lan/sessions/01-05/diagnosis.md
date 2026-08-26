# Diagnosis 01-05

Для каждого случая двигайтесь от проверенных входных данных к первой границе,
которую они больше не подтверждают. Не заполняйте конкретную первопричину вместо
`Unknowns`.

## Source facts

TODO: перечислите три директории fixture, их проверенные provenance/hash и
заявленные границы захвата. Сохраните точные ссылки на файлы-источники.

## Assumptions before inspector actions

TODO: перечислите утверждения, которые не даны provenance и ещё не наблюдались.
Если дополнительных допущений нет, напишите это явно и объясните почему.

## Expected before inspector actions

TODO: одна отметка ISO UTC до первого `inspect` и прогноз работы инспектора: три
отдельных запуска с `network=none`, по четыре исходных файла и подтверждённая
очистка каждого. События протоколов, диагнозы и поля цели пока `Unknown`.

## Inspector run ledger

TODO: для Case A/B/C — отдельная директория `.training/evidence/01-05/<run-id>/`,
`inspect_action_at`, `cleanup_at`, ссылки на `preflight.txt`, `events.jsonl`,
`inspect.txt`, `post-check.txt`, фактическое `exact_container_absent=true` и
счётчики ресурсов с метками курса `0/0/0`. Не подставляйте сюда время
искусственной пробы из fixture `action.txt`.

## Case A — interface-not-ready

### Verified inputs and observations

TODO: hash/provenance и точные ссылки на `baseline.txt`, `action.txt` и
`events.tsv` либо на metadata, доказывающие границы пустого захвата.

### Last proven stage

TODO

### Earliest disproven or not-proven transition

TODO

### Bounded inference

TODO

### Remaining unknowns

TODO: минимум два независимых `Unknowns`.

### Next discriminating observation

TODO: только предложите ограниченное read-only-наблюдение, не запускайте новую
пробу; назовите конкурирующие гипотезы и разные ожидаемые результаты наблюдения.

## Case B — arp-no-reply

### Verified inputs and observations

TODO: hash/provenance и точные ссылки на `baseline.txt`, `action.txt` и
`events.tsv` либо на metadata, доказывающие границы пустого захвата.

### Last proven stage

TODO

### Earliest disproven or not-proven transition

TODO

### Bounded inference

TODO

### Remaining unknowns

TODO: минимум два независимых `Unknowns`.

### Next discriminating observation

TODO

## Case C — icmp-no-reply

### Verified inputs and observations

TODO: hash/provenance и точные ссылки на `baseline.txt`, `action.txt` и
`events.tsv` либо на metadata, доказывающие границы пустого захвата.

### Last proven stage

TODO

### Earliest disproven or not-proven transition

TODO

### Bounded inference

TODO

### Remaining unknowns

TODO: минимум два независимых `Unknowns`.

### Next discriminating observation

TODO

## Cross-case comparison

TODO: объясните, почему одинаковый верхнеуровневый симптом не означает одинаковую
причинную границу.

## Offline inspector cleanup

TODO: три фактических `exact_container_absent=true` из `post-check.txt` тех же
запусков, нулевые счётчики ресурсов с метками курса и итоговый
`pnpm network:lab status`.

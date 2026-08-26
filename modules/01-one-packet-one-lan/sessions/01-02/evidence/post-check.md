# Post-check 01-02

Этот файл подтверждает, что ресурсы именно вашего запуска удалены. Успешного кода
завершения `down` без данных из `post-check.txt` недостаточно.

## Cleanup action

TODO: значение `at` из записи `phase="cleanup"`, `kind="cleanup"` в
`events.jsonl` в ISO 8601 UTC формате `YYYY-MM-DDTHH:mm:ss.sssZ` и команда
`pnpm network:lab down`.

## Raw post-check evidence

TODO: путь `.training/evidence/01-02/<тот-же-run-id>/post-check.txt` и method/owner
label из исходного файла; отдельно перенесите `checked_at` как отметку времени
наблюдения конечного состояния.

## Observed status

TODO: фактические `containers=0`, `networks=0`, `volumes=0`, exact-state и
labelled counts из исходного post-check плюс результат независимого
`pnpm network:lab status`.

## Final state

TODO: подтверждение, что контейнеры, сети и volumes с метками лаборатории отсутствуют,
либо честное описание оставшегося состояния.

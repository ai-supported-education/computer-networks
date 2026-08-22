# Post-check 01-02

## Cleanup action

TODO: значение `at` из записи `phase="cleanup"`, `kind="cleanup"` в
`events.jsonl` в ISO 8601 UTC формате `YYYY-MM-DDTHH:mm:ss.sssZ` и команда
`pnpm network:lab down`.

## Raw post-check evidence

TODO: путь `.training/evidence/01-02/<тот-же-run-id>/post-check.txt` и method/owner
label из raw файла; отдельно перенесите `checked_at` как timestamp наблюдения
конечного состояния.

## Observed status

TODO: фактические `containers=0`, `networks=0`, `volumes=0`, exact-state и
labelled counts из raw post-check плюс результат независимого
`pnpm network:lab status`.

## Final state

TODO: подтверждение, что labelled lab containers, networks и volumes отсутствуют,
либо честное описание оставшегося состояния.

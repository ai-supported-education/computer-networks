# Baseline 01-02

## Expected before action

TODO: ISO 8601 UTC timestamp `YYYY-MM-DDTHH:mm:ss.sssZ`, полученный до
`pnpm network:lab up 01-02`, и прогноз.

## Initial state and preflight

TODO: ссылка на `.training/evidence/01-02/<run-id>/preflight.json`, effective local
`unix://` Docker endpoint, exact targets, Engine/server architecture, image ID,
`networkInventory.conflictCount=0` и фактические `labelled_containers=0`,
`labelled_networks=0`, `labelled_volumes=0` до action.

## Action start

TODO: значение `at` из записи `phase="up"`, `kind="action"` в `events.jsonl` и
точная команда. Формат timestamp: `YYYY-MM-DDTHH:mm:ss.sssZ`.

## Raw evidence reference

TODO: один unique run id и точные пути к `preflight.json`, `events.jsonl`,
`topology-inspect.json` и `baseline.txt`.

## Observed topology guardrails

TODO: только из `topology-inspect.json`: `internal=true`, isolated gateway mode,
exact endpoint names/IDs, `published_ports=0`, mounts/capabilities/exposure.

## Observed alpha

TODO: interface, оба observed flag `UP` и `LOWER_UP`, MAC и IPv4 только из raw
output.

## Observed beta

TODO: interface, оба observed flag `UP` и `LOWER_UP`, MAC и IPv4 только из raw
output.

## Inference and unknowns

TODO: ограниченный вывод и то, чего baseline не доказывает.

## Failed attempts

None. Если попытки были, замените `None` списком bare run ids и кратких причин;
canonical raw paths выше оставьте только для одного успешного run.

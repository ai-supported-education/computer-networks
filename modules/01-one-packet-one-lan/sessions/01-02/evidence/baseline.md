# Baseline 01-02

Заполняйте разделы по ходу запуска. Не переносите ожидаемые значения в
`Observed`, пока не увидите их в указанных исходных файлах.

## Source facts

TODO: перечислите заданные контрактом лаборатории имена, адреса и scope из
`curriculum/lab-environment.md`, а точную ссылку на образ — из
`packages/network-lab/src/constants.ts`. Локальный image ID сюда не переносите:
он будет фактическим результатом preflight.

## Assumptions before action

TODO: перечислите только утверждения, которые до запуска ещё не подтверждены ни
source fact, ни preflight. Если дополнительных допущений нет, напишите это явно и
назовите проверку, которая заменяет каждое возможное допущение наблюдением.

## Expected before action

TODO: отметка времени ISO 8601 UTC `YYYY-MM-DDTHH:mm:ss.sssZ`, полученная до
`pnpm network:lab up 01-02`, и ваш прогноз состояния лаборатории.

## Initial state and preflight

TODO: ссылка на `.training/evidence/01-02/<run-id>/preflight.json`, фактически
выбранный локальный Docker endpoint `unix://`, точные цели, архитектура
Engine/server, image ID, `networkInventory.conflictCount=0` и фактические
`labelled_containers=0`,
`labelled_networks=0`, `labelled_volumes=0` до action.

## Action start

TODO: значение `at` из записи `phase="up"`, `kind="action"` в `events.jsonl` и
точная команда. Формат timestamp: `YYYY-MM-DDTHH:mm:ss.sssZ`.

## Raw evidence reference

TODO: один уникальный run id и точные пути к `preflight.json`, `events.jsonl`,
`topology-inspect.json` и `baseline.txt`.

## Observed topology guardrails

TODO: только из `topology-inspect.json`: `internal=true`, isolated gateway mode,
точные endpoint names/IDs, `published_ports=0`, mounts/capabilities/exposure.

## Observed alpha

TODO: интерфейс, оба наблюдаемых флага `UP` и `LOWER_UP`, MAC и IPv4 только из
исходного вывода.

## Observed beta

TODO: интерфейс, оба наблюдаемых флага `UP` и `LOWER_UP`, MAC и IPv4 только из
исходного вывода.

## Inference and unknowns

TODO: ограниченный `Inference` из процитированных source facts и Observed, а также
`Unknowns` — то, чего baseline не доказывает. Не превращайте assumption в вывод.

## Failed attempts

None. Если попытки были, замените `None` списком bare run ids и кратких причин;
канонические пути к исходным данным выше оставьте только для одного успешного
запуска.

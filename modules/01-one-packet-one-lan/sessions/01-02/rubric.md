# Rubric: 01-02

## Invariants для PASS

- Expected имеет timestamp/явно записан до action start.
- Preflight подтверждён; targets ограничены `cn-alpha`, `cn-beta` и course-labelled
  isolated network.
- Для обоих endpoints cited raw evidence содержит interface, link state, MAC и
  IPv4; summary не подменяет отсутствующие значения ожиданиями.
- Raw run directory уникален и не перезаписывает предыдущую попытку.
- Post-check выполнен после cleanup и показывает отсутствие lab resources либо
  честно фиксирует неуспешный cleanup (в последнем случае PASS невозможен до
  безопасного завершения).
- `network-evidence` PASS и evidence достаточно для независимой сверки.

## Valid alternatives

- Допустим другой UTC run id и более подробный raw inventory.
- Поля можно оформить таблицей или списком, сохранив разделение endpoint и типов
  утверждений.
- Повторный run допустим только в новой directory с новой ссылкой.

## Evidence and safety

Agent сопоставляет summary с raw output, но не повторяет опасные действия.
Published ports, host network, Docker socket, privileged container, произвольные
targets или оставленные resources блокируют PASS.

## Optional improvements

Можно добавить версию Docker и image digest в summary. Это полезно, но не
блокирует PASS, если они уже есть в raw preflight.

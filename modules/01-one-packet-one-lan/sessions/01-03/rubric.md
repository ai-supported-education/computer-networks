# Rubric: 01-03

## Invariants для PASS

- Указанный observed SHA-256 совпадает с versioned provenance.
- Карта содержит два разных frame id и фактические Ethernet, IPv4, ICMP fields.
- Protocol boundaries выводятся из EtherType/protocol/length fields, а не только из
  знакомых addresses.
- Для каждого frame показаны `20 + 8 + 32 = 60 bytes` и `14 + 60 = 74 bytes` либо
  эквивалентный проверяемый расчёт с единицами.
- Отмечено, что FCS отсутствует в capture и что расчёт не универсален для VLAN,
  options или иных capture условий.
- Observations отделены от inference; названы минимум два unknown/ограничения.

## Valid alternatives

- Поля можно представить таблицей, annotated hex map или структурированным
  списком.
- Допустим дополнительный TShark filter/field set, если canonical evidence остаётся
  воспроизводимым.

## Evidence and safety

Анализ только offline, `--network none`; изменённый fixture или несовпавший hash
блокирует PASS. Agent не считает пример output наблюдением учащегося без фактической
идентификации файла.

## Optional improvements

Можно добавить byte offsets каждого поля или собственный рисунок. Это не условие
PASS.

# Rubric: 01-03

## Invariants для PASS

- Указанный observed SHA-256 совпадает с versioned provenance.
- Expected записан до `inspect`; один unique raw run содержит `preflight.txt`,
  `events.jsonl`, `inspect.txt` и `post-check.txt`, а timestamps упорядочены.
- Карта содержит два разных frame id и фактические Ethernet, IPv4, ICMP fields со
  ссылкой на строки raw `inspect.txt`.
- Protocol boundaries выводятся из EtherType/protocol/length fields, а не только из
  знакомых addresses.
- Для каждого frame показаны `20 + 8 + 32 = ip.len = 60 bytes` и
  `14 + 60 = frame.cap_len = 74 bytes` либо эквивалентный проверяемый расчёт;
  `frame.len` и `frame.cap_len` не смешаны, truncation check назван отдельно.
- Отмечено, что FCS отсутствует в capture и что расчёт не универсален для VLAN,
  options или иных capture условий.
- Observations отделены от inference; названы минимум два unknown/ограничения.
- Post-check того же run содержит `exact_container_absent=true`, final labelled
  counts/status чисты.

## Valid alternatives

- Поля можно представить таблицей, annotated hex map или структурированным
  списком.
- Допустим дополнительный TShark filter/field set, если canonical evidence остаётся
  воспроизводимым.

## Evidence and safety

Анализ только offline, через local `unix://` Docker endpoint, `--network none` и
без host bind mount; изменённый fixture или несовпавший hash блокирует PASS. Agent
не считает пример output наблюдением учащегося без raw run, method и фактической
идентификации файла.

## Optional improvements

Можно добавить byte offsets каждого поля или собственный рисунок. Это не условие
PASS.

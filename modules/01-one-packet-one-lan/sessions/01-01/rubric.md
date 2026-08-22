# Rubric: 01-01

## Invariants для PASS

- На все шесть вопросов дан выбранный ответ и непустой самостоятельный `reason`.
- Объяснение различает interface, link-layer address, IPv4 address и ICMP message.
- Encapsulation описана как ICMP message → IPv4 datagram → Ethernet frame, а
  decapsulation — как чтение outer Ethernet header → IPv4 → ICMP.
- Source/destination MAC и source/destination IPv4 правильно привязаны к своим
  headers и endpoints в заданном incoming scenario.
- Наличие request не используется как доказательство reply или end-to-end success.
- Frame с иным EtherType не разбирается как IPv4 только по сходству окружения.

## Valid alternatives

- Термины `frame`, `datagram` и `message` можно объяснить русскими словами, если
  границы protocol units остаются однозначными.
- Reason не обязан повторять README или формулировку quiz; допускается любой
  короткий контрпример или собственная причинная формулировка.

## Evidence

Agent читает `answers.json` после зелёного автоматического quiz. Проверяется смысл
reason, а не совпадение с эталонной строкой. Отсутствующие в сценарии факты должны
оставаться unknown.

## Optional improvements

Можно нарисовать собственную схему вложенности или выписать поля reply. Это не
условие PASS.

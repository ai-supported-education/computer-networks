# Reference: 01-01

Открывайте этот разбор только как rescue level 3 после собственной попытки.

- q1 — `A`: `eth0` является interface; MAC и IPv4 — адреса разных уровней,
  назначенные endpoint/interface, а `icmp.type` — поле сообщения.
- q2 — `B`: `eth.type=0x0800` объявляет IPv4 payload Ethernet frame, а
  `ip.proto=1` — ICMP payload IPv4 datagram.
- q3 — `B`: строка доказывает наблюдение Echo Request в точке capture. Она не
  доказывает получение, reply, отсутствие loss или состояние всей системы.
- q4 — `C`: `0x0806` объявляет ARP, поэтому поля IPv4/ICMP к этому frame не
  применимы.
- q5 — `C`: source MAC и source IPv4 принадлежат `beta`, destination-пара —
  `alpha`; это согласуется с incoming Echo Reply в точке `alpha:eth0`.
- q6 — `C`: interface получает Ethernet frame, EtherType выбирает IPv4,
  `ip.proto` выбирает ICMP, и только затем интерпретируется ICMP message.

Формулировка learner reason может отличаться; важны причинная связь и границы
evidence, а не совпадение текста.

# Reference structure: 01-04

Это структура разбора, а не observed run. Не подставляйте sample timestamp или
run id вместо собственных raw artifacts.

- Cold: `neighbor-before` не содержит mapping; target-scoped capture показывает
  ARP request, matching reply, затем ICMP Echo Request и Reply.
- Warm: `neighbor-before` содержит mapping `.20 → 02:42:ac:1e:00:14`; первый Echo
  Request не требует предшествующего target ARP exchange в capture.
- Inference: в границах этой topology observed mapping согласуется с reuse cache;
  он опирается одновременно на neighbor snapshot и packet sequence.
- Limit: поздний ARP confirmation допустим и не опровергает warm path; timestamps,
  IP ID и checksums не сравниваются как фиксированные.
- Cleanup: PASS возможен только после собственного `down` и фактических нулевых
  labelled/exact counts.

# Reference structure: 01-04

Это структура разбора, а не observed run. Не подставляйте sample timestamp или
run id вместо собственных raw artifacts.

- Cold: `neighbor-before` не содержит mapping; target-scoped capture показывает
  ARP request, matching reply, затем ICMP Echo Request и Reply.
- Warm: `neighbor-before` содержит mapping `.20 → 02:42:ac:1e:00:14`; первый Echo
  Request не имеет предшествующего target ARP exchange в capture. Более поздний
  ARP допустим и не меняет этот порядок.
- Inference: в границах этой topology observed mapping согласуется с reuse cache;
  он опирается одновременно на neighbor snapshot и packet sequence.
- Environment: один `preflight.json` фиксирует local endpoint + Engine ID,
  `conflictCount=0` и initial `0/0/0`; `topology-inspect.json` и пять
  `helpers/*.json` подтверждают actual isolation, mounts, limits и capabilities.
  Capture/probe имеют только `NET_RAW`, neighbor flush — только `NET_ADMIN`.
- Limit: timestamps, IP ID, ICMP identifier и checksums не сравниваются как
  фиксированные.
- Cleanup: PASS возможен только после собственного `down`; `post-check.txt` того
  же run должен содержать bounded reconciliation/quiescence и фактические
  labelled/exact `0/0/0`.

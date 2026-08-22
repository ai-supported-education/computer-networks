# Rubric: 01-04

## Invariants для PASS

- Expected cold/warm и start marker позволяют доказать правильный порядок фаз.
- Capture target/interface/time/frame bounds совпадают с разрешённым scope.
- Cold и warm имеют отдельные raw artifacts, hashes/normalized companions и
  neighbor snapshots; повтор не перезаписал старый evidence.
- ARP request/reply и ICMP request/reply названы отдельными messages/frames.
- Вывод о cache reuse опирается одновременно на neighbor state и capture; отсутствие
  frame не объявляется абсолютным доказательством без проверки capture point.
- Variable fields (timestamps, identifiers, checksums/IP ID) не используются как
  фиксированный acceptance oracle.
- Cleanup/post-check подтверждают ноль exact lab resources.

## Valid alternatives

- Neighbor state может называться `REACHABLE`, `STALE` или другим валидным
  runtime state; PASS требует observed mapping, а не конкретного слова state.
- Допустим дополнительный bounded run в новой directory.

## Evidence and safety

Agent проверяет provenance и summary, но не повторяет live probe без причины.
Неверный target, unbounded capture, privileged endpoint, host network, published
port, Docker socket mount или оставленная topology блокируют PASS.

## Optional improvements

Можно построить компактную диаграмму двух timelines или добавить frame counts.
Это не условие PASS.

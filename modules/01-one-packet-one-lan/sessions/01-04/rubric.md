# Rubric: 01-04

## Invariants для PASS

- Expected cold/warm и start marker позволяют доказать правильный порядок фаз.
- Capture target/interface/time/frame bounds совпадают с разрешённым scope.
- Cold и warm имеют отдельные raw artifacts, hashes/normalized companions и
  neighbor snapshots; повтор не перезаписал старый evidence.
- ARP request/reply и ICMP request/reply названы отдельными messages/frames;
  advertised ARP hardware address совпадает с beta inventory, Ethernet directions
  согласованы, observed Echo identifier/sequence связывают каждую reply с request.
- Вывод о cache reuse опирается одновременно на neighbor state и capture; отсутствие
  target ARP перед первым warm Echo проверено как order invariant, а ARP после Echo
  не подменяет уже наблюдавшийся warm path; отсутствие frame не объявляется
  абсолютным доказательством без проверки capture point.
- Variable fields (timestamps, identifiers, checksums/IP ID) не используются как
  фиксированный acceptance oracle.
- Initial preflight и final raw post-check относятся к тому же run; preflight
  подтверждает local `unix://` endpoint и `networkInventory.conflictCount=0`, а
  lifecycle — переход `0/0/0 → bounded topology → 0/0/0` для
  containers/networks/volumes и ноль exact/labelled resources.

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

# 01-04 — Сравнить cold и warm neighbor paths

Время: 55 минут.

## Результат и разрешённый scope

Вы проведёте два bounded live runs между `cn-alpha` и `cn-beta` в изолированной
Docker LAN:

- **cold:** перед probe у `alpha` нет готовой neighbor entry для `beta`;
- **warm:** entry уже появилась после успешного cold exchange.

Для каждого run сохраните neighbor state, ограниченный capture и normalized
TShark companion, затем заполните `evidence/comparison.md`. Разрешён единственный
target `172.30.0.20`, один ICMP Echo, до 3 секунд и не более 8 captured frames на
phase.
После работы topology полностью удаляется.

## Причинная модель: зачем IP endpoint нужен ещё один адрес

В этой лаборатории принято, что `.10` и `.20` находятся в одной LAN. Чтобы
Ethernet interface `alpha` отправил frame, header нуждается в destination MAC.
IPv4 destination `.20` сам по себе не заполняет это поле.

ARP связывает известный IPv4 соседнего endpoint с его MAC:

```text
alpha knows destination IPv4 .20
           ↓ neighbor cache lookup
entry absent (cold)
           ↓
Ethernet broadcast ARP Request:
"who has 172.30.0.20? tell 172.30.0.10"
           ↓ beta recognizes its IPv4
unicast ARP Reply: ".20 is at 02:42:ac:1e:00:14"
           ↓ alpha stores neighbor entry
Ethernet unicast IPv4/ICMP Echo Request
           ↓
Ethernet unicast IPv4/ICMP Echo Reply
```

При warm run cache lookup уже может вернуть MAC, поэтому новые ARP frames перед
ICMP не нужны. «Может» здесь важно: cache state и таймеры — runtime facts. Именно
поэтому мы сохраняем `ip neigh` до каждого probe, а не объявляем второй run warm
только по порядковому номеру.

Source fact: формат ARP request/reply определён в
[RFC 826](https://www.rfc-editor.org/rfc/rfc826.html). Source fact для этой
лаборатории: fixed inventory из `lab-environment.md`. Observed: фактические
neighbor rows и captured frames. Inference: связь изменения cache с различием
timelines.

## Почему capture снимается в source network namespace

Docker bridge не является «зеркальным портом»: третий обычный container не обязан
получить known-unicast frames между двумя endpoints. Capture helper поэтому
кратковременно разделяет network namespace `alpha`. Он видит тот же `eth0`, но
получает только необходимые `NET_RAW`/`NET_ADMIN`; endpoints остаются без лишних
capabilities. Docker socket внутрь containers не монтируется.

## Разобранный пример 1: cold timeline

Synthetic sample (это не ваше observed):

```text
1  eth.dst=ff:ff:ff:ff:ff:ff arp.opcode=1 arp.dst.proto_ipv4=172.30.0.20
2  eth.src=02:42:ac:1e:00:14 arp.opcode=2
   arp.src.hw_mac=02:42:ac:1e:00:14 arp.src.proto_ipv4=172.30.0.20
3  eth.type=0x0800 ip.dst=172.30.0.20 icmp.type=8
4  eth.type=0x0800 ip.src=172.30.0.20 icmp.type=0
```

Сначала разрешается link-layer destination, затем отправляется ICMP. Строка 2
связывает `.20` и `…:14`; строка 3 показывает использование этого MAC в отдельном
frame. Нельзя утверждать, что «ARP содержит ping»: это разные protocol messages.

## Разобранный пример 2: warm без ARP перед Echo

```text
neighbor-before: 172.30.0.20 dev eth0 lladdr 02:42:ac:1e:00:14 REACHABLE
1  eth.type=0x0800 ip.dst=172.30.0.20 icmp.type=8
2  eth.type=0x0800 ip.src=172.30.0.20 icmp.type=0
```

Observed neighbor row плюс отсутствие ARP до Echo согласуются с cache reuse.
После Echo в том же bounded window могут появиться другие ARP frames из-за
runtime state второго endpoint; они не превращают отправку Echo Request задним
числом в cold path. Само отсутствие предшествующего ARP без neighbor snapshot
было бы слабее: capture мог стартовать поздно или использовать неправильный
interface/filter.

## Preflight, expected и stop conditions

1. `pnpm network:lab status` должен показать чистое состояние.
2. `pnpm network:lab preflight` должен подтвердить local absolute `unix://`
   endpoint, rootful Engine, `subnet_conflicts=0` и clean initial state; image
   заранее загружен командой `pnpm network:lab preload` при необходимости. Remote
   context или subnet conflict — stop condition; не удаляйте существующую network
   ради карточки.
3. До `up` заполните Expected в `evidence/comparison.md`: поставьте UTC timestamp
   и отдельно предскажите cold/warm timelines. Не копируйте туда «observed».
4. Остановитесь при любом target кроме `.20`, неожиданном interface, отсутствии
   isolated mode, несоответствии fixed inventory, превышении time/frame limits,
   появлении чужих payloads или lab resources от другого run.

## Процедура

1. Поднимите exact topology:

   ```bash
   pnpm network:lab up 01-04
   ```

   Сохранённый run-scoped `preflight.json` должен показывать initial counts
   local endpoint, `networkInventory.conflictCount=0` и initial counts `0/0/0`
   для containers/networks/volumes, а последующий `topology-inspect.json` — exact
   isolation/exposure guardrails.

2. Создайте cold/warm evidence bundle. Runner очищает только neighbor entry `.20`
   внутри разрешённого namespace, ставит start markers, ограничивает capture и
   запускает ровно bounded Echo probes:

   ```bash
   pnpm network:lab capture
   ```

   Команда принимает PASS только когда cold capture содержит ordered matching
   ARP exchange, где reply фактически рекламирует MAC beta, и Echo Request/Reply;
   warm neighbor-before содержит expected IPv4-to-MAC mapping, а Echo Reply
   совпадает со своим Request по observed identifier/sequence.
   Identifier/sequence должны совпасть внутри пары, но их конкретное числовое
   значение не фиксируется между runs. Capture сначала
   пишется в exact labelled volume, затем `docker cp` создаёт host artifact от
   имени вызывающего пользователя. Повтор создаёт новый run directory и не
   перезаписывает raw pcap.
3. Укажите один exact run directory в `evidence/comparison.md`. Перенесите
   фактические neighbor-before/after, pcap SHA-256 и normalized event rows со
   ссылками на `cold/` и `warm/`, не фиксируя как invariant timestamps, IP ID,
   конкретный ICMP identifier или checksums.
4. Сравните timelines: что присутствует в cold, что отсутствует/присутствует в
   warm, какое cache evidence объясняет различие и какие альтернативы ещё
   возможны.
5. Cleanup и post-check:

   ```bash
   pnpm network:lab down
   pnpm network:lab status
   ```

   Сошлитесь на raw `post-check.txt` того же run. При runtime discrepancy capture
   fail-closed записывает error и пытается выполнить exact cleanup; не запускайте
   ручной probe, сохраните failed run. Если cleanup не PASS, active state остаётся
   для повторного scoped `pnpm network:lab down`.

## Два правдоподобных неверных пути

1. **Очистить neighbor cache macOS/Linux host.** Lab endpoints живут в отдельных
   network namespaces; host cache не задаёт состояние `alpha`. Такой run не будет
   доказан как cold.
2. **Поставить третий sniffer на bridge и трактовать отсутствие unicast как packet
   loss.** Known-unicast не обязан попадать этому endpoint. Capture point должен
   быть source namespace, а его identity — частью provenance.

## Проверка и evidence

- Local: `network-evidence` проверяет headings, timestamp order, один run id,
  обязательные cold/warm raw filenames и hashes, neighbor/ARP/ICMP/matching fields,
  cleanup counts и отсутствие TODO. Semantics runner gate и regression matrix
  приведены в consistency-only `acceptance.md`.
- Empirical: pcap, normalized companions и neighbor snapshots созданы фактическим
  bounded run.
- Agent: сверяет timeline с raw/normalized evidence, осторожность inference,
  rerun policy и финальный clean state.
- Evidence: `evidence/comparison.md` плюс локальный уникальный run directory; raw
  `*.pcap` исключён из Git.

## DONE

- [ ] Expected cold/warm timestamp раньше action start; saved preflight показывает
      local `unix://` endpoint, `networkInventory.conflictCount=0`, initial counts
      `0/0/0`, exact targets и pinned environment.
- [ ] Cold run имеет neighbor-before и bounded capture; warm run имеет отдельные
      snapshot/capture.
- [ ] Comparison ссылается на observed rows и не сравнивает variable fields как
      фиксированные.
- [ ] Matching Echo pairs доказаны observed identifier/sequence внутри каждой phase.
- [ ] Cold ARP Reply рекламирует observed MAC beta; Ethernet directions Echo
      совпадают с fixed inventory.
- [ ] Raw post-check того же run подтверждает ноль labelled containers, networks
      и volumes.
- [ ] `pnpm session:check` зелёный, agent review получил PASS.

Следующий шаг `01-05` использует только synthetic evidence bundles и не требует
оставлять Docker запущенным.

# 01-05 — Локализовать самый ранний недоказанный этап

Время: 50 минут.

## Результат и границы

Вы проанализируете три immutable synthetic evidence bundle и для каждого укажете:

1. последний этап, который подтверждён observed evidence;
2. самый ранний следующий этап, для которого ожидаемое доказательство отсутствует
   или прямо опровергнуто;
3. что это локализует и что остаётся unknown.

Исправлять конфигурацию и угадывать root cause не нужно. Scope — только
предоставленные offline files в `fixtures/01-05/`. Утверждение «сломано потому что
X» без различающего evidence является ошибкой, даже если X правдоподобен.

## Причинная лестница локального Echo exchange

Диагностика начинается не с названия любимой причины, а с первого нарушенного
контракта в последовательности:

```text
S0 requested action exists
 ↓
S1 source interface is ready
 ↓
S2 neighbor-before is observed as present or absent
 ├─ mapping present ───────────────────────────────┐
 └─ mapping absent → S3a ARP Request observed
                         ↓
                    S3b matching ARP Reply observed
                         ↓                         │
                    S4 mapping available ←────────┘
                         ↓
       S5 Ethernet/IPv4/ICMP Echo Request observed
                         ↓
 S6 matching reverse Ethernet/IPv4/ICMP Reply observed
```

Каждый переход имеет собственное evidence. S3a/S3b — только cold/cache-miss
branch: при уже observed mapping warm path законно идёт от S2 прямо к S4. Если
mapping absent и после S3a нет S3b, отсутствие ICMP Request ожидаемо и ещё не
проверяет ICMP handling. Если S5 достигнут, ARP уже не является самой ранней
границей данного run. S5/S6 требуют назвать вложенные Ethernet, IPv4 и ICMP
evidence, а не только слово `ping`.

S3b и S4 — тоже разные утверждения. Наблюдаемый ARP Reply доказывает содержимое
frame, но сам по себе не доказывает, что source принял mapping. S4 можно подтвердить
отдельным neighbor snapshot либо косвенно следующим Ethernet Request, который в
той же bounded sequence использует рекламированный destination MAC. Если нет ни
одного такого evidence, граница остаётся между S3b и S4.

«Нет frame в capture» считается evidence только когда bundle подтверждает capture
point, interval/filter и requested action. Иначе отсутствие могло возникнуть из-за
ошибки наблюдения.

## Как читать bundle

Каждая directory содержит:

- `provenance.md` — synthetic inputs, capture point и ограничения;
- `sha256.txt` — identity raw artifacts;
- `baseline.txt` — interface/neighbor state до action;
- `events.tsv` — нормализованные observed events; он производен от raw pcap;
- `capture.pcap` или явное описание пустого capture;
- `action.txt` — какой bounded probe был запрошен и когда.

Порядок анализа:

```text
verify identity → verify observation window → mark observed stages
→ find first missing expected transition → state boundary → preserve unknowns
```

## Разобранный пример 1: успех до request, дальше unknown

Synthetic sample, не один из заданных cases:

```text
baseline: eth0 UP, neighbor .20 -> 02:42:ac:1e:00:14
events:
  1 eth.type=0x0800 ip.dst=172.30.0.20 icmp.type=8
  -- capture ends, no matching type=0 --
```

Подтверждены S1, warm-ветка S2, S4 и S5; S3 здесь не требуется. Самая ранняя
недоказанная граница — S6: reply не
наблюдался в заявленном window. Это не доказывает, что `beta firewall dropped`:
возможны обработка на `beta`, обратная отправка, capture loss и другие unknowns.

## Разобранный пример 2: почему похожий симптом имеет другую границу

```text
action: Echo probe requested during capture window
baseline: eth0 state DOWN
events: none
```

Здесь нельзя начинать с «beta не отвечает». S1 прямо опровергнут: source interface
не готов. S2 тоже не наблюдается, но это более позднее следствие. Локализация — на
границе готовности/эмиссии source; конкретная причина состояния DOWN остаётся
unknown.

## Micro-example: как выбрать следующий discriminator

Предположим, source capture доказал S5, но не S6. Остались две hypotheses:

- H1: matching request не дошёл до destination;
- H2: request дошёл, но matching reply не был создан.

Один bounded read-only capture в destination namespace для того же synthetic
request различает их: при H1 matching ingress Request отсутствует, при H2 он
присутствует. Такой вывод допустим только при заранее доказанных capture
point/filter/window и completeness contract; без них отсутствие снова не
различает hypotheses. В задании новый capture не запускайте — предложите
аналогичное наблюдение и явно напишите разные ожидаемые результаты для оставшихся
hypotheses.

## Три cases задания

| Case | Directory | Наблюдаемый симптом |
| --- | --- | --- |
| A | `fixtures/01-05/interface-not-ready/` | requested action есть, relevant frames не наблюдались; baseline показывает `eth0 DOWN` |
| B | `fixtures/01-05/arp-no-reply/` | repeated ARP requests, matching reply отсутствует |
| C | `fixtures/01-05/icmp-no-reply/` | ARP exchange завершён, Echo Request есть, matching Reply отсутствует |

Таблица называет observed shape, но не root cause. Самостоятельная работа —
доказать границу для каждого case точными ссылками `file:line`/frame number и не
сделать вывод шире данных.

## Два правдоподобных неверных пути

1. **Во всех трёх cases написать «destination недоступен».** Это пересказ общего
   symptom, который стирает различающие stages и не помогает выбрать следующую
   проверку.
2. **Назвать конкретную причину по отсутствующему reply.** Repeated ARP без reply
   совместим с несколькими причинами: неверный target inventory, link/endpoint
   issue, filtering или capture limitation. Evidence локализует границу, но не
   выбирает одну причину без нового теста.

## Процедура

1. Выполните `pnpm network:fixture preflight`. Продолжайте только после PASS для
   local `unix://` endpoint и pinned image; при missing image используйте
   `pnpm network:fixture preload` и повторите preflight.
2. До первого `inspect` заполните `Expected before inspector actions` в
   `diagnosis.md`: получите ISO UTC timestamp командой
   `node -e 'console.log(new Date().toISOString())'` и предскажите только
   operational contract — три immutable identities, три network-none parser runs
   и cleanup каждого. Диагнозы не записывайте до observations.
3. Для каждого case проверьте hashes/provenance и получите canonical view:

   ```bash
   pnpm network:fixture verify fixtures/01-05/interface-not-ready
   pnpm network:fixture inspect fixtures/01-05/interface-not-ready

   pnpm network:fixture verify fixtures/01-05/arp-no-reply
   pnpm network:fixture inspect fixtures/01-05/arp-no-reply

   pnpm network:fixture verify fixtures/01-05/icmp-no-reply
   pnpm network:fixture inspect fixtures/01-05/icmp-no-reply
   ```

   Каждый `inspect` создаёт отдельный `.training/evidence/01-05/<run-id>/` с
   `preflight.txt`, `events.jsonl`, `inspect.txt` и `post-check.txt`.
4. Заполните `Inspector run ledger`: для A/B/C укажите run path,
   `inspect_action_at` из текущего inspector `events.jsonl`,
   `cleanup_at`/marker/counts из `post-check.txt` и все четыре raw references.
   `inspect_action_at` — время offline parsing action, а не время synthetic Echo
   probe из fixture `action.txt`. Global Expected timestamp должен быть раньше
   каждого inspector action.
5. В `diagnosis.md` заполните отдельный раздел Case A/B/C:
   - verified source facts/assumptions;
   - cited observations;
   - last proven stage;
   - earliest disproven/not-proven transition;
   - bounded inference;
   - минимум две remaining unknowns;
   - один следующий minimum discriminating observation без запуска: назовите
     competing hypotheses и разные ожидаемые результаты этого observation.
6. Не меняйте fixtures. Каждый `inspect` запускает exact labelled offline
   container без network, затем обязан завершиться секцией
   `exact_container_absent=true`. Перенесите три cleanup post-check в раздел
   `Offline inspector cleanup` файла `diagnosis.md`.

Если inspect сообщает `Fixture cleanup FAILED`, не продолжайте и не выдавайте
анализ за DONE. Выполните только напечатанную recovery-команду с exact failed run
directory; она сверяет сохранённые Docker endpoint, Engine ID, reserved name/role,
run label и container ID перед удалением, а затем ждёт bounded clean quiescence:

```bash
pnpm network:fixture cleanup .training/evidence/01-05/<failed-run-id>
pnpm network:lab status
```

Остановитесь и не делайте диагноз, если hash/provenance не совпал, observation
window неизвестен или canonical companion расходится с raw artifact.

## Проверка и evidence

- Local: `network-evidence` проверяет три case ids, один Expected checkpoint, три
  unique raw runs с упорядоченными timestamps, обязательные sections/citations,
  cleanup post-check и отсутствие TODO. Смысл citations и количество независимых
  unknowns проверяет agent по rubric.
- Empirical: три run-scoped `inspect.txt` воспроизводят fixture hashes/fields
  offline; это измерение файлов, не живой сети.
- Agent: проверяет causal boundary, конкурирующие объяснения и отсутствие
  недоказанного root cause.
- Evidence: `diagnosis.md`.

## DONE

- [ ] Identity/provenance всех трёх bundles проверены.
- [ ] Expected записан до трёх action markers; run ledger связывает каждый case с
      preflight/events/inspect/post-check и clean post-state.
- [ ] Для каждого case названы last proven и earliest missing/disproven stage с
      точной evidence citation.
- [ ] Root cause не объявлен известным там, где bundle задаёт только boundary.
- [ ] Для каждого case сохранены unknowns и следующий различающий observation.
- [ ] Все три offline inspector cleanup post-check сохранены; labelled counts/status
      чисты.
- [ ] `pnpm session:check` зелёный, agent review получил PASS.

Следующий шаг `01-06` даст новый bundle без заранее названного symptom shape и
попросит собрать весь локальный packet path.

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
S2 source emits a relevant Ethernet frame
 ↓
S3 ARP request receives a matching ARP reply
 ↓
S4 neighbor mapping is available
 ↓
S5 ICMP Echo Request is emitted toward beta
 ↓
S6 matching ICMP Echo Reply is observed back at alpha
```

Каждый переход имеет собственное evidence. Если S2 не достигнут, данные ничего не
говорят о том, ответил бы `beta` на ARP. Если S3 не достигнут, отсутствие ICMP
Request ожидаемо и ещё не проверяет ICMP handling. Если S5 достигнут, ARP уже не
является самой ранней границей данного run.

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

Подтверждены S1, S2, S4 и S5. Самая ранняя недоказанная граница — S6: reply не
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

## Три cases задания

| Case | Directory | Наблюдаемый симптом |
| --- | --- | --- |
| A | `fixtures/01-05/interface-not-ready/` | requested action есть, relevant frames не emitted |
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

1. Для каждого case проверьте hashes/provenance и получите canonical view:

   ```bash
   pnpm network:fixture verify fixtures/01-05/interface-not-ready
   pnpm network:fixture inspect fixtures/01-05/interface-not-ready

   pnpm network:fixture verify fixtures/01-05/arp-no-reply
   pnpm network:fixture inspect fixtures/01-05/arp-no-reply

   pnpm network:fixture verify fixtures/01-05/icmp-no-reply
   pnpm network:fixture inspect fixtures/01-05/icmp-no-reply
   ```

2. В `diagnosis.md` заполните отдельный раздел Case A/B/C:
   - verified source facts/assumptions;
   - cited observations;
   - last proven stage;
   - earliest disproven/not-proven transition;
   - bounded inference;
   - минимум две remaining unknowns;
   - один следующий minimum discriminating observation без запуска.
3. Не меняйте fixtures. Offline container работает без network; cleanup внешнего
   состояния не требуется.

Остановитесь и не делайте диагноз, если hash/provenance не совпал, observation
window неизвестен или canonical companion расходится с raw artifact.

## Проверка и evidence

- Local: `network-evidence` проверяет три case ids, обязательные sections,
  evidence citations, unknowns и отсутствие TODO.
- Empirical: fixture hashes/fields воспроизводятся offline; это измерение файла, не
  живой сети.
- Agent: проверяет causal boundary, конкурирующие объяснения и отсутствие
  недоказанного root cause.
- Evidence: `diagnosis.md`.

## DONE

- [ ] Identity/provenance всех трёх bundles проверены.
- [ ] Для каждого case названы last proven и earliest missing/disproven stage с
      точной evidence citation.
- [ ] Root cause не объявлен известным там, где bundle задаёт только boundary.
- [ ] Для каждого case сохранены unknowns и следующий различающий observation.
- [ ] `pnpm session:check` зелёный, agent review получил PASS.

Следующий шаг `01-06` даст новый bundle без заранее названного symptom shape и
попросит собрать весь локальный packet path.

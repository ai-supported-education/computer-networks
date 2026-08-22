# 01-06 — Восстановить полный локальный packet path

Время: 55 минут.

## Результат и границы

Вы получите новый synthetic evidence bundle
`fixtures/01-06/novel-local-exchange.pcap` вместе с versioned baseline companion и
восстановите причинный путь exchange в `packet-path.md`: от исходного interface state через link-layer delivery и
neighbor evidence до IPv4/ICMP messages и обратно.

Это интеграция главы, а не проверка памяти на названия. Для каждого шага нужно
показать evidence и классифицировать утверждение как source fact, assumption,
observed, inference или unknown. CIDR arithmetic, gateway и route lookup остаются
за пределами; данное в provenance допущение «одна LAN» не превращается в
универсальный вывод.

## Модель полного отчёта

Хороший packet-path report отвечает на пять разных вопросов:

| Вопрос | Тип ответа | Пример допустимого evidence |
| --- | --- | --- |
| Что было задано до run? | source fact / assumption | inventory, provenance |
| Что реально было видно? | observed | frame field, neighbor snapshot |
| Как frames связаны во времени? | observed + ordering | frame numbers/timestamps |
| Что из этого следует? | inference | stage transition с cited observations |
| Чего capture не показывает? | unknown | обработка внутри endpoint, причины задержки |

Путь удобно собирать не сверху вниз по «OSI layers», а по решениям:

```text
requested local exchange
  → source interface evidence
  → destination link address available or resolved
  → Ethernet delivery event(s)
  → IPv4 endpoint fields
  → ICMP request/reply relation
  → returned evidence at source
```

Один frame может одновременно быть evidence нескольких вложенных units, но один
field не доказывает соседний stage. Например, `icmp.type=0` сообщает тип message;
связь с конкретным request требует addresses и echo identifiers/payload context.

## Разобранный сценарий 1: полный cold exchange

Synthetic sample timeline (не target fixture):

```text
t0 neighbor .20 absent
t1 ARP request: broadcast, asks for .20
t2 ARP reply: .20 reports MAC …:14
t3 IPv4/ICMP request: .10 → .20, type 8
t4 IPv4/ICMP reply:   .20 → .10, type 0
t5 neighbor .20 at …:14 present
```

Observed t1–t2 плюс snapshots объясняют появление mapping. Observed t3–t4
доказывают request/reply в capture point. Ограниченный inference: bundle
согласуется с успешным local Echo exchange после neighbor resolution. Unknown:
какие функции ядра выполнялись, почему заняла конкретное время и потерялись ли
frames вне bounded window.

## Разобранный сценарий 2: внешне похожий, но неполный путь

```text
t0 neighbor .20 absent
t1 ARP request for .20
t2 ARP reply for .20
t3 ICMP Echo Request .10 → .20
-- capture ends --
```

Здесь link address разрешён и request emitted, но complete exchange не доказан.
Нельзя нарисовать обратную стрелку только потому, что типичный `ping` должен иметь
reply. Expected и observed остаются разными.

## Две типичные ошибки

1. **Пересказать capture строками без причинных связей.** Список полей полезен, но
   не объясняет, какой earlier fact сделал возможным следующий event и где
   ограничено inference.
2. **Заполнить пропуски «нормальным поведением сети».** Если в bundle нет evidence
   route choice, process internals или delivery за пределами capture point, эти
   элементы должны остаться assumption/unknown, даже если схема кажется
   незавершённой.

## Процедура

1. Выполните `pnpm network:fixture preflight`. Продолжайте только после PASS для
   local `unix://` endpoint и pinned image; при missing image используйте
   `pnpm network:fixture preload` и повторите preflight.
2. До `inspect` заполните в `packet-path.md` секции `Expected before action` и
   `Assumptions`: получите timestamp командой
   `node -e 'console.log(new Date().toISOString())'`, предскажите только форму
   bounded evidence и зафиксируйте supplied one-LAN assumption. Не записывайте
   target fields как observed до чтения raw output.
3. Проверьте identity/provenance и получите normalized view offline:

   ```bash
   pnpm network:fixture verify fixtures/01-06/novel-local-exchange.pcap
   pnpm network:fixture inspect fixtures/01-06/novel-local-exchange.pcap
   ```

   `inspect` создаёт unique `.training/evidence/01-06/<run-id>/` с
   `preflight.txt`, `events.jsonl`, `inspect.txt` и `post-check.txt`. Остановитесь
   при hash mismatch, неизвестном origin, неожиданном network access, cleanup без
   `exact_container_absent=true` или расхождении raw/companion. Fixture не
   изменяйте. При cleanup failure используйте только напечатанный exact ID:

   ```bash
   pnpm network:fixture cleanup <exact-container-id>
   pnpm network:lab status
   ```

   Не используйте broad Docker cleanup.
4. Перенесите в `Inspector action and raw evidence` один run path, action timestamp
   из `events.jsonl` и полный набор raw references. Companion citations оформляйте
   как `path:line`; frame citations — как `inspect.txt`, `frame.number=N` и exact
   `field=value`, чтобы было ясно, какое observation поддерживает стрелку.
5. Не заглядывая в hints/solution, составьте в `packet-path.md` inventory всех
   frames: number, relative order, Ethernet src/dst/type, IPv4 src/dst/protocol или
   ARP fields, ICMP type там, где он действительно присутствует.
6. Сгруппируйте frames в причинные stages. Для каждой стрелки укажите cited
   observation; совпавший порядок сам по себе не доказывает внутреннюю причину.
7. Заполните epistemic ledger:
   - source facts;
   - assumptions;
   - observations;
   - inferences;
   - минимум три unknowns.
8. Дайте итог одной фразой, область применимости и один counterfactual: какое
   изменение evidence опровергло бы ваш основной inference.

Live topology не создаётся, но offline inspector использует disposable container.
Из `post-check.txt` того же run перенесите `checked_at`,
`exact_container_absent=true` и нулевые labelled counts, затем проверьте status:

```bash
pnpm network:lab status
```

## Проверка и evidence

- Local: `network-evidence` проверяет fixture identity, один raw run, порядок
  Expected/action/cleanup, inventory всех frames, обязательные sections/raw
  references, cleanup marker и отсутствие TODO. Корректность causal
  arrows/ledger/counterfactual проверяет agent.
- Empirical: run-scoped `inspect.txt` сохраняет method и фактическое чтение
  versioned synthetic pcap; `post-check.txt` доказывает cleanup того же run.
- Agent: проверяет причинную связность, соответствие fields, epistemic labels,
  counterfactual и соблюдение границы главы.
- Evidence: `packet-path.md`.

## DONE

- [ ] Expected/assumptions записаны до action marker; fixture hash/provenance,
      versioned `alpha:eth0` baseline и один unique raw run проверены.
- [ ] Все observed frames отражены в inventory со ссылками на raw `inspect.txt`.
- [ ] Каждая causal arrow ссылается на конкретное observation.
- [ ] Source facts, assumptions, observations, inferences и минимум три unknowns
      разделены.
- [ ] Итог ограничен данной LAN/fixture; CIDR/route/gateway не выданы за доказанные.
- [ ] Counterfactual действительно мог бы опровергнуть inference.
- [ ] Post-check того же run содержит `exact_container_absent=true`, labelled
      counts/status чисты; `pnpm session:check` и agent review PASS.

Глава завершена. Следующая опубликованная в будущем карточка начнёт вывод IPv4
addressing и CIDR; продолжать её сейчас для DONE не требуется.

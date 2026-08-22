# 01-03 — Разобрать synthetic capture по полям

Время: 45 минут.

## Результат и область применимости

Вы проверите provenance и SHA-256 детерминированного `pcap`, извлечёте два frames
через TShark и создадите `frame-map.md`: карту границ Ethernet, IPv4 и ICMP с
раздельными observations и inference.

Это offline-анализ публичного synthetic fixture. Он доказывает содержимое именно
этого файла, но не реальный обмен вашей машины. Docker network не создаётся;
offline TShark запускается контейнером без network access.

## Дано

- Fixture: `fixtures/01-03/known-neighbour.pcap`.
- Expected SHA-256:
  `8a4036d450c9f0953c50286f2dc99d429873900e8f92f22a1d2f8f6f1b6dc64f`.
- Provenance рядом с fixture описывает генератор, фиксированные inputs и synthetic
  природу данных.
- В файле два Ethernet frames; для каждого `frame.cap_len=74 bytes` и
  `frame.len=74 bytes`. Первое поле — реально сохранённая длина записи, второе —
  сообщённая исходная длина frame. Ethernet FCS в fixture не записан.

Последние два пункта — source facts из provenance. Сначала воспроизведите hash и
TShark extraction; только после этого используйте их как verified inputs.

## Что на самом деле лежит в pcap

`pcap` — контейнер: file header плюс запись для каждого captured frame. Он не
добавляет сетевой header к packet и не является «ещё одним layer» на wire.

Для каждого frame в этом fixture границы такие:

```text
byte offset 0
┌────────────────────── 14 bytes ──────────────────────┐
│ Ethernet header: dst MAC | src MAC | EtherType       │
└───────────────────────────────────────────────────────┘
                       ┌──────── 20 bytes ──────────────┐
                       │ IPv4 header                    │
                       └────────────────────────────────┘
                                            ┌─ 8 bytes ─┐
                                            │ ICMP hdr  │
                                            └────────────┘
                                                        ┌─ 32 bytes ─┐
                                                        │ payload    │
                                                        └────────────┘
captured bytes = frame.cap_len = 14 + 20 + 8 + 32 = 74 bytes
```

Размерность — bytes. Sanity check: IPv4 `total_length` должен быть `20 + 8 + 32 =
60`, а сохранённая длина — `frame.cap_len = 14 + 60 = 74`. В этом fixture
`frame.len` тоже равен 74, то есть pcap не усёк frame. Эти выводы применимы к
fixture, где IPv4 options и VLAN tag отсутствуют; это не формула для любого frame.

TShark не «угадывает смысл по знакомому адресу». Он последовательно использует
link type pcap, EtherType, IPv4 header и protocol number, а затем отображает поля
dissector-ом.

## Разобранный пример 1: карта request

Sample extraction:

```text
frame.number=1 frame.len=74 frame.cap_len=74
eth.src=02:42:ac:1e:00:0a eth.dst=02:42:ac:1e:00:14 eth.type=0x0800
ip.version=4 ip.hdr_len=20 ip.len=60 ip.proto=1
ip.src=172.30.0.10 ip.dst=172.30.0.20
icmp.type=8 icmp.code=0
```

Observed fields дают независимые проверки: `eth.type` выбирает IPv4,
`ip.hdr_len`/`ip.len` задают размер datagram, `frame.cap_len` задаёт реально
сохранённые bytes, а `ip.proto` выбирает ICMP. Inference может назвать frame Echo
Request от `alpha` к `beta`, потому что inventory связывает эти фиксированные
addresses с именами endpoints.

## Разобранный пример 2: что изменилось в reply

```text
frame.number=2 frame.len=74
eth.src=02:42:ac:1e:00:14 eth.dst=02:42:ac:1e:00:0a
ip.src=172.30.0.20 ip.dst=172.30.0.10
icmp.type=0 icmp.code=0
```

Source/destination pairs поменялись местами, а ICMP type стал Echo Reply. Lengths
могут остаться одинаковыми, но это не превращает две записи в один frame: у них
разные `frame.number`, timestamps и headers.

## Типичные ошибки

1. **Нарисовать поля из README, не запуская extraction.** Тогда получится копия
   expected, а не evidence того, какой файл реально прочитан. Hash и фактический
   output обязательны.
2. **Смешать `frame.len` и `frame.cap_len` или считать их разность с `ip.len`
   универсальной длиной Ethernet header.** В данном fixture оба frame-поля равны
   74 и разность равна 14, но truncation, VLAN tags, padding и FCS меняют картину.
   Формулируйте вывод в границах fixture.

## Процедура

1. Проверьте offline inspector без создания topology:

   ```bash
   pnpm network:fixture preflight
   ```

   Он допускает только local absolute `unix://` Docker endpoint, Linux
   amd64/arm64 и уже загруженный pinned image. Если отсутствует только image,
   выполните `pnpm network:fixture preload`, затем повторите preflight. Remote
   context — stop condition. Любой другой non-PASS также означает остановку и
   review; не обходите preflight ручным Docker-запуском.

2. До `inspect` заполните `Expected before action` в `frame-map.md`: получите ISO
   UTC timestamp командой `node -e 'console.log(new Date().toISOString())'` и
   запишите ожидаемые identity/frame-count/safety свойства только из provenance.
   Не переписывайте sample fields в observations.
3. Проверьте provenance/hash и извлеките canonical поля в offline container:

   ```bash
   pnpm network:fixture verify fixtures/01-03/known-neighbour.pcap
   pnpm network:fixture inspect fixtures/01-03/known-neighbour.pcap
   ```

   `inspect` повторно проверяет identity/preflight и создаёт новый raw run в
   `.training/evidence/01-03/<run-id>/`: `preflight.txt`, `events.jsonl`,
   `inspect.txt` и `post-check.txt`. Runner использует `--network none`,
   `cap-drop=ALL`, `no-new-privileges`,
   bounded CPU/memory/PIDs и `--pull never`; verified fixture копируется exact
   `docker cp` в disposable container filesystem, без host bind mount. Writable
   disposable rootfs нужен только parser container и удаляется до PASS.
   Команда считается успешной только если exact offline container удалён и output
   заканчивается `exact_container_absent=true`. При `Fixture cleanup FAILED`
   остановитесь; используйте напечатанный ID только с
   `pnpm network:fixture cleanup <exact-container-id>`, затем проверьте
   `pnpm network:lab status`. Напечатанный `failed_run` сохраняйте как failed
   evidence; повтор получает новый run id и не перезаписывает его. Недоступный
   daemon или permission error не считается доказательством отсутствия container
   и блокирует cleanup PASS.
4. Укажите один exact run directory в `frame-map.md`. Из `events.jsonl` перенесите
   `at` записи `phase="inspect"`, `kind="action"`; из `post-check.txt` —
   `checked_at`, exact cleanup marker и нулевые labelled counts. Все полные raw
   paths должны относиться к тому же run id.
5. Заполните `frame-map.md` своими observed values из `inspect.txt`. Для каждого из
   двух frames укажите field → protocol unit → что поле доказывает.
6. Для каждого frame выполните два sanity checks: IPv4 total length и
   `frame.cap_len`; отдельно сравните `frame.len` с `frame.cap_len` и объясните,
   что равенство означает отсутствие truncation только для этой записи.
7. Отдельно напишите inference и минимум два unknown/ограничения, включая FCS и
   применимость к VLAN/options/truncated captures.
8. Подтвердите чистый labelled status командой `pnpm network:lab status`.

Остановитесь, если hash отличается, fixture не synthetic по provenance, команда
просит network access или TShark показывает не два frames. Не «чините» pcap и не
подгоняйте карту; сохраните discrepancy как observed и запросите review.

## Проверка и evidence

- Local: `network-evidence` проверяет sections, один exact raw run, порядок
  Expected/action/cleanup timestamps, raw filenames, оба frame id, length fields с
  единицами, hash, exact cleanup marker и отсутствие TODO. Он не оценивает
  свободный inference как эталонную строку.
- Empirical: run-scoped `inspect.txt` сохраняет method, hash и фактические TShark
  fields; `post-check.txt` связывает cleanup с тем же run.
- Agent: проверяет связь каждого inference с cited fields, арифметику и границы
  применимости.
- Evidence: `frame-map.md`; сам fixture и canonical companion уже versioned.

## DONE

- [ ] Hash совпал с provenance до анализа.
- [ ] Expected записан до raw action marker; preflight/action/inspect/post-check
      одного unique run сохранены и процитированы.
- [ ] Оба frames разобраны на Ethernet, IPv4 и ICMP по фактическим fields из raw
      `inspect.txt`.
- [ ] Для обоих frames расчёты `ip.len` и `frame.cap_len` имеют единицы; различие
      original/captured length явно учтено.
- [ ] Observations, inference и unknowns разделены.
- [ ] Offline inspect сообщил `exact_container_absent=true`; labelled status чист.
- [ ] `pnpm session:check` зелёный, agent review получил PASS.

Следующий шаг `01-04` проверит, что происходит до Echo Request при пустом neighbor
cache; текущий fixture намеренно не объясняет этот механизм.

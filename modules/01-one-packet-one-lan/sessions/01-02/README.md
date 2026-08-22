# 01-02 — Доказать baseline изолированной LAN

Время: 45 минут.

## Результат и разрешённый scope

Вы поднимете два disposable Linux endpoint — `cn-alpha` и `cn-beta` — только в
Docker network этой лаборатории. Затем сохраните наблюдаемые interface, MAC, IPv4
и link state и полностью удалите topology.

Разрешены только ресурсы, которые создаёт `pnpm network:lab up 01-02`. У них есть
course labels и точные имена. Не подключайте лабораторию к рабочим Compose
проектам, не добавляйте published ports, host networking, Docker socket или
произвольные Internet targets.

Значения `172.30.0.10` и `172.30.0.20` — заданный inventory. Почему эти адреса
относятся к одной сети и что означает prefix, будет выведено в главе 02.

## До запуска: expected

Запишите прогноз и текущий UTC timestamp в `evidence/baseline.md` до `up`.
Все timestamps в evidence имеют ISO 8601 UTC-форму
`YYYY-MM-DDTHH:mm:ss.sssZ`, например `2026-08-23T05:40:12.345Z`. Portable способ
получить timestamp для Expected в этой Node.js repository:

```bash
node -e 'console.log(new Date().toISOString())'
```

Скопируйте строку сразу в Expected, а затем запишите прогноз:

- появятся ровно два lab endpoints;
- у каждого будет `eth0` в состоянии `UP/LOWER_UP`;
- `alpha` получит MAC `02:42:ac:1e:00:0a` и IPv4 `172.30.0.10`;
- `beta` получит MAC `02:42:ac:1e:00:14` и IPv4 `172.30.0.20`;
- topology не опубликует host ports и не получит обычный gateway path наружу;
- после `down` lab containers и network отсутствуют.

Это expected, а не уже выполненное наблюдение.

## Почему baseline состоит из нескольких доказательств

Строка «container running» отвечает только на вопрос о процессе контейнера. Она не
доказывает, что нужный interface существует, имеет ожидаемые addresses или
работает на link. И наоборот, запись адреса в конфигурации ещё не доказывает
наблюдаемое runtime state.

```text
expected recorded with timestamp
      ↓ run-scoped preflight proves initial labelled counts are zero
declared topology
      ↓ exact action marker, then Docker creates resources
container running
      ↓ inspect inside its Linux network namespace
eth0 exists → link is up → MAC observed → IPv4 observed
      ↓ exact cleanup
no labelled lab resources remain
```

Поэтому baseline сопоставляет source fact (контракт topology) с observed output
команд внутри каждого endpoint. Вывод «лаборатория готова к следующему bounded
probe» допустим только после обоих наборов evidence.

### Разобранный пример 1: interface есть, адрес не доказан

```text
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    link/ether 02:42:ac:1e:00:0a
```

Observed: `eth0` существует, flags сообщают admin/link state, MAC виден. В строках
нет `inet 172.30.0.10`, поэтому IPv4 configuration остаётся unknown. Нельзя
дописать expected address в раздел observed только потому, что он указан в
declaration topology.

В этой карточке `UP` означает, что interface административно включён, а
`LOWER_UP` — что virtual link layer сообщает доступный нижний уровень/peer. Эти
flags не доказывают IPv4 address и не доказывают передачу packet.

### Разобранный пример 2: cleanup проверен отдельно

```text
containers: 0
networks: 0
volumes: 0
```

Если эти числа получены командой `network:lab status` после `down` и относятся к
course labels, они подтверждают post-condition лаборатории. Простой успешный exit
code cleanup-команды слабее: она могла ничего не найти или работать с другим run.

## Preflight и stop conditions

1. Убедитесь, что предыдущая попытка завершена:

   ```bash
   pnpm network:lab status
   ```

2. Проверьте effective Docker context/endpoint, Engine ID, server architecture,
   pinned image, поддержку isolated gateway mode, fixed subnet, свободное место и
   отсутствие конфликтующих exact resources:

   ```bash
   pnpm network:lab preflight
   ```

3. Если единственная ошибка — `Pinned image не загружен`, это исправимое состояние
   первого запуска. Отдельно выполните:

   ```bash
   pnpm network:lab preload
   ```

   Это единственный шаг карточки, которому нужен registry access. Затем обязательно
   повторите `pnpm network:lab preflight` и продолжайте только после PASS. Все lab
   runs используют локальный image с `--pull never`.

Кроме явно описанной ветки missing image, остановитесь, если preflight не PASS,
endpoint не является local absolute `unix://` socket, Engine ID меняется между
фазами, Engine rootless, fixed
`172.30.0.0/24` пересекается с existing Docker network, обнаружен неожиданный
resource с тем же именем, Docker сообщает неподдерживаемый gateway mode или
команда предлагает другие targets. При subnet conflict не удаляйте чужую сеть:
используйте другой local учебный daemon или запросите поддержку курса. Не обходите
guardrails ручным `docker run --privileged`.

## Процедура

1. В `evidence/baseline.md` замените TODO в секции Expected до первого изменения.
2. Поднимите topology:

   ```bash
   pnpm network:lab up 01-02
   ```

   `up` повторяет preflight непосредственно перед действием и сохраняет связанный
   с unique run файл `preflight.json`: effective local context/endpoint и Engine
   ID, Engine/server architecture, pinned image ID, checked network inventory с
   `networkInventory.conflictCount=0`, owner label, exact target names и initial
   labelled counts `containers=0`, `networks=0`, `volumes=0`. Затем `events.jsonl`
   фиксирует отдельный action start marker. Для секции Action start скопируйте
   поле `at` из первой записи с `phase="up"` и `kind="action"`; runner уже пишет
   его в том же ISO UTC формате.

3. Снимите baseline. Команда печатает выполняемые Linux-команды и добавляет raw
   output в новый run directory; она не переиспользует существующий raw artifact:

   ```bash
   pnpm network:lab baseline
   ```

   В успешном run появятся `topology-inspect.json` с normalized Docker isolation,
   capabilities, mounts/ports и exact endpoints и `baseline.txt` с Linux
   interface evidence.
4. Перенесите только существенные observed values и точные ссылки на
   `preflight.json`, `events.jsonl`, `topology-inspect.json` и `baseline.txt` одного
   run в `evidence/baseline.md`. Отдельно напишите ограниченный inference.
5. Выполните cleanup и сохраните результат post-check:

   ```bash
   pnpm network:lab down
   pnpm network:lab status
   ```

   `down` использует заранее сохранённые name/role reservations, сверяет
   name/ID/owner/run/role на исходном Engine и ждёт bounded clean quiescence после
   удаления. Это позволяет повторному `down` восстановить run даже после CLI
   timeout между daemon-side create и возвратом ID. Затем команда сохраняет
   `post-check.txt` в той же run directory до удаления active state. Заполните
   `evidence/post-check.md` ссылкой на этот raw файл и фактическими
   counts. Для Cleanup action скопируйте поле `at` записи `phase="cleanup"`,
   `kind="cleanup"` из `events.jsonl`; отдельно перенесите `checked_at` из
   `post-check.txt` как время наблюдения конечного состояния. Последующий `status`
   — независимая видимая перепроверка, но не замена raw post-check.

### Если runtime baseline не совпал

Не переходите к дальнейшим действиям и не исправляйте raw output под expected.
`network:lab baseline` при ошибке записывает её в unique run и сам пытается
выполнить exact cleanup. Если вы заметили discrepancy отдельно, выполните только
`pnpm network:lab down`, затем `pnpm network:lab status`.

Сохраните failed run directory и перечислите её bare run id и причину в секции
`Failed attempts` файла `evidence/baseline.md`. Полные raw paths во всех остальных
секциях должны ссылаться только на один canonical successful run: так checker не
спутает его с предыдущими попытками. Новый запуск получает другой run id и не
перезаписывает failed evidence. Если cleanup/post-check не PASS, runner сохраняет
active state; не удаляйте чужие resources вручную, повторите только scoped `down`
на том же endpoint и Engine ID или остановитесь и передайте evidence на review.

## Два правдоподобных неверных пути

1. **Использовать только `docker ps` как baseline.** Это проверяет container
   lifecycle, но не interface/MAC/IPv4/link state внутри его network namespace.
2. **Оставить topology ради следующей карточки.** Тогда текущая сессия не
   green-to-green, а следующая попытка не отличит свой baseline от старого
   состояния. Cleanup — часть результата, а не необязательный хвост.

## Проверка и evidence

- Local: `pnpm session:check` запускает `network-evidence` и проверяет headings,
  отсутствие TODO, обязательные raw filenames, порядок expected/action/cleanup
  timestamps, единый run id, initial/final zero counts и isolation/exposure summary.
  Точная acceptance matrix приведена в consistency-only `acceptance.md`; check не
  утверждает истинность произвольного вписанного значения.
- Empirical: raw preflight, action marker, topology inspect, Linux baseline и
  post-check реально получены указанными lab-командами.
- Agent: сверяет значения с raw evidence, порядок expected → action → observed,
  границы scope и cleanup.
- Evidence: `evidence/baseline.md`, `evidence/post-check.md` и локальные ссылки на
  один exact `.training/evidence/01-02/<run-id>/`. Raw logs не нужно коммитить.

## DONE

- [ ] Expected timestamp раньше raw action marker; saved preflight показывает
      local `unix://` endpoint + Engine ID, `networkInventory.conflictCount=0`, initial
      labelled counts `0/0/0` для containers/networks/volumes, exact scope,
      Engine/architecture и image.
- [ ] `topology-inspect.json` доказывает internal isolated network, exact endpoints,
      отсутствие published ports/mounts/added endpoint capabilities.
- [ ] Observed interface, MAC, IPv4 и link state для обоих endpoints сохранены со
      ссылкой на raw output.
- [ ] Source facts, observed и inference не смешаны.
- [ ] `down` выполнен; raw `post-check.txt` того же run содержит bounded
      reconciliation/quiescence evidence, а независимый status
      показывают ноль lab containers, networks и volumes.
- [ ] `pnpm session:check` зелёный, agent review получил PASS.

Следующий шаг `01-03` использует уже готовый synthetic capture и не требует
оставлять эту topology запущенной.

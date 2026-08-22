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

Запишите прогноз в `evidence/baseline.md` до `up`:

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
declared topology
      ↓ docker creates resources
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
Compose.

### Разобранный пример 2: cleanup проверен отдельно

```text
containers: 0
networks: 0
```

Если эти числа получены командой `network:lab status` после `down` и относятся к
course labels, они подтверждают post-condition лаборатории. Простой успешный exit
code `docker compose down` слабее: команда могла работать с другим project name.

## Preflight и stop conditions

1. Убедитесь, что предыдущая попытка завершена:

   ```bash
   pnpm network:lab status
   ```

2. Проверьте Docker, архитектуру image, поддержку isolated gateway mode, свободное
   место и отсутствие конфликтующих exact resources:

   ```bash
   pnpm network:lab preflight
   ```

3. Если image ещё не загружен, отдельно выполните:

   ```bash
   pnpm network:lab preload
   ```

   Это единственный шаг карточки, которому нужен registry access. Все lab runs
   затем используют локальный image с `--pull never`.

Остановитесь, если preflight не PASS, обнаружен неожиданный resource с тем же
именем, Docker сообщает неподдерживаемый gateway mode или команда предлагает
другие targets. Не обходите guardrails ручным `docker run --privileged`.

## Процедура

1. В `evidence/baseline.md` замените TODO в секции Expected до первого изменения.
2. Поднимите topology:

   ```bash
   pnpm network:lab up 01-02
   ```

3. Снимите baseline. Команда печатает выполняемые Linux-команды и добавляет raw
   output в новый run directory; она не переиспользует существующий raw artifact:

   ```bash
   pnpm network:lab baseline
   ```

4. Перенесите только существенные observed values и ссылку на raw run directory в
   `evidence/baseline.md`. Отдельно напишите ограниченный inference.
5. Выполните cleanup и сохраните результат post-check:

   ```bash
   pnpm network:lab down
   pnpm network:lab status
   ```

   Заполните `evidence/post-check.md` фактическим output/status, не примером из
   README.

## Два правдоподобных неверных пути

1. **Использовать только `docker ps` как baseline.** Это проверяет container
   lifecycle, но не interface/MAC/IPv4/link state внутри его network namespace.
2. **Оставить topology ради следующей карточки.** Тогда текущая сессия не
   green-to-green, а следующая попытка не отличит свой baseline от старого
   состояния. Cleanup — часть результата, а не необязательный хвост.

## Проверка и evidence

- Local: `pnpm session:check` запускает `network-evidence` и проверяет структуру
  двух Markdown artifacts, отсутствие TODO и ссылки на отдельные observed/post-check
  данные. Команда не утверждает истинность вписанных наблюдений.
- Empirical: raw baseline и status реально получены указанными lab-командами.
- Agent: сверяет значения с raw evidence, порядок expected → action → observed,
  границы scope и cleanup.
- Evidence: `evidence/baseline.md`, `evidence/post-check.md` и локальная ссылка на
  созданный run directory. Raw capture/log не нужно коммитить.

## DONE

- [ ] Expected записан до `up`, preflight получил PASS.
- [ ] Observed interface, MAC, IPv4 и link state для обоих endpoints сохранены со
      ссылкой на raw output.
- [ ] Source facts, observed и inference не смешаны.
- [ ] `down` выполнен; post-check показывает ноль lab containers и networks.
- [ ] `pnpm session:check` зелёный, agent review получил PASS.

Следующий шаг `01-03` использует уже готовый synthetic capture и не требует
оставлять эту topology запущенной.

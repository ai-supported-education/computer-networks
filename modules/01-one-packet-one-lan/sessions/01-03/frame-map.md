# Frame map 01-03

Сначала отделите заданные факты и допущения от собственного прогноза. После
запуска переносите поля только из своего `inspect.txt`: демонстрационные значения
из README не являются вашими `Observations`.

## Source facts

TODO: путь, версионируемый SHA-256, искусственное происхождение и число кадров из
provenance fixture. Укажите точный файл-источник.

## Assumptions before action

TODO: утверждения, которые до запуска не подтверждены provenance или наблюдением.
Если дополнительных допущений нет, напишите это явно и объясните почему.

## Expected before action

TODO: отметка времени ISO UTC до `inspect` и ваш прогноз свойств офлайн-инспектора:
локальный endpoint, `network=none`, отсутствие добавленных capabilities, mounts и
опубликованных портов, ограничения ресурсов и последующая очистка.

## Inspector action and raw evidence

TODO: одна директория `.training/evidence/01-03/<run-id>/`, отметка времени
действия из `events.jsonl` и ссылки на `preflight.txt`, `events.jsonl`,
`inspect.txt` и `post-check.txt`.

## Fixture identity

- Path: `fixtures/01-03/known-neighbour.pcap`
- Observed SHA-256: TODO
- Provenance checked: TODO

## Frame 1 observations

TODO: перенесите фактические поля `frame`, `eth`, `ip` и `icmp`.

## Frame 1 boundary arithmetic

TODO: покажите расчёты `ip.len`, `frame.cap_len` и сравнение
`frame.len`/`frame.cap_len`; укажите единицы.

## Frame 2 observations

TODO: перенесите фактические поля `frame`, `eth`, `ip` и `icmp`.

## Frame 2 boundary arithmetic

TODO: независимо повторите расчёты `ip.len`, `frame.cap_len` и проверку усечения;
укажите единицы.

## Inference

TODO: какой ограниченный вывод позволяет сделать последовательность в рамках
этого fixture.

## Unknowns and applicability limits

TODO: минимум два утверждения, которых этот fixture не доказывает.

## Offline inspector cleanup

TODO: время post-check того же run, фактическое
`exact_container_absent=true`, счётчики ресурсов с метками курса `0/0/0` и
результат `pnpm network:lab status`.

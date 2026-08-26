# Packet path 01-06

Собирайте путь только из данных своего `inspect.txt`. Если для стрелки нет
наблюдения, оставьте её в `Assumptions` или `Unknowns`, а не достраивайте по
типичному поведению `ping`.

## Fixture identity and provenance

TODO: path, наблюдаемый SHA-256, искусственное происхождение и хранящийся в
репозитории `novel-local-exchange.baseline.txt`.

## Source facts

TODO: только утверждения из versioned provenance и baseline с точными ссылками.

## Assumptions

TODO: предоставленное допущение об одной LAN и другие недоказанные утверждения;
если дополнительных нет, напишите это явно.

## Expected before action

TODO: отметка времени ISO UTC до `inspect`, ожидаемая форма ограниченного
доказательства и границы вывода без `Observations` из целевого fixture.

## Inspector action and raw evidence

TODO: одна директория `.training/evidence/01-06/<run-id>/`, отметка времени
действия из `events.jsonl` и ссылки на `preflight.txt`, `events.jsonl`,
`inspect.txt` и `post-check.txt`.

## Frame inventory

TODO: все frame numbers и применимые поля Ethernet/ARP/IPv4/ICMP, включая
`icmp.ident` и `icmp.seq` для Echo frames.

## Echo pair correlation

TODO: самостоятельно найдите все Echo-кадры в исходном `inspect.txt`. Для каждого
добавьте одну строку показанного формата, подставив наблюдаемый номер и поля. Затем
перечислите найденные Request/Reply-пары и объясните сопоставление по адресам,
`icmp.type`, `icmp.ident` и `icmp.seq`; не используйте один только порядок кадров.

```text
echo_frame=<observed frame number> eth.src=<observed> eth.dst=<observed> ip.src=<observed> ip.dst=<observed> icmp.type=<observed> icmp.ident=<observed> icmp.seq=<observed>
```

## Causal stages

TODO: этапы и стрелки; ссылка на companion имеет форму `path:line`, ссылка на кадр
— `inspect.txt`, `frame.number=N`, точное `field=value`.

## Observations

TODO: только фактически извлечённые данные со ссылками на источник.

## Inferences

TODO: ограниченные выводы из `Source facts` + `Assumptions` + `Observations`.

## Unknowns

TODO: минимум три.

## Counterfactual

TODO: какое конкретное изменение доказательств опровергло бы главный `Inference`.

## Final bounded conclusion

TODO: одна фраза и область применимости.

## Cleanup status

TODO: время post-check того же запуска, фактическое
`exact_container_absent=true`, счётчики ресурсов с метками курса `0/0/0` и
результат `network:lab status`.

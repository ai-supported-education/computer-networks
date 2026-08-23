# Rubric: 01-06

## Invariants для PASS

- Fixture identity/provenance и versioned source-interface baseline проверены;
  inventory содержит каждый observed frame и только применимые protocol fields.
- Expected/assumptions записаны до inspector action; один unique raw run содержит
  preflight/events/inspect/post-check, а timestamps упорядочены.
- Causal stages покрывают source interface/link evidence, neighbor resolution или
  reuse, Ethernet delivery, IPv4/ICMP request и обратный evidence в том объёме,
  который реально присутствует.
- Echo request/reply сопоставлены отдельно для frames 3→4 и 5→6: в каждой паре
  observed `icmp.ident` и `icmp.seq` совпадают, Ethernet/IPv4 addresses развёрнуты,
  а sequence отличает одну пару от другой. Близость или порядок frames сами по
  себе не считаются доказательством сопоставления.
- Каждая причинная стрелка имеет точную companion `path:line` либо raw
  `frame.number` + `field=value` citation; expected поведение не записано как
  observed.
- Ledger явно разделяет source facts, assumptions, observations, inferences и
  минимум три meaningful unknowns.
- Главный inference ограничен synthetic fixture/одной LAN; CIDR, gateway и route
  choice не введены скрыто.
- Counterfactual конкретно меняет evidence и логически опровергает вывод.
- Post-check того же run содержит exact-container cleanup marker, нулевые labelled
  counts и clean status; local check PASS.

## Valid alternatives

- Timeline можно оформить таблицей, Mermaid/text diagram или нумерованными stages.
- Допустимы разные уровни детализации payload, если обязательная correlation по
  identifier/sequence, headers/relations и epistemic границы сохранены.
- Иной counterfactual допустим, если связь с главным inference объяснена.

## Evidence and safety

Agent сверяет `packet-path.md` с raw/normalized synthetic fixture и profile
contracts. Inspector допускает только local `unix://` Docker endpoint, использует
`--network none` и не bind-mount-ит host paths. Network access, изменение fixture
или необоснованное заполнение unknown блокируют PASS.

## Optional improvements

Можно добавить отдельную diagram вложенности и отдельную event timeline. Это не
условие PASS.

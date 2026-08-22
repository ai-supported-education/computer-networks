# Rubric: 01-06

## Invariants для PASS

- Fixture identity/provenance проверены; inventory содержит каждый observed frame и
  только применимые protocol fields.
- Causal stages покрывают source interface/link evidence, neighbor resolution или
  reuse, Ethernet delivery, IPv4/ICMP request и обратный evidence в том объёме,
  который реально присутствует.
- Каждая причинная стрелка имеет citation; типичное/expected поведение не записано
  как observed.
- Ledger явно разделяет source facts, assumptions, observations, inferences и
  минимум три meaningful unknowns.
- Главный inference ограничен synthetic fixture/одной LAN; CIDR, gateway и route
  choice не введены скрыто.
- Counterfactual конкретно меняет evidence и логически опровергает вывод.
- Offline run не оставил lab resources; local check PASS.

## Valid alternatives

- Timeline можно оформить таблицей, Mermaid/text diagram или нумерованными stages.
- Допустимы разные уровни детализации payload, если headers/relations и epistemic
  границы сохранены.
- Иной counterfactual допустим, если связь с главным inference объяснена.

## Evidence and safety

Agent сверяет `packet-path.md` с raw/normalized synthetic fixture и profile
contracts. Network access, изменение fixture или необоснованное заполнение unknown
блокируют PASS.

## Optional improvements

Можно добавить отдельную diagram вложенности и отдельную event timeline. Это не
условие PASS.

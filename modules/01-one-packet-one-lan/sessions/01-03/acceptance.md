# Automated acceptance contract: 01-03

Файл входит только в consistency-pass author review и не содержит ответов
artifact.

`network-evidence` отклоняет TODO starter, неверный/отсутствующий canonical hash,
отсутствующий или смешанный raw run, неверный Expected/action/cleanup order,
отсутствующие `preflight.txt`/`events.jsonl`/`inspect.txt`/`post-check.txt`, frame
1/2 citations, `ip.len`/`frame.cap_len`, значения `60 bytes`/`74 bytes`, labelled
`0/0/0` и offline cleanup marker. Минимальный structurally complete frame-map
проходит.
Regression matrix находится в `packages/network-lab/test/evidence.test.ts`.

Automation проверяет форму и fixed identity, но не заменяет agent: связь fields с
protocol boundaries, арифметическое рассуждение, FCS/VLAN/options limits и
корректность inference оцениваются по rubric.

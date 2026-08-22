# Automated acceptance contract: 01-03

Файл входит только в consistency-pass author review и не содержит ответов
artifact.

`network-evidence` отклоняет TODO starter, неверный/отсутствующий canonical hash,
отсутствующие frame 1/2 citations, sections, значения `60 bytes`/`74 bytes` и
offline cleanup marker. Минимальный structurally complete frame-map проходит.
Regression matrix находится в `packages/network-lab/test/evidence.test.ts`.

Automation проверяет форму и fixed identity, но не заменяет agent: связь fields с
protocol boundaries, арифметическое рассуждение, FCS/VLAN/options limits и
корректность inference оцениваются по rubric.

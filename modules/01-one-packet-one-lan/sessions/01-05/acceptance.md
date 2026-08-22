# Automated acceptance contract: 01-05

Файл входит только в consistency-pass author review и не раскрывает diagnoses.

`network-evidence` отклоняет TODO starter, отсутствующий case/required section,
неточную fixture file citation, менее двух отдельных unknowns в case и менее трёх
offline cleanup markers. Он требует все три fixed fixture directories и
cross-case comparison. Минимальный structurally complete artifact проходит в
`packages/network-lab/test/evidence.test.ts`.

Automation не назначает last proven stage и root cause. Содержательную
согласованность citations, causal boundary и discriminating observation проверяет
agent по rubric.

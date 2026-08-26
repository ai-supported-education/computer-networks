# Automated acceptance contract: 01-05

Файл входит только в consistency-pass author review и не раскрывает diagnoses.

`network-evidence` отклоняет TODO starter, отсутствие или пустые `Source facts` и
`Assumptions before inspector actions`, отсутствие Expected checkpoint, трёх
unique raw runs либо любого их `preflight.txt`/`events.jsonl`/`inspect.txt`/
`post-check.txt`, отсутствие трёх exact `inspect_action_at`/`cleanup_at` rows,
неверный Expected/inspect-action/cleanup order, отсутствующий
case/required section, неточную fixture file citation, менее двух отдельных
unknowns в case и менее трёх cleanup markers. Он требует все три fixed fixture
directories и cross-case comparison. Минимальный структурно полный artifact
проходит в `packages/network-lab/test/evidence.test.ts`.

Automation не назначает last proven stage и root cause. Содержательную
согласованность citations, causal boundary и discriminating observation проверяет
agent по rubric.

# Automated acceptance contract: 01-06

Файл входит только в consistency-pass author review и не содержит готового packet
path.

`network-evidence` отклоняет TODO starter, отсутствие одного exact raw run и
`preflight.txt`/`events.jsonl`/`inspect.txt`/`post-check.txt`, неверный
Expected/action/cleanup order, отсутствие pcap/baseline references, любого frame
1–6, обязательной ledger/stages/counterfactual section, менее трёх отдельных
unknowns, labelled `0/0/0` и offline cleanup marker. Минимальный structurally
complete artifact проходит regression test.

Automation не может оценить, действительно ли causal arrow следует из cited
field, а counterfactual опровергает главный inference. Эти критерии остаются в
обязательном agent review.

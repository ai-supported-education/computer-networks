# Automated acceptance contract: 01-06

Файл входит только в consistency-pass author review и не содержит готового packet
path.

`network-evidence` отклоняет TODO starter, отсутствие одного exact raw run и
`preflight.txt`/`events.jsonl`/`inspect.txt`/`post-check.txt`, неверный
Expected/action/cleanup order, отсутствие pcap/baseline references, любого frame
1–6, обязательной ledger/stages/counterfactual section, менее трёх отдельных
unknowns, labelled `0/0/0` и offline cleanup marker. Для Echo frames обязательны
четыре отдельные rows 3–6 с явными `eth.src/dst`, `ip.src/dst`, `icmp.type`,
`icmp.ident` и `icmp.seq`. Automation сверяет их с versioned normalized fixture и
отклоняет выдуманные fields, несовпавшие request/reply identifier/sequence,
неразвёрнутые addresses, duplicate frame и одинаковый sequence у двух exchanges.
Минимальный structurally complete artifact проходит regression test; negative
regressions меняют reply identity, Ethernet/IPv4 address, подставляют внутренне
согласованные, но не observed ICMP values, ломают row format и дублируют frame.

Automation не может оценить, действительно ли causal arrow следует из cited
field, а counterfactual опровергает главный inference. Эти критерии остаются в
обязательном agent review.

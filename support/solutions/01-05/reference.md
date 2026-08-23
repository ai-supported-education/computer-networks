# Reference: 01-05

Все утверждения ниже относятся только к versioned synthetic bundles.

До первого inspector action нужен один global Expected timestamp. В run ledger
три case связываются с тремя разными `.training/evidence/01-05/<run-id>/` и своими
`preflight.txt`, `events.jsonl`, `inspect.txt`, `post-check.txt`; для каждого
`inspect_action_at < cleanup_at`, `exact_container_absent=true` и labelled
`0/0/0`. `inspect_action_at` берётся из inspector `events.jsonl`, а не из
synthetic fixture `action.txt`.

## interface-not-ready

Baseline показывает `eth0 state DOWN` и `ipv4=not-observed`; bounded events не
содержат frame. Последний доказанный stage — наличие точки inventory/capture,
первый недоказанный переход — готовность source interface к IPv4 action. Root
cause, поведение beta и причина состояния interface остаются unknown.

## arp-no-reply

Baseline доказывает `eth0 UP`, source MAC/IPv4 и отсутствие neighbor entry.
Events 1–3 доказывают повторные ARP requests (S3a); matching reply (S3b) и
последующий ICMP не наблюдаются в заданном окне. Граница — переход S3a → S3b,
но fixture не различает состояние beta, delivery и capture omission вне bounds.

## icmp-no-reply

Events 1–2 доказывают ARP request/reply, event 3 — outgoing Echo Request. Echo
Reply не наблюдается в двухсекундном окне. Граница находится после outgoing
request; это не доказывает, был ли request принят или почему reply отсутствует.

ARP Reply и S4 не следует сливать: mapping available подтверждается отдельным
neighbor snapshot либо следующим Ethernet Request, использующим advertised MAC.

Безопасное следующее наблюдение в каждом case должно быть read-only, bounded и
различать названные hypotheses: например, второй заранее заданный capture point
или endpoint-local log в synthetic lab, но не произвольный внешний probe. В
предложении должны быть названы competing hypotheses и разные ожидаемые outcomes.
При cleanup failure анализ не становится PASS: применяется только напечатанная
recovery-команда exact run directory с persisted daemon/resource identity.

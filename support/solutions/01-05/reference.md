# Reference: 01-05

Все утверждения ниже относятся только к versioned synthetic bundles.

## interface-not-ready

Baseline показывает `eth0 state DOWN` и `ipv4=not-observed`; bounded events не
содержат frame. Последний доказанный stage — наличие точки inventory/capture,
первый недоказанный переход — готовность source interface к IPv4 action. Root
cause, поведение beta и причина состояния interface остаются unknown.

## arp-no-reply

Baseline доказывает `eth0 UP`, source MAC/IPv4 и отсутствие neighbor entry.
Events 1–3 доказывают повторные ARP requests; matching reply и последующий ICMP
не наблюдаются в заданном окне. Граница — переход от ARP request к reply/mapping,
но fixture не различает состояние beta, delivery и capture omission вне bounds.

## icmp-no-reply

Events 1–2 доказывают ARP request/reply, event 3 — outgoing Echo Request. Echo
Reply не наблюдается в двухсекундном окне. Граница находится после outgoing
request; это не доказывает, был ли request принят или почему reply отсутствует.

Безопасное следующее наблюдение в каждом case должно быть read-only, bounded и
различать названные hypotheses: например, второй заранее заданный capture point
или endpoint-local log в synthetic lab, но не произвольный внешний probe.

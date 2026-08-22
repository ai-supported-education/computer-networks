# Reference: 01-03

Verified synthetic fixture:

```text
fixtures/01-03/known-neighbour.pcap
sha256=8a4036d450c9f0953c50286f2dc99d429873900e8f92f22a1d2f8f6f1b6dc64f
```

Frame 1: `74 bytes`, Ethernet `.0a → .14`, EtherType `0x0800`, IPv4
`172.30.0.10 → 172.30.0.20`, protocol `1`, ICMP type/code `8/0`, id `4660`,
sequence `1`. Frame 2 имеет обратные MAC/IPv4 направления и ICMP type/code `0/0`
с теми же id/sequence.

Для каждого frame IPv4 total length: `20 + 8 + 32 = 60 bytes`. Captured Ethernet
frame: `14 + 60 = 74 bytes`. FCS в capture отсутствует. Это вычисление зависит от
отсутствия VLAN tag и IPv4 options и не является универсальной формулой для любого
frame.

Sequence согласуется с одной synthetic Echo Request/Reply парой в заданной точке
capture. Она не доказывает live kernel behavior, route/gateway или трафик вне двух
records.

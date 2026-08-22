# Automated acceptance contract: 01-04

Файл входит только в consistency-pass author review и не содержит observed run.

Local `network-evidence` обязан отклонить TODO starter, разные run ids, Expected не
раньше action, cleanup не позже action, отсутствие cold/warm raw filenames,
SHA-256, neighbor evidence, local endpoint/subnet gate, advertised ARP MAC,
ARP/ICMP/matching identifier/sequence summary или нулевого post-check. Минимальный
structurally complete artifact проходит.

До появления Markdown runner сам fail-closed проверяет decoded live capture:
cold ARP request → matching reply with advertised beta MAC → Echo Request →
matching Echo Reply; warm neighbor mapping; Ethernet directions; frame/time/size
bounds; Echo identity/sequence. Regression tests в
`packages/network-lab/test/lab.test.ts` отдельно отвергают incomplete capture,
wrong advertised MAC и reply с другой Echo identity. Agent затем сверяет summary
с local raw files и оценивает причинный inference.

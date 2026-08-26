# Automated acceptance contract: 01-04

Файл входит только в consistency-pass author review и не содержит observed run.

Local `network-evidence` обязан отклонить TODO starter, разные run ids, Expected не
раньше action, cleanup не позже action, отсутствующие или пустые `Source facts` и
`Assumptions before action`, отсутствие cold/warm raw filenames,
helper runtime-inspect filenames, SHA-256, neighbor evidence, local endpoint/subnet
gate, advertised ARP MAC, ARP/ICMP/matching identifier/sequence summary или
нулевого post-check. Минимальный структурно полный artifact проходит.

До появления Markdown runner сам fail-closed проверяет decoded live capture:
cold ARP request → matching reply with advertised beta MAC → Echo Request →
matching Echo Reply; warm neighbor mapping и отсутствие target ARP перед первым
Echo Request; Ethernet directions; frame/time/size bounds; Echo identity/sequence.
ARP после warm Echo остаётся допустимым runtime событием. Regression tests в
`packages/network-lab/test/lab.test.ts` отдельно отвергают incomplete capture,
wrong advertised MAC, pre-Echo warm ARP и reply с другой Echo identity. Agent затем
сверяет summary с local raw files и оценивает причинный inference.

Каждый helper до старта проходит fail-closed Docker inspect. Runner проверяет
exact identity/labels, shared network namespace, минимальный capability set,
`no-new-privileges`, read-only rootfs, bounded tmpfs/CPU/memory/PIDs, mounts и
отсутствие ports. Для capture-helper разрешён ровно один labelled volume текущей
фазы в `/evidence`; probe- и neighbor-helper должны иметь ноль mounts, а host bind
mount запрещён. Normalized snapshots сохраняются в `helpers/*.json`.

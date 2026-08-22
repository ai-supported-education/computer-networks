# Frame map 01-03

## Expected before action

TODO: ISO UTC timestamp до `inspect`, ожидаемые identity/frame-count/safety свойства
из provenance и исходные assumptions.

## Inspector action and raw evidence

TODO: один `.training/evidence/01-03/<run-id>/`, action timestamp из
`events.jsonl` и ссылки на `preflight.txt`, `events.jsonl`, `inspect.txt` и
`post-check.txt`.

## Fixture identity

- Path: `fixtures/01-03/known-neighbour.pcap`
- Observed SHA-256: TODO
- Provenance checked: TODO

## Frame 1 observations

TODO: перенесите фактические `frame`, `eth`, `ip` и `icmp` fields.

## Frame 1 boundary arithmetic

TODO: расчёты `ip.len`, `frame.cap_len` и сравнение `frame.len`/`frame.cap_len` с
единицами.

## Frame 2 observations

TODO: перенесите фактические `frame`, `eth`, `ip` и `icmp` fields.

## Frame 2 boundary arithmetic

TODO: независимые расчёты `ip.len`, `frame.cap_len` и truncation check с единицами.

## Inference

TODO: что последовательность позволяет заключить в рамках fixture.

## Unknowns and applicability limits

TODO: минимум два утверждения, которых fixture не доказывает.

## Offline inspector cleanup

TODO: cleanup/post-check timestamp того же run, фактические
`exact_container_absent=true`, labelled counts `0/0/0` и `pnpm network:lab status`.

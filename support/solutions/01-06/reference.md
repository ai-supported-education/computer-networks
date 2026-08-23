# Reference: 01-06

Verified synthetic fixture SHA-256:
`e8e22341c995edf8fb1ad045d5fd089d3130490e5a506b85889b2a9ada3f4ddd`.

Expected и supplied one-LAN assumption записываются до action marker. Один exact
run связывает `preflight.txt`, `events.jsonl`, `inspect.txt` и `post-check.txt`;
каждая observation/causal arrow ссылается на конкретный extracted frame row, а не
только на этот reference-разбор.

Observed sequence:

1. Frame 1: alpha broadcasts ARP request for beta IPv4.
2. Frame 2: beta returns its MAC directly to alpha.
3. Frames 3/4: Echo Request `.10 → .20`, then matching Reply `.20 → .10`, id
   `25094`, sequence `7`.
4. Frames 5/6: the same directions and message types, sequence `8`, without a new
   preceding ARP pair inside the capture.

Source facts: endpoint inventory, synthetic origin, capture point/filter/bounds.
Assumption: supplied statement that both endpoints are in one local Ethernet LAN.
Observations: the six extracted rows. Inference: the sequence is consistent with
neighbor resolution followed by two completed local Echo exchanges and reuse for
the second request.

Unknowns include endpoint internals, host routing, frames outside the window and
why a real system would choose the same timings. A counterfactual such as absence
of frame 2 while frame 3 remains would break the claimed causal ARP-resolution
chain; absence of frame 4 would break the claim that the first exchange completed.

Operational PASS дополнительно требует `exact_container_absent=true`, labelled
`containers/networks/volumes=0` и независимый чистый `network:lab status`. При
cleanup failure используется только напечатанный exact run-directory recovery,
который сверяет endpoint, Engine ID и persisted resource identity.

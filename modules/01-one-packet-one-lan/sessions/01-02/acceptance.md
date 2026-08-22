# Automated acceptance contract: 01-02

Этот файл входит только в consistency-pass author review. Учащийся выполняет
команду `pnpm session:check`; ответы или observed values здесь не заданы.

`network-evidence` проверяет два regular non-symlink Markdown artifacts:

- starter с любым оставшимся TODO получает FAIL;
- отсутствующий обязательный heading или raw filename получает FAIL;
- Expected timestamp не раньше Action start получает FAIL;
- cleanup timestamp не позже Action start получает FAIL;
- разные run ids в baseline и post-check получают FAIL;
- отсутствие observed `UP` и `LOWER_UP` отдельно для двух endpoints получает FAIL;
- отсутствие local `unix://` endpoint, `networkInventory.conflictCount=0`,
  initial/final zero counts или isolation/no-port summary получает FAIL;
- минимальный artifact, удовлетворяющий всем этим отношениям, получает PASS.

Regression tests находятся в `packages/network-lab/test/evidence.test.ts`; adapter
check label отдельно покрыт `packages/session-runner/test/network-evidence.test.ts`.
Agent review остаётся обязательным: automation не может доказать, что человек не
переписал raw observation, и поэтому сверяет Markdown с локальной unique run
directory и safety rubric.

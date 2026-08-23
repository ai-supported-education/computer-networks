# Rubric: 01-05

## Invariants для PASS

- Expected operational contract записан до всех трёх inspector action markers;
  ledger содержит три unique preflight/events/inspect/post-check runs с
  упорядоченными timestamps и clean labelled counts.
- Все три bundles идентифицированы verified hash/provenance.
- Каждый case содержит точные citations на baseline/action/events, а не пересказ
  названия directory.
- Last proven stage и earliest missing/disproven transition согласованы с causal
  ladder; ARP Request и matching Reply не слиты, а S5/S6 различают Ethernet, IPv4
  и ICMP evidence; более поздний симптом не подменяет первую границу.
- S4 не выводится только из наличия ARP Reply: cited evidence показывает observed
  neighbor mapping либо последующее использование advertised MAC при emission.
- Bounded inference не объявляет конкретный root cause без различающего evidence.
- Для каждого case сохранены минимум две правдоподобные unknowns и предложено одно
  безопасное следующее наблюдение, для которого указаны competing hypotheses и
  разные ожидаемые результаты.
- Cross-case comparison объясняет, почему общий «ping failed» недостаточен.
- Отсутствие формулируется как «не наблюдалось» в bounded capture; emission не
  объявляется фактом без отдельного evidence.
- Для каждого из трёх inspect post-check сохранил `exact_container_absent=true` и
  нулевые labelled counts; final status чист.

## Valid alternatives

- Нумерацию stages можно заменить точными названиями переходов.
- Empty capture можно цитировать через metadata/companion, если observation window
  и filter доказаны.
- Следующий observation может отличаться от авторского, если он действительно
  различает оставшиеся hypotheses и остаётся bounded/read-only.

## Evidence and safety

Fixtures immutable и synthetic; inspector допускает только local `unix://`
Docker endpoint, использует `--network none` и не bind-mount-ит host paths.
Изменение raw artifacts, пропуск hash mismatch или запуск probes против внешних
targets блокируют PASS.

## Optional improvements

Можно добавить одну общую matrix «case → confirmed stages → first gap». Это не
условие PASS.

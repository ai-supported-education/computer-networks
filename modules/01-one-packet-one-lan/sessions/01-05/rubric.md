# Rubric: 01-05

## Invariants для PASS

- Все три bundles идентифицированы verified hash/provenance.
- Каждый case содержит точные citations на baseline/action/events, а не пересказ
  названия directory.
- Last proven stage и earliest missing/disproven transition согласованы с causal
  ladder; более поздний симптом не подменяет первую границу.
- Bounded inference не объявляет конкретный root cause без различающего evidence.
- Для каждого case сохранены минимум две правдоподобные unknowns и предложено одно
  безопасное следующее наблюдение.
- Cross-case comparison объясняет, почему общий «ping failed» недостаточен.
- Для каждого из трёх inspect сохранён `exact_container_absent=true`; final
  labelled status чист.

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

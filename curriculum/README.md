# Карта курса

`course.json` — каноническая карта: порядок modules, длительность, outcome, DONE,
profiles, checks и evidence. Здесь можно держать человеческий обзор маршрута, но не
вторую независимую версию требований.

Опубликованная часть курса начинается с module `01-one-packet-one-lan`; остальные
карточки пока образуют roadmap со статусом `planned`. При реализации следующей
карточки сначала обновите её полный контракт в authoring branch, создайте
одноимённую папку `modules/<id>-<slug>/sessions/<session-id>/`, проведите session и
module content-review, и только затем переносите published prefix в default branch.

Перед добавлением карточки сверяйтесь с [контрактом сессии](session-contract.md) и
[стандартом материала](authoring-standard.md), выберите profiles по
[`docs/course-profiles`](../docs/course-profiles/README.md) и скопируйте ближайший
каркас из [`templates/sessions`](../templates/README.md).

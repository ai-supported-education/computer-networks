# Course support

Эта ветка дополняет основную ветку и не предназначена для обычной навигации
учащегося. Здесь находятся progressive hints, quiz key и reference solutions для
опубликованной части курса.

```text
support/
├── hints/<session-id>.json
├── quizzes/<session-id>.key.json
└── solutions/<session-id>/reference.md
```

Runner читает эти файлы из Git ref `course-support`. `pnpm session:hint` выдаёт
ровно один следующий уровень и фиксирует его в персональном progress. Reference
solution никогда не применяется автоматически.

Материалы live-lab не содержат выдуманных observed values: соответствующие
reference-файлы показывают форму доказательства, а реальные timestamps, run ids и
вывод команд учащийся получает только собственным запуском.

# Reference structure: 01-02

Это не observed evidence и не готовый ответ для копирования. Реальные timestamps,
run id и строки interface учащийся получает только собственным запуском.

Минимально достаточная структура:

1. До `up` записан expected и время записи.
2. Из `events.jsonl` взят более поздний `phase=up kind=action` timestamp; все
   полные ссылки используют один unique `.training/evidence/01-02/<run-id>/`.
3. `preflight.json` подтверждает local absolute `unix://` endpoint, Engine ID,
   `networkInventory.conflictCount=0`, initial labelled `0/0/0`, image и exact
   targets. `topology-inspect.json` подтверждает internal isolated network,
   labels, отсутствие exposure/mounts и runtime security/resource guardrails.
4. Для alpha и beta процитированы отдельные строки `baseline.txt` с `eth0`,
   `UP/LOWER_UP`, MAC и IPv4; рядом дан только ограниченный inference.
5. После `down` cleanup action time взят из `events.jsonl`, observation time — из
   `post-check.txt`; там же сохранены reconciliation/quiescence и exact/labelled
   `containers=0`, `networks=0`, `volumes=0`.
6. Failed attempts перечислены отдельно bare run ids. Если любой финальный count
   ненулевой, artifact помечает cleanup incomplete и не претендует на PASS.

Пример допустимого ограничения вывода: baseline согласуется с заявленным
inventory двух endpoints, но сам по себе ещё не доказывает обмен сообщениями между
ними.

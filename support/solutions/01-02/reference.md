# Reference structure: 01-02

Это не observed evidence и не готовый ответ для копирования. Реальные timestamps,
run id и строки interface учащийся получает только собственным запуском.

Минимально достаточная структура:

1. До `up` записан expected и время записи.
2. После `baseline` указан unique `.training/evidence/01-02/<run-id>/...`.
3. Для alpha и beta процитированы отдельные raw-строки с `eth0`, link state, MAC и
   IPv4; рядом дан только ограниченный inference.
4. После `down` сохранены время/команда и фактический `status` с нулевыми counts.
5. Если любой count ненулевой, artifact честно помечает cleanup incomplete и не
   претендует на PASS.

Пример допустимого ограничения вывода: baseline согласуется с заявленным
inventory двух endpoints, но сам по себе ещё не доказывает обмен сообщениями между
ними.

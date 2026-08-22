# Контракт Docker/Linux лаборатории

Этот документ задаёт обязательную support и safety boundary для всех sessions.
Конкретная карточка может сузить scope, но не расширить его без отдельного
обоснования и review.

## Required host environment

Поддерживаемая матрица v1:

| Host | CPU | Runtime |
| --- | --- | --- |
| macOS с Docker Desktop | arm64 или amd64 | Linux containers, Docker Compose v2 |
| Linux с Docker Engine | arm64 или amd64 | Linux containers, Docker Compose v2 |

Host также предоставляет Git, shell, Node.js версии не ниже указанной в
package.json и package manager из поля packageManager. Изучаемые ip, ping, ss,
tcpdump, tshark, dig, curl, openssl, nft, conntrack и tc выполняются внутри
Linux containers. Карточка не требует установки этих tools непосредственно на
macOS.

Каждый published lab image обязан иметь multi-platform manifest как минимум для
linux/amd64 и linux/arm64. Image reference фиксируется автором; preflight
сохраняет реально разрешённый digest и uname -m. Наличие support в этом документе
является требованием к материалу, а не выдуманным фактом успешного запуска.

## Default topology boundary

Обязательная практика использует только явно названные services текущего Compose
project. По умолчанию topology имеет следующие ограничения:

- dedicated isolated internal network;
- нет published ports, host networking и подключения к произвольным external
  networks;
- Docker socket не монтируется;
- privileged containers запрещены;
- host filesystem не монтируется, кроме точной session evidence directory;
- NET_RAW и NET_ADMIN выдаются только конкретному disposable service и только
  когда без них нельзя получить заявленный outcome;
- automation печатает выполняемую Linux-команду, exact target и ограничения, а
  не скрывает изучаемый mechanism.

Разрешённые targets — localhost и containers текущей synthetic topology.
Documented example ranges и service names не являются разрешением выполнять
команды против Internet или другой сети. MikroTik, RouterOS, домашний router и
production infrastructure никогда не входят в default target scope.

## Обязательный порядок run

Каждая lab session сохраняет доказуемый порядок фаз:

1. Inventory и preflight: runtime, architecture, image digest, свободное место,
   exact Compose project, capabilities и evidence path.
2. Baseline до изменения или probe.
3. Expected и assumptions до action start marker.
4. Одно bounded действие.
5. Raw observed evidence без исправления под expected.
6. Отдельный inference с названной remaining uncertainty.
7. Cleanup или rollback.
8. Post-check конечного состояния.

Setup, capture, ожидание, cleanup и post-check входят в заявленные 35–55 минут.
Session не заканчивается работающей в background topology или обязательным TODO.

## Packet evidence

Для обязательного разбора используется текстовый tshark output. GUI Wireshark
может быть необязательным способом посмотреть те же fields, но не является
prerequisite и не создаёт отдельный правильный ответ.

Любой raw pcap/pcapng:

- создан только synthetic traffic внутри разрешённой topology;
- ограничен exact interface, BPF/display filter, target, duration и maximum size;
- сопровождается capture method, UTC timestamps, environment parameters,
  provenance и SHA-256;
- хранится отдельно от normalized TSV/Markdown interpretation;
- не содержит credentials, tokens, персональные payloads или реальный
  пользовательский traffic.

Default ceiling для live capture — 15 seconds, 256 frames и 1 MiB. Карточка может
задать меньший предел. Больший предел требует явного предметного обоснования,
отдельной stop condition и review.

Timestamp, checksum-offload result, ephemeral port, TCP sequence number и другие
изменчивые fields не проверяются как фиксированные значения. Automated check
проверяет structure, relationships и bounded provenance, а agent review —
причинность interpretation.

## Rerun policy

Raw evidence не перезаписывается молча. До action preflight проверяет, что target
path отсутствует, либо создаёт новую directory с UTC run id. Summary artifact
явно перечисляет использованные run ids и hashes. Неудачная попытка сохраняется
как observed run или удаляется только по явно описанному cleanup contract; она не
подменяется ожидаемым output.

## Stop conditions

Действие немедленно прекращается, если:

- resolved address, interface, container, Compose project или protocol не
  совпадает с разрешённым target;
- capture видит traffic, который не создан synthetic topology;
- неожиданно появляется Internet reachability или published host port;
- baseline не совпадает с карточкой;
- теряется control channel, резко растёт error rate/load или превышен limit;
- требуются privileged mode, Docker socket, host firewall change или production
  credentials;
- cleanup или rollback нельзя выполнить заявленным способом.

Срабатывание stop condition не считается учебной ошибкой и честно записывается в
evidence. Agent review не повторяет рискованное действие только ради PASS.

## Cleanup и post-check

Cleanup останавливает только exact Compose project текущей session, удаляет его
disposable containers/networks и возвращает временные in-container rules/state в
baseline. Он не использует broad host cleanup, не удаляет чужие Docker resources и
не меняет host routing/firewall.

Post-check подтверждает отсутствие session containers, networks, background
processes и published ports, а также наличие сохранённого evidence. На macOS
Docker Desktop имеет отдельную Linux VM; материал не выдаёт container path за host
network path. На Linux материал также не зависит от host-specific bridge names и
не требует root-доступа к host network.

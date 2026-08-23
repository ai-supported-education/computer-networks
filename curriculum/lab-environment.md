# Контракт Docker/Linux лаборатории

Этот документ задаёт обязательную support и safety boundary для всех sessions.
Конкретная карточка может сузить scope, но не расширить его без отдельного
обоснования и review.

## Required host environment

Поддерживаемая матрица v1:

| Host | CPU | Runtime |
| --- | --- | --- |
| macOS с Docker Desktop | arm64 или amd64 | Linux containers, Docker Engine >= 28.0; Compose v2 для поздних modules |
| Linux с Docker Engine | arm64 или amd64 | rootful Docker Engine >= 28.0; Compose v2 для поздних modules |

Host также предоставляет Git, shell, Node.js версии не ниже указанной в
package.json и package manager из поля packageManager. Изучаемые ip, ping, ss,
tcpdump, tshark, dig, curl, openssl, nft, conntrack и tc выполняются внутри
Linux containers. Карточка не требует установки этих tools непосредственно на
macOS.

## Fixed live inventory v1

| Resource | Interface | IPv4 | MAC |
| --- | --- | --- | --- |
| `cn-alpha` | `eth0` | `172.30.0.10` | `02:42:ac:1e:00:0a` |
| `cn-beta` | `eth0` | `172.30.0.20` | `02:42:ac:1e:00:14` |

Оба endpoint создаются только в internal network `cn-lab` с fixed subnet
`172.30.0.0/24`. Таблица — declared source fact лаборатории; конкретный run обязан
подтвердить фактические значения через topology/interface evidence и не переносить
их в Observed автоматически.

Live topology v1 не поддерживает rootless Docker Engine; preflight сообщает это
до создания resources. Все Docker-действия разрешены только через local absolute
`unix://` socket. `ssh://`, `tcp://`, remote contexts и production daemons — stop
condition. Fixed subnet `172.30.0.0/24` также должен не пересекаться с уже
существующими Docker networks; preflight проверяет это, ничего не удаляя. При
конфликте используйте другой local учебный daemon или обратитесь к автору курса —
не удаляйте и не перенастраивайте существующую сеть ради упражнения.

Отсутствие pinned image признаётся только по exact Docker `No such image`.
Ошибки daemon, permissions и timeout являются stop condition, а не поводом
запускать `preload`.

Каждый published lab image обязан иметь multi-platform manifest как минимум для
linux/amd64 и linux/arm64. Image reference фиксируется автором; preflight
сохраняет local image ID и Docker server OS/architecture. `uname -m` сохраняется
только в карточке, где он действительно является evidence. Наличие support в этом
документе является требованием к материалу, а не выдуманным фактом успешного
запуска.

## Default topology boundary

Обязательная практика использует только явно названные resources текущего
lab-run. Guardrail runner связывает их exact IDs или names и уникальным owner/run
label; поздние Compose-карточки дополнительно фиксируют exact project/services.
По умолчанию topology имеет следующие ограничения:

- dedicated isolated internal network;
- нет published ports, host networking и подключения к произвольным external
  networks;
- Docker socket не монтируется;
- privileged containers запрещены;
- host paths не bind-mount-ятся; versioned fixture и live capture передаются
  только exact `docker cp` между host и disposable container;
- временный capture хранится в явно именованном, labelled Docker volume текущего
  run, копируется в evidence через `docker cp` и удаляется до PASS;
- NET_RAW и NET_ADMIN выдаются только конкретному disposable service и только
  когда без них нельзя получить заявленный outcome;
- endpoint и каждый helper проходят runtime `docker inspect` до принятия evidence:
  проверяются exact labels/name, network mode, capabilities,
  `no-new-privileges`, read-only rootfs, bounded tmpfs/CPU/memory/PIDs, mounts и
  отсутствие ports;
- automation печатает выполняемую Linux-команду, exact target и ограничения, а
  не скрывает изучаемый mechanism.

Разрешённые targets — localhost и containers текущей synthetic topology.
Documented example ranges и service names не являются разрешением выполнять
команды против Internet или другой сети. MikroTik, RouterOS, домашний router и
production infrastructure никогда не входят в default target scope.

## Обязательный порядок run

Каждая lab session сохраняет доказуемый порядок фаз:

1. Inventory и preflight: effective Docker context/endpoint, Engine ID, runtime,
   architecture, image identity, subnet conflicts, свободное место, exact
   labelled run/project, capabilities и evidence path.
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

- resolved address, interface, container, labelled run/Compose project или protocol не
  совпадает с разрешённым target;
- effective Docker endpoint не является local absolute `unix://` socket,
  сохранённый Engine ID изменился или fixed lab subnet пересекается с existing
  network;
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

Cleanup работает только с сохранёнными endpoint + Engine ID и exact labelled run
текущей session. Имена/roles ресурсов резервируются в active state до Docker
create; cleanup сверяет name/ID/owner/run/role, удаляет disposable
containers/networks/volumes (для named volume exact name и есть удаляемая Docker
identity), затем ждёт bounded clean quiescence, чтобы поймать
позднее завершение create после CLI timeout. Он возвращает временные
in-container rules/state в baseline. Он не использует broad host cleanup, не
удаляет чужие Docker resources и не выполняет ручные изменения host
routing/firewall. На native Linux сам Docker Engine создаёт и удаляет bridge и
связанные firewall rules как часть обычного network lifecycle; этот
Docker-managed эффект не выдаётся за отсутствие host-side изменений.

Post-check подтверждает отсутствие session containers, networks, volumes,
background processes и published ports, а также наличие сохранённого evidence.
На macOS Docker Desktop имеет отдельную Linux VM; материал не выдаёт container
path за host network path. На Linux материал также не зависит от host-specific
bridge names и не требует root-доступа к host network.

## Primary operational sources

- [Docker gateway modes](https://docs.docker.com/engine/network/port-publishing/#gateway-modes)
  описывает `internal + isolated` и отсутствие адреса у host bridge.
- [Docker packet filtering and firewalls](https://docs.docker.com/engine/network/packet-filtering-firewalls/)
  фиксирует Docker-managed firewall rules для Linux bridge networks.
- [Docker container cp](https://docs.docker.com/reference/cli/docker/container/cp/)
  задаёт ownership semantics при копировании artifact из container на host.
- [Docker contexts](https://docs.docker.com/engine/manage-resources/contexts/)
  объясняет, как active context выбирает daemon для CLI commands.
- [Docker network create](https://docs.docker.com/reference/cli/docker/network/create/)
  описывает явные subnets и отказ при их overlap.
- [Docker rootless mode](https://docs.docker.com/engine/security/rootless/)
  описывает отдельный режим Engine, который не входит в live support matrix v1.

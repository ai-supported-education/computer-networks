# Компьютерные сети: от пакета к диагностике

Практический IPv4-only курс для разработчика, который пользуется Git, shell и
Docker, но ещё не имеет единой системной модели сетевого пути.

Курс идёт от одного synthetic packet exchange внутри одной LAN к production
request path через switching, routing, UDP/TCP, DNS, firewall/NAT, TLS, reverse
proxy и Docker. Финальный навык — не вспомнить случайную команду, а выбрать
минимальную различающую проверку, локализовать failure и доказать recovery
сохранённым evidence.

Подробная модель учащегося, language policy и границы v1 зафиксированы в
[audience](curriculum/audience.md). Требования к macOS/Linux, arm64/amd64,
Docker/Linux labs, packet captures и cleanup находятся в
[lab environment](curriculum/lab-environment.md).

## Маршрут

Canonical order и concept graph находятся в [course.json](curriculum/course.json).
Маршрут состоит из 71 independently finishable session по 35–55 минут:

1. Один packet в одной LAN — 6 sessions.
2. IPv4, CIDR и route choice — 7.
3. Switching, VLAN и DHCP — 6.
4. Routing, ICMP и MTU — 7.
5. UDP и TCP — 8.
6. DNS — 6.
7. NAT и firewall — 7.
8. HTTP, TLS и proxy — 7.
9. Docker networking — 6.
10. Diagnosis и performance — 6.
11. Capstone — 5.

Nominal time — 3525 минут, около 58 часов 45 минут; полный проход с повторными
runs и review рассчитан примерно на 59–65 часов.

Первые шесть sessions образуют один published authoring prefix. Остальные entries
имеют releaseStatus planned: они фиксируют outcome и зависимости, но runner не
выдаёт их как готовый learner material. Published status в feature branch ещё не
означает публичную готовность: каждая карточка и весь module должны получить
актуальный independent content-review PASS.

## Как проходить

После установки dependencies:

    pnpm session:validate
    pnpm session:next
    pnpm session:start <id>

В активной карточке:

    pnpm session:check
    pnpm session:review
    pnpm session:finish

Session начинается и заканчивается green/safe state, создаёт named evidence и не
оставляет обязательного хвоста. Runner хранит personal progress локально и не
применяет solution. Progressive hints выдаются по одному командой
pnpm session:hint; quiz keys, hints и reference solutions не находятся в default
branch.

## Практика и безопасность

Обязательные labs запускаются в synthetic Docker/Linux topologies. Default scope
не включает Internet targets, host networking, Docker socket, privileged
containers, реальные credentials или пользовательский traffic. Packet evidence
имеет bounded capture contract, provenance, SHA-256 и текстовый tshark companion.
Каждое изменение начинается с preflight/baseline и заканчивается cleanup плюс
post-check.

Курс vendor-neutral. MikroTik и RouterOS находятся вне scope: материал не содержит
RouterOS commands, не подключается к домашнему или production router и не меняет
его configuration.

## Ограничение IPv4-only

Изучаемое поведение не является универсальным свойством любого IP traffic. В v1
не входят IPv6, Neighbor Discovery, SLAAC и dual-stack selection; ARP, broadcast,
IPv4 fragmentation и address semantics нельзя переносить на IPv6 по аналогии.

Также вне v1 находятся Wi-Fi/RF, OSPF/BGP, VPN/tunnels, Kubernetes/CNI, service
mesh, vendor-specific cloud networking, QUIC/HTTP/3 и offensive/disruptive
testing. Эти темы перечислены как course exclusions, а не как session defers:
manifest разрешает defer только concept, который действительно вводится позже.

## Authoring и review

Правила материала задают [authoring standard](curriculum/authoring-standard.md),
[session contract](curriculum/session-contract.md) и profiles lab, quantitative,
network-safety, networking.

После создания или существенного изменения learner-facing session:

    pnpm author:content-review session <id>
    pnpm author:content-review module <module-id>

Fresh reviewer сначала читает blind learner packet, затем проверяет concept graph,
profiles, rubric, checks/evidence и соседние карточки. Никакая expected строка в
README не считается observed result учащегося.

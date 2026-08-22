# Аудитория и границы курса

## Для кого этот курс

Курс рассчитан на практикующего разработчика, который уверенно работает с Git,
shell, Docker и Docker Compose, умеет запускать процессы, читать logs и менять
текстовую configuration. Предыдущая системная модель компьютерных сетей не
предполагается.

До начала достаточно уметь:

- выполнить и повторить shell-команду из указанной directory;
- прочитать небольшой JSON, YAML или Markdown-файл;
- запустить и остановить Docker container или Compose project;
- сохранить изменение в Git checkpoint;
- выполнить целочисленное вычисление с явно указанными units.

Не считаются входными знаниями Ethernet, MAC addressing, ARP, IPv4 prefixes,
routing, transport ports, sockets, UDP, TCP, DNS, NAT, firewall, HTTP, TLS,
packet capture или Wireshark.

## Проверяемый финал

После v1 учащийся может проследить один IPv4 application request от interface и
Ethernet frame до process, DNS, TCP, TLS, HTTP и reverse proxy, выбрать
минимальную различающую проверку для конкурирующих hypotheses, локализовать
неисправность и доказать recovery сохранённым evidence.

Итог не требует запоминать набор команд. Учащийся должен объяснить, какое решение
принимает каждый компонент, какое сообщение наблюдается, что было expected до
действия, что действительно observed и почему inference не шире evidence.

## Язык и термины

Объяснения, задания и rubric пишутся по-русски. Имена protocol, packet fields,
states, standards, CLI-команды и их flags сохраняются на English: Ethernet,
IPv4, ARP, ICMP, CIDR, route lookup, UDP, TCP, DNS, NAT, TLS, HTTP, tcpdump,
tshark, ip, ss и curl.

Слово packet допустимо как общее обозначение только там, где точный protocol
data unit ещё не важен. При разборе evidence материал различает Ethernet frame,
IPv4 datagram, UDP datagram, TCP segment и application message.

## Scope v1

v1 строит production foundation для application developer и использует только
IPv4. В обязательный маршрут входят:

- interface, Ethernet, MAC, ARP и packet evidence в одной LAN;
- IPv4 addressing, CIDR, local/remote choice, switching, VLAN и DHCP;
- routing, ICMP, MTU, fragmentation и PMTUD;
- ports, sockets, UDP, TCP и их диагностические signatures;
- DNS resolution и system resolver behavior;
- Linux packet path, stateful firewall, conntrack, DNAT и SNAT;
- HTTP, TLS, reverse proxy, load balancing и health checks;
- Docker networking на macOS и Linux;
- layered diagnosis, latency, throughput, loss, queues, timeouts и retries;
- capstone с deterministic fault, evidence-based recovery и runbook.

IPv4-only — явное ограничение модели, а не утверждение об универсальном поведении
IP networks. Материал не переносит ARP, broadcast, fragmentation или address
semantics на IPv6.

## Не входит в v1

- IPv6, Neighbor Discovery, SLAAC и dual-stack selection;
- Wi-Fi/RF, STP, LACP и сложный campus switching;
- OSPF, BGP и другое dynamic routing;
- VPN, tunnels, Kubernetes/CNI, service mesh и vendor-specific cloud networking;
- QUIC/HTTP/3 и глубокая настройка congestion-control algorithms;
- active scanning чужих systems, interception, spoofing, access-control bypass
  или disruptive testing;
- настройка production routers и switches.

MikroTik и RouterOS не являются target, prerequisite или скрытым продолжением
курса. Учащийся сможет позже переносить причинную модель на принадлежащее ему
оборудование, но v1 не содержит RouterOS-команд, не подключается к MikroTik и не
меняет его configuration.

## Учебная среда

Все обязательные observations и изменения происходят в synthetic Docker/Linux
topologies согласно [контракту лаборатории](lab-environment.md). Реальный домашний
или production traffic не нужен и не должен попадать в course evidence.

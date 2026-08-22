# Quiz 01-01

Для каждого вопроса выберите один вариант и запишите собственное объяснение в
`answers.json`.

## q1 — что является interface

Inventory endpoint `alpha`:

```text
1: lo:    <LOOPBACK,UP> mtu 65536
2: eth0:  <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    link/ether 02:42:ac:1e:00:0a
    inet 172.30.0.10
```

Какой элемент является сетевым interface, через который в сценарии отправляется
локальный frame?

- A. `eth0`
- B. `02:42:ac:1e:00:0a`
- C. `172.30.0.10`
- D. `icmp.type=8`

## q2 — что непосредственно вложено во что

Дана строка одного frame:

```text
eth.type=0x0800 ip.proto=1 icmp.type=8
```

Какое описание соответствует этим полям?

- A. Ethernet frame вложен в ICMP message, а IPv4 находится рядом.
- B. ICMP message вложен в IPv4 datagram, который является payload Ethernet frame.
- C. MAC address преобразован в IPv4 address, затем в ICMP type.
- D. Это три независимых packets, случайно имеющих один номер frame.

## q3 — что доказывает один request

Capture на `alpha` содержит только эту строку:

```text
frame=12 ip.src=172.30.0.10 ip.dst=172.30.0.20 icmp.type=8
```

Какой вывод не выходит за пределы evidence?

- A. `beta` получил request и уже сформировал reply.
- B. В точке capture наблюдался IPv4/ICMP Echo Request от `.10` к `.20`.
- C. Между endpoints нет packet loss.
- D. Route и firewall всей системы настроены правильно.

## q4 — почему второй frame разбирается иначе

```text
frame=20 eth.type=0x0800 ip.proto=1 icmp.type=8
frame=21 eth.type=0x0806 arp.opcode=1
```

Почему к frame 21 нельзя применить `ip.dst` и `icmp.type` как к frame 20?

- A. Номер frame нечётный.
- B. У frame 21 другой Ethernet destination, которого здесь не показали.
- C. EtherType frame 21 обозначает другой payload, поэтому IPv4/ICMP headers в нём не заявлены.
- D. Любой ARP frame всегда повреждён.

## q5 — к каким endpoints относятся source и destination

Capture point задан явно: `alpha:eth0`, direction — incoming. Inventory:

```text
alpha: MAC 02:42:ac:1e:00:0a, IPv4 172.30.0.10
beta:  MAC 02:42:ac:1e:00:14, IPv4 172.30.0.20

eth.src=02:42:ac:1e:00:14 eth.dst=02:42:ac:1e:00:0a
ip.src=172.30.0.20 ip.dst=172.30.0.10 icmp.type=0
```

Какое описание направления соответствует обоим headers?

- A. MAC-пара направлена от `alpha` к `beta`, а IPv4-пара — от `beta` к `alpha`.
- B. Source и destination можно определить только по номеру interface.
- C. И Ethernet, и IPv4 headers направлены от `beta` к `alpha`; это наблюдаемый incoming Echo Reply.
- D. В reply source/destination всегда остаются такими же, как в request.

## q6 — в каком порядке читаются headers при приёме

`beta:eth0` получает frame с `eth.type=0x0800`, затем decoder показывает
`ip.proto=1` и `icmp.type=8`. Какой порядок обработки соответствует
decapsulation в рамках этой модели?

- A. Сначала ICMP выбирает interface, затем IPv4 создаёт Ethernet header.
- B. MAC превращается в IPv4, а IPv4 — в ICMP type.
- C. Interface получает frame; Ethernet сообщает про IPv4 payload; IPv4 сообщает про ICMP payload; затем читается ICMP message.
- D. Все три headers читаются как независимые packets в произвольном порядке.

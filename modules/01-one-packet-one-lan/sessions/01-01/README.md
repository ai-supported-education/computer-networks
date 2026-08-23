# 01-01 — Различить interface, адреса и вложенные сообщения

Время: 40 минут.

## Результат и границы

После карточки вы сможете по полям одного локального обмена отличить:

- сетевой interface — точку, через которую система отправляет и принимает frames;
- MAC address — адрес доставки Ethernet frame в пределах рассматриваемой link;
- IPv4 address — адрес endpoint внутри IPv4 datagram;
- ICMP Echo message — запрос или ответ, вложенный в datagram.

В scope входит только уже подготовленная LAN с двумя endpoints. Как система
вычисляет принадлежность к LAN, выбирает route и узнаёт MAC соседа, пока отложено.
Это важная граница: готовый адрес в сценарии — исходный факт, а не результат ещё не
изученного алгоритма.

## До начала

Нужны только умение читать таблицы/hex-поля и редактировать JSON. Docker в этой
карточке не запускается. Откройте рядом `quiz.md` и `answers.json`, но сначала
разберите модель ниже.

## Причинная модель: не «слои для запоминания», а вложенные решения

Пусть процесс на endpoint `alpha` просит операционную систему отправить Echo
Request endpoint `beta`. Для этой задачи заранее известны interface и оба набора
адресов.

```text
alpha process creates
ICMP Echo Request
  ↓ wrapped as payload of
IPv4 datagram  src=172.30.0.10, dst=172.30.0.20
  ↓ wrapped as payload of
Ethernet frame src=02:42:ac:1e:00:0a, dst=02:42:ac:1e:00:14
  ↓ outer frame is sent through
alpha interface → local link → beta interface
```

Это не четыре названия одного объекта.

1. ICMP задаёт смысл control message: здесь «echo request».
2. IPv4 header называет IPv4 endpoints и указывает, что payload имеет protocol
   number `1` (ICMP).
3. Ethernet header называет link-layer source/destination и через EtherType
   `0x0800` сообщает, что payload — IPv4.
4. Interface — место отправки frame. У interface могут быть состояния и несколько
   адресов; сам interface не равен ни MAC, ни IPv4 address.

При приёме происходит обратное чтение: interface получает frame, Ethernet
обработка видит подходящий destination MAC и EtherType, IPv4 обработка видит
destination IPv4 и protocol number, ICMP обработка видит Echo Request. Reply —
новое сообщение и новый frame, а не тот же объект, «развернувшийся обратно».

### Timeline одного успешного обмена

| Шаг | Где | Создано или проверено | Наблюдаемое поле |
| ---: | --- | --- | --- |
| 1 | `alpha` | ICMP Echo Request | `icmp.type = 8` |
| 2 | `alpha` | IPv4 datagram вокруг ICMP | `ip.src`, `ip.dst`, `ip.proto = 1` |
| 3 | `alpha` | Ethernet frame вокруг datagram | `eth.src`, `eth.dst`, `eth.type = 0x0800` |
| 4 | link | frame передан между interfaces | один captured frame |
| 5 | `beta` | headers прочитаны снаружи внутрь | destination values относятся к `beta` |
| 6 | `beta` | создан отдельный Echo Reply | `icmp.type = 0` и обратные пары адресов |

Порядок таблицы — причинная модель. Один capture рядом с `alpha` обычно показывает
frames после их построения или до разбора; он не доказывает, какой участок кода
внутри ядра выполнился.

## Разобранный сценарий 1: Echo Request

Synthetic TShark companion содержит строку:

```text
frame=1 eth.src=02:42:ac:1e:00:0a eth.dst=02:42:ac:1e:00:14 \
eth.type=0x0800 ip.src=172.30.0.10 ip.dst=172.30.0.20 \
ip.proto=1 icmp.type=8
```

Из этой строки можно установить как факты наблюдения:

- Ethernet header содержит link-layer source `…:0a` и destination `…:14`;
- Ethernet payload размечен как IPv4;
- IPv4 datagram направлен от `.10` к `.20` и несёт ICMP;
- ICMP message — Echo Request.

Можно сделать ограниченный вывод: строка согласуется с локальным Echo Request от
`alpha` к `beta`. Без отдельно заданных capture point и direction она не доказывает
сам момент выхода через interface. Нельзя по одной строке утверждать, что `beta`
получил frame, создал reply или что любой другой network path исправен.

## Разобранный сценарий 2: похожий frame, другой payload

```text
frame=7 eth.src=02:42:ac:1e:00:0a eth.dst=ff:ff:ff:ff:ff:ff \
eth.type=0x0806 arp.opcode=1 arp.src.proto_ipv4=172.30.0.10
```

Здесь тоже есть source/destination MAC и Ethernet frame, но `eth.type=0x0806`, а
не `0x0800`. Поэтому внутри не IPv4 datagram и поля `ip.src`, `ip.dst`,
`icmp.type` к этому frame неприменимы. Это ARP request; его механизм будет
разобран в `01-04`. Пока достаточно не приписывать frame отсутствующие headers.

## Факты, наблюдения и выводы

- **Source fact:** по спецификации IPv4 protocol number `1` обозначает ICMP; ICMP
  type `8`/`0` обозначает Echo Request/Reply.
- **Assumption:** endpoints в сценарии уже находятся в одной подготовленной LAN,
  а нужный destination MAC дан.
- **Observed:** конкретные поля, действительно прочитанные из строки или capture.
- **Inference:** ограниченное объяснение, которое следует из observed и
  assumptions.
- **Unknown:** всё, для чего нет поля или отдельного evidence.

Первичные источники для форматов: [RFC 792](https://www.rfc-editor.org/rfc/rfc792.html)
для ICMP и спецификация EtherTypes IEEE, на которую TShark отображает значения.
В карточке не требуется читать RFC целиком.

## Два правдоподобных неверных пути

1. **«MAC — постоянный глобальный адрес компьютера, IPv4 — то же самое в другом
   виде».** Они принадлежат разным headers и отвечают на разные вопросы. Interface
   может сменить оба значения; router в будущей главе меняет link-layer envelope,
   не превращая MAC в IPv4.
2. **«Если виден Echo Request, значит `ping` успешен».** Request доказывает только
   наличие request в точке capture. Для успеха нужен отдельный Echo Reply и
   соответствие идентификаторов/полей обмена.

## Quiz

В `quiz.md` шесть самодостаточных сценариев с полным набором входных данных.
Заполните `answers.json`: выберите вариант и напишите собственное объяснение в
`reasons`. Формулировка намеренно не перечисляет слова, которые должны встретиться
в объяснении.

## Проверка и evidence

- Local: `pnpm session:check` автоматически сверяет выбранные варианты с key из
  `course-support`; Codex эта команда не вызывает.
- Agent: после зелёного check отдельный review проверяет причинность свободных
  объяснений по `rubric.md`.
- Evidence: заполненный `answers.json`.

## DONE

- [ ] Ответ дан на каждый вопрос, каждый `reason` написан своими словами.
- [ ] В объяснениях interface, Ethernet/MAC, IPv4 и ICMP не названы одним объектом.
- [ ] Направления MAC и IPv4 привязаны к соответствующим headers и endpoints.
- [ ] Encapsulation при отправке и чтение headers снаружи внутрь при приёме
      объяснены как разные направления обработки.
- [ ] Выводы не шире показанного evidence.
- [ ] `pnpm session:check` зелёный и agent review получил PASS.

Следующий независимый шаг — поднять такую LAN и снять baseline в `01-02`.

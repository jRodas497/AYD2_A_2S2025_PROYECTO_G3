# ADR-0007: El outbox en la base de datos hace de broker en el MVP

**Estado:** Propuesta
**Fecha:** 2026-09-22
**Decisores:** Quien implementa transacciones e integraciones (Backend 2) — pendiente de ratificación en reunión de equipo

## Contexto

El ADR-0001 adoptó un estilo orientado a eventos con un broker de mensajería, y el ADR-0002 y el
ADR-0004 construyen sobre él: el cobro se registra en un outbox dentro de la misma transacción
que la orden, los reintentos viajan por una cola, y las notificaciones se procesan en una cola
dedicada. Los tres hablan de "el broker" sin fijar cuál.

Al llegar a la implementación había que resolverlo, y aparecieron dos hechos que en la Fase 1 no
se habían cruzado:

1. La base ya tiene la tabla `integration.outbox`, con estado, número de intentos, próxima cita
   y último error — es decir, ya está modelada como una cola con reintentos.
2. El presupuesto de infraestructura es de $1,200 al mes para todo el sistema (DR-02) y el
   despliegue es on-premises (ADR-0005). Un RabbitMQ o un Kafka no son solo un contenedor más:
   son un componente con estado propio, que hay que respaldar, monitorear y del que el sistema
   pasa a depender para operar.

Además, el patrón Transactional Outbox exige que el evento y el cambio de estado se guarden
atómicamente. Con un broker externo eso **no** se logra publicando directo al broker: se logra
escribiendo primero en una tabla y publicando después. O sea, la tabla hace falta de todos modos.

## Decisión

En el MVP, `integration.outbox` es el broker. Un repartidor dentro de la misma aplicación
(`OutboxDispatcher`) toma en préstamo los eventos pendientes con `for update skip locked`, se los
entrega al manejador registrado para ese tipo de evento y los marca como entregados; si el
manejador falla, el evento vuelve a la cola con una espera que se duplica en cada intento y, al
agotarse, queda en `FAILED` con su último error.

Cada tipo de evento tiene exactamente un manejador, y el manejador lo implementa el módulo dueño
del paso siguiente: `OrderPaid` lo atiende facturación, `OrderInvoiced` lo atiende logística,
`PaymentRetryRequested` lo atiende pagos. Los módulos no se llaman entre sí para avanzar el
flujo: publican un evento y siguen.

El préstamo (correr la próxima cita hacia adelante antes de procesar) es lo que evita que dos
hilos tomen el mismo evento y, si el proceso se cae a la mitad de un envío, que el evento quede
trabado: el préstamo vence y otro lo vuelve a tomar.

Esta decisión **no** cambia ADR-0001, ADR-0002 ni ADR-0004: los implementa. El día que haga
falta un broker externo, los manejadores no cambian — cambia quién los invoca.

## Alternativas consideradas

| Alternativa | Ventajas | Desventajas | Por qué se descartó |
|---|---|---|---|
| RabbitMQ (o Kafka) como broker, con el outbox solo como puente | Es el broker "de verdad"; permite consumidores fuera del proceso y escalar cada consumidor por separado | Un componente con estado más que respaldar, monitorear y del cual depender; consume presupuesto de DR-02 sin que el MVP tenga todavía un consumidor fuera del proceso; el outbox y su repartidor hay que escribirlos igual | Se descarta para la Fase 2 por costo/beneficio, no por diseño. Es la evolución natural cuando un componente se separe del monolito |
| Llamadas directas entre módulos (facturar dentro de la transacción del cobro) | Lo más simple de escribir y de seguir leyendo | Si la SAT tarda, el cliente que está pagando espera; si falla, se revierte también el cobro; vuelve a acoplar lo que ADR-0001 separó | Contradice DC-01 y DC-06: una falla de un tercero volvería a tumbar la operación principal |
| Eventos en memoria de Spring (`ApplicationEventPublisher`) | Sin infraestructura y sin tabla | Un reinicio pierde los eventos en vuelo: una orden pagada podría quedarse sin facturar para siempre | Rompe la garantía central del ADR-0002, que es justamente no perder nada ante una caída |
| El outbox de la base como broker (elegida) | Atomicidad real entre el hecho y su evento; sobrevive a reinicios; cero infraestructura nueva; los eventos pendientes y fallidos se consultan con SQL y ya están auditados | Un solo proceso reparte, así que no escala horizontalmente sin coordinación extra; el reparto tiene la latencia del intervalo de sondeo (2 s) | Es lo que el MVP necesita, con la puerta abierta a un broker externo sin reescribir los manejadores |

## Consecuencias

**Positivas:**
- El patrón Transactional Outbox queda implementado de verdad: no existe una orden pagada sin su
  evento de facturación, ni un evento de algo que al final no ocurrió.
- La cola es consultable y auditable con SQL, y se expone en `GET /api/integration/outbox` y en
  `GET /api/integration/health` — el monitoreo que ADR-0002 y ADR-0004 dejaron como condición.
- No se agregó ningún componente de infraestructura, así que el despliegue sigue siendo
  `docker compose up` con dos contenedores.

**Negativas / tradeoffs aceptados:**
- Con varias instancias del backend, el `for update skip locked` evita el procesamiento doble
  pero todas sondean la misma tabla; con mucho volumen eso se vuelve carga sobre la base y
  entonces sí conviene el broker externo.
- El avance del flujo tiene una latencia de segundos, no de milisegundos. Para pasar de
  "pagada" a "facturada" es irrelevante; para algo que el cliente mire en vivo, no lo sería.
- Al ser la entrega "al menos una vez", cada manejador tiene que ser idempotente. Aquí lo
  garantizan llaves de la base (`invoice.order_id` es único, `erp_batch_order.order_id` es
  llave primaria), no la disciplina de quien programa.

## Drivers que atiende

- DC-01, DC-06 (Fase 1) — una falla de un tercero no tumba la operación principal.
- DC-07 — cada evento y su resultado quedan registrados.
- DR-01, DR-02 — no consume presupuesto de infraestructura.

## Vistas afectadas

- `FASE 2/backend/src/main/java/com/sgologic/integration/`
- `FASE 2/backend/README.md`, sección "Del cobro a la entrega, sin que nadie lo empuje"
- `Docs/Diagramas/componentes.drawio` — el "Message Broker" del diagrama es, en el MVP, la tabla
  `integration.outbox` más su repartidor, no un middleware aparte.

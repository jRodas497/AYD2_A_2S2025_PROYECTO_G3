# ADR-0012: Kafka como broker de mensajería, con el outbox como puente

**Estado:** Aceptada
**Fecha:** 2026-10-14
**Decisores:** Equipo del Grupo 3
**Evoluciona a:** [ADR-0007](../../../FASE%202/DDA/ADR/0007-outbox-en-la-base-como-broker-del-mvp.md)

## Contexto

El ADR-0007 decidió que en el MVP la tabla `integration.outbox` hace de broker, con un repartidor dentro del backend que invoca a los manejadores. Dejó dicho cuándo se dejaría de cumplir: «el día que haga falta un broker externo, los manejadores no cambian — cambia quién los invoca», y que con mucho volumen, o con varias instancias sondeando la misma tabla, convenía el broker externo.

La Fase 3 pide «un nuevo estilo arquitectónico capaz de gestionar las notificaciones y que conviva con la arquitectura ya realizada». Además, la regla del crédito suma más pasos que dependen de terceros —la lectura del historial del ERP, el abono con PayKlik y el aviso de la decisión— y todos deben reintentarse sin congelar la orden ni el checkout.

Hay tres presiones:

- **Los reintentos viven en la base y compiten con el tráfico.** El repartidor del ADR-0007 sondea la tabla y espera entre intentos dentro del mismo proceso.
- **Las notificaciones y los terceros necesitan reintentos escalonados y un destino para lo que se agota.** Un evento en `FAILED` con su último error no basta cuando hay muchos tipos de mensaje.
- **No se puede romper lo ya construido.** Facturación, logística, pagos, ERP y POS ya tienen sus manejadores idempotentes y probados.

## Decisión

1. **Kafka 3.8.1 es el broker de mensajería.** Se levanta con docker-compose y los mensajes viajan por cuatro tópicos: `sgologic.orders`, `sgologic.notifications`, `sgologic.pos` y `sgologic.erp`.
2. **El outbox se queda como puente, no como broker.** La intención de negocio se guarda en la base dentro de la misma transacción de la orden, como antes, y eso mantiene la atomicidad que pedía el ADR-0002: no existe una orden pagada sin su evento. Un relé (`OutboxDispatcher`) toma hasta 100 filas pendientes por tabla con `for update skip locked` cada 2 segundos, las publica en Kafka y marca `kafka_published_at`. **El relé nunca invoca a un manejador ni a un proveedor.**
3. **Los manejadores no cambian.** Los consumidores de Kafka llaman a los mismos manejadores del ADR-0007 (`OrderPaid`, `OrderInvoiced`, el reintento de abonos, el aviso al cliente). Cambia quién los invoca, tal como se anticipó.
4. **Reintentos con tópicos de reintento.** Cada consumidor usa `@RetryableTopic`: 8 intentos, con espera exponencial que arranca en 2 segundos y se duplica hasta 30 segundos, sobre 3 particiones por tópico. Agotados los intentos, el mensaje pasa a su tópico de mensajes muertos (DLT), donde un manejador deja el último error en la fila de origen para que Finanzas u Operaciones lo vean.
5. **Kafka caído no pierde nada.** Si el relé no logra publicar, la intención queda en la base y se vuelve a intentar. El productor usa `acks=all` e idempotencia.
6. **Los avisos al cliente viajan por su propio tópico**, `sgologic.notifications`. Es el estilo que gestiona las notificaciones sin retrasar la compra: el checkout termina, y el aviso llega después.

## Alternativas consideradas

| Alternativa | Ventajas | Desventajas | Por qué se descartó |
|---|---|---|---|
| Seguir solo con el outbox del ADR-0007 | Cero infraestructura nueva | Reintentos y espera dentro del proceso, sin tópicos de reintento ni DLT; todas las instancias sondean la misma tabla | No da el nuevo estilo que pide la fase |
| Publicar directo a Kafka desde la transacción de negocio | Un salto menos | No es atómico: puede haber orden sin evento, o evento de algo que no ocurrió | Rompe la garantía del ADR-0002 |
| RabbitMQ | Más liviano que Kafka | Otra pieza y otra librería de cliente; los reintentos escalonados y el destino de mensajes muertos habría que armarlos a mano | `spring-kafka` ya los da con `@RetryableTopic`, y la Fase 1 dejó abierta la elección entre RabbitMQ y Kafka |
| Kafka con el outbox como puente (elegida) | Atomicidad del outbox más reintentos escalonados, DLT y consumidores independientes; los manejadores no cambian | Un contenedor más y operación más compleja | Cumple lo que el ADR-0007 dejó previsto |

## Consecuencias

**Positivas:**
- Se conserva la atomicidad del outbox y se agregan reintentos escalonados y un destino para lo que se agota.
- Los manejadores y sus pruebas siguen siendo los mismos.
- Los consumidores pueden escalar por separado.
- Se probó con caídas reales de Kafka y de los proveedores en la suite de la Fase 3.

**Negativas / tradeoffs aceptados:**
- Un contenedor más, el broker, y 28 consumidores que arrancar. En el plan gratuito de Render no cabe en memoria: por eso Kafka y los proveedores solo existen en docker-compose, y la nube es una vista parcial ([ADR-0011](0011-cicd-y-despliegue-en-la-nube.md)).
- La latencia de los pasos asíncronos sigue siendo de segundos.
- Hay más piezas que vigilar: el relé, los tópicos y los mensajes muertos.

## Drivers que atiende

- RC 04 y RC 05 (una falla externa no detiene la venta), RC 09 (recuperación de proveedores), RC 03 (volumen de órdenes simultáneas)
- Nuevos: CC-02 de [drivers-y-escenarios-fase3.md](../drivers-y-escenarios-fase3.md)

## Vistas afectadas

- [diagramas-fase3.md](../diagramas-fase3.md): componentes y secuencia
- `FASE 2/backend/src/main/java/com/sgologic/integration/` (`OutboxDispatcher`, `KafkaConsumers`)
- `FASE 2/docker-compose.yml` (servicio `kafka`)

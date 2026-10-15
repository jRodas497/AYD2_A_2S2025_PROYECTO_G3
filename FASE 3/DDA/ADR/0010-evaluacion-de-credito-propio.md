# ADR-0010: Evaluación de crédito propio en el checkout, con el historial del ERP en una proyección local

**Estado:** Aceptada
**Fecha:** 2026-10-14
**Decisores:** Equipo del Grupo 3

## Contexto

La Gerencia General quiere lanzar «Compra ahora, paga en 30 días» sin detener lo que ya funciona. La gerente de marketing, María José Rivas, espera aumentar el ticket promedio, y Finanzas pone una condición: no se da crédito sin criterio. Cada solicitud debe apoyarse en el comportamiento real del cliente: cuánto ha comprado, qué tan puntual ha sido, si acumula devoluciones o incidencias.

Eso cambia el checkout. Ya no basta con decidir si el cliente puede pagar; hay que decidir primero cómo va a pagar. Para algunos clientes el crédito aparece junto a PayKlik y para otros no existe. Esa decisión no puede quedar en manos de un agente ni resolverse revisando historiales a mano, como pasaba antes.

Hay tres presiones que se contradicen:

- **El historial vive en el ERP heredado**, que nunca se ha usado para decidir nada en el momento de la venta, y que puede estar lento o caído.
- **La orden no puede quedar congelada** esperando una respuesta. Sea cual sea la ruta elegida, la orden debe terminar confirmada o rechazada, con el cliente enterado de qué pasó, y ninguna de las dos rutas puede bloquear a la otra.
- **El crédito es dinero prestado**: dos compras simultáneas del mismo cliente no pueden superar su límite.

El ADR-0009 ya fijó que todos los componentes corren en un solo contenedor, y el ADR-0007 que lo que sale hacia un tercero pasa por el outbox. Esta decisión tiene que encajar en eso, sin un módulo aislado.

## Decisión

1. **La evaluación vive dentro del componente de pagos**, en `payments/CreditService`, y corre en el checkout, dentro del mismo proceso que crea la orden. No se crea un servicio aparte.
2. **Los criterios son datos, no código.** Compras entregadas mínimas, importe mínimo, máximos de incidencias, devoluciones, pagos fuera de plazo y rechazos, límite y plazo viven en `config.setting` con la clave `credit.*`. El administrador los cambia desde la pantalla de configuración y aplican a la siguiente compra, sin desplegar. Los valores iniciales son 3 compras entregadas, Q 30 de importe mínimo, cero incidencias, devoluciones, atrasos y rechazos, Q 5,000 de límite y 30 días de plazo.
3. **El historial del ERP se lee a una proyección local** (`integration.erp_customer_history`). La lectura al ERP tiene un límite de 800 ms. Si responde, se actualiza la proyección; si no, se usa la última proyección vigente; si no hay ninguna, el crédito se declara no disponible. La transacción de pago nunca espera al ERP.
4. **La decisión se calcula con el historial del ERP sumado al interno** (órdenes entregadas, devoluciones, incidencias y pagos del propio sistema), y se guarda siempre, aprobada o rechazada, en `payments.credit_application` con el detalle de la evaluación. Cada decisión queda auditada y se notifica al cliente.
5. **Un candado por cliente serializa el gasto de crédito.** Evaluar y cargar ocurren con la fila del cliente bloqueada, así que dos compras simultáneas no superan el límite.
6. **PayKlik es siempre la ruta de respaldo.** Si el cliente no es elegible, si el ERP no responde y no hay historial vigente, o si el crédito no cubre el total, el checkout lo dice y el cliente sigue con PayKlik. Una ruta no depende de la otra.
7. **El abono se paga con PayKlik.** Cada compra a crédito genera un cargo en `payments.credit_charge` con vencimiento. El abono confirmado lo libera; si falla, el error queda registrado y se puede reintentar.
8. **Los avisos al cliente viajan por el outbox y Kafka**, igual que el resto de las integraciones (ADR-0007). Es la forma en que el sistema gestiona las notificaciones de la decisión sin retrasar el checkout.

## Alternativas consideradas

| Alternativa | Ventajas | Desventajas | Por qué se descartó |
|---|---|---|---|
| Un agente revisa cada solicitud | Criterio humano | Lento, inconsistente y no escala; es lo que Finanzas quiere dejar atrás | Contradice el enunciado de negocio |
| Consultar el ERP en línea en cada checkout, sin proyección | Dato siempre fresco | El checkout depende de la disponibilidad y la latencia del ERP; si cae, cae la venta | Viola RC 04 y RC 05: una falla externa no debe detener la venta |
| Servicio de crédito independiente | Escala y despliega por separado | Exige una transacción distribuida entre la orden y el cargo; el ADR-0009 ya descartó separar componentes | Rompe la atomicidad del checkout |
| Evaluar con un proveedor externo de scoring | Modelo más rico | Costo, nuevo tercero y datos del cliente fuera; Finanzas pidió usar el comportamiento propio | Fuera del presupuesto y del enunciado |
| Criterios fijos en el código | Más simple | Ajustarlos exige un despliegue | Los criterios cambian con el negocio |
| Proyección local del ERP más criterios en configuración (elegida) | La venta no depende del ERP; Finanzas ajusta sin desplegar; todo queda auditado | El historial puede estar levemente desactualizado | Es el mejor equilibrio entre rapidez, resiliencia y control |

## Consecuencias

**Positivas:**
- La decisión de crédito es rápida: en la prueba de carga L04, 256 decisiones con 16 en paralelo dieron un p95 de 128 ms, contra un umbral de 2,000 ms (`FASE 3/EVIDENCIA.md`).
- La orden no se congela. Con el ERP caído, el crédito desaparece como opción y el cliente sigue con PayKlik; está cubierto por los E2E de crédito (E01 a E05).
- El gasto de crédito de un cliente se serializa, así que compras simultáneas no se evalúan contra el mismo cupo disponible.
- Cada solicitud, aprobada o rechazada, queda con su motivo y el detalle de la evaluación. Finanzas puede justificarla.

**Negativas / tradeoffs aceptados:**
- El historial usado puede tener unos minutos de antigüedad. Se acepta a cambio de que el ERP no bloquee la venta.
- La evaluación hace varias consultas por solicitud. Es adecuada al volumen actual y se mide en las pruebas de carga; si crece mucho habrá que agregar índices o precalcular.
- El crédito comparte el contenedor con el resto del sistema, así que no escala por separado (consecuencia del ADR-0009).
- En la nube del MVP, Kafka y el ERP simulado no están desplegados, así que el flujo completo del crédito solo se demuestra con docker-compose.

## Drivers que atiende

- Nuevos: RN-C01 a RN-C03 y CC-01 a CC-04 de [drivers-y-escenarios-fase3.md](../drivers-y-escenarios-fase3.md)
- RC 04 y RC 05 (una falla externa no detiene la venta), RC 09 (recuperación de proveedores), RC 07 y R 11 (auditoría), RC 06 (no guardar tarjetas)

## Vistas afectadas

- [diagramas-fase3.md](../diagramas-fase3.md): componentes y secuencia del checkout con crédito
- `FASE 2/backend/src/main/java/com/sgologic/payments/CreditService.java`
- `FASE 2/backend/src/main/java/com/sgologic/integration/erp/ErpCustomerHistoryService.java`
- `FASE 2/db/migrations/V10`, `V17` y `V18`

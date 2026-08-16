# ADR-0002: Estrategia de resiliencia de pagos ante fallas de PayKlik

**Estado:** Propuesta
**Fecha:** 2026-08-13
**Decisores:** Equipo de Arquitectura SGO-Logic (Grupo 3, Sección A) — pendiente de ratificación en reunión de equipo

## Contexto

PayKlik tiene un SLA conocido pero imperfecto: ~800ms de latencia normal, hasta 5s en picos, y un antecedente documentado de 45 minutos de indisponibilidad total durante el Black Friday anterior (USD 150,000 en ventas perdidas). Para el próximo Black Friday se espera hasta 8x la demanda normal (DC-02). El contrato con PayKlik es vigente por 3 años y debe respetarse (DR-06) — no se reemplaza como proveedor. La Directora de Finanzas exige que cada intento de cobro, exitoso o fallido, quede auditable (DC-07, DC-04), y que nunca se almacene el PAN completo ni el CVV (DC-08).

## Decisión

Implementamos el patrón **Transactional Outbox + Circuit Breaker + Cola de reintentos asíncronos**, todo dentro del Componente de Procesamiento de Pagos (ver ADR-0001):

1. Al confirmar el checkout, el sistema registra el intento de pago en una tabla *outbox* dentro de la misma transacción que crea la orden — la orden **nunca se pierde**, independientemente de si PayKlik responde.
2. Un *circuit breaker* protege las llamadas a PayKlik: ante fallas o latencias sostenidas por encima de un umbral, deja de intentar llamadas síncronas y encola el intento para reintento asíncrono con backoff exponencial.
3. Cuando el circuito está abierto, la orden queda en estado "pago en proceso" visible para el cliente (no bloqueante — cumple DC-03), y el resultado se confirma vía notificación cuando el pago se resuelve.
5. Cada intento (exitoso, fallido, en reintento) queda registrado en el log de auditoría transversal (DC-07) con orden, canal, fecha y resultado, sin almacenar datos sensibles de la tarjeta (DC-08) — solo el token/referencia que devuelve PayKlik.

## Alternativas consideradas

| Alternativa | Ventajas | Desventajas | Por qué se descartó |
|---|---|---|---|
| Llamada síncrona directa a PayKlik sin protección | Simple de implementar | Ante una caída de PayKlik, el checkout completo falla; repite el incidente de USD 150,000 | Viola directamente DC-01, el driver de mayor prioridad del proyecto |
| Segundo proveedor de pagos (multi-PSP) con failover automático | Máxima disponibilidad, no depende de un solo proveedor | Requiere integrar, certificar (PCI) y mantener un segundo gateway; costo y tiempo incompatibles con DR-01/DR-02/DR-03 (Black Friday es en pocos meses) | Se descarta para la Fase 1 por costo/tiempo; se documenta como evolución futura si el volumen lo justifica |
| Outbox + Circuit Breaker + reintentos asíncronos (elegido) | No pierde la orden ante falla de PayKlik; costo bajo (patrón de software, no proveedor adicional); compatible con Java/.NET (DR-09) | Introduce consistencia eventual en la confirmación de pago; requiere monitoreo del circuit breaker | Mejor balance costo/beneficio dentro de las restricciones del caso |

## Consecuencias

**Positivas:**
- La orden nunca se pierde por una falla de PayKlik (atiende directamente el incidente de Black Friday pasado).
- Cada intento queda auditable, satisfaciendo la exigencia de trazabilidad de Finanzas.
- No requiere negociar ni certificar un segundo proveedor de pagos antes del próximo Black Friday.

**Negativas / tradeoffs aceptados:**
- El cliente puede ver su orden en estado "pago en proceso" por unos segundos/minutos en vez de una confirmación instantánea durante una falla de PayKlik — se acepta como mejor alternativa a perder la orden.
- Se necesita monitoreo activo del estado del circuit breaker y de la profundidad de la cola de reintentos (relacionado con la preocupación de monitoreo de Carlos Méndez).

## Drivers que atiende

- DC-01, DC-02, DC-06, DC-07, DC-08

## Vistas afectadas

- `Docs/Diagramas/componentes.drawio`
- `Docs/Diagramas/despliegue.drawio`

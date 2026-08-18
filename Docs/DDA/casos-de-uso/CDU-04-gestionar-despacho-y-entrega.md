# CDU-04 — Gestionar Despacho y Entrega

| Campo | Detalle |
|---|---|
| **CUN de origen** | CUN-04 |
| **Actor principal** | Personal de Logística |
| **Actores secundarios** | LogiExpress (logística, externo), Cliente |
| **Prioridad** | Alta (objetivo de negocio: -70% errores de despacho) |
| **Disparador (trigger)** | La orden queda facturada (post-CDU-03) |

## Descripción

Determina desde dónde despachar cada orden (centro de distribución, tienda o recogida por el cliente), coordina con LogiExpress cuando aplica, y mantiene el estado de entrega actualizado — incluso si el cliente cambia el método de entrega después de confirmada la compra.

## Precondiciones

- La orden está facturada (CDU-03 completado).

## Flujo principal

1. El sistema determina el punto de despacho (centro de distribución, tienda o pickup) según disponibilidad e inventario centralizado (CDU-08).
2. Logística recibe la orden a preparar, con ubicación de origen y datos del destinatario.
3. El sistema genera la guía con LogiExpress cuando el método de entrega lo requiere.
4. El sistema recibe y propaga actualizaciones de estado (preparación, tránsito, entrega).

## Flujos alternativos

- **1a. El cliente cambia el método de entrega después de confirmada la compra:** el sistema actualiza el punto de despacho sin perder la trazabilidad de la orden ni reiniciar el proceso desde cero.
- **3a. LogiExpress responde con timeout** (~2% de las solicitudes, según el histórico del proveedor): el sistema reintenta vía el circuit breaker (ADR-0004) sin bloquear la operación principal.

## Flujos de excepción

- **E1. LogiExpress no genera la guía tras los reintentos configurados:** se genera una alerta operativa para que Logística intervenga manualmente; la orden no queda "perdida", solo pendiente de asignación manual de transporte.
- **E2. El inventario del punto de despacho seleccionado cambia antes de preparar el pedido** (ej. ajuste manual en tienda): el sistema re-evalúa el punto de despacho contra el inventario centralizado vigente.

## Postcondiciones

- **De éxito:** orden despachada, con estado de entrega actualizado e inventario del origen decrementado.
- **De fracaso parcial:** orden queda en alerta operativa visible para Logística, nunca silenciosamente perdida.

## Reglas de negocio

- El despacho puede realizarse desde un centro de distribución, una tienda física, o mediante recogida por el cliente.
- El método de entrega puede modificarse incluso después de confirmada la compra.
- Cada envío incorrecto tiene un costo estimado de USD 25 en logística inversa — el diseño prioriza precisión en la asignación del punto de despacho para cumplir la meta de reducir errores en 70%.

## Drivers relacionados

- **Calidad:** DC-03 (consulta de estado < 5s), DC-06 (tolerancia a fallas de LogiExpress), DC-11 (precisión operacional del despacho)
- **Restricción:** DR-05 (no modificar POS), DR-07 (contrato LogiExpress vigente)

# CDU-08 — Gestionar Inventario Centralizado

| Campo | Detalle |
|---|---|
| **CUN de origen** | CUN-08 |
| **Actor principal** | Personal de Logística |
| **Actores secundarios** | Personal de Tienda, POS (x32 tiendas, externo) |
| **Prioridad** | Alta (19/20 — habilita CDU-01 y CDU-04, evita doble venta) |
| **Disparador (trigger)** | Ocurre un movimiento de inventario en una tienda o centro de distribución (venta, ajuste, entrada, salida) |

## Descripción

Consolida en una sola vista las existencias, ubicaciones, reservas, entradas y salidas de los 2 centros de distribución y las 32 tiendas, reemplazando la confirmación telefónica manual que existe hoy, y garantizando que ninguna unidad se comprometa a más de un cliente a la vez.

## Precondiciones

- Existen movimientos de inventario reportados desde al menos un POS de tienda o un centro de distribución.

## Flujo principal

1. El sistema consolida existencias, ubicaciones, reservas, entradas y salidas de los 2 centros de distribución y las 32 tiendas en una sola vista.
2. El sistema expone disponibilidad en tiempo real a CDU-01 (Realizar Compra) y CDU-04 (Gestionar Despacho).
3. El sistema libera reservas de compras no concluidas a los 20 minutos de inactividad (mismo valor confirmado en CDU-01).

## Flujos alternativos

- **1a. Evento de inventario proveniente de un POS falla al entregarse:** el sistema reintenta con manejo de errores garantizado (adaptador POS con reintentos, ADR-0001), sin perder el movimiento reportado.

## Flujos de excepción

- **E1. Dos canales intentan comprometer la misma unidad casi simultáneamente:** el mecanismo de reserva atómica garantiza que solo uno de los dos tenga éxito; el otro recibe el flujo alternativo 2a de CDU-01 (producto no disponible).
- **E2. Un POS reporta un ajuste de inventario que contradice el estado centralizado** (ej. conteo físico distinto): el evento se acepta como la fuente de verdad más reciente de esa tienda, y queda registrado para auditoría de diferencias.

## Postcondiciones

- Vista de inventario consistente entre todos los canales; ninguna unidad comprometida a más de un cliente simultáneamente.

## Reglas de negocio

- Antes de confirmar una venta debe verificarse la disponibilidad para evitar que una misma unidad sea comprometida a más de un cliente.
- Cuando una compra no concluye, el inventario reservado debe liberarse en un tiempo acorde con la operación comercial (20 minutos, confirmado por el equipo).
- Los POS de tienda no se modifican — solo reciben eventos desde SGO-Logic y reportan movimientos hacia él.

## Drivers relacionados

- **Calidad:** DC-02 (elasticidad 8x), DC-05 (confiabilidad de integración)
- **Restricción:** DR-05 (no modificar POS)

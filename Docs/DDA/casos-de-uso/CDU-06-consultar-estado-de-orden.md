# CDU-06 — Consultar Estado de Orden

| Campo | Detalle |
|---|---|
| **CUN de origen** | CUN-06 |
| **Actor principal** | Cliente |
| **Actores secundarios** | Personal de Atención |
| **Prioridad** | Media (experiencia de cliente, base para CDU-05) |
| **Disparador (trigger)** | El cliente o el agente de atención solicita el estado de una orden desde cualquier canal o dispositivo |

## Descripción

Entrega una vista consolidada y de solo lectura del estado completo de una orden (compra, pago, despacho, entrega, incidencias) en menos de 5 segundos, sin importar desde qué canal se consulte, y sin depender de que las notificaciones proactivas hayan funcionado.

## Precondiciones

- La orden existe en el sistema (fue creada al menos vía CDU-01).

## Flujo principal

1. El actor solicita el estado de una orden desde cualquier canal o dispositivo.
2. El sistema responde con la vista consolidada (compra, pago, despacho, entrega, incidencias) en menos de 5 segundos.

## Flujos alternativos

- **1a. Falla el canal de notificación proactiva** (SMS/correo/push fuera de servicio): el cliente igual puede consultar el estado bajo demanda — la operación principal y esta consulta nunca dependen de que las notificaciones hayan llegado.

## Flujos de excepción

- **E1. La orden referenciada no existe o el identificador es inválido:** el sistema responde con un mensaje claro de "orden no encontrada", sin exponer información de otras órdenes.
- **E2. La consulta excede el tiempo objetivo de 5 segundos** (ej. degradación del sistema en pico de demanda): se considera una violación del Eac DC-03 y debe registrarse para revisión de capacidad — no es un comportamiento aceptable silencioso.

## Postcondiciones

- Ninguna — es una operación de solo lectura, no modifica el estado de la orden.

## Reglas de negocio

- Los clientes y el personal de atención deben poder consultar el estado de cualquier orden desde distintos dispositivos.
- Consultas que superen los 5 segundos son inaceptables para la organización (Eac DC-03).

## Drivers relacionados

- **Calidad:** DC-03 (rendimiento de consulta < 5s)
- **Restricción:** — (ninguna aplica directamente)

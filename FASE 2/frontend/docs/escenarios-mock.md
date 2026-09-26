# Escenarios de mock — Frontend 1 (Cliente / Compra Omnicanal)

"Datos mágicos" que cada repositorio mock debe reconocer para poder navegar los flujos
alternos/de excepción de las historias sin esperar al backend real. Referencian solo los
últimos 4 dígitos de tarjeta (nunca el número completo — ver regla de seguridad abajo).

| Dato mágico | Repositorio | Comportamiento simulado | Historia que prueba |
|---|---|---|---|
| SKU específico (a definir en `shared/mocks/`, ej. `SKU-SIN-STOCK`) | Catálogo/Inventario | Siempre responde "sin disponibilidad" | PB-003 |
| Tarjeta terminada en `0000` | Pago | Cobro rechazado de inmediato | PB-013 |
| Tarjeta terminada en `1111` | Pago | Devuelve "pago en proceso" y resuelve a aprobado tras unos segundos, simulando el reintento asíncrono del backend (Outbox + Circuit Breaker) | PB-010, PB-014 |
| ID de orden inexistente (ej. `ORD-000000`) | Orden | Responde "orden no encontrada" | PB-025 |

## Regla de seguridad de pagos (también en el mock, no solo en el backend real)

- El formulario de pago limpia el número completo de tarjeta de su estado en cuanto se envía el intento.
- El repositorio mock de pago **solo acepta/persiste el formato enmascarado** (`**** 1111` + marca), nunca el número tecleado completo.
- Este documento y cualquier prueba (`*.mock.test.ts`) referencian las tarjetas "mágicas" únicamente por sus últimos 4 dígitos.

## Persistencia simulada

`localStorage` simula que "el carrito es del cliente, no del canal/dispositivo" dentro del mismo
navegador, bajo la clave del cliente identificado (`CustomerContext`). No es persistencia real
cross-device — eso requiere el backend (Order/Checkout Service + Customer Service reales).

_(Ampliar esta tabla conforme se agreguen más casos alternos/de excepción durante la implementación de cada historia.)_

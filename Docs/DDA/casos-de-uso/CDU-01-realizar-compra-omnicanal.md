# CDU-01 — Realizar Compra Omnicanal

| Campo | Detalle |
|---|---|
| **CUN de origen** | CUN-01 |
| **Actor principal** | Cliente |
| **Actores secundarios** | Inventory Service (CDU-08), Payment Service (CDU-02) |
| **Prioridad** | Alta (19/20 — ver `03-caracteristicas-priorizadas.md`) |
| **Disparador (trigger)** | El cliente agrega un producto al carrito desde cualquier canal (tienda, web, app, call center) |

## Descripción

Permite que un cliente inicie, continúe y complete una compra cruzando de un canal a otro sin perder el contenido de su carrito ni la disponibilidad reservada de los productos. Es el caso de uso central de la operación omnicanal — resuelve directamente la exigencia de "no tener silos" entre canales.

## Precondiciones

- El cliente está identificado o es identificable en el canal (sesión, número de teléfono, cuenta).
- El catálogo de productos y su disponibilidad son accesibles desde el canal.

## Flujo principal

1. El cliente agrega uno o más productos al carrito desde cualquier canal.
2. El sistema verifica disponibilidad en tiempo real contra el inventario centralizado (CDU-08).
3. El sistema reserva la unidad para evitar que se comprometa a más de un cliente.
4. El cliente puede continuar la compra desde un canal distinto al que inició, viendo el mismo carrito.
5. El cliente confirma la compra y selecciona el método de entrega.
6. El sistema dispara CDU-02 (Procesar Pago de la Orden).

## Flujos alternativos

- **2a. Producto no disponible:** el sistema notifica al cliente y sugiere una alternativa o la tienda más cercana con existencia.
- **5a. Cliente abandona la compra sin confirmar:** el inventario reservado se libera automáticamente a los **20 minutos** de inactividad (decisión confirmada por el equipo).

## Flujos de excepción

- **E1. Falla de comunicación con el Inventory Service:** el sistema no permite confirmar la reserva; muestra un mensaje de reintento al cliente sin perder el contenido del carrito ya construido.
- **E2. El cliente cambia de canal con una sesión no reconocible** (ej. pierde el identificador de cliente): el sistema solicita reidentificación antes de continuar; el carrito permanece asociado al cliente, no al dispositivo/canal.

## Postcondiciones

- **De éxito:** orden creada en estado "pendiente de pago", con inventario reservado y visible de forma idéntica en cualquier canal.
- **De fracaso:** ninguna orden se crea; el inventario no queda comprometido.

## Reglas de negocio

- Una misma unidad de inventario nunca puede quedar comprometida a más de un cliente simultáneamente.
- El carrito es una propiedad del cliente, no del canal ni del dispositivo.

## Drivers relacionados

- **Calidad:** DC-02 (elasticidad 8x), DC-05 (confiabilidad de integración)
- **Restricción:** DR-05 (no modificar POS), DR-10 (despliegue on-premises)

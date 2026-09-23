# API — transacciones e integraciones (Backend 2)

Para el equipo de frontend y para quien conecte un tablero de operación. Cubre pagos,
facturación, logística, notificaciones, auditoría e integraciones con PayKlik, la SAT,
LogiExpress, el POS de las tiendas y el ERP-Core.

El catálogo, los clientes, el inventario y el carrito/órdenes están en [`API.md`](API.md).

Base local: `http://localhost:8080`. Todo responde JSON, entrada y salida, y los errores traen
el mismo cuerpo que ya documenta `API.md` (`timestamp`, `status`, `error`, `message`, `path`).

En Postman: la colección `postman/SGO-Logic-Backend.postman_collection.json` ya trae estas
carpetas (Pagos, Facturación, Logística, Notificaciones, Integración, Auditoría y reportes, y
Simulación de terceros).

## Lo primero: casi nada de esto hay que llamarlo

El flujo avanza solo. Desde el frontend basta con **cobrar**; la factura, el despacho, la guía
y los avisos ocurren sin que nadie los pida:

```
POST /api/orders/{id}/payments
        │
        ├─ cobro aprobado ──> factura electrónica ──> la SAT la acepta ──> despacho ──> guía
        │                                                                      │
        └─ PayKlik no responde ──> cola de contingencia, se reintenta solo      └─> avisos al cliente
```

Cada paso queda registrado en la auditoría, así que la forma de ver en qué va una orden es
`GET /api/orders/{id}` (estado actual) o `GET /api/orders/{id}/trace` (todo lo que le pasó).

El resto de endpoints son para **consultar** y para **resolver a mano** lo que se atoró: una
factura que la SAT rechazó, una guía que LogiExpress no emitió, un aviso que no salió.

## Valores fijos (enums)

Los de `API.md` siguen valiendo. Estos se agregan:

| Campo | Valores |
|---|---|
| `method` (cobro) | `CARD`, `TRANSFER`, `WALLET` |
| `result` (cobro) | `APPROVED`, `DECLINED`, `TIMEOUT`, `ERROR` |
| `status` (factura) | `GENERATED`, `SENT`, `ACCEPTED`, `REJECTED` |
| `status` (envío) | `ASSIGNED`, `GUIDE_REQUESTED`, `GUIDE_ISSUED`, `IN_TRANSIT`, `DELIVERED`, `FAILED` |
| `channel` (aviso) | `SMS`, `EMAIL`, `PUSH` |
| `status` (cola: avisos, outbox, POS, lotes) | `PENDING`, `DELIVERED`, `FAILED` |

En las colas, `FAILED` no significa "error del sistema": significa que se agotaron los
reintentos y eso necesita que alguien intervenga.

---

## Pagos

### `POST /api/orders/{orderId}/payments`

Cobra la orden. Responde `201`.

```json
{ "method": "CARD", "cardToken": "tok_visa_demo", "cardLast4": "4242" }
```

`method` es opcional (por defecto `CARD`). `cardToken` es obligatorio: es el token que devuelve
el formulario de pago de PayKlik. `cardLast4` son 4 dígitos, obligatorio cuando el método es
`CARD`.

**El backend no recibe el número de tarjeta ni el CVV.** Si el cuerpo trae un campo
`cardNumber`, o si `cardToken` contiene algo que parece un número de tarjeta, responde `400` y
no guarda nada.

```json
{
  "orderId": 12,
  "attemptNumber": 1,
  "result": "APPROVED",
  "orderStatus": "PAID",
  "providerReference": "PK-899B2F4A",
  "latencyMs": 81,
  "message": "cobro aprobado"
}
```

Qué hacer con cada `result`:

| `result` | `orderStatus` | Qué mostrarle al cliente |
|---|---|---|
| `APPROVED` | `PAID` | Compra confirmada. La factura y el despacho salen solos. |
| `DECLINED` | `PAYMENT_FAILED` | El emisor rechazó el cobro (`message` trae el motivo). Puede reintentar con otro método. |
| `TIMEOUT` / `ERROR` | `PAYMENT_IN_PROGRESS` | "Estamos procesando tu pago". PayKlik no respondió; el cobro se reintenta solo y la orden no se pierde. |

Ese tercer caso es intencional y es el más importante: en vez de fallar el checkout cuando la
pasarela se cae, la orden queda viva y el cobro se resuelve después. El frontend no debe
tratarlo como error — debe dejar la orden visible con ese estado y consultar `GET /api/orders/{id}`.

Errores: `404` si la orden no existe. `409` si la orden ya fue pagada, si ya tiene un cobro en
proceso, o si está cancelada o devuelta.

### `GET /api/orders/{orderId}/payments`

El historial completo de intentos, exitosos y fallidos.

```json
[
  { "id": 1, "attemptNumber": 1, "result": "ERROR", "amount": 4200.00, "providerReference": null,
    "cardLast4": "4242", "failureReason": "PayKlik no respondió a la solicitud de cobro",
    "latencyMs": 0, "attemptedAt": "2026-09-23T04:36:20Z" },
  { "id": 6, "attemptNumber": 6, "result": "APPROVED", "amount": 4200.00,
    "providerReference": "PK-A50F1670", "cardLast4": "4242", "failureReason": null,
    "latencyMs": 80, "attemptedAt": "2026-09-23T04:36:52Z" }
]
```

Esta tabla es de solo inserción: un intento registrado no se puede cambiar ni borrar, ni
siquiera desde la base.

---

## Facturación

### `GET /api/orders/{orderId}/invoice`

```json
{
  "id": 3, "orderId": 12, "status": "ACCEPTED",
  "cui": "F9263AB5-D985-4B9A-9AE1-832D7EB2506B", "series": "A",
  "satResponse": "documento aceptado por la SAT, autorización F9263AB5-...",
  "generatedAt": "2026-09-23T04:34:14Z", "answeredAt": "2026-09-23T04:34:14Z"
}
```

`404` mientras la orden no tenga factura.

### `GET /api/orders/{orderId}/invoice/xml`

El XML tal cual se le transmitió a la SAT, con su número de autorización y su serie.
Responde `application/xml`.

### `POST /api/orders/{orderId}/invoice`

Emite o reintenta la factura a mano. Es para Finanzas, cuando un documento quedó rechazado o
sin respuesta. Es idempotente: no genera un documento nuevo, reintenta el mismo.

`409` si la orden todavía no está pagada. `502` si la SAT la vuelve a rechazar.

### `GET /api/invoices?status=REJECTED&limit=50`

Las facturas por estado. Con `REJECTED` es la bandeja de revisión de Finanzas.

### La regla que no se negocia

Una orden **no se despacha** hasta que la SAT acepte su factura. Si la SAT rechaza o no
responde, la orden se queda en `PAID` con la factura en `REJECTED` o `SENT`, y tras agotar los
reintentos queda escalada en la auditoría (`action = FACTURA_ESCALADA`) para revisión manual.
Ninguna mercancía sale sin respaldo fiscal.

---

## Logística

### `GET /api/orders/{orderId}/shipment`

El envío con toda su línea de tiempo.

```json
{
  "id": 5, "orderId": 12, "originLocation": "CD-01", "carrier": "LOGIEXPRESS",
  "status": "GUIDE_ISSUED", "trackingNumber": "LX-879862010",
  "createdAt": "2026-09-23T04:34:16Z", "updatedAt": "2026-09-23T04:34:16Z",
  "tracking": [
    { "status": "ASSIGNED", "detail": "Despacho asignado desde CD-01", "occurredAt": "..." },
    { "status": "GUIDE_REQUESTED", "detail": "Guía solicitada a LogiExpress", "occurredAt": "..." },
    { "status": "GUIDE_ISSUED", "detail": "Guía LX-879862010 emitida por LogiExpress", "occurredAt": "..." }
  ]
}
```

`404` mientras la orden no tenga envío.

### `GET /api/shipments/{id}` — lo mismo, por id de envío.

### `GET /api/shipments?status=GUIDE_REQUESTED&limit=50`

Los envíos por estado. Con `GUIDE_REQUESTED` es **el panel de alertas de Logística**: órdenes
ya preparadas, con el inventario descontado, que siguen sin número de guía porque LogiExpress no
respondió. La orden no está perdida: está esperando que alguien le asigne transporte.

### `POST /api/shipments/{id}/guide`

Vuelve a pedir la guía. Es la forma de resolver una alerta cuando el proveedor ya se recuperó.
`503` si LogiExpress sigue caído.

### `POST /api/shipments/{id}/tracking`

La actualización de estado que manda LogiExpress. También sirve para que Logística mueva el
estado a mano.

```json
{ "status": "IN_TRANSIT", "detail": "Salió del centro de distribución" }
```

Con `status: DELIVERED` la orden pasa a `DELIVERED` y el cliente recibe el aviso.

### `PUT /api/shipments/{id}/origin`

Cambia el punto de despacho después de confirmada la compra.

```json
{ "locationCode": "T-05" }
```

Devuelve la mercancía al origen anterior y la toma del nuevo, deja los dos movimientos de
inventario, le avisa al POS de las tiendas involucradas y conserva toda la trazabilidad del
envío. Si la guía ya estaba emitida, se anula y se pide una nueva desde el origen correcto.

`409` si la mercancía ya salió (`IN_TRANSIT` o posterior), o si el nuevo origen no tiene
existencia — en ese caso no se mueve nada.

### `POST /api/orders/{orderId}/dispatch`

Despacha la orden a mano. Normalmente no hace falta: el despacho se dispara solo al aceptarse la
factura. `409` si la orden no está facturada.

---

## Notificaciones

Los avisos son best-effort: se encolan junto con el hecho que los origina y se envían aparte. Si
el proveedor de mensajería falla, **nada del flujo de la orden se detiene**; lo único que pasa
es que quedan avisos en `FAILED`.

El canal se elige según el dato de contacto del cliente: correo si lo tiene, si no SMS, y push
como último recurso.

### `GET /api/orders/{orderId}/notifications`

```json
[
  { "id": 1, "orderId": 12, "channel": "EMAIL", "status": "DELIVERED",
    "recipient": "cliente1@example.com", "message": "Tu orden 12 está en preparación desde CD-01.",
    "attempts": 1, "lastError": null, "createdAt": "...", "sentAt": "..." }
]
```

### `GET /api/notifications?status=FAILED&limit=50` — los avisos por estado.

### `POST /api/notifications/{id}/retry` — lo vuelve a poner en cola.

---

## Integración

### `GET /api/integration/health`

Una sola consulta con el estado de cada tercero y la profundidad de las colas.

```json
{
  "circuitos": { "PAYKLIK": "CLOSED", "SAT": "CLOSED", "LOGIEXPRESS": "OPEN",
                 "MESSAGING": "CLOSED", "POS": "CLOSED" },
  "outbox": { "PENDING": 1, "DELIVERED": 24, "FAILED": 0 },
  "pos": { "PENDING": 0, "DELIVERED": 3, "FAILED": 0 }
}
```

Un circuito en `OPEN` significa que ese proveedor viene fallando y el sistema dejó de insistir
de forma síncrona. Es información de operación, no un error que haya que mostrarle al cliente.

### `GET /api/integration/outbox?status=PENDING&limit=50`

Los eventos del broker. Con `FAILED` son los que agotaron sus reintentos, cada uno con el
`lastError` que dio.

### `POST /api/integration/outbox/{id}/retry`

Vuelve a encolar un evento agotado, una vez resuelto lo que lo tumbó.

### `GET /api/integration/pos/events?status=PENDING&limit=50`

Los eventos de actualización hacia el POS de cada tienda. Con `FAILED` son las tiendas que se
quedaron sin recibirlos.

### `POST /api/integration/pos/events/{id}/retry`

### `POST /api/integration/erp/batches`

Cierra la ventana de conciliación ahora mismo, sin esperar los 30 minutos.

```json
{
  "generated": true,
  "batch": { "id": 2, "file_name": "SGO-VENTAS-20260923-044140.csv", "status": "DELIVERED",
             "order_count": 4, "total_amount": 8580.00,
             "window_start": "...", "window_end": "...", "format": "CSV" },
  "message": null
}
```

Si no hay ventas pendientes responde `{ "generated": false, ... }` con el motivo, en vez de
crear un lote vacío. **Una orden entra en un solo lote**, así que correrlo dos veces no manda la
misma venta dos veces al ERP.

### `GET /api/integration/erp/batches?limit=20` — los lotes con su ventana, archivo, cantidad de órdenes y monto.

### `GET /api/integration/erp/batches/{id}`

El detalle transaccional del lote: qué órdenes incluyó, de qué cliente, por cuánto y con qué
factura. Es lo que evita investigar una diferencia de conciliación a mano.

### `GET /api/integration/erp/batches/{id}/file`

El archivo tal como lo recibe el AS/400. El mismo queda escrito en `FASE 2/erp-out/`.

---

## Auditoría y reportes

### `GET /api/orders/{orderId}/trace`

Todo lo que le pasó a una orden: su estado actual más cada paso registrado, en orden.

```json
{
  "order": { "orderId": 12, "status": "IN_DISPATCH", "invoiceStatus": "ACCEPTED", "...": "..." },
  "timeline": [
    { "occurredAt": "...", "actor": "system", "action": "COBRO_INICIADO", "entityType": "order",
      "entityId": "12", "orderId": 12, "channel": "WEB",
      "details": { "metodo": "CARD", "monto": 4200.00 } },
    { "occurredAt": "...", "action": "COBRO_APPROVED", "entityType": "payment_attempt", "...": "..." },
    { "occurredAt": "...", "action": "FACTURA_ACEPTADA", "entityType": "invoice", "...": "..." },
    { "occurredAt": "...", "action": "DESPACHO_ASIGNADO", "entityType": "shipment", "...": "..." },
    { "occurredAt": "...", "action": "GUIA_EMITIDA", "entityType": "shipment", "...": "..." }
  ]
}
```

### `GET /api/audit`

Búsqueda en el registro. Todos los filtros son opcionales y se combinan: `orderId`,
`entityType`, `entityId`, `action`, `from`, `to` (fecha ISO) y `limit` (100 por defecto).

Valores típicos de `action`: `COBRO_INICIADO`, `COBRO_REINTENTADO`, `COBRO_APPROVED`,
`COBRO_DECLINED`, `COBRO_TIMEOUT`, `COBRO_ERROR`, `COBRO_AGOTADO`, `FACTURA_GENERADA`,
`FACTURA_ACEPTADA`, `FACTURA_RECHAZADA`, `FACTURA_SIN_RESPUESTA`, `FACTURA_ESCALADA`,
`DESPACHO_ASIGNADO`, `DESPACHO_REASIGNADO`, `GUIA_EMITIDA`, `GUIA_FALLIDA`, `GUIA_ESCALADA`,
`ENVIO_IN_TRANSIT`, `ENVIO_DELIVERED`, `ENVIO_FAILED`, `ERP_LOTE_GENERADO`.

No hay endpoint para escribir auditoría: se escribe sola desde cada módulo, y la base no admite
modificarla después.

### `GET /api/reports/payments`

Cada intento de cobro con su orden, canal, fecha y resultado. Es la consulta de Finanzas.
Filtros opcionales: `result`, `channel`, `orderId`, `from`, `to`, `limit`.

### `GET /api/reports/sales`

Ventas por canal y por estado. Por defecto los últimos 30 días; se acota con `from` y `to`.

---

## Simulación de terceros (solo para la demo)

PayKlik, la SAT, LogiExpress, el proveedor de mensajería y el POS no existen para conectarse de
verdad. Están detrás de un adaptador que hoy los simula, y su comportamiento se cambia en
caliente para demostrar los escenarios de falla.

**No es un endpoint de negocio.** En un despliegue real no existe.

### `GET /api/simulation` — el modo de cada uno.

### `PUT /api/simulation/{provider}`

`provider`: `payklik`, `sat`, `logiexpress`, `messaging`, `pos`.

```json
{ "mode": "DOWN" }
```

| Modo | Qué hace |
|---|---|
| `NORMAL` | Responde bien y rápido. |
| `SLOW` | Tarda más que el umbral: el resultado es un timeout. |
| `DOWN` | No responde: se cae la llamada y entra el circuit breaker. |
| `REJECT` | Responde, pero rechazando (tarjeta sin fondos, factura mal formada, fuera de cobertura). |

### Qué se ve con cada escenario

| Escenario | Resultado esperado |
|---|---|
| PayKlik `DOWN` y cobrar | La orden queda `PAYMENT_IN_PROGRESS`, el cobro en la cola. A las 3 fallas el circuito abre y ya ni se intenta. Volver a `NORMAL` y la orden se completa sola: cobro, factura, despacho y guía. |
| PayKlik `REJECT` | Cobro `DECLINED` con su motivo, orden en `PAYMENT_FAILED`, aviso al cliente. |
| SAT `REJECT` | La orden se queda en `PAID`, la factura en `REJECTED` y **no hay envío**. Tras los reintentos queda `FACTURA_ESCALADA` en la auditoría. |
| LogiExpress `DOWN` | La orden se despacha igual (`IN_DISPATCH`, inventario descontado); lo que falta es la guía, y el envío aparece en `GET /api/shipments?status=GUIDE_REQUESTED`. |
| Mensajería `DOWN` | El envío avanza igual; solo quedan avisos en `FAILED`. |
| POS `DOWN` | Los eventos se acumulan pendientes y se entregan cuando la tienda vuelve. |

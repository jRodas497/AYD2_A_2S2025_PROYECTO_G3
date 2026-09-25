# Contrato real — Order / Checkout Service

> Consumido por `httpOrderRepository` (`src/features/orden/api/orderRepository.http.ts`). El frontend llama directo al backend (Backend 1) vía el proxy de Vite — no existe un BFF de agregación; el supuesto original de este documento (agregación por BFF) no se cumplió, igual que le pasó a `catalog-service.md`.

## `POST /api/orders/checkout`

Convierte el carrito activo del cliente en una orden — reserva stock y crea la orden en `PENDING_PAYMENT`.

**Request**
```json
{ "customerId": 1, "deliveryAddress": "Zona 10, Ciudad de Guatemala" }
```

**Response 201**
```json
{ "id": 1, "cartId": 1, "customerId": 1, "channel": "WEB", "status": "PENDING_PAYMENT", "total": 4500.00, "deliveryAddress": "Zona 10, Ciudad de Guatemala", "createdAt": null, "updatedAt": "2026-09-22T04:05:48Z" }
```
`createdAt` sale `null` en esta respuesta puntual (limitación conocida del backend) — `httpOrderRepository` usa `updatedAt` como `creadaEn` para este caso. `400` si el cliente no tiene carrito activo o está vacío; `409` si algún producto ya no está activo o no alcanza el stock — se muestran como texto en `CheckoutPage`.

**No lleva `items` en el request.** El backend usa el carrito activo del cliente tal cual está en el servidor. El frontend guarda localmente (`orderItemsSnapshot.ts`) los ítems que tenía el carrito justo antes de confirmar, solo para mostrarlos después — el backend no los devuelve en ningún endpoint de orden.

**No existe el concepto de "método de entrega"** (centro de distribución/tienda/recogida) que asumía este documento — solo `deliveryAddress`, texto libre. PB-004.1 ("elegir centro de distribución, tienda o recogida") queda no cumplido contra el backend real; se reemplazó por un campo de dirección.

## `GET /api/orders/{id}`

Estado completo de la orden en una sola consulta.

**Response 200**
```json
{
  "orderId": 1, "createdAt": "2026-09-22T04:05:48Z", "customerId": 1, "customer": "Cliente de prueba 1",
  "channel": "WEB", "status": "PENDING_PAYMENT", "total": 4500.00, "lastPaymentResult": null,
  "paymentAttempts": null, "invoiceStatus": null, "shipmentStatus": null, "trackingNumber": null
}
```
`404` si la orden no existe — `httpOrderRepository.getOrder` lo traduce a `null`.

**No trae line items ni dirección de entrega.** `httpOrderRepository.getOrder` los rellena desde el snapshot local guardado al momento del checkout (`orderItemsSnapshot.ts`) — si no existe (otro navegador, `localStorage` limpiado), `items` queda `[]` y `direccionEntrega` queda `''`; la UI lo muestra como "no tenemos el detalle en este navegador" en vez de fallar.

## Estados reales de la orden

`PENDING_PAYMENT, PAYMENT_IN_PROGRESS, PAYMENT_FAILED, PAID, INVOICED, IN_DISPATCH, DELIVERED, CANCELLED, RETURNED` — mapeados 1:1 a `EstadoOrden` (`pendiente_pago`, `pago_en_proceso`, `pago_fallido`, `pagada`, `facturada`, `en_despacho`, `entregada`, `cancelada`, `devuelta`). `entregada`/`cancelada`/`devuelta` son terminales — `OrderStatusPage` deja de sondear al llegar a cualquiera de ellos.

## "Mis órdenes" — sin endpoint de listado

El backend no tiene ningún `GET /api/customers/{id}/orders` ni equivalente. `httpOrderRepository.listOrders` mantiene un índice local por cliente (`orderIndex.ts`, `localStorage: sgo-order-ids-<customerId>`), poblado al crear cada orden (`createOrder`), y consulta el estado real de cada una con `GET /api/orders/{id}`. Esto es un índice de conveniencia del navegador, no autorización real — el endpoint de consulta de una orden sigue abierto para cualquier id, igual que el resto de la API hoy.

## Identificación / reidentificación (PB-009)

Sigue sin ser un endpoint de Order/Checkout — ver `customer-service.md`. Sin cambios respecto a la fase anterior.

# Contrato asumido — Order / Checkout Service (vía BFF)

> Consumido hoy por `mockOrderRepository` (`src/features/orden/api/orderRepository.mock.ts`).

## `POST /bff/orders`

Crea una orden a partir del carrito confirmado (PB-004).

**Request**
```json
{
  "customerId": "string",
  "items": [{ "productId": "string", "cantidad": 0, "precioUnitario": 0 }],
  "metodoEntrega": "centro_distribucion | tienda | recogida"
}
```

**Response 201**
```json
{
  "id": "SGO-000001",
  "customerId": "string",
  "items": [{ "productId": "string", "nombre": "string", "sku": "string", "cantidad": 0, "precioUnitario": 0 }],
  "total": 0,
  "metodoEntrega": "centro_distribucion | tienda | recogida",
  "estado": "pendiente_pago",
  "creadaEn": "ISO-8601"
}
```

Se asume que el backend reserva el inventario (Inventory Service) como parte de esta misma llamada, antes de responder — el mock no simula ese paso porque ya se validó disponibilidad al agregar al carrito (CDU-01).

## `GET /bff/orders/{id}`

Consulta el estado de una orden — versión mínima hoy (solo lo necesario para PB-004: eco de lo creado). La vista consolidada completa (pago, despacho, entrega, incidencias) es PB-025, todavía no implementada.

**Response 200:** mismo shape que la creación.
**Response 404:** orden no encontrada.

## Identificación / reidentificación (PB-009)

No es un endpoint de Order/Checkout — se asume que Customer Service es quien resuelve la identidad del cliente por sesión, teléfono o cuenta, y que el frontend solo necesita saber "sí/no" para decidir si pide reidentificación. El mock simula la reidentificación con un formulario manual (nombre + teléfono) disparado por un control en la sidebar ("¿No eres tú?"), ya que no hay canales reales que forzar el escenario. Falta que Customer Service confirme el mecanismo real de detección.

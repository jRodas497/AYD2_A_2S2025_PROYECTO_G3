# Contrato asumido — Payment Service (vía BFF)

> Consumido hoy por `mockPaymentRepository` (`src/features/pago/api/paymentRepository.mock.ts`).

## Regla de seguridad (DC-08 / RC06 de Fase 1)

El frontend **nunca envía ni persiste el número completo de tarjeta ni el CVV**. El formulario de pago limpia esos campos de su estado en cuanto se envía el intento; solo se usan los últimos 4 dígitos para identificar el método en la UI. Se asume que el token/referencia real de la pasarela (PayKlik) lo genera y guarda el backend — el frontend nunca lo ve ni lo necesita.

## `POST /bff/orders/{id}/payments`

Registra un intento de cobro para una orden.

**Request**
```json
{
  "metodo": "tarjeta | transferencia | billetera",
  "tarjeta": { "ultimosDigitos": "0000" }
}
```

**Response 200**
```json
{
  "id": "PAY-000001",
  "orderId": "SGO-000001",
  "metodo": "tarjeta",
  "resultado": "aprobado | en_proceso | rechazado",
  "motivo": "string | null",
  "fecha": "ISO-8601"
}
```

## Estados y reglas asumidas

- **`aprobado`**: la orden pasa a `pagada` de inmediato.
- **`en_proceso`**: la orden pasa a `pago_en_proceso`; el backend resuelve el resultado de forma asíncrona (Outbox + Circuit Breaker, ADR-0002) y el frontend debe re-consultar la orden hasta ver el cambio — no hay webhook/push al frontend en este contrato, por eso `OrderStatusPage` hace polling cada 2s en vez de esperar una notificación. **Supuesto a validar con Backend**: si el BFF expone un mecanismo de push (SSE/WebSocket), el polling se puede reemplazar sin tocar el resto de la UI.
- **`rechazado`**: la orden vuelve a `pendiente_pago` (para permitir reintento con otro método, PB-013) — salvo que se alcance el máximo de intentos fallidos, caso en el que pasa a `pago_fallido` (fallido definitivo, PB-014).
- **Máximo de reintentos fallidos**: el mock usa `3` como placeholder fijo (`mockPaymentRepository.maxIntentosFallidos`). El valor real lo controla el backend — falta que Payment Service confirme el número y si es configurable por tipo de orden o global.

## Datos mágicos usados por el mock (ver también `escenarios-mock.md`)

- Tarjeta terminada en `0000` → rechazo inmediato con motivo "Fondos insuficientes".
- Tarjeta terminada en `1111` → `en_proceso`, resuelve a `aprobado` tras ~4s.
- Cualquier otro método o tarjeta → `aprobado` inmediato.

# Contrato real — Payment Service

> Consumido por `httpPaymentRepository` (`src/features/pago/api/paymentRepository.http.ts`). Documentado en detalle en `FASE 2/backend/API-Transacciones.md`.

## Regla de seguridad (DC-08 / RC06 de Fase 1)

Sigue vigente: el frontend nunca envía ni persiste el número completo de tarjeta ni el CVV. Contra el backend real esto además es una regla que el propio backend hace cumplir: si el cuerpo trae un campo `cardNumber`, o si `cardToken` contiene algo que parece un número de tarjeta, responde `400` sin guardar nada. Como no existe un widget real de PayKlik en este entorno, `httpPaymentRepository` genera un token simulado (`tok_<aleatorio>`) que nunca deriva del número ingresado — simula el límite que tendría un formulario real de la pasarela.

## `POST /api/orders/{orderId}/payments`

**Request**
```json
{ "method": "CARD", "cardToken": "tok_demo123", "cardLast4": "4242" }
```
`method` es opcional (`CARD` por defecto): `CARD`, `TRANSFER` o `WALLET` — mapeado desde `tarjeta`/`transferencia`/`billetera`. `cardToken` es obligatorio; `cardLast4` obligatorio si el método es `CARD`.

**Response 201**
```json
{ "orderId": 12, "attemptNumber": 1, "result": "APPROVED", "orderStatus": "PAID", "providerReference": "PK-899B2F4A", "latencyMs": 81, "message": "cobro aprobado" }
```
`404` si la orden no existe. `409` si ya está pagada, tiene un cobro en proceso, o está cancelada/devuelta.

## Mapeo de resultado

| Backend `result` | Frontend `ResultadoCobro` | `orderStatus` real |
|---|---|---|
| `APPROVED` | `aprobado` | `PAID` |
| `DECLINED` | `rechazado` | `PAYMENT_FAILED` |
| `TIMEOUT` | `en_proceso` | `PAYMENT_IN_PROGRESS` |
| `ERROR` | `en_proceso` | `PAYMENT_IN_PROGRESS` |

`TIMEOUT`/`ERROR` no deben tratarse como fallo — el backend reintenta el cobro solo (cola de contingencia); el frontend solo debe dejar la orden visible y seguir sondeando `GET /api/orders/{id}` (`OrderStatusPage` ya lo hace).

## `GET /api/orders/{orderId}/payments` — historial de intentos

```json
[{ "id": 1, "attemptNumber": 1, "result": "ERROR", "amount": 4200.00, "providerReference": null, "cardLast4": "4242", "failureReason": "PayKlik no respondió a la solicitud de cobro", "latencyMs": 0, "attemptedAt": "2026-09-23T04:36:20Z" }]
```
`httpPaymentRepository.countIntentosFallidos` cuenta los elementos con `result: "DECLINED"`.

## Límite de reintentos (PB-014) — regla de frontend, no del backend

**El backend no tiene un concepto de "fallido definitivo".** Un solo `DECLINED` ya deja la orden en `PAYMENT_FAILED`, y nada impide un nuevo intento después (el propio backend dice "puede reintentar con otro método"). PB-014 exige un máximo de reintentos con un estado terminal — `maxIntentosFallidos = 3` se mantiene como una regla de negocio aplicada enteramente en el frontend (`PaymentPage`), contando los `DECLINED` reales del historial (`GET /api/orders/{orderId}/payments`), no el estado crudo de la orden. Esto es una decisión de producto, no una limitación técnica: el backend permitiría seguir intentando indefinidamente.

## Forzar escenarios de fallo para pruebas/demo

Como ya no existen las tarjetas "mágicas" del mock (`0000` rechaza, `1111` deja en proceso), los escenarios de rechazo/timeout se fuerzan cambiando el modo del simulador de PayKlik (fuera del frontend, vía Postman/curl):
```
PUT /api/simulation/payklik
{ "mode": "REJECT" }   // próximo cobro: DECLINED
{ "mode": "DOWN" }     // próximo cobro: se cae, entra a la cola de contingencia (PAYMENT_IN_PROGRESS)
{ "mode": "NORMAL" }   // vuelve a la normalidad
```
Ver `FASE 2/backend/API-Transacciones.md`, sección "Simulación de terceros".

# Contrato real — Customer Service

> Consumido por `httpCustomerRepository` (`src/features/cliente/api/customerRepository.http.ts`), vía el proxy de Vite (`/api/*` → `http://localhost:8080`).

## `GET /api/customers/{id}`

```json
{ "id": 1, "fullName": "Cliente de prueba 1", "email": "cliente1@example.com", "phone": "50200000001", "taxId": "CF", "address": "Zona 2, Ciudad de Guatemala", "createdAt": "2026-09-22T04:03:01Z" }
```
`404` si no existe — el frontend lo traduce a `null`. El frontend solo usa `fullName` (→ `nombre`) y `phone` (→ `telefono`); `email`/`taxId`/`address`/`createdAt` no se usan todavía.

## `POST /api/customers`

```json
{ "fullName": "Cliente de prueba", "email": "correo@example.com", "phone": "50200000000", "address": "Zona 1" }
```
`fullName` es obligatorio; el frontend nunca manda `email` ni `address` (no los captura en ningún formulario todavía). `201` con el cliente creado.

## `PUT /api/customers/{id}`

Mismo cuerpo que crear. `200` con el cliente actualizado, `404` si no existe.

## Identidad del cliente en el frontend

El frontend no tiene login: al abrir la app por primera vez en un navegador, si no hay un id de cliente guardado en `localStorage` (clave `sgo-customer-id`), crea un cliente real con `POST /api/customers` (`fullName: "Cliente invitado"`) y guarda el id devuelto. Las siguientes visitas reutilizan ese id. El flujo "¿No eres tú?" de la barra lateral llama `PUT /api/customers/{id}` para actualizar el nombre/teléfono del mismo registro — no crea un cliente nuevo.

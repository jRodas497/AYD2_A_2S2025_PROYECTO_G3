# Datos de seed

Qué carga cada migración de `FASE 2/db/migrations/` que siembra datos de prueba (no las de
esquema o seguridad, que no insertan datos de demo). Se cargan solas la primera vez que se crea
la base — con `FASE 2/iniciar.sh` y `RESET_SEED=true` en `.env` se borra y se recrea desde cero
en cualquier momento (detalle en `FASE 2/README.md`).

## SEED_1 incluye: datos base del catálogo y la operación (`V2__datos_de_prueba.sql`)

- **Parámetros del sistema** (`config.setting`): `reservation.ttl_minutes` (20 — ver nota abajo),
  `erp.batch_interval_minutes` (30), `payment.timeout_ms` (5000).
- **Ubicaciones**: 2 centros de distribución (`CD-01`, `CD-02`) y 32 tiendas (`T-01` a `T-32`).
- **Catálogo**, 12 productos en 4 categorías:

  | SKU | Nombre | Categoría | Precio |
  |---|---|---|---|
  | LB-001 | Refrigeradora 300 L | Línea blanca | Q 4,200.00 |
  | LB-002 | Lavadora 18 kg | Línea blanca | Q 3,500.00 |
  | LB-003 | Estufa de 4 quemadores | Línea blanca | Q 2,100.00 |
  | EL-001 | Televisor 55 pulgadas | Electrónica | Q 3,900.00 |
  | EL-002 | Laptop 14 pulgadas | Electrónica | Q 5,600.00 |
  | EL-003 | Audífonos inalámbricos | Electrónica | Q 450.00 |
  | RO-001 | Camisa manga larga | Ropa | Q 180.00 |
  | RO-002 | Pantalón de mezclilla | Ropa | Q 260.00 |
  | RO-003 | Chumpa impermeable | Ropa | Q 390.00 |
  | CA-001 | Zapatos deportivos | Calzado | Q 520.00 |
  | CA-002 | Zapatos de vestir | Calzado | Q 480.00 |
  | CA-003 | Sandalias | Calzado | Q 150.00 |

- **Stock**: los 12 productos en las 34 ubicaciones (408 filas) — 200 unidades en cada centro de
  distribución, entre 10 y 24 en cada tienda (varía según la ubicación y el producto).
- **100 clientes de prueba sin cuenta**: `Cliente de prueba 1` a `Cliente de prueba 100`,
  correo `cliente1@example.com` a `cliente100@example.com`, teléfono y dirección de ejemplo.
  Sirven para listados y búsquedas del backoffice (`/administracion/clientes`), pero no tienen
  contraseña — no se puede iniciar sesión con ellos como cliente (ver SEED_3).

Nota: `reservation.ttl_minutes` queda en 20 tal cual arranca la base, porque
`V8__reserva_de_20_minutos.sql` corrige el valor que esta migración sembraba (15) para que
coincida con lo que el equipo confirmó en la Fase 1.

## SEED_2 incluye: personal interno (`V7__usuario_de_prueba.sql`)

- 1 usuario de personal con rol `ADMIN`: usuario `admin`, contraseña `admin123`. Único usuario
  de personal que siembra la base — el resto se crea desde `/administracion/configuracion` (o
  `POST /api/users`), ya logueado como `admin`.

## SEED_3 incluye: cuentas de cliente con login real (`V9__cuentas_de_cliente.sql`)

5 cuentas de cliente de la tienda, con historial de compras distinto cada una a propósito
(para poder entrar con usuarios distintos y ver carrito, compras, facturas y crédito propios de
cada uno). Contraseña **`cliente123`** para las cinco.

| Correo | Nombre | Compras entregadas | Total | Otro |
|---|---|---|---|---|
| `maria@example.com` | María López | Refrigeradora 300 L (×1), Laptop 14 pulgadas (×1), Audífonos inalámbricos (×2) | Q 10,700.00 | — |
| `lucia@example.com` | Lucía Fernández | Lavadora 18 kg (×1), Estufa de 4 quemadores (×1), Pantalón de mezclilla (×2), Sandalias (×2) | Q 6,420.00 | — |
| `ana@example.com` | Ana Gómez | Camisa manga larga (×3), Zapatos deportivos (×1) | Q 1,060.00 | Devolución registrada y resuelta sobre los Zapatos deportivos (defecto de fábrica) |
| `carlos@example.com` | Carlos Pérez | — | Q 3,900.00 pendiente | 1 Televisor 55 pulgadas (×1), pago rechazado por fondos insuficientes — sin factura ni envío |
| `jorge@example.com` | Jorge Ramírez | — | — | Cuenta nueva, sin ninguna compra todavía |

Cada compra entregada de María, Lucía y Ana quedó con su cadena completa: carrito convertido,
orden, cobro aprobado (tarjeta terminada en `4242`), factura aceptada por la SAT y envío
entregado con su evento de rastreo — para que el detalle de cada orden (`/ordenes/{id}`) se vea
completo, no solo el total.

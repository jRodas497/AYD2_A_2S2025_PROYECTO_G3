# Base de datos

PostgreSQL 16 con una sola base, `sgologic`, y un esquema por componente, como se decidió en el ADR-0001. La base es compartida, pero cada componente escribe solo en su esquema.

## Cómo levantarla

Desde la carpeta `FASE 2`:

```
docker compose up -d db
```

La primera vez, Postgres ejecuta los archivos de `db/migrations` en orden. Los datos quedan en un volumen, así que al reiniciar no se pierde nada. Para empezar de cero:

```
docker compose down -v
docker compose up -d db
```

Datos de conexión para desarrollo: `localhost:5432`, base `sgologic`, usuario `sgologic`, clave `sgologic_dev`. La clave se puede cambiar con la variable `DB_PASSWORD`.

## Qué guarda cada esquema

| Esquema | Contenido |
|---|---|
| `config` | Valores configurables: tiempo de reserva, intervalo del ERP, límite de latencia de PayKlik |
| `catalog` | Productos |
| `customers` | Clientes |
| `inventory` | Centros de distribución y tiendas, stock, movimientos y reservas temporales |
| `orders` | Carrito, órdenes, sus ítems e incidencias |
| `payments` | Cada intento de cobro |
| `invoicing` | Facturas XML y la respuesta de la SAT |
| `logistics` | Envíos y eventos de rastreo de LogiExpress |
| `notifications` | Avisos por SMS, correo y push |
| `integration` | Outbox, eventos hacia el POS y lotes para el ERP |
| `audit` | Registro de auditoría |

## Reglas que hace cumplir la base

- No se puede reservar más stock del que hay (`reserved <= on_hand`), aunque falle la lógica de la aplicación.
- `audit.audit_log` y `payments.payment_attempt` solo aceptan inserciones. Un `UPDATE`, `DELETE` o `TRUNCATE` da error.
- No existe ninguna columna para el número de tarjeta ni para el CVV. De la tarjeta solo se guarda la referencia de PayKlik y los últimos 4 dígitos.
- Una orden entra en un solo lote del ERP, así no se manda la misma venta dos veces.
- Un cliente solo puede tener un carrito activo, sin importar el canal.

## Datos de prueba

`V2__datos_de_prueba.sql` carga 2 centros de distribución, 32 tiendas, 12 productos con su stock, 100 clientes y los tres valores de `config`. Son datos de ejemplo. El tiempo de reserva de 15 minutos es un valor por defecto que se puede cambiar.

## Cuando el backend use Flyway

Los archivos ya siguen el nombre que Flyway espera (`V1__...`). Ese día hay que quitar el montaje de `docker-entrypoint-initdb.d` del compose para que las migraciones no corran dos veces.

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
| `config` | Valores configurables (tiempo de reserva, intervalo del ERP, límite de latencia de PayKlik) y los canales de venta |
| `catalog` | Productos y sus categorías |
| `customers` | Clientes |
| `inventory` | Centros de distribución y tiendas, stock, movimientos y reservas temporales |
| `orders` | Carrito, órdenes, sus ítems e incidencias |
| `payments` | Cada intento de cobro, y la vista `payment_audit` con el canal de la orden para Finanzas |
| `invoicing` | Facturas XML y la respuesta de la SAT |
| `logistics` | Envíos y eventos de rastreo de LogiExpress |
| `notifications` | Avisos por SMS, correo y push |
| `integration` | Outbox, eventos hacia el POS y lotes para el ERP, con la vista `erp_batch_summary` que cuenta sus órdenes y suma su monto |
| `audit` | Registro de auditoría |

## Reglas que hace cumplir la base

- No se puede reservar más stock del que hay (`reserved <= on_hand`), aunque falle la lógica de la aplicación.
- `audit.audit_log` y `payments.payment_attempt` solo aceptan inserciones. Un `UPDATE`, `DELETE` o `TRUNCATE` da error.
- No existe ninguna columna para el número de tarjeta ni para el CVV. De la tarjeta solo se guarda la referencia de PayKlik y los últimos 4 dígitos.
- Una orden entra en un solo lote del ERP, así no se manda la misma venta dos veces.
- Un cliente solo puede tener un carrito activo, sin importar el canal.
- Solo se puede reservar un producto que la orden realmente lleva.
- El POS solo recibe eventos de tiendas, nunca de un centro de distribución.

## Normalización

La estructura está en tercera forma normal: cada dato vive en un solo lugar y las demás tablas lo consultan por su llave. Por eso los canales y las categorías tienen su propia tabla, el carrito no guarda precios (salen del catálogo hasta que se crea la orden), el intento de cobro no repite el canal (se toma de la orden) y la cantidad y el monto de cada lote del ERP se calculan en una vista en lugar de guardarse.

Hay copias que se dejaron a propósito:

- `inventory.stock` guarda `on_hand` y `reserved` como contadores, para reservar de forma atómica sin recorrer todos los movimientos. Los movimientos y las reservas siguen ahí para poder cuadrarlos.
- `orders.purchase_order` guarda `total` y `delivery_address` tal como se acordaron al comprar. Si después cambia el precio o la dirección del cliente, la orden no cambia. Por lo mismo `orders.order_item` guarda el `unit_price` del momento y `notifications.notification` guarda el destinatario al que se mandó el aviso.
- `audit.audit_log` repite el canal y usa referencias sin llave foránea (`entity_type`, `entity_id`, `order_id`), para no depender de otras tablas y consultarse en menos de 1 segundo. `integration.outbox` usa el mismo tipo de referencia.

## Datos de prueba

`V2__datos_de_prueba.sql` carga 2 centros de distribución, 32 tiendas, 12 productos con su stock, 100 clientes y los tres valores de `config`. Son datos de ejemplo. El tiempo de reserva de 15 minutos es un valor por defecto que se puede cambiar.

## Cargar órdenes de prueba

Las migraciones dejan el catálogo, el stock y los clientes, pero ninguna orden. Con la base levantada, este script agrega órdenes y todo lo que las rodea: reservas, cobros, facturas, envíos, notificaciones, outbox, eventos del POS, lotes del ERP y auditoría.

```
./db/scripts/cargar-datos-de-prueba.sh          # 200 órdenes
./db/scripts/cargar-datos-de-prueba.sh 5000     # la cantidad que quieras
```

Las órdenes salen en todos los estados, desde pendientes de pago hasta devueltas, y con las fallas que el sistema tiene que tolerar: cobros de PayKlik con timeout y su reintento en el outbox, guías de LogiExpress sin número, mensajes que no salieron y eventos del POS sin entregar. Además hay clientes con un carrito abierto.

El stock sigue cuadrando con los movimientos. Si una tienda no tiene unidades para tantas ventas, el script registra una reposición antes de venderlas.

Cada corrida suma datos, no borra los anteriores. Con 20 000 órdenes tarda unos 16 segundos.

## Empezar de cero

La auditoría y los cobros no se pueden borrar, así que para limpiar la base hay que crearla de nuevo. Este script borra todo, levanta la base otra vez desde las migraciones y espera a que esté lista:

```
./db/scripts/reiniciar-base.sh          # pregunta antes de borrar
./db/scripts/reiniciar-base.sh -y       # sin preguntar
./db/scripts/reiniciar-base.sh -y 500   # sin preguntar y con 500 órdenes de prueba
```

## Cuando el backend use Flyway

Los archivos ya siguen el nombre que Flyway espera (`V1__...`). Ese día hay que quitar el montaje de `docker-entrypoint-initdb.d` del compose para que las migraciones no corran dos veces.

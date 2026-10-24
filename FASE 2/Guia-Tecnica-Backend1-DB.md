# Guía técnica: base de datos y Backend 1

Hernán Ávila, 9516085. Cubre el diseño de la base de datos y el núcleo comercial del backend de SGO-Logic: catálogo, clientes, inventario con reserva, carrito omnicanal, checkout, consulta de órdenes, incidencias y autenticación. Todo lo de aquí se probó contra el proyecto levantado en Docker.

## Alcance

| Área | Qué se construyó | Dónde está |
|---|---|---|
| Base de datos | Modelo completo, 11 esquemas, 41 tablas, 3 vistas, migraciones V1 a V7 | `db/migrations`, `db/README.md` |
| Seguridad de datos | Rol de aplicación sin superusuario, auditoría de solo inserción, guardia de tarjetas | V4, V5, V6, ADR-0006 |
| Catálogo | Consultar, crear y editar productos, con existencia inicial en las 34 ubicaciones | `catalog/` |
| Clientes | Crear, consultar y modificar | `customers/` |
| Inventario | Reserva atómica, liberación automática, disponibilidad consolidada | `inventory/` |
| Carrito y checkout | Carrito único por cliente entre canales, checkout transaccional | `orders/` |
| Consulta de orden | Estado completo de la orden, despacho y entrega | `orders/OrderQueryService.java` |
| Incidencias | Registrar, listar y procesar cambios y devoluciones | `orders/Incident*` |
| Autenticación | Login con JWT, usuario sembrado, rutas de administrador protegidas | `auth/`, V7 |
| Contenedores | Dockerfile del backend, docker-compose con healthcheck | `backend/Dockerfile`, `docker-compose.yml` |

Las rutas de código son relativas a `backend/src/main/java/com/sgologic/`.

## Levantar el entorno

Desde `FASE 2`:

```bash
docker compose up -d --build backend
```

El compose levanta primero Postgres 16 y espera su healthcheck (`pg_isready`) antes de arrancar el backend. La primera vez, Postgres corre las migraciones de `db/migrations` en orden. El puerto de la base solo se publica en `127.0.0.1`.

Para empezar desde cero, borrando todos los datos:

```bash
./db/scripts/reiniciar-base.sh -y
```

Las migraciones solo corren sobre un volumen vacío. Si la base ya existía y se agrega una migración nueva, hay que aplicarla a mano o reiniciar la base.

## Modelo de datos

Es una sola base, `sgologic`, con un esquema por componente del diagrama de la Fase 1 (ADR-0001):

| Esquema | Tablas de datos |
|---|---|
| `catalog` | product |
| `customers` | customer |
| `inventory` | location, stock, reservation, stock_movement |
| `orders` | cart, cart_item, purchase_order, order_item, incident |
| `payments` | payment_attempt |
| `invoicing` | invoice |
| `logistics` | shipment, tracking_event |
| `notifications` | notification |
| `integration` | outbox, pos_event, erp_batch, erp_batch_order |
| `audit` | audit_log |
| `config` | setting, app_user, user_role |

Las decisiones que sostienen el modelo:

- **Esquemas en lugar de bases separadas.** El checkout reserva stock y crea la orden en una sola transacción. Con bases separadas eso exigiría sagas o two-phase commit. Los esquemas mantienen la frontera entre componentes y permiten separarlos después.
- **Tablas de referencia en lugar de enums de Postgres.** Todo valor de conjunto fijo (canal, estado, tipo) vive en una tabla con `id`, `code` y `name`, y las tablas de datos guardan el id con llave foránea. Hay 17 tablas de este tipo. Agregar un estado es un insert, no un cambio de tipo. En Java, cada tabla tiene un enum con los mismos ids y un converter JPA.
- **`search_path` con todos los esquemas.** Así los demás integrantes pueden consultar sin prefijar el esquema. Los nombres de tabla no se repiten entre esquemas.
- **Valores de negocio en `config.setting`.** Minutos de reserva (20), timeout de PayKlik (5000 ms) e intervalo del ERP (30 min). Se cambian sin reiniciar el backend.

El diagrama está en `image/Diagrama-Entidad-Relacion-SGO-Logic-Fase2.png`. Su fuente es `db/Diagrama-Entidad-Relacion-SGO-Logic-Fase2.dot` y se regenera con:

```bash
dot -Tpng -Gdpi=150 db/Diagrama-Entidad-Relacion-SGO-Logic-Fase2.dot -o image/Diagrama-Entidad-Relacion-SGO-Logic-Fase2.png
```

## Seguridad en la base

El backend no se conecta como dueño de las tablas. Usa `sgologic_app`, un rol con permisos de lectura y escritura sobre los datos pero sin poder alterar ni borrar tablas (ADR-0006). Sin eso, cualquier error o vulnerabilidad en el backend podría desactivar los triggers que protegen la auditoría.

| Protección | Cómo se implementa |
|---|---|
| Auditoría inmutable | Triggers `audit_log_no_update_delete` y `payment_attempt_no_update_delete` rechazan UPDATE y DELETE |
| Sin tarjeta completa | No hay columna para el número; la restricción `no_card_number` rechaza números con forma de tarjeta en los textos libres de auditoría, cobros y outbox |
| Mínimo privilegio | `sgologic_app` no es superusuario ni dueño; su contraseña se asigna en V6 desde una variable de entorno |
| Superficie de red | Postgres publicado solo en `127.0.0.1` |

Demostración:

```bash
docker exec sgologic-db psql -U sgologic_app -d sgologic -c "update audit.audit_log set actor='x' where id=1"
docker exec sgologic-db psql -U sgologic_app -d sgologic -c "drop table audit.audit_log"
docker exec sgologic-db psql -U sgologic_app -d sgologic -c "begin; insert into audit.audit_log(actor,action,entity_type,entity_id,details) values('x','PRUEBA','t','1','{\"nota\":\"4111 1111 1111 1111\"}'); rollback;"
```

Resultados esperados, en orden: `permission denied for table audit_log`, `must be owner of table audit_log` y `violates check constraint "no_card_number"`.

## Reserva de inventario

La atomicidad la garantiza la base, no Java. `InventoryReservationService` reserva con un único UPDATE condicional por ubicación:

```sql
update inventory.stock
set reserved = reserved + ?, updated_at = now()
where location_id = ? and product_id = ? and on_hand - reserved >= ?
```

Si el UPDATE afecta una fila, la reserva quedó hecha. Si afecta cero, otra transacción se adelantó y se prueba la siguiente ubicación candidata. Dos checkouts simultáneos sobre la misma fila se serializan en Postgres y el segundo ve el stock ya descontado. Además, la restricción `no_oversell` (`reserved <= on_hand`) en `stock` impide la sobreventa aunque el código tuviera un error.

Cada reserva queda en `inventory.reservation` con `expires_at`. `ReservationExpiryJob` corre cada 30 segundos, pasa a EXPIRED las reservas activas vencidas y devuelve las unidades al stock.

Demostración:

```bash
cd "FASE 2/pruebas" && python3 prueba_reserva_concurrente.py
```

Lanza 80 checkouts simultáneos sobre el mismo producto. El resultado esperado es una parte en 201 y el resto en 409 por falta de stock, cero ubicaciones con reservado mayor a la existencia, y el cierre `SIN SOBREVENTA`.

## Carrito omnicanal y checkout

Un cliente tiene un solo carrito activo sin importar el canal. Lo garantiza un índice único parcial:

```sql
create unique index one_active_cart_per_customer on orders.cart (customer_id) where status_id in (1, 2);
```

Los estados 1 y 2 son OPEN e IN_CHECKOUT. Si dos peticiones intentan crear el carrito a la vez, la segunda choca con el índice y `CartController` reintenta leyendo el carrito que ya existe. El carrito guarda el último canal usado.

`CheckoutService.checkout` es una sola transacción:

- Toma el carrito activo y rechaza con 400 si está vacío.
- Crea la orden en PENDING_PAYMENT con sus líneas y el precio del momento.
- Reserva cada producto con el tiempo de `reservation.ttl_minutes`.
- Pasa el carrito a CONVERTED.

Si cualquier reserva falla, la transacción entera se revierte y la respuesta es 409.

Demostración del carrito entre canales:

```bash
B=http://127.0.0.1:8080
CID=$(curl -s -X POST $B/api/customers -H 'Content-Type: application/json' -d '{"fullName":"Demo canales"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -s -X POST $B/api/customers/$CID/cart/items -H 'Content-Type: application/json' -d '{"productId":1,"quantity":1,"channel":"WEB"}'
curl -s -X POST $B/api/customers/$CID/cart/items -H 'Content-Type: application/json' -d '{"productId":3,"quantity":2,"channel":"CALL_CENTER"}'
curl -s $B/api/inventory/products/1/availability
```

Las dos respuestas del carrito traen el mismo `cartId` con ambos productos. La disponibilidad trae `totalAvailable` y el detalle por centro de distribución y tienda.

## Incidencias y autenticación

Registrar una incidencia es abierto para atención al cliente. Procesarla exige sesión. `SecurityConfig` protege:

| Ruta | Requiere |
|---|---|
| `POST /api/products`, `PUT /api/products/{id}` | Rol ADMIN |
| `PUT /api/incidents/{id}/status` | Cualquier sesión válida |

El login (`POST /api/auth/login`) valida la contraseña con BCrypt y emite un JWT firmado, válido por 480 minutos. La clave se toma de `JWT_SECRET`. El usuario de desarrollo es `admin` / `admin123`, sembrado en V7. La sesión es stateless y los errores 401 y 403 salen con el mismo formato JSON que el resto de la API.

Reglas del procesamiento:

- **Auditoría:** cada registro y cada cambio de estado queda en la auditoría con el actor. Es el usuario del token o, si no hay sesión, `atencion-al-cliente`.
- **Devolución resuelta:** si la orden ya estaba cobrada, pasa a RETURNED.
- **Incidencia cerrada:** una incidencia RESOLVED o REJECTED no se reabre y responde 409.
- **Aviso al cliente:** el cliente recibe una notificación al registrar y al cerrar.

Demostración en Postman, con la colección y el entorno de `backend/postman`:

| Paso | Resultado |
|---|---|
| "Registrar incidencia" tipo RETURN sobre una orden despachada | 201 |
| "Procesar incidencia" sin token | 401 |
| "Iniciar sesión" con admin / admin123 | El token queda en el entorno |
| "Procesar incidencia" a RESOLVED | 200, la orden pasa a RETURNED |
| "Procesar incidencia" a IN_PROCESS | 409 |

Verificación en la auditoría:

```bash
docker exec sgologic-db psql -U sgologic -d sgologic -c "select actor, action, occurred_at from audit.audit_log where entity_type='incident' order by id desc limit 4"
```

## Endpoints

| Método y ruta | Uso |
|---|---|
| `POST /api/auth/login` | Iniciar sesión |
| `GET /api/products`, `GET /api/products/{id}` | Catálogo |
| `POST /api/products`, `PUT /api/products/{id}` | Crear y editar producto (ADMIN) |
| `POST /api/customers`, `GET` y `PUT /api/customers/{id}` | Clientes |
| `GET /api/inventory/products/{id}/availability` | Disponibilidad consolidada |
| `GET /api/customers/{id}/cart` | Ver carrito |
| `POST /api/customers/{id}/cart/items` | Agregar producto indicando canal |
| `POST /api/orders/checkout` | Confirmar compra |
| `GET /api/orders/{id}` | Estado completo de la orden |
| `POST` y `GET /api/orders/{orderId}/incidents` | Registrar y listar incidencias |
| `GET /api/incidents/{id}` | Ver incidencia |
| `PUT /api/incidents/{id}/status` | Procesar incidencia (sesión) |

Todos los errores responden con el mismo cuerpo: `timestamp`, `status`, `error`, `message` y `path`. El detalle completo está en `backend/API.md`.

## Limitaciones conocidas

- **Roles del personal:** existen seis, pero solo ADMIN tiene usuario y reglas de acceso. Auditoría, reportes y el simulador de terceros no piden sesión, y está registrado como pendiente en la matriz de trazabilidad.
- **Estados sin flujo:** ABANDONED del carrito, RELEASED de la reserva y CANCELLED de la orden están en el modelo, pero ningún flujo los asigna todavía.
- **`createdAt` nulo:** la respuesta de crear una orden o una incidencia trae `createdAt` en null, aunque en la base queda guardada. Al consultarlas después aparece correcta.
- **Un solo contenedor:** el backend es un despliegue único con un módulo por componente. La desviación respecto a contenedores separados está justificada en el ADR-0009.

# Backend

Java 21 + Spring Boot. Todos los componentes corren en un solo contenedor, cada uno como un paquete propio con su propio esquema en la base. El ADR-0001 pedía contenedores independientes por componente; el MVP los junta para que el checkout pueda crear la orden y reservar el stock en una sola transacción, y la decisión está registrada en el [ADR-0009](../DDA/ADR/0009-alcance-de-despliegue-del-mvp.md). Backend 1 y Backend 2 son dos partes del reparto de trabajo dentro de la misma aplicación, no dos servicios.

- **Núcleo comercial (Backend 1):** catálogo, clientes, inventario y órdenes/carrito.
- **Transacciones e integraciones (Backend 2):** pagos, facturación, logística, notificaciones, auditoría e integraciones con PayKlik, la SAT, LogiExpress, el POS y el ERP-Core.

## Cómo levantarlo

Desde `FASE 2`, con la base ya definida en `docker-compose.yml`:

```
docker compose up -d --build backend
```

Levanta también `db` si no estaba corriendo (depende de que la base esté sana). Queda escuchando en `http://127.0.0.1:8080`.

Se conecta con el rol `sgologic_app`, nunca con `sgologic`. Ver `FASE 2/db/README.md` para las credenciales de desarrollo.

## Qué hace cada paquete

| Paquete | Responsabilidad |
|---|---|
| `catalog` | Productos (RF: catálogo) |
| `customers` | Clientes |
| `inventory` | Ubicaciones, reserva atómica de stock (RF04) y el job que libera reservas vencidas |
| `orders` | Carrito unificado (RF01), checkout y consulta de estado de orden (RC01) |
| `config` | Lectura de `config.setting` (por ejemplo el TTL de la reserva) |
| `payments` | Cobro con PayKlik (RF: pagos), circuit breaker y cola de contingencia (CDU-02) |
| `invoicing` | Factura electrónica con CUI y serie, y su envío a la SAT (CDU-03) |
| `logistics` | Punto de despacho, guía con LogiExpress y rastreo (CDU-04) |
| `notifications` | Avisos al cliente, desacoplados del flujo de la orden |
| `integration` | El outbox que hace de broker, los eventos hacia el POS y los lotes del ERP (CDU-07) |
| `audit` | Registro de auditoría y los reportes de Finanzas |
| `external` | Los adaptadores de los terceros: PayKlik, SAT, LogiExpress, mensajería y POS |

Las tablas de referencia (canal, estado de orden, etc.) no tienen una entidad JPA por tabla: son enums de Java con el mismo id fijo que ya documenta `FASE 2/db/README.md`, convertidos con un `AttributeConverter`. Evita 17 tablas de referencia adicionales para algo que no cambia.

## La reserva de stock, en corto

`InventoryReservationService.reserve(...)` no decide el punto óptimo de despacho — esa decisión es de Logistics Service, después de facturar (CDU-04). Aquí solo se elige una ubicación con existencia (centros de distribución primero) y se reserva de forma atómica: un `UPDATE ... WHERE on_hand - reserved >= :cantidad` que solo afecta una fila si de verdad hay existencia. Si no la hay, se prueba la siguiente ubicación candidata; si ninguna alcanza, se lanza `InsufficientStockException` (409) y toda la orden se revierte — no queda una orden a medio reservar.

## Del cobro a la entrega, sin que nadie lo empuje

Después del checkout, lo único que hay que llamar es el cobro. De ahí en adelante el flujo
avanza solo, paso a paso, a través del outbox:

```
POST /api/orders/{id}/payments
        │
        ├─ aprobado ──> OrderPaid ──> factura ──> la SAT acepta ──> OrderInvoiced ──> despacho ──> guía
        │                                                                                  │
        └─ PayKlik no responde ──> PaymentRetryRequested ──> se reintenta solo              └─> avisos
```

`integration.outbox` es el broker del MVP: el evento se guarda en la **misma transacción** que
el cambio de estado que lo origina, así que no puede existir una orden pagada sin su evento de
facturación, ni un evento de algo que al final no pasó. Un repartidor (`OutboxDispatcher`) los
entrega cada 2 segundos, con espera creciente entre reintentos; lo que se agota queda en
`FAILED` con su último error, visible en `GET /api/integration/outbox?status=FAILED`.

El porqué de no montar RabbitMQ o Kafka para esto está en el [ADR-0007](../DDA/ADR/0007-outbox-en-la-base-como-broker-del-mvp.md).

## Cuando un tercero falla

Cada integración recibe el nivel de resiliencia que su impacto de negocio justifica, como
decidieron el ADR-0002 y el ADR-0004:

| Tercero | Si falla |
|---|---|
| PayKlik | La orden queda en `PAYMENT_IN_PROGRESS` y el cobro se reintenta solo. Tras 3 fallas seguidas el circuito abre y ya ni se intenta, para no dejar al cliente esperando. La orden nunca se pierde. |
| SAT | La orden se queda retenida antes de despacho. Es la regla dura: ninguna mercancía sale sin factura aceptada. Al agotarse los reintentos queda escalada en la auditoría. |
| LogiExpress | El despacho se hace igual y el inventario baja; lo que falta es la guía. El envío queda listado en `GET /api/shipments?status=GUIDE_REQUESTED` como alerta para Logística. |
| Mensajería | Solo se pierde el aviso. Confirmar, pagar, facturar y despachar siguen igual. |
| POS de una tienda | Los eventos se acumulan pendientes y se entregan cuando la tienda vuelve. Al cerrar cada ventana del ERP, las 32 tiendas reciben la existencia consolidada (paso 10 del flujo principal). |
| Carpeta del AS/400 | El lote queda `PENDING` con sus órdenes ya asignadas y se reentrega cada minuto hasta que el archivo llegue. Nunca se duplica una venta. |

Los seis son simuladores: no hay un PayKlik ni una SAT reales contra los cuales integrarse. Cada
uno vive detrás de su propio `*Client` en `external`, que es el único archivo que cambia el día
que el proveedor exista ([ADR-0008](../DDA/ADR/0008-terceros-simulados-tras-un-adaptador.md)).
Su comportamiento se cambia en caliente desde `/api/simulation` para demostrar los escenarios de
falla sin reiniciar nada.

## Pruebas de los escenarios de calidad

`FASE 2/pruebas/` tiene tres scripts ejecutables —reserva concurrente sin sobreventa, tiempos de
respuesta bajo carga y el flujo completo con volumen— con los resultados medidos. Ver
[`pruebas/README.md`](../pruebas/README.md).

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/products` | Catálogo activo |
| GET | `/api/products/{id}` | Un producto |
| GET | `/api/customers/{id}` | Un cliente |
| POST | `/api/customers` | Crear cliente |
| GET | `/api/inventory/products/{id}/availability` | Existencia consolidada por ubicación (RF03) |
| GET | `/api/customers/{id}/cart` | Ver el carrito activo (sin crear ni tocar el canal) |
| POST | `/api/customers/{id}/cart/items` | Agregar un ítem (crea el carrito si no existe) |
| PUT / DELETE | `/api/customers/{id}/cart/items/{productId}` | Cambiar la cantidad o quitar un ítem |
| GET | `/api/customers/{id}/orders` · `/history` | Historial del cliente: órdenes e incidencias |
| POST | `/api/inventory/movements` | Entrada o salida de mercancía; avisa al POS si es una tienda |
| POST | `/api/inventory/adjustments` | Ajuste por conteo físico que reporta el POS (CDU-08, E2) |
| POST · PUT | `/api/orders/{id}/incidents` · `/api/incidents/{id}/status` | Registrar y procesar un cambio o devolución (procesar requiere sesión) |
| POST | `/api/orders/checkout` | Convierte el carrito en orden, reserva stock |
| GET | `/api/orders/{id}` | Estado completo de la orden (RC01, `orders.order_overview`) |

Los de transacciones e integraciones están documentados aparte, en [`API-Transacciones.md`](API-Transacciones.md):
cobro y sus intentos, factura y su XML, envío y rastreo, avisos, auditoría y trazabilidad,
reportes de Finanzas, lotes del ERP, eventos del POS y salud de las integraciones.

## Los archivos para el ERP

El adaptador del ERP escribe los CSV/XML en `/app/erp-out` dentro del contenedor, montado como
`FASE 2/erp-out/` afuera. Son salida, no fuente: están en `.gitignore`.

## Lo que falta a propósito

No incluye, de los CDU de la Fase 1: el reembolso de una devolución ni su aprobación por Finanzas arriba de USD 500 (CDU-05; la atención se registra y resuelve, pero no extiende el flujo de pago), la recogida en tienda como método de entrega (CDU-04), la sugerencia de un producto alternativo cuando no hay existencia (CDU-01, 2a) ni la reidentificación del cliente al cambiar de canal (CDU-01, E2, depende del login). Tampoco el CRUD completo de catálogo (crear/editar producto).

Del lado del ERP, el adaptador manda las ventas facturadas pero no las devoluciones (el ADR-0003 las incluía): una orden devuelta después de conciliada no genera un registro de ajuste para el AS/400. Y no hay un canal de respuesta del AS/400, así que un lote que el ERP rechace por formato no se detecta automáticamente (CDU-07, E1). El enunciado prioriza el camino feliz de la demo; con el tiempo que quedó para la Fase 2, esto se dejó fuera a propósito, no por descuido.

La autenticación es parcial: hay login con JWT (paquete `auth`, usuarios en `config.app_user` con
bloqueo por intentos fallidos), pero solo se exige para crear o editar productos y para procesar
incidencias. Los endpoints de operación (auditoría, reportes, reintentos) y el de simulación
siguen públicos, y en un despliegue real no deberían estarlo. Es la deuda más grande que queda
abierta.

El envío guarda un solo origen por orden. Si la reserva quedó repartida entre dos ubicaciones,
el inventario baja en la ubicación real de cada línea y el envío registra la principal — no se
parte en dos envíos.

El `createdAt` que devuelve el checkout en la respuesta sale `null`: la columna tiene su valor por `DEFAULT now()` en la base y Hibernate no lo relee después de insertar. La consulta de estado (`GET /api/orders/{id}`) sí trae el valor real, porque lee directo de la vista.

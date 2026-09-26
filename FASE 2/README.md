# SGO-Logic — Fase 2 (MVP)

Sistema de Gestión de Órdenes y Logística Omnicanal de MegaStore. Esta carpeta contiene el MVP de
la Fase 2: el backend, la base de datos, su despliegue con Docker y la documentación de
arquitectura actualizada.

El sistema cubre el flujo principal del enunciado de punta a punta: carrito unificado entre
canales, reserva de stock, cobro con PayKlik, factura electrónica para la SAT, despacho con
LogiExpress, avisos al cliente, conciliación con el ERP AS/400 y eventos hacia el POS de las 32
tiendas. Los terceros (PayKlik, SAT, LogiExpress, mensajería, POS y AS/400) no existen para
conectarse de verdad, así que están simulados detrás de un adaptador y se pueden hacer fallar a
propósito para demostrar la resiliencia.

## Qué hay en esta carpeta

| Carpeta | Contenido |
|---|---|
| [`backend/`](backend/) | Aplicación Java 21 + Spring Boot. [README](backend/README.md) · [API núcleo comercial](backend/API.md) · [API transacciones e integraciones](backend/API-Transacciones.md) · colección de Postman en `backend/postman/` |
| [`db/`](db/) | Migraciones de PostgreSQL, datos de prueba y scripts. [README](db/README.md) con el modelo de datos |
| [`pruebas/`](pruebas/) | Pruebas ejecutables de concurrencia, rendimiento y volumen, con sus resultados. [README](pruebas/README.md) |
| [`DDA/`](DDA/) | Documento de arquitectura de la Fase 2: drivers, restricciones, caso de acción, CDU expandidos, diagramas, matriz de trazabilidad y ADR 0006 a 0009 |
| `DRAWIO/`, `image/` | Diagramas editables y sus imágenes |
| `docker-compose.yml` | La base y el backend |

## Requisitos

- Docker Engine con el plugin Compose v2 (`docker compose version`).
- Los puertos `5432` y `8080` libres en `127.0.0.1` (se cambian con variables, ver abajo).
- Conexión a internet la primera vez, para descargar las imágenes y las dependencias de Maven.

No hace falta instalar Java, Maven ni PostgreSQL: todo se compila y corre dentro de los contenedores.

## Instalación y despliegue

Desde esta carpeta (`FASE 2`):

```
docker compose up -d --build
```

Eso levanta dos contenedores:

| Contenedor | Qué es | Puerto |
|---|---|---|
| `sgologic-db` | PostgreSQL 16. La primera vez corre las migraciones `db/migrations/V1` a `V8` y siembra 2 centros de distribución, 32 tiendas, 12 productos con su stock, 100 clientes y el usuario de desarrollo `admin` | `127.0.0.1:5432` |
| `sgologic-backend` | El backend. Espera a que la base esté sana antes de arrancar | `127.0.0.1:8080` |

La primera vez tarda unos minutos por la descarga de dependencias; después, segundos.

### Verificar que quedó arriba

```
docker compose ps                                   # los dos en "Up", la base en "(healthy)"
curl http://localhost:8080/api/products             # los 12 productos
curl http://localhost:8080/api/integration/health   # circuitos en CLOSED y colas en cero
```

### Recorrer el flujo principal

La forma más directa es la colección de Postman:

1. Importar `backend/postman/SGO-Logic-Backend.postman_collection.json` y el entorno
   `backend/postman/SGO-Logic-Local.postman_environment.json`, y seleccionar el entorno.
2. Correr la colección completa en orden (Collection Runner). Recorre agregar al carrito, checkout,
   cobro, factura, despacho, rastreo, incidencias, avisos, lote del ERP, auditoría y la simulación
   de fallas; las consultas que dependen de procesos asíncronos esperan unos segundos por sí solas.

O a mano, con `curl`:

```
curl -X POST localhost:8080/api/customers/1/cart/items -H 'Content-Type: application/json' \
     -d '{"productId":1,"quantity":1,"channel":"WEB"}'
curl -X POST localhost:8080/api/orders/checkout -H 'Content-Type: application/json' \
     -d '{"customerId":1,"deliveryAddress":"Zona 10"}'                      # devuelve el id de la orden
curl -X POST localhost:8080/api/orders/1/payments -H 'Content-Type: application/json' \
     -d '{"method":"CARD","cardToken":"tok_demo","cardLast4":"4242"}'
sleep 10
curl localhost:8080/api/orders/1/trace          # cobro, factura, despacho y guía, en orden
curl -X POST localhost:8080/api/integration/erp/batches   # cierra la ventana del ERP sin esperar 30 min
```

### Iniciar sesión

```
curl -X POST localhost:8080/api/auth/login -H 'Content-Type: application/json' \
     -d '{"username":"admin","password":"admin123"}'        # devuelve {"token": "..."}
```

El token (cabecera `Authorization: Bearer <token>`) se exige para crear o editar productos (rol
`ADMIN`) y para procesar una incidencia (`PUT /api/incidents/{id}/status`). El resto de la API es
pública, incluido el simulador de terceros. En Postman, la carpeta "Sesión" guarda el token solo.

### Demostrar las fallas de terceros

```
curl -X PUT localhost:8080/api/simulation/payklik -H 'Content-Type: application/json' -d '{"mode":"DOWN"}'
```

Proveedores: `payklik`, `sat`, `logiexpress`, `messaging`, `pos`, `erp`. Modos: `NORMAL`, `SLOW`,
`DOWN`, `REJECT`. Qué se ve en cada caso está en
[API-Transacciones.md](backend/API-Transacciones.md#simulación-de-terceros-solo-para-la-demo).
La carpeta "Simulación de terceros" de Postman tiene cada escenario con su "vuelve".

### Datos de volumen y pruebas

```
./db/scripts/cargar-datos-de-prueba.sh 20000    # 20 000 órdenes en todos los estados
python3 pruebas/prueba_reserva_concurrente.py   # 80 checkouts simultáneos: sin sobreventa
python3 pruebas/prueba_rendimiento.py           # estado de orden < 5 s, auditoría < 1 s
python3 pruebas/prueba_flujo_volumen.py         # 60 compras simultáneas hasta la guía
```

## Configuración

| Variable | Por defecto | Para qué |
|---|---|---|
| `DB_PASSWORD` | `sgologic_dev` | Clave del dueño de la base (solo migraciones y administración) |
| `DB_APP_PASSWORD` | `sgologic_app_dev` | Clave del rol `sgologic_app`, con el que entra el backend |
| `DB_PORT` | `5432` | Puerto de la base en el host |
| `BACKEND_PORT` | `8080` | Puerto del backend en el host |
| `JWT_SECRET` | una clave de desarrollo | Clave con la que se firman los tokens de sesión |

Por ejemplo, si el 5432 ya está ocupado: `DB_PORT=5433 docker compose up -d`. Las claves por
defecto son solo para desarrollo local.

Los valores de negocio viven en la tabla `config.setting` y se cambian sin reiniciar:
`reservation.ttl_minutes` (20), `erp.batch_interval_minutes` (30) y `payment.timeout_ms` (5000).
Los intervalos de reintento y el modo inicial de cada tercero están en
`backend/src/main/resources/application.yml`.

## Operación

```
docker compose logs -f backend      # log del backend
docker compose down                 # detener (los datos se conservan en el volumen db_data)
./db/scripts/reiniciar-base.sh -y   # borrar la base y crearla de nuevo desde las migraciones
```

Los archivos que se le dejan al AS/400 quedan en `FASE 2/erp-out/`.

**Las migraciones solo corren cuando el volumen de la base está vacío.** Si ya tenías la base
creada de antes y se agrega una migración nueva (por ejemplo `V8__reserva_de_20_minutos.sql`), hay
que aplicarla a mano o reiniciar la base:

```
docker exec -i sgologic-db psql -U sgologic -d sgologic < db/migrations/V8__reserva_de_20_minutos.sql
```

## Arquitectura en una línea

Monolítico en su despliegue (un contenedor de aplicación con un módulo por componente,
[ADR-0009](DDA/ADR/0009-alcance-de-despliegue-del-mvp.md)), orientado a eventos para todo paso que
depende de un tercero (Transactional Outbox,
[ADR-0007](DDA/ADR/0007-outbox-en-la-base-como-broker-del-mvp.md)) y orientado a datos para lo que
exige consistencia inmediata (una base con un esquema por componente), según el ADR-0001 de la
Fase 1. Los diagramas de bloques, componentes y despliegue que coinciden con el código están en
[DDA/diagrama-de-componentes.md](DDA/diagrama-de-componentes.md) y
[DDA/diagrama-de-despliegue.md](DDA/diagrama-de-despliegue.md); la trazabilidad de cada
funcionalidad, en [DDA/matriz-trazabilidad-fase2.md](DDA/matriz-trazabilidad-fase2.md).

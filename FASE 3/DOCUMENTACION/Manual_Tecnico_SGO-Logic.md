# Manual técnico de SGO-Logic

Sistema de Gestión de Órdenes y Logística Omnicanal de MegaStore. Este manual describe cómo está construido el sistema tal como corre hoy: arquitectura, componentes, datos, seguridad, despliegue, CI/CD y pruebas. Lo que se propuso en las fases anteriores y todavía no está construido se marca como tal.

| | |
|---|---|
| Versión del documento | 1.1 |
| Código | Backend Java 21 con Spring Boot 3.3.4, frontend React 19 con TypeScript y Vite, PostgreSQL 16, Kafka 3.8.1 |
| Repositorio | Este mismo repositorio. El código vive en `FASE 2/`, las pruebas y la documentación de esta fase en `FASE 3/` |
| Aplicación en la nube | Render (backend y frontend), Neon (PostgreSQL) y Cloudflare R2 (archivo del ERP) |

## Qué resuelve

MegaStore vende por web y en tiendas físicas. SGO-Logic coordina el catálogo, el inventario por ubicación, el carrito, el cobro, la factura, el envío y la atención posterior, y se integra con seis sistemas externos: PayKlik (pagos), SAT (facturación), LogiExpress (envíos), mensajería, POS y el ERP.

La Fase 3 sumó una regla de negocio nueva: el crédito propio «Compra ahora, paga en 30 días». En el checkout, el sistema decide primero cómo va a pagar el cliente. Algunos clientes ven el crédito junto a PayKlik y otros solo ven PayKlik, según su historial de compras, devoluciones, incidencias y pagos. La orden nunca queda esperando: termina confirmada o rechazada por la ruta que se haya elegido.

## Estilo arquitectónico

La arquitectura combina tres ideas, que ya estaban decididas en los ADR de las fases 1 y 2:

- **Monolito modular.** Un solo contenedor de aplicación con un módulo por componente de negocio. Se eligió así para el MVP porque simplifica el despliegue y las transacciones; las razones están en el [ADR-0009](../../FASE%202/DDA/ADR/0009-alcance-de-despliegue-del-mvp.md).
- **Base de datos compartida con un esquema por componente.** La consulta de estado y el inventario se resuelven de forma síncrona contra la base.
- **Integración asíncrona orientada a eventos.** Todo lo que sale hacia un tercero (cobros abonados, notificaciones, POS, ERP) pasa por el patrón *outbox*: la intención se guarda en la base dentro de la misma transacción de negocio y un relé la publica en Kafka. Detalle en el [ADR-0007](../../FASE%202/DDA/ADR/0007-outbox-en-la-base-como-broker-del-mvp.md), que el [ADR-0012](../DDA/ADR/0012-kafka-como-broker-con-el-outbox-como-puente.md) evoluciona al poner a Kafka como broker.

![Diagrama de componentes implementado](../../FASE%202/image/Diagrama-Componentes-Implementado-SGO-Logic-Fase2.png)

![Diagrama de despliegue implementado](../../FASE%202/image/Diagrama-Despliegue-Implementado-SGO-Logic-Fase2.png)

Los diagramas de la vista objetivo (microservicios independientes detrás de un API Gateway, sobre Kubernetes) se conservan como propuesta de evolución, en `FASE 2/DDA/` y en [esta carpeta](image/vista-objetivo/). No es lo que corre hoy: el sistema implementado es el monolito modular de arriba.

Las decisiones y vistas que agregó esta fase están en [FASE 3/DDA](../DDA/README.md): el [ADR-0010](../DDA/ADR/0010-evaluacion-de-credito-propio.md) del crédito, el [ADR-0012](../DDA/ADR/0012-kafka-como-broker-con-el-outbox-como-puente.md) de Kafka, los casos de uso [CDU-09](../DDA/casos-de-uso/CDU-09-comprar-a-credito.md) y [CDU-10](../DDA/casos-de-uso/CDU-10-abonar-saldo-de-credito.md), el [ADR-0011](../DDA/ADR/0011-cicd-y-despliegue-en-la-nube.md) del CI/CD y el despliegue, los [drivers y escenarios de calidad](../DDA/drivers-y-escenarios-fase3.md) y los [diagramas](../DDA/diagramas-fase3.md) de componentes, secuencia, pipeline y despliegue en la nube.

## Backend

Un solo servicio Spring Boot. Cada paquete de `com.sgologic` es un componente:

| Paquete | Responsabilidad | Esquema en la base |
|---|---|---|
| `catalog` | Productos, categorías y promociones | `catalog` |
| `customers` | Clientes, cuentas con login, recuperación de cuenta | `customers` |
| `inventory` | Stock por ubicación, reservas de 20 minutos, movimientos, ubicaciones y traslados | `inventory` |
| `orders` | Carrito, checkout, órdenes, estados, incidencias, devoluciones y cambios | `orders` |
| `payments` | Cobro con PayKlik, crédito propio, abonos y reembolsos | `payments` |
| `invoicing` | Factura electrónica con la SAT | `invoicing` |
| `logistics` | Envíos, rastreo, retiro en tienda y transporte alternativo | `logistics` |
| `notifications` | Avisos al cliente | `notifications` |
| `integration` | Outbox, consumidores de Kafka, POS y ERP | `integration` |
| `external` | Clientes HTTP de los seis proveedores y almacenamiento del archivo del ERP | — |
| `audit` | Bitácora de auditoría, trazas y reportes | `audit` |
| `auth`, `config` | Login, JWT, roles y parámetros del sistema | `config` |

La API está documentada en [API.md](../../FASE%202/backend/API.md) y [API-Transacciones.md](../../FASE%202/backend/API-Transacciones.md).

### Flujo de una compra

1. El cliente arma el carrito y llega al checkout. El stock se reserva por 20 minutos (parámetro `reservation.ttl_minutes`); un job libera las reservas vencidas cada 30 segundos.
2. El sistema decide las rutas de pago disponibles: PayKlik para todos y crédito propio solo si el cliente es elegible.
3. Al pagar, el sistema cobra y confirma la orden. Si hay un doble clic o dos cobros simultáneos para la misma orden, solo uno procede y los demás reciben 409.
4. Con el pago aprobado, el trabajo posterior (factura, envío, avisos al cliente, evento de POS y lote del ERP) se encola en el outbox. Un fallo de un tercero no deshace la compra: el trabajo queda pendiente y se reintenta.
5. El cliente sigue la orden en «Mis órdenes» hasta la entrega.

### Crédito propio

Está en `payments/CreditService` y se alimenta del historial del cliente en el ERP.

**Quién es elegible.** Se evalúa en cada checkout, con criterios que viven en la tabla `config.setting` y que el administrador cambia sin desplegar:

| Parámetro | Valor inicial |
|---|---|
| `credit.minimum_delivered_orders` | 3 compras entregadas |
| `credit.minimum_purchase_amount` | Q 30 en compras entregadas |
| `credit.maximum_late_payments` | 0 pagos fuera de plazo |
| `credit.maximum_confirmed_incidents` | 0 incidencias confirmadas |
| `credit.maximum_returns` | 0 devoluciones confirmadas |
| `credit.maximum_declined_payments` | 0 pagos rechazados |
| `credit.limit` | Q 5,000 de límite |
| `credit.term_days` | 30 días de plazo |

No es elegible quien tenga un saldo vencido, una devolución o cambio en revisión, o no tenga un historial ERP vigente. Si el ERP no responde y no hay historial reciente, la opción de crédito simplemente no aparece y el cliente sigue con PayKlik.

**Cómo se decide.** El historial del ERP se refresca en una proyección propia en PostgreSQL y se suma al historial interno. La decisión, aprobada o rechazada, se guarda con el detalle de la evaluación en `payments.credit_application`, se audita y se notifica al cliente. Un candado por cliente serializa el gasto de crédito, de modo que dos compras simultáneas no superen el límite.

**Cómo se paga.** Cada compra a crédito crea un cargo en `payments.credit_charge` con fecha de vencimiento. El cliente lo abona desde «Mi crédito» con PayKlik; el abono libera el cupo. Si el abono falla, queda el error registrado y se puede reintentar.

### Mensajería con Kafka

La decisión está en el [ADR-0012](../DDA/ADR/0012-kafka-como-broker-con-el-outbox-como-puente.md).

```text
transacción de negocio ──► tabla outbox (misma transacción)
                                  │
                       relé programado (cada 2 s)
                                  ▼
          Kafka: sgologic.orders · .notifications · .pos · .erp
                                  │
                      consumidor con reintentos
                                  ▼
                       proveedor externo (HTTP)
```

- El relé (`OutboxDispatcher`) toma hasta 100 intenciones pendientes por tabla con `for update skip locked`, las publica y marca `kafka_published_at`. Nunca llama a un proveedor.
- Cada consumidor reintenta hasta 8 veces con espera exponencial de 2 s que se duplica hasta 30 s (`@RetryableTopic`, 3 particiones). Agotados los intentos, el mensaje va a su tópico DLT y la fila queda con el último error.
- Si Kafka se cae, las intenciones se quedan en la base y el relé las publica cuando vuelve. La compra no se pierde.
- Un circuito por tercero se abre tras 3 fallas seguidas y se queda abierto 20 segundos, para no golpear a un proveedor caído.

### Proveedores externos

Los seis son procesos independientes, hechos con un mismo script (`FASE 2/providers/server.py`) que se configura con la variable `PROVIDER` y guarda su estado en SQLite. El backend los consume por HTTP, por una URL configurable (`PAYKLIK_URL`, `SAT_URL`, `LOGIEXPRESS_URL`, `MESSAGING_URL`, `POS_URL`, `ERP_URL`), detrás de un adaptador. Cambiar a un proveedor real exige tocar solo el adaptador: es la decisión del [ADR-0008](../../FASE%202/DDA/ADR/0008-terceros-simulados-tras-un-adaptador.md).

El ERP, además de recibir los lotes de ventas, expone el historial de cada cliente que usa el crédito. El archivo de intercambio se escribe en disco en local y en Cloudflare R2 en la nube, porque el disco de Render no persiste.

## Datos

PostgreSQL 16, una sola base con 11 esquemas (`audit`, `catalog`, `config`, `customers`, `integration`, `inventory`, `invoicing`, `logistics`, `notifications`, `orders`, `payments`). El modelo completo está en `FASE 2/db/README.md` y en el diagrama entidad-relación de `FASE 2/image/`.

Las migraciones están en `FASE 2/db/migrations/` (V1 a V21) y se aplican con `FASE 2/db/migrate.sh`. El script es incremental: guarda lo aplicado en `public.schema_migration` y solo corre las versiones que faltan, sin borrar datos. En local lo ejecuta el servicio `migrate` del compose; en la nube, `FASE 2/db/scripts/aplicar-migraciones-nube.sh`, que el CI corre antes de cada deploy.

Hay dos roles de base: `sgologic`, dueño y usado por las migraciones, y `sgologic_app`, de bajo privilegio, que usa el backend en local ([ADR-0006](../../FASE%202/DDA/ADR/0006-rol-de-aplicacion-sin-privilegios-de-superusuario.md)). En la nube, Neon da un solo usuario por base y el backend se conecta con `DATABASE_URL`; es una reducción real del aislamiento, aceptable para una demo.

Los datos de prueba (12 productos, 34 ubicaciones, 408 filas de stock, clientes, el usuario `admin` y 5 cuentas de demo) salen de las migraciones V2, V7 y V9 y están detallados en [DATOS_SEED.md](../../DATOS_SEED.md).

## Seguridad

- **Dos logins independientes con JWT.** Personal (`POST /api/auth/login`) y cliente (`POST /api/customers/login`). El token se firma con `JWT_SECRET` y dura 8 horas. La revocación de sesiones del personal está en la migración V16.
- **Roles del personal:** `ADMIN`, `FINANCE`, `LOGISTICS`, `CALL_CENTER_AGENT`, `STORE_MANAGER` y `STORE_EMPLOYEE`. Cada ruta del backoffice declara los roles que la pueden usar en `SecurityConfig`.
- **Rutas públicas:** el catálogo y las promociones, el registro y login de clientes, la recuperación de contraseña y el webhook de rastreo de LogiExpress (protegido por la clave `CARRIER_WEBHOOK_KEY`).
- **Tarjetas.** No existe ninguna columna para guardar una tarjeta. Como última barrera, restricciones de la base (migración V4) rechazan cualquier texto o JSON que contenga un número con forma de tarjeta: de 13 a 19 dígitos que pasen la verificación de Luhn.
- **Auditoría.** Cada acción relevante (compra, crédito, cambios de configuración) queda en `audit` con actor, fecha y canal, y se puede reconstruir la traza de una orden.
- **Secretos.** Las claves de base, JWT y R2 viajan por variables de entorno y no están en el repositorio. Las de desarrollo local son valores de ejemplo.

## Frontend

React 19 con TypeScript y Vite. Un solo build sirve dos aplicaciones: la tienda del cliente, en la raíz (`/`, `/catalogo`, `/carrito`, `/checkout`, `/credito`, `/mis-ordenes`, `/perfil`, `/notificaciones`), y el backoffice del personal, bajo `/administracion`. nginx sirve los archivos compilados y reenvía `/api` al backend. La plantilla está en `FASE 2/frontend/nginx.conf.template` y usa la variable `BACKEND_URL`.

## Ejecución local

Solo hace falta Docker con Compose v2. Desde `FASE 2/` se levanta todo con `./iniciar.sh` o `docker compose up -d --build`:

| Servicio | Qué es | Dirección |
|---|---|---|
| `db` | PostgreSQL 16 | `127.0.0.1:5432` |
| `migrate` | Aplica las migraciones y termina | — |
| `kafka` | Broker `apache/kafka:3.8.1` | interno |
| `backend` | Spring Boot | `http://127.0.0.1:8080` |
| `frontend` | nginx con la aplicación compilada | `http://localhost:8081` |
| `payklik`, `sat`, `logiexpress`, `messaging`, `pos`, `erp` | Los seis proveedores simulados | interno |

`iniciar.sh` lee `RESET_SEED` en `.env` para decidir si borra la base y la recrea desde las migraciones antes de levantar todo. La guía completa está en [FASE 2/README.md](../../FASE%202/README.md).

## Despliegue en la nube

El blueprint [render.yaml](../../render.yaml) levanta dos servicios web con Docker (`Dockerfile.backend` y `Dockerfile.frontend`, en la raíz porque Render no resuelve bien una ruta con espacio). La base es Neon y el archivo del ERP va a Cloudflare R2. Los pasos y las decisiones están en [DEPLOY-RENDER.md](../../DEPLOY-RENDER.md).

| Variable | Servicio | Para qué |
|---|---|---|
| `DATABASE_URL` | backend | Cadena de conexión de Neon |
| `JWT_SECRET` | backend | Firma de los tokens (la genera Render) |
| `PORT` | ambos | Puerto de escucha |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | backend | Archivo del ERP; opcionales |
| `KAFKA_BOOTSTRAP_SERVERS`, `PAYKLIK_URL`, `SAT_URL`, `LOGIEXPRESS_URL`, `MESSAGING_URL`, `POS_URL`, `ERP_URL` | backend | Kafka y proveedores; sin valor apuntan a los nombres del compose |
| `CARRIER_WEBHOOK_KEY` | backend | Clave del webhook de rastreo |
| `BACKEND_URL` | frontend | URL pública del backend, a la que nginx reenvía `/api` |

Dos cosas que conviene tener presentes:

- **El frontend usa la URL pública del backend.** Un servicio gratuito de Render no recibe tráfico por la red privada, así que el nombre interno no resuelve. Por eso `BACKEND_URL` es una URL completa con `https://`.
- **La nube es una vista parcial.** Kafka y los seis proveedores no están desplegados en Render. El catálogo, el login, el carrito y las consultas funcionan; los flujos que dependen de Kafka o de un proveedor simulado solo se demuestran completos con el compose. Es una limitación del plan gratuito, y está dicha en el propio `render.yaml`.

Los servicios gratuitos se duermen tras 15 minutos sin tráfico. La primera petición después tarda hasta un par de minutos mientras el backend arranca y puede devolver 502. Conviene abrir la tienda antes de una demostración.

## Integración y despliegue continuos

`.github/workflows/ci.yml` corre en cada push a `develop` y a las ramas `feature/**`, y en cada pull request hacia `develop`:

| Job | Qué hace |
|---|---|
| `backend` | `mvn test` con JUnit |
| `frontend` | `tsc`, Vitest, oxlint y build |
| `e2e` | `python "FASE 3/verificar.py"`: integración, carga, estrés, caídas y E2E sobre el compose completo, y guarda la evidencia como artefacto |

El deploy lo hace Render, y solo cuando esos tres checks pasan: los dos servicios tienen `autoDeployTrigger: checksPass` en `render.yaml`. Si algo falla, Render no despliega y el servicio sigue con la última versión que pasó. El workflow no tiene un job de deploy propio a propósito, porque uno que esperara a Render crearía una espera circular. No hay credenciales de Render ni de la base guardadas en GitHub.

Las migraciones no se aplican solas. Si una versión agrega una, hay que correr `aplicar-migraciones-nube.sh` antes de que el backend nuevo arranque; está explicado en [DEPLOY-RENDER.md](../../DEPLOY-RENDER.md).

## Pruebas

La verificación automática completa corre con un solo comando desde la raíz:

```text
python "FASE 3/verificar.py"
```

La última corrida validada ejecutó 242 casos sin fallos: 182 unitarias (60 del backend y 122 del frontend), 8 de integración, 5 de carga, 5 de estrés y 42 E2E con Chromium, además de las simulaciones de caída de proveedores y Kafka. El enunciado pide al menos 5 por categoría. El plan, la matriz de trazabilidad, la guía técnica y la evidencia están en `FASE 3/`:

- [Plan de pruebas](../PLAN-PRUEBAS.md)
- [Matriz de trazabilidad](../MATRIZ-TRAZABILIDAD.md)
- [Guía técnica de las pruebas](../GUIA-TECNICA-PRUEBAS.md)
- [Evidencia de la ejecución](../EVIDENCIA.md)

## Flujo de trabajo en git

Se usa git-flow. `main` guarda lo que se entregó y cada versión lleva un tag `v1`, `v2`, etc. `develop` integra el trabajo del sprint. Cada cambio se hace en una rama `feature/<carnet>-<tema>` creada desde `develop` y vuelve por pull request. El mensaje de cada commit lleva el carnet de quien lo hace: `carnet: mensaje`.

## Operación y problemas conocidos

| Síntoma | Causa | Qué hacer |
|---|---|---|
| 502 al entrar o al iniciar sesión en la nube | El backend gratuito estaba dormido | Esperar un minuto y reintentar |
| Deploy del backend falla con «Timed out waiting for health check» | El esquema de Neon es anterior al código y `/api/products` da 500 | Aplicar las migraciones con `aplicar-migraciones-nube.sh` y redesplegar |
| `unknown "backend_url" variable` en el log de nginx | Falta la variable `BACKEND_URL` en el frontend | Definirla en Render y redesplegar |
| Avisos `localhost:9092 could not be established` en el log de la nube | No hay Kafka desplegado en Render | Esperado en la vista parcial; los eventos quedan pendientes en el outbox |
| La compra a crédito no aparece como opción | El cliente no cumple los criterios o no hay historial ERP vigente | Revisar «Mi crédito», que explica el motivo |

## Referencias

- [README del proyecto](../../README.md) y [bitácora](../../BITACORA.md)
- [Arquitectura de la Fase 1](../../FASE%201/README.md) y [de la Fase 2](../../FASE%202/DDA/)
- [Despliegue en Render](../../DEPLOY-RENDER.md)
- [Manual de usuario](Manual_Usuario_SGO-Logic.md)

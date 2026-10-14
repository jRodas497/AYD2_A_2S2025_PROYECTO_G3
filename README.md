# SGO-Logic — MegaStore

Sistema de Gestión de Órdenes y Logística Omnicanal (SGO-Logic) para **MegaStore**, proyecto del curso Análisis y Diseño de Sistemas 2 (USAC), Grupo 3.

El repositorio está dividido por fase del curso:

La verificación automática de **FASE 3** se ejecuta desde la raíz con `python "FASE 3/verificar.py"`.
Incluye unitarias, integración, E2E, cinco pruebas de carga y cinco de estrés, seguridad y caídas reales,
con reportes y un entorno Docker aislado. [Guía, matriz y manuales](FASE%203/README.md).

```
.
├── FASE 1/    Definición de arquitectura (DDA, ADRs, diagramas, prototipo)
├── FASE 2/    Implementación (backend Java, frontend React, base de datos)
└── FASE 3/    Testeo automático, carga, estrés, trazabilidad y manuales
```

## FASE 1 — Definición de arquitectura

Documento de Definición de Arquitectura (DDA), ADRs, diagramas y presentación que justifican el diseño de SGO-Logic: un monolito modular por componentes, con integración asíncrona (outbox/eventos) para pagos, logística, notificaciones y ERP, e integración síncrona por base de datos compartida para inventario y consulta de estado. No incluye código de aplicación — es el entregable de arquitectura. Detalle completo en [`FASE 1/README.md`](FASE%201/README.md).

## FASE 2 — Implementación

Construcción del sistema definido en la Fase 1:

- **`backend/`** — Java 21 + Spring Boot. Un contenedor de aplicación con un módulo por componente (núcleo comercial: catálogo, clientes, inventario, órdenes/carrito, incidencias; transacciones e integraciones: pagos, facturación, logística, notificaciones, auditoría, ERP y POS). Por qué es un solo contenedor, en el [ADR-0009](FASE%202/DDA/ADR/0009-alcance-de-despliegue-del-mvp.md). Detalle en [`FASE 2/backend/README.md`](FASE%202/backend/README.md).
- **`pruebas/`** — Pruebas ejecutables de concurrencia, rendimiento y volumen, con sus resultados. Detalle en [`FASE 2/pruebas/README.md`](FASE%202/pruebas/README.md).
- **`DDA/`** — Arquitectura de la Fase 2: drivers, CDU expandidos, diagramas de bloques, componentes y despliegue (vista objetivo e implementada), matriz de trazabilidad y ADR 0006 a 0009.
- **`frontend/`** — React + TypeScript + Vite. Tienda del cliente (catálogo, carrito, checkout, pago, órdenes) y backoffice del personal (dashboard, órdenes, incidencias, inventario, reservas, logística, clientes, auditoría, reportes, configuración), todo sobre la API real del backend. Detalle en [`FASE 2/frontend/README.md`](FASE%202/frontend/README.md).
- **`db/`** — PostgreSQL 16, una sola base con un esquema por componente. Detalle en [`FASE 2/db/README.md`](FASE%202/db/README.md).

### Autenticación

Hay dos sistemas de login, independientes entre sí, ambos con JWT:

- **Personal** (`POST /api/auth/login`, frontend en `/administracion/login`). Las migraciones
  siembran un usuario de desarrollo, `admin` / `admin123`, con rol `ADMIN`. El token se exige en:

  | Acción | Requiere |
  |---|---|
  | Crear o editar productos (`POST /api/products`, `PUT /api/products/{id}`) | Rol `ADMIN` |
  | Cambiar un parámetro (`PUT /api/settings/{key}`) | Rol `ADMIN` |
  | Listar y gestionar al personal (`/api/users`) | Rol `ADMIN` |
  | Procesar una incidencia (`PUT /api/incidents/{id}/status`) | Cualquier sesión |

- **Cliente de la tienda** (`POST /api/customers/register` y `/login`, frontend en `/ingresar`).
  Cada cliente tiene su propia cuenta — su propio carrito, sus compras, sus facturas y su
  historial, en vez de un solo "Cliente invitado" anónimo compartido. Las migraciones siembran 5
  cuentas de demo con historiales de compra distintos (contraseña `cliente123` para las cinco):
  `maria@example.com` (compradora frecuente), `lucia@example.com` (la de mayor historial),
  `ana@example.com` (con una devolución registrada), `carlos@example.com` (una compra sin pagar)
  y `jorge@example.com` (cuenta nueva, sin compras). Carrito, checkout, "Mis órdenes",
  notificaciones y perfil exigen esta sesión; el catálogo es público.

El resto de la API —catálogo, cobro, consultas, auditoría, reportes, integraciones y el
simulador de terceros `/api/simulation`— es pública. La clave con la que se firman los tokens se
cambia con la variable `JWT_SECRET` (la misma para los dos sistemas de login).

## Cómo levantar el proyecto

Solo hace falta Docker con Compose v2. Desde `FASE 2/`:

```bash
cd "FASE 2"
./iniciar.sh
```

Es un atajo sobre `docker compose up -d --build` (que sigue funcionando igual si se prefiere):
además revisa `RESET_SEED` en `.env` (plantilla en `FASE 2/.env.example`) para decidir si borra
la base y la recrea desde las migraciones antes de levantar todo, o deja los datos como están.

Levanta estos servicios (los tres primeros son los que se usan a diario; el resto es lo que la Fase 2 sumó):

| Servicio | Qué es | Dirección |
|---|---|---|
| `sgologic-db` | PostgreSQL 16 | `127.0.0.1:5432` |
| `migrate` | Corre una vez las migraciones `FASE 2/db/migrations/V1` a `V21` (esquemas, datos de prueba, usuario `admin`, configuración) y termina | — |
| `kafka` | Broker de mensajes para la integración asíncrona | interno |
| `sgologic-backend` | Java 21 + Spring Boot. Espera a que la base esté sana | `http://127.0.0.1:8080` |
| `sgologic-frontend` | La aplicación compilada, servida con nginx, que reenvía `/api` al backend | `http://localhost:8081` |
| `payklik`, `sat`, `logiexpress`, `messaging`, `pos`, `erp` | Los seis proveedores externos simulados, cada uno como proceso HTTP propio | interno |

Abrir `http://localhost:8081`: la tienda está en la raíz y el backoffice en `/administracion`. El backend no tiene página en la raíz; su API está documentada en [`FASE 2/backend/API.md`](FASE%202/backend/API.md).

Las migraciones solo corren con el volumen vacío. Si la base ya existía, las nuevas se aplican a mano o se reinicia la base con `./db/scripts/reiniciar-base.sh -y` (detalle en [`FASE 2/README.md`](FASE%202/README.md#operación)).

Para detener todo:

```bash
docker compose down
```

Los datos de la base persisten en el volumen `db_data`.

### Desarrollo del frontend

Para trabajar en el frontend con recarga en caliente hace falta Node.js 22 o superior. Con la base y el backend del compose corriendo, desde `FASE 2/frontend/`:

```bash
npm install
npm run dev
```

Queda en `http://localhost:5173` y Vite reenvía `/api` a `http://localhost:8080`.

### Pruebas

```bash
# backend, pruebas unitarias, desde FASE 2/backend (no requiere Maven instalado)
docker run --rm -v "$PWD":/app -v sgologic-m2:/root/.m2 -w /app maven:3.9-eclipse-temurin-21 mvn -B test

# frontend, desde FASE 2/frontend (no requiere Node 22 instalado)
docker run --rm -v "$PWD":/app -v /app/node_modules -w /app node:22 sh -c "npm ci && npx vitest run"

# concurrencia, rendimiento y volumen, desde FASE 2 con el sistema levantado
python3 pruebas/prueba_reserva_concurrente.py
python3 pruebas/prueba_rendimiento.py
python3 pruebas/prueba_flujo_volumen.py
```

## Documentación adicional

- Verificación automática de la Fase 3 (plan de pruebas, matriz, manuales y evidencia): [`FASE 3/README.md`](FASE%203/README.md)
- Despliegue en Render y CI de cada commit en la rama de trabajo: [`DEPLOY-RENDER.md`](DEPLOY-RENDER.md)
- Bitácora de desarrollo del proyecto, con fechas y evidencia de commits: [`BITACORA.md`](BITACORA.md)
- Guía completa de instalación, despliegue, pruebas y demostración de fallas: [`FASE 2/README.md`](FASE%202/README.md)
- Arquitectura y decisiones: [`FASE 1/`](FASE%201/) (DDA, ADRs) y [`FASE 2/DDA/`](FASE%202/DDA/) (ADR 0006 a 0009, diagramas implementados, [matriz de trazabilidad](FASE%202/DDA/matriz-trazabilidad-fase2.md))
- API del backend: [`FASE 2/backend/API.md`](FASE%202/backend/API.md), [`FASE 2/backend/API-Transacciones.md`](FASE%202/backend/API-Transacciones.md)
- Modelo de datos: [`FASE 2/db/README.md`](FASE%202/db/README.md)

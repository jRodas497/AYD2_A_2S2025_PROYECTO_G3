# SGO-Logic — MegaStore

Sistema de Gestión de Órdenes y Logística Omnicanal (SGO-Logic) para **MegaStore**, proyecto del curso Análisis y Diseño de Sistemas 2 (USAC), Grupo 3.

El repositorio está dividido por fase del curso:

```
.
├── FASE 1/    Definición de arquitectura (DDA, ADRs, diagramas, prototipo)
└── FASE 2/    Implementación (backend Java, frontend React, base de datos)
```

## FASE 1 — Definición de arquitectura

Documento de Definición de Arquitectura (DDA), ADRs, diagramas y presentación que justifican el diseño de SGO-Logic: un monolito modular por componentes, con integración asíncrona (outbox/eventos) para pagos, logística, notificaciones y ERP, e integración síncrona por base de datos compartida para inventario y consulta de estado. No incluye código de aplicación — es el entregable de arquitectura. Detalle completo en [`FASE 1/README.md`](FASE%201/README.md).

## FASE 2 — Implementación

Construcción del sistema definido en la Fase 1:

- **`backend/`** — Java 21 + Spring Boot. Un contenedor de aplicación con un módulo por componente (núcleo comercial: catálogo, clientes, inventario, órdenes/carrito, incidencias; transacciones e integraciones: pagos, facturación, logística, notificaciones, auditoría, ERP y POS). Por qué es un solo contenedor, en el [ADR-0009](FASE%202/DDA/ADR/0009-alcance-de-despliegue-del-mvp.md). Detalle en [`FASE 2/backend/README.md`](FASE%202/backend/README.md).
- **`pruebas/`** — Pruebas ejecutables de concurrencia, rendimiento y volumen, con sus resultados. Detalle en [`FASE 2/pruebas/README.md`](FASE%202/pruebas/README.md).
- **`DDA/`** — Arquitectura de la Fase 2: drivers, CDU expandidos, diagramas de bloques, componentes y despliegue (vista objetivo e implementada), matriz de trazabilidad y ADR 0006 a 0009.
- **`frontend/`** — React + TypeScript + Vite. Consume la API del backend (catálogo, clientes, carrito, checkout, pago y órdenes ya conectados al backend real).
- **`db/`** — PostgreSQL 16, una sola base con un esquema por componente. Detalle en [`FASE 2/db/README.md`](FASE%202/db/README.md).

### Autenticación

El backend tiene login con JWT (`POST /api/auth/login`). Las migraciones siembran un usuario de desarrollo, `admin` / `admin123`, con rol `ADMIN`. Hoy el token se exige solo en:

| Acción | Requiere |
|---|---|
| Crear o editar productos (`POST /api/products`, `PUT /api/products/{id}`) | Sesión con rol `ADMIN` |
| Procesar una incidencia (`PUT /api/incidents/{id}/status`) | Cualquier sesión |

El resto de la API —catálogo, carrito, checkout, cobro, consultas, auditoría, integraciones y el simulador de terceros `/api/simulation`— es pública. El frontend todavía no manda el token en ninguna llamada: una pantalla que use las acciones de la tabla va a recibir `401` hasta que lo haga. La clave con la que se firman los tokens se cambia con la variable `JWT_SECRET`.

## ¿Está dockerizado?

**Parcialmente.** `FASE 2/docker-compose.yml` levanta la **base de datos** y el **backend** en contenedores (el backend tiene su propio `Dockerfile`, imagen Maven + JRE 21). El **frontend no está dockerizado**: se corre con Node/npm y su servidor de desarrollo (Vite), que hace de proxy hacia el backend.

## Cómo levantar el proyecto

### Requisitos

- Docker y Docker Compose (para base de datos y backend)
- Node.js 20+ y npm (para el frontend)

### Primero: base de datos y backend

Desde `FASE 2/`:

```bash
cd "FASE 2"
docker compose up -d --build backend
```

Esto también levanta `db` (Postgres 16) si no estaba corriendo, esperando a que esté saludable antes de arrancar el backend. La primera vez, Postgres ejecuta las migraciones de `db/migrations` (V1 a V8) automáticamente: esquemas, datos de prueba, el usuario `admin` y la configuración. Las migraciones solo corren con el volumen vacío; si la base ya existía, las nuevas se aplican a mano o se reinicia la base con `./db/scripts/reiniciar-base.sh -y` (detalle en [`FASE 2/README.md`](FASE%202/README.md#operación)).

- Backend disponible en `http://127.0.0.1:8080`
- Postgres disponible en `127.0.0.1:5432` (usuario de aplicación `sgologic_app`, ver [`FASE 2/db/README.md`](FASE%202/db/README.md) para credenciales de desarrollo)

Para detener todo:

```bash
docker compose down
```

Los datos de la base persisten en un volumen (`db_data`), así que no se pierden al reiniciar.

### Luego: frontend

En otra terminal, desde `FASE 2/frontend/`:

```bash
cd "FASE 2/frontend"
npm install
npm run dev
```

El frontend queda en `http://localhost:5173` y su servidor de desarrollo (Vite) hace proxy de `/api` hacia `http://localhost:8080`, así que el backend de Docker debe estar corriendo primero.

### Por último: verificar que todo funciona

- Abrir `http://localhost:5173` en el navegador y navegar el catálogo.
- `http://127.0.0.1:8080/api/...` debe responder (ver [`FASE 2/backend/API.md`](FASE%202/backend/API.md) para los endpoints disponibles).

### Comandos útiles del frontend

```bash
npm run build     # build de producción (tsc + vite build)
npm run test      # tests con vitest
npm run lint      # lint con oxlint
```

## Documentación adicional

- Bitácora de desarrollo del proyecto, con fechas y evidencia de commits: [`BITACORA.md`](BITACORA.md)
- Guía completa de instalación, despliegue, pruebas y demostración de fallas: [`FASE 2/README.md`](FASE%202/README.md)
- Arquitectura y decisiones: [`FASE 1/`](FASE%201/) (DDA, ADRs) y [`FASE 2/DDA/`](FASE%202/DDA/) (ADR 0006 a 0009, diagramas implementados, [matriz de trazabilidad](FASE%202/DDA/matriz-trazabilidad-fase2.md))
- API del backend: [`FASE 2/backend/API.md`](FASE%202/backend/API.md), [`FASE 2/backend/API-Transacciones.md`](FASE%202/backend/API-Transacciones.md)
- Modelo de datos: [`FASE 2/db/README.md`](FASE%202/db/README.md)

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

- **`backend/`** — Java 21 + Spring Boot. Un solo despliegue con un módulo por componente (núcleo comercial: catálogo, clientes, inventario, órdenes/carrito; transacciones e integraciones: pagos, facturación, logística, notificaciones, auditoría). Detalle en [`FASE 2/backend/README.md`](FASE%202/backend/README.md).
- **`frontend/`** — React + TypeScript + Vite. Consume la API del backend (catálogo, clientes, carrito, checkout, pago y órdenes ya conectados al backend real).
- **`db/`** — PostgreSQL 16, una sola base con un esquema por componente. Detalle en [`FASE 2/db/README.md`](FASE%202/db/README.md).

Actualmente no hay autenticación de usuario final habilitada en el flujo (prioridad puesta en funcionalidad sobre seguridad para esta fase).

## ¿Está dockerizado?

**Parcialmente.** `FASE 2/docker-compose.yml` levanta la **base de datos** y el **backend** en contenedores (el backend tiene su propio `Dockerfile`, imagen Maven + JRE 21). El **frontend no está dockerizado**: se corre con Node/npm y su servidor de desarrollo (Vite), que hace de proxy hacia el backend.

## Cómo levantar el proyecto

### Requisitos

- Docker y Docker Compose (para base de datos y backend)
- Node.js 20+ y npm (para el frontend)

### 1. Base de datos y backend

Desde `FASE 2/`:

```bash
cd "FASE 2"
docker compose up -d --build backend
```

Esto también levanta `db` (Postgres 16) si no estaba corriendo, esperando a que esté saludable antes de arrancar el backend. La primera vez, Postgres ejecuta las migraciones de `db/migrations` automáticamente.

- Backend disponible en `http://127.0.0.1:8080`
- Postgres disponible en `127.0.0.1:5432` (usuario de aplicación `sgologic_app`, ver [`FASE 2/db/README.md`](FASE%202/db/README.md) para credenciales de desarrollo)

Para detener todo:

```bash
docker compose down
```

Los datos de la base persisten en un volumen (`db_data`), así que no se pierden al reiniciar.

### 2. Frontend

En otra terminal, desde `FASE 2/frontend/`:

```bash
cd "FASE 2/frontend"
npm install
npm run dev
```

El frontend queda en `http://localhost:5173` y su servidor de desarrollo (Vite) hace proxy de `/api` hacia `http://localhost:8080`, así que el backend de Docker debe estar corriendo primero.

### 3. Verificar que todo funciona

- Abrir `http://localhost:5173` en el navegador y navegar el catálogo.
- `http://127.0.0.1:8080/api/...` debe responder (ver [`FASE 2/backend/API.md`](FASE%202/backend/API.md) para los endpoints disponibles).

### Comandos útiles del frontend

```bash
npm run build     # build de producción (tsc + vite build)
npm run test      # tests con vitest
npm run lint      # lint con oxlint
```

## Documentación adicional

- Arquitectura y decisiones: [`FASE 1/`](FASE%201/) (DDA, ADRs)
- API del backend: [`FASE 2/backend/API.md`](FASE%202/backend/API.md), [`FASE 2/backend/API-Transacciones.md`](FASE%202/backend/API-Transacciones.md)
- Modelo de datos: [`FASE 2/db/README.md`](FASE%202/db/README.md)

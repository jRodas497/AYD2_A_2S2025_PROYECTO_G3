# Contrato asumido — Backoffice Service (Dashboard y Reportes)

> Aún no existe implementación real de este servicio. Este documento fija el contrato que el frontend administrativo asume, para que el backend lo implemente o lo corrija.

## `GET /bff/backoffice/dashboard`

Respuesta esperada:

```json
{
  "stats": [
    { "id": "ordenes", "titulo": "Órdenes", "valor": "128", "descripcion": "+12% este mes", "tono": "info" }
  ],
  "ordenesRecientes": [
    { "id": "ORD-1024", "cliente": "Carlos López", "fecha": "2026-09-23", "monto": 1250, "estado": "pagada" }
  ],
  "inventario": [
    { "categoria": "Disponible", "porcentaje": 82, "tono": "ok" }
  ]
}
```

`tono` en `stats`/`inventario` es una de `ok | alerta | falla | info`. `estado` en `ordenesRecientes` reutiliza el mismo enum de estado de orden que ya usa el resto del sistema (`pendiente_pago | pago_en_proceso | pagada | pago_fallido`, ver `docs/contratos-api/order-checkout-service.md`) — no es un estado propio de administración. El frontend actual usa datos simulados vía `mockDashboardRepository` (`src/features/backoffice/dashboard/api/dashboardRepository.mock.ts`).

## `GET /bff/backoffice/reportes?periodo={30d|90d|anio}`

Respuesta esperada:

```json
{
  "metricas": [{ "id": "ventas", "titulo": "Ventas totales", "valor": "Q 45,280.00", "variacionPct": 8.4 }],
  "ventasMensuales": [{ "mes": "Ene", "monto": 32000 }],
  "estadoOrdenes": [{ "estado": "Pagadas", "porcentaje": 62 }],
  "ordenesPorMes": [{ "mes": "Enero", "cantidad": 48 }],
  "inventario": [{ "categoria": "Disponible", "porcentaje": 82 }]
}
```

El parámetro `periodo` debe cambiar los valores devueltos — hoy el mock lo simula con un multiplicador (`30d` × 1, `90d` × 2.8, `anio` × 11); el backend real decide la ventana de tiempo real de la consulta. El frontend actual usa datos simulados vía `mockReportesRepository` (`src/features/backoffice/reportes/api/reportesRepository.mock.ts`).

## Pendiente

Las demás secciones del menú de administración (Órdenes, Incidencias, Devoluciones, Inventario, Reservas, Logística, Seguimiento, Clientes, Auditoría, Configuración) no tienen contrato todavía — son placeholders "Próximamente" en el frontend hasta que se definan sus historias.

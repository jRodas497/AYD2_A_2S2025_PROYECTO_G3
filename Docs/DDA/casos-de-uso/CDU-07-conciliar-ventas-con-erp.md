# CDU-07 — Conciliar Ventas con ERP

| Campo | Detalle |
|---|---|
| **CUN de origen** | CUN-07 |
| **Actor principal** | Finanzas |
| **Actores secundarios** | ERP-Core (AS/400, externo) |
| **Prioridad** | Alta (cumplimiento fiscal, restricción dura de no modificar el ERP) |
| **Disparador (trigger)** | Se cumple una ventana de tiempo (cada 30 minutos) con órdenes facturadas pendientes de sincronizar |

## Descripción

Sincroniza las ventas confirmadas con el ERP-Core mediante archivos CSV/XML en las ventanas de 30 minutos que el sistema legado puede procesar, sin modificar el ERP-Core, y dejando trazabilidad suficiente para que una diferencia de conciliación se investigue sin el esfuerzo manual actual.

## Precondiciones

- Existen órdenes facturadas (post-CDU-03) pendientes de sincronizar con el ERP-Core.

## Flujo principal

1. El sistema agrupa las ventas confirmadas dentro de la ventana de tiempo vigente.
2. El sistema genera un archivo CSV/XML compatible con el formato que acepta el ERP-Core.
3. El sistema deja disponible el archivo para que el ERP-Core lo procese (ventana de 30 minutos).
4. El sistema registra la confirmación de sincronización para auditoría.

## Flujos alternativos

- **3a. Se detectan diferencias en la conciliación:** el sistema expone el detalle transaccional del lote afectado, reduciendo la investigación manual que hoy retrasa el cierre y los reportes gerenciales.

## Flujos de excepción

- **E1. El ERP-Core rechaza el lote** (error de formato, datos inconsistentes): se genera una alerta para revisión y el lote se reintenta en la siguiente ventana, sin duplicar registros ya aceptados (idempotencia).
- **E2. El proceso de sincronización se interrumpe a medias** (ej. reinicio del componente): el reprocesamiento del lote es idempotente — no genera doble registro contable en el ERP-Core.

## Postcondiciones

- **De éxito:** ventas reflejadas en el ERP-Core sin haber modificado el ERP-Core mismo; lote y confirmación quedan auditables.
- **De fracaso:** el lote queda pendiente para la siguiente ventana, nunca se pierde ni se duplica.

## Reglas de negocio

- El ERP-Core no será reemplazado ni modificado — su único mecanismo de recepción es CSV/XML en ventanas de 30 minutos (decisión irrevocable de la Junta Directiva).
- Toda sincronización debe ser idempotente: reprocesar un lote no debe generar registros duplicados.
- Una transacción sin respaldo en el ERP puede derivar en multas o inconsistencias fiscales — de ahí la exigencia de trazabilidad completa del proceso.

## Drivers relacionados

- **Calidad:** DC-05 (confiabilidad de integración), DC-07 (auditabilidad)
- **Restricción:** DR-04 (no modificar ERP-Core)

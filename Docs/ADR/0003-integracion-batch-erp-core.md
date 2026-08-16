# ADR-0003: Estrategia de integración con ERP-Core (batch CSV/XML)

**Estado:** Propuesta
**Fecha:** 2026-08-13
**Decisores:** Equipo de Arquitectura SGO-Logic (Grupo 3, Sección A) — pendiente de ratificación en reunión de equipo

## Contexto

El ERP-Core (AS/400, años 90) es la plataforma contable-fiscal de MegaStore. La Junta Directiva decidió que **no será reemplazado ni modificado** (DR-04). Su único mecanismo de recepción de resúmenes de ventas son archivos CSV o XML, procesables en ventanas de 30 minutos — no existe una API en tiempo real. Al mismo tiempo, la Directora de Finanzas exige trazabilidad completa y capacidad de reconstruir cualquier operación para auditorías de la SAT (DC-07), y hoy las diferencias de conciliación se investigan manualmente porque no hay detalle transaccional accesible.

## Decisión

Construimos un **Componente Adaptador de Sincronización ERP** que:

1. Escucha (vía el broker de mensajería, ADR-0001) los eventos de venta, devolución y facturación ya confirmados dentro de SGO-Logic.
2. Cada 30 minutos, agrupa los eventos pendientes de la ventana en un archivo CSV/XML con el formato que el ERP-Core espera.
3. Dispone el archivo en la ubicación/mecanismo que el ERP-Core consume.
4. Registra la confirmación de cada lote sincronizado (qué órdenes incluyó, cuándo) en el log de auditoría (DC-07), de forma que una diferencia de conciliación pueda rastrearse por lote y por orden individual sin investigación manual extensa.
5. Es **idempotente**: si un lote se reprocesa (ej. por reinicio del componente), no duplica registros hacia el ERP.

## Alternativas consideradas

| Alternativa | Ventajas | Desventajas | Por qué se descartó |
|---|---|---|---|
| Sincronización en tiempo real vía API | Conciliación inmediata, sin ventana de espera | El ERP-Core (AS/400) no expone una API en tiempo real — técnicamente inviable | Viola directamente DR-04; no es una opción real dado el sistema legacy |
| Job batch simple sin idempotencia ni registro de auditoría | Más rápido de construir | Riesgo de duplicar registros contables ante reintentos; no resuelve el problema actual de conciliación manual | No atiende DC-07 (auditabilidad); perpetúa el problema que motivó el proyecto |
| Adaptador batch con idempotencia y log de auditoría (elegido) | Respeta la restricción técnica del ERP; reduce la investigación manual de diferencias al exponer detalle transaccional por lote; reutiliza el broker ya adoptado en ADR-0001 | La ventana de 30 min sigue siendo una limitación de "casi tiempo real", no tiempo real | Es la única opción compatible con DR-04 que además mejora la auditabilidad actual |

## Consecuencias

**Positivas:**
- Cumple la restricción de no modificar el ERP-Core.
- Reduce el esfuerzo manual de conciliación al dejar trazabilidad por lote y por orden.
- Reutiliza la infraestructura de mensajería ya decidida en ADR-0001 — no agrega un componente de infraestructura nuevo.

**Negativas / tradeoffs aceptados:**
- Los reportes gerenciales que dependen del ERP nunca serán "en tiempo real" — hay una ventana de hasta 30 minutos, que debe comunicarse como limitación conocida y aceptada por Finanzas.
- Si el ERP-Core rechaza un lote (formato, error de datos), se necesita un mecanismo de alerta y reintento manual — a definir en detalle de implementación.

## Drivers que atiende

- DC-05, DC-07
- DR-04

## Vistas afectadas

- `Docs/Diagramas/componentes.drawio`
- `Docs/Diagramas/contexto.drawio`
- `Docs/Diagramas/despliegue.drawio`

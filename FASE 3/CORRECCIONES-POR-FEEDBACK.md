# Correcciones por retroalimentación de las fases anteriores

El enunciado de la Fase 3 pide modificar la documentación de las fases 1 y 2 de acuerdo con el feedback de sus revisiones. Este documento registra qué se observó, dónde se corrigió y cómo comprobarlo en el repositorio.

Las observaciones se resumen según lo que recuerda el equipo. No hay una copia escrita de las observaciones originales en el repositorio, y por eso cada corrección apunta a los commits y archivos que sí se pueden verificar.

## Fase 1: diagramas

**Qué se observó.** La retroalimentación de la Fase 1 fue sobre los diagramas. El auxiliar aprobó las correcciones.

**Dónde se corrigió.** Las correcciones se hicieron durante la Fase 2, que es donde se rehicieron y alinearon las vistas de arquitectura:

| Corrección | Dónde está | Commit |
|---|---|---|
| Diagrama de componentes de la Fase 2 | [diagrama-de-componentes.md](../FASE%202/DDA/diagrama-de-componentes.md) y `FASE 2/DRAWIO/` | `2f15dae` (11 de septiembre) |
| Diagrama de despliegue terminado | [diagrama-de-despliegue.md](../FASE%202/DDA/diagrama-de-despliegue.md) | `40a90c5` y `594b031` (15 de septiembre) |
| Casos de uso expandidos con su trazabilidad, uno por sección de la hoja de calificación | [casos-de-uso-expandidos.md](../FASE%202/DDA/casos-de-uso-expandidos.md) | `644f12d` (9 de septiembre) y `77807cf` (23 de septiembre) |
| Diagrama entidad-relación de la base de datos | `FASE 2/image/Diagrama-Entidad-Relacion-SGO-Logic-Fase2.png` | `232d373`, `ea51e01` y `c7b42e5` (21 de septiembre) |
| Vistas **implementadas** de bloques, componentes y despliegue, que coinciden con el código y con `docker-compose.yml` | Las mismas secciones de los dos documentos de arriba, con la correspondencia componente → paquete → contenedor | `a5f5a3d` (23 de septiembre) |
| Diagramas alineados con las incidencias integradas y la migración V8 | `FASE 2/DRAWIO/` y `FASE 2/image/` | `3fa8aa3` (25 de septiembre) |

Cómo comprobarlo: `git show <commit> --stat` muestra los archivos que cambió cada uno.

## Fase 2: ajustes posteriores a la calificación

Después de la calificación de la Fase 2 el equipo hizo estos cambios, del 28 de septiembre al 3 de octubre. El detalle día por día está en la [bitácora](../BITACORA.md) y el técnico en [PENDIENTES-BACKOFFICE.txt](../FASE%202/PENDIENTES-BACKOFFICE.txt).

| Ajuste | Qué cambió |
|---|---|
| Backoffice con datos reales | Se construyeron las 9 pantallas que seguían en placeholder y se conectaron Dashboard, Reportes y Mis órdenes a datos reales, en lugar de mocks |
| Endpoints del backoffice | Listado y búsqueda de órdenes, clientes, incidencias y reservas, y administración de parámetros y personal. Documentados en `FASE 2/backend/API.md` |
| Acceso del personal | Inicio de sesión del personal en el frontend; la lista de personal pasó a exigir rol ADMIN |
| Frontend en Docker | El frontend se compila y se sirve con nginx, y `docker compose up -d --build` levanta el sistema completo |
| Segunda auditoría | Se cruzó cada endpoint del backend con cada llamada del frontend. Se corrigieron el carrito, el perfil del cliente y la vista de factura, y se agregaron las pantallas de integraciones, avisos fallidos y facturas rechazadas |
| Pruebas | 22 pruebas más de los repositorios HTTP del backoffice y seis pruebas de punta a punta con Playwright contra el stack completo |
| Matriz de trazabilidad de la Fase 2 | Se actualizó con el Scrum incorporado, el frontend integrado y la lista de personal protegida (`be512d6`, 30 de septiembre) |

## Lo que cambió en la documentación por la Fase 3

- La nueva regla del crédito y el despliegue continuo están documentados en [FASE 3/DDA](DDA/README.md), con dos ADR, drivers, escenarios de calidad y diagramas.
- Los README de la raíz y de cada fase, la bitácora y el CHANGELOG se actualizaron con lo que ya existe, incluidas las 11 piezas del docker-compose y las migraciones hasta V21.
- El manual técnico dejó de describir una arquitectura de microservicios que no se implementó y ahora describe la real. La vista objetivo de microservicios se conserva como propuesta de evolución.

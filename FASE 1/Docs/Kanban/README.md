# Tablero Kanban — SGO-Logic

El enunciado exige un tablero **con foco arquitectural**, no de desarrollo tradicional: cada tarjeta representa un componente, patrón o decisión de diseño, priorizando el **Backbone** (componentes base de la arquitectura) antes que funcionalidades cosméticas.

## Columnas obligatorias

1. **To Do** — Requerimientos arquitecturales pendientes.
2. **Blocked** — Decisiones técnicas o falta de recursos que impiden el avance.
3. **In Progress** — Tareas de diseño o codificación activa.
4. **Ready for Testing** — Componentes listos para validación de integración.
5. **Test/QA** — Pruebas de cumplimiento de los escenarios de arquitectura (escalabilidad, seguridad, etc.).
6. **Done** — Funcionalidad desplegada y documentada.

## Criterio "Backbone-first"

Antes de mover una tarjeta "cosmética" (ej. mockup de una pantalla) a `In Progress`, debe existir ya en `Done` o `In Progress` la decisión estructural de la que depende. Ejemplos de orden correcto:

| Orden | Tarjeta | Por qué va antes |
|---|---|---|
| 1 | ADR: estrategia de resiliencia de pagos ante caída de PayKlik | Es un driver crítico (Black Friday, $150K de pérdida ya documentada) |
| 2 | Diagrama de despliegue reflejando el patrón de resiliencia elegido | Depende de la decisión anterior |
| 3 | Mockup de pantalla de checkout | Es cosmético; no bloquea ni es bloqueado por la arquitectura |

## Dónde vive el tablero

Este README documenta la estructura mientras el repo es solo local. Cuando el equipo cree el repositorio remoto (`AYD2_A_2S2025_PROYECTO_G3`), crear un **GitHub Project** vinculado al repo con estas mismas 6 columnas, y mover aquí solo el enlace:

- Tablero: `TODO: enlace al GitHub Project`

## Antes de cada revisión periódica

Antes de cada revisión periódica (sección 6.2 del enunciado), preparar un reporte de decisiones abiertas, evidencia nueva, riesgos y cambios — tomando como insumo el estado real del tablero.

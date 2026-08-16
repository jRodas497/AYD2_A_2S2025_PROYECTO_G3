# ADR-0001: Estilo arquitectónico — Monolito modular con integración asíncrona vía broker de mensajería

**Estado:** Propuesta
**Fecha:** 2026-08-13
**Decisores:** Equipo de Arquitectura SGO-Logic (Grupo 3, Sección A) — pendiente de ratificación en reunión de equipo

## Contexto

SGO-Logic debe soportar 8x el tráfico normal en Black Friday (DC-02), no perder órdenes ante fallas de PayKlik (DC-01), tolerar fallas conocidas de LogiExpress y notificaciones (DC-06), integrarse con POS y ERP-Core sin modificarlos (DR-04, DR-05), y ser mantenible por un equipo que domina Java/.NET y Docker básico, sin experiencia previa en orquestación tipo Kubernetes (DR-09, DC-09). El presupuesto es limitado ($150,000 de inversión, ≤$1,200/mes de operación — DR-01, DR-02) y el despliegue inicial es obligatoriamente on-premises (DR-10). El Black Friday del caso ocurre en un plazo corto: la arquitectura debe ser operable desde el primer mes.

## Decisión

Adoptamos un **monolito modular orientado a componentes**, con los componentes internos comunicándose mayormente a través de un **broker de mensajería** (colas/eventos) para las operaciones que requieren desacoplamiento y tolerancia a fallas (pagos, logística, notificaciones, sincronización con ERP), y llamadas síncronas directas (in-process) para operaciones que requieren consistencia inmediata (verificación y reserva de inventario, consulta de estado). Los componentes se despliegan como contenedores Docker independientes que comparten una base de datos relacional con esquemas separados por componente, preparando una futura extracción a servicios independientes sin necesidad de rediseño (ver ADR-0005).

## Alternativas consideradas

| Alternativa | Ventajas | Desventajas | Por qué se descartó |
|---|---|---|---|
| Monolito tradicional sin separación interna | Más simple de construir inicialmente | Mezcla responsabilidades (pagos, inventario, facturación); dificulta mantenibilidad y evolución hacia microservicios | No atiende DC-09 (mantenibilidad a largo plazo) ni DC-10 (evolutividad); alto acoplamiento hace más difícil aislar fallas de terceros (DC-06) |
| Microservicios completos desde el inicio (con orquestador tipo Kubernetes) | Máxima escalabilidad y aislamiento de fallas por diseño | Requiere competencias de orquestación que el equipo no tiene (DR-09); alto costo operativo y de aprendizaje incompatible con DR-01/DR-02; riesgo de no estar listo antes de Black Friday (DR-03) | Viola restricciones de presupuesto, capacidad del equipo y tiempo disponible |
| Monolito modular + broker de mensajería (elegido) | Balance entre lo que el equipo puede operar hoy (Docker básico, sin K8s) y la necesidad de desacoplar componentes críticos de fallas externas; costo de un broker open-source (ej. RabbitMQ) es compatible con DR-02; permite evolución futura a servicios independientes | Requiere disciplina de diseño para no degradar a monolito acoplado; el broker es un componente adicional a operar | Es la opción que mejor equilibra los drivers priorizados sin violar ninguna restricción dura |

## Consecuencias

**Positivas:**
- Aísla fallas de PayKlik, LogiExpress y notificaciones sin bloquear el flujo principal (atiende DC-01, DC-06).
- Compatible con el stack y la capacidad de operación actual del equipo (DR-09, DC-09).
- Costo de infraestructura compatible con DR-01/DR-02 (un broker open-source y contenedores on-prem).
- Dejar fronteras de componente claras facilita la migración planificada a nube (DC-10, ver ADR-0005).

**Negativas / tradeoffs aceptados:**
- Se acepta consistencia eventual en los flujos que pasan por el broker (ej. confirmación de pago no es 100% síncrona) — debe comunicarse claramente al cliente en el flujo de UX (fuera del alcance de este DDA).
- El broker se vuelve un componente crítico: su disponibilidad debe monitorearse (relacionado con la preocupación de monitoreo de Carlos Méndez).
- Compartir una única base de datos relacional (aunque con esquemas separados) es una limitación reconocida frente a "bases de datos por servicio"; se acepta como tradeoff pragmático para la Fase 1.

## Drivers que atiende

- DC-01, DC-02, DC-05, DC-06, DC-09, DC-10
- DR-01, DR-02, DR-09, DR-10

## Vistas afectadas

- `Docs/Diagramas/componentes.drawio`
- `Docs/Diagramas/despliegue.drawio`
- `Docs/Diagramas/bloques.drawio`

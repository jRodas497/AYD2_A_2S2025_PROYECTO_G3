# ADR-0005: Despliegue on-premises con evolución planificada a nube

**Estado:** Propuesta
**Fecha:** 2026-08-13
**Decisores:** Equipo de Arquitectura SGO-Logic (Grupo 3, Sección A) — pendiente de ratificación en reunión de equipo

## Contexto

La Junta Directiva exige que el despliegue inicial sea **on-premises**, para aprovechar la inversión existente, mantener control operativo durante la adopción y reducir el riesgo de transición de los sistemas legacy (DR-10). Al mismo tiempo, se exige que la arquitectura permita una **migración planificada hacia la nube** conforme crezca la demanda y la operación regional, para facilitar elasticidad ante eventos como Black Friday, mejorar recuperación ante desastres, y evitar que el crecimiento dependa de ampliar permanentemente la capacidad física instalada (DC-10). El presupuesto operativo es estrecho (≤$1,200/mes — DR-02) y se pide minimizar el consumo energético (DR-11). El equipo domina Docker básico, sin experiencia previa en Kubernetes.

## Decisión

Desplegamos los componentes de SGO-Logic (ADR-0001) como **contenedores Docker independientes on-premises**, orquestados inicialmente con **Docker Compose/Swarm** (no Kubernetes, para no exceder la capacidad operativa actual del equipo — DR-09). El diseño de componentes ya desacoplados vía broker de mensajería (ADR-0001) es intencional: son la frontera que permitirá, en una fase futura fuera de este alcance, migrar componentes individuales a un orquestador cloud (ej. Kubernetes gestionado) sin rediseñar el modelo de componentes ni sus interfaces externas. El dimensionamiento de contenedores se ajusta a la carga esperada normal, con capacidad adicional reservada para el pico de Black Friday (8x) dentro del límite físico disponible — el equipo documenta explícitamente que la elasticidad completa ante picos aún mayores es uno de los motivadores de la migración futura a nube.

## Alternativas consideradas

| Alternativa | Ventajas | Desventajas | Por qué se descartó |
|---|---|---|---|
| Nube pública desde el inicio | Elasticidad inmediata, sin límite físico | Viola directamente DR-10 (despliegue inicial obligatorio on-prem); no aprovecha la inversión existente | Incumple una restricción dura del caso, no es una opción válida para la Fase 1 |
| On-premises con Kubernetes desde el inicio | Prepara la migración a nube con la misma tecnología de orquestación | Requiere competencias que el equipo no tiene hoy (solo Docker básico); alto costo de aprendizaje y operación incompatible con DR-02/DR-09 en el plazo disponible | Se descarta para la Fase 1; documentado como paso intermedio natural antes de migrar a nube |
| On-premises con Docker Compose/Swarm + componentes desacoplados (elegido) | Compatible con la competencia actual del equipo; bajo costo operativo; las fronteras de componente ya preparan la migración futura sin rediseño | No ofrece elasticidad automática dentro de la Fase 1 — el pico de Black Friday se cubre con capacidad reservada, no con autoescalado | Es la única opción que respeta DR-10 y DR-09 simultáneamente sin comprometer el plazo antes de Black Friday |

## Consecuencias

**Positivas:**
- Cumple la decisión de la Junta de iniciar on-premises.
- No requiere capacitación intensiva antes del Black Friday inmediato.
- Las fronteras de componente (broker de mensajería, interfaces claras) dejan preparada la migración a nube sin rediseño completo del sistema.

**Negativas / tradeoffs aceptados:**
- La elasticidad ante el pico de 8x depende de capacidad física reservada de antemano, no de autoescalado — el equipo debe dimensionar con margen y monitorear de cerca durante el evento.
- La migración a nube completa es explícitamente **fuera del alcance de la Fase 1**; este ADR solo garantiza que el diseño no la bloquee.

## Drivers que atiende

- DC-02, DC-09, DC-10, DR-11
- DR-09, DR-10

## Vistas afectadas

- `Docs/Diagramas/despliegue.drawio`
- `Docs/Diagramas/bloques.drawio`

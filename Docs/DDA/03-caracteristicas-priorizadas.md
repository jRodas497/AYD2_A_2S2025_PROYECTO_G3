# Características del sistema priorizadas

> Prioriza los drivers de `04-drivers-funcionales.md`, `05-drivers-calidad.md` y `06-drivers-restriccion.md`. **El equipo debe revisar y poder defender cada puntaje** — no es un cálculo mecánico, es una decisión de negocio.

## Criterios (escala 1-5 cada uno)

- **Valor:** impacto en el objetivo estratégico de omnicanalidad / continuidad de negocio.
- **Riesgo:** probabilidad e impacto de que NO abordarlo cause una falla ya observada en el caso (ej. caída de pagos, doble venta).
- **Urgencia:** relación con la fecha fija de Black Friday (noviembre) y la exigencia de "ruta viable en el primer mes".
- **Impacto arquitectónico:** cuánto restringe o habilita el estilo/patrón arquitectónico elegido.

**Total = Valor + Riesgo + Urgencia + Impacto arquitectónico** (máximo 20). Se usa solo para ordenar de forma inicial — la prioridad final la decide el equipo, no el número.

## Priorización

| Driver | Descripción breve | Valor | Riesgo | Urgencia | Impacto arq. | Total | Justificación |
|---|---|---|---|---|---|---|---|
| DC-01 | Disponibilidad ante falla de PayKlik | 5 | 5 | 5 | 5 | **20** | Incidente ya materializado: 45 min de caída = USD 150,000. Sin esto, el resto de la arquitectura es irrelevante para Black Friday |
| CDU-01 / CDU-08 | Inventario centralizado en tiempo real (evitar doble venta) | 5 | 5 | 4 | 5 | **19** | Sin esto no hay omnicanalidad real; doble venta rompe la confianza del cliente y genera logística inversa |
| DC-02 | Elasticidad 8x en picos de demanda | 5 | 4 | 5 | 5 | **19** | Requisito explícito de Carlos Méndez (Gerente de TI); condiciona todo el diagrama de despliegue |
| DC-07 | Auditabilidad / trazabilidad completa | 5 | 4 | 4 | 4 | **17** | Ana Lucía Fuentes tiene **veto** sobre decisiones que reduzcan trazabilidad — no es negociable |
| DC-05 | Confiabilidad de integración (POS/ERP/inventario, con reintentos) | 4 | 4 | 4 | 5 | **17** | Condición explícita para poder enviar eventos a POS/ERP sin modificarlos (DR-04, DR-05) |
| DR-10 | Despliegue inicial on-prem + evolución planificada a nube | 4 | 3 | 2 | 5 | **14** | Define el estilo de despliegue de toda la arquitectura desde el inicio |
| DC-11 | Precisión operacional del despacho (-70% errores) | 4 | 3 | 3 | 3 | **13** | Objetivo cuantificado explícitamente por Roberto Quezada (Jefe de Logística) |
| DC-06 | Tolerancia a fallas de terceros (LogiExpress ~2%, notificaciones) | 4 | 4 | 3 | 4 | **15** | Tasa de falla documentada y conocida; debe tolerarse, no ignorarse |
| DC-08 | Seguridad / cumplimiento de datos de pago (no PAN/CVV) | 5 | 3 | 3 | 4 | **15** | Requisito de cumplimiento no negociable, con relación directa al veto de Finanzas |
| DC-04 | Rendimiento de auditoría (<1s) | 3 | 2 | 3 | 3 | **11** | Relevante para auditoría SAT, pero de menor urgencia que la resiliencia de pagos |
| DC-03 | Rendimiento de consulta de estado (<5s) | 3 | 2 | 3 | 3 | **11** | Experiencia de cliente/atención; impacto arquitectónico moderado (principalmente de datos/caché) |
| DR-09 | Stack Java/.NET/Docker del equipo interno | 3 | 2 | 2 | 4 | **11** | Condiciona qué alternativas tecnológicas son viables sin plan de capacitación |
| DR-06 / DR-07 | Contratos vigentes con PayKlik y LogiExpress | 3 | 2 | 2 | 4 | **11** | No se reemplazan proveedores; cualquier diseño de resiliencia debe construirse alrededor de ellos |
| DC-10 | Evolutividad / portabilidad a nube | 4 | 2 | 1 | 4 | **11** | Importante a mediano plazo, pero no urgente para el Black Friday inmediato |
| DC-09 | Mantenibilidad por equipo interno | 3 | 2 | 2 | 3 | **10** | Relevante para sostenibilidad operativa, pero no bloquea la entrega inicial |

## Lectura para el equipo

Los 5 primeros drivers (DC-01, CDU-01/08, DC-02, DC-07, DC-05) deben tener, cada uno, al menos un ADR dedicado — son los que más deberían defender en la presentación ante el comité. Los de la parte baja de la tabla siguen siendo drivers válidos, pero pueden resolverse con decisiones de menor riesgo o quedar como trabajo de refinamiento continuo (ADR que se revisa más adelante).

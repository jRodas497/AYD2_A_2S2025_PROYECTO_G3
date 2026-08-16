# Matrices de Trazabilidad

> Consolida el contenido de `Docs/DDA/01` a `06` y `Docs/ADR/0001` a `0005`. IDs: `ST-NN` (stakeholders, 02), `CUN-NN`/`CDU-NN` (funcionales, 01/04), `DC-NN` (calidad, 05), `DR-NN` (restricción, 06), `ADR-NNNN` (decisiones, `Docs/ADR/`).

## Stakeholder → Preocupación → Driver(s) relacionados

| ST | Stakeholder | Preocupación (resumen) | Drivers relacionados |
|---|---|---|---|
| ST-01 | Carlos Méndez (Gerente TI) | Continuidad en picos, no tocar ERP/POS, mantenibilidad, monitoreo | DC-01, DC-02, DC-09, DR-04, DR-05, DR-09 |
| ST-02 | Ana Lucía Fuentes (Finanzas, veto) | Trazabilidad, cumplimiento fiscal, auditabilidad | DC-04, DC-07, DR-08 |
| ST-03 | Roberto Quezada (Logística) | -70% errores de despacho, visibilidad de inventario | DC-11, DC-05, CDU-04, CDU-08 |
| ST-04 | Directora de Comercialización | Experiencia consistente entre canales, sin silos | CDU-01, DC-03 |
| ST-05 | Jefe de Operaciones | Impacto financiero de indisponibilidad | DC-01, DC-02 |
| ST-06 | Junta Directiva / Gerencia | Presupuesto, no tocar ERP-Core/POS | DR-01, DR-02, DR-04, DR-05 |
| ST-07 | Cliente final | Reconocimiento cross-canal, consulta <5s, notificaciones, carrito unificado | CDU-01, CDU-06, DC-03, DC-06 |
| ST-08 | Personal de tienda / atención | Vista consolidada de compra/pago/despacho/entrega | CDU-05, CDU-06, DC-07 |
| ST-09 | Equipo interno de TI | Stack conocido (Java/.NET/Docker) | DC-09, DR-09 |
| ST-10 | SAT | Facturación electrónica, auditoría anual | CDU-03, DC-04, DC-07, DR-08 |
| ST-11 | PayKlik | Contrato vigente, SLA conocido | DR-06, DC-01 |
| ST-12 | LogiExpress | Contrato vigente, SLA conocido | DR-07, DC-06 |

**Cobertura:** los 12 stakeholders tienen al menos un driver asociado. Ningún stakeholder queda "huérfano".

## Driver → Decisión (ADR) → Vista → Mecanismo de validación

### Drivers de calidad (DC)

| DC | Descripción breve | ADR | Vista(s) | Mecanismo de validación sugerido |
|---|---|---|---|---|
| DC-01 | Disponibilidad ante falla de PayKlik | ADR-0002 | componentes, despliegue | Prueba de caos: simular caída/timeout de PayKlik y verificar 0 órdenes perdidas |
| DC-02 | Elasticidad 8x (Black Friday) | ADR-0001, ADR-0005 | despliegue, bloques | Prueba de carga a 8x el tráfico normal, midiendo degradación de los demás Eac |
| DC-03 | Rendimiento — consulta de estado (<5s) | *(sin ADR dedicado — ver nota)* | despliegue | Medición de tiempo de respuesta bajo carga normal y pico |
| DC-04 | Rendimiento — auditoría (<1s) | *(sin ADR dedicado — ver nota)* | despliegue | Medición de tiempo de recuperación de evidencia de una transacción |
| DC-05 | Confiabilidad de integración | ADR-0001, ADR-0003 | componentes, despliegue | Interrumpir POS/ERP y verificar reintento sin pérdida de eventos |
| DC-06 | Tolerancia a fallas de terceros | ADR-0002, ADR-0004 | componentes, despliegue | Simular timeout de LogiExpress/notificaciones; la orden debe confirmarse igual |
| DC-07 | Auditabilidad / trazabilidad | ADR-0002, ADR-0003 | despliegue | Revisar que cada operación (pago, factura, conciliación) queda en el log de auditoría |
| DC-08 | Seguridad — no PAN/CVV | ADR-0002 | despliegue | Revisión de esquema de datos: verificar ausencia de campos PAN/CVV |
| DC-09 | Mantenibilidad por equipo interno | ADR-0001, ADR-0005 | despliegue | Checklist de stack tecnológico usado vs. competencias del equipo |
| DC-10 | Evolutividad / portabilidad a nube | ADR-0005 | despliegue, bloques | Revisar si un servicio puede extraerse sin tocar los demás |
| DC-11 | Precisión operacional del despacho (-70%) | ADR-0004 | componentes, despliegue | Simulación de asignación de despacho contra inventario; medir tasa de error |

> **Nota sobre DC-03 y DC-04:** no tienen un ADR dedicado porque, a diferencia de los demás Eac, no representan un tradeoff arquitectónico entre alternativas — se resuelven con decisiones de implementación (indexado y consulta directa en Order Service y Audit/Traceability Service) dentro del estilo ya fijado en ADR-0001. Si en la implementación aparece un tradeoff real (ej. necesidad de caché o réplica de lectura para sostener <5s en pico), **debe** documentarse como ADR nuevo.

### Drivers de restricción (DR)

| DR | Restricción | ADR / decisión que la respeta | Vista(s) | Mecanismo de validación sugerido |
|---|---|---|---|---|
| DR-01 | Inversión inicial ≤ $150,000 | ADR-0001 (componentes open-source) | — | Revisar presupuesto de inversión vs. componentes elegidos |
| DR-02 | Costo operativo ≤ $1,200/mes | ADR-0001, ADR-0005 | despliegue | Estimar costo mensual de infraestructura on-prem/broker |
| DR-03 | Black Friday fijo, ruta viable desde el mes 1 | ADR-0002 | — | Verificar que ADR-0002 sea implementable antes de Black Friday (plan de entrega) |
| DR-04 | No modificar ERP-Core | ADR-0003 | contexto, componentes, despliegue | Revisar que ningún flujo asuma sincronización en tiempo real con el ERP |
| DR-05 | No modificar POS | ADR-0001, ADR-0004 | contexto, componentes | Confirmar que POS solo recibe eventos, sin lógica nueva exigida |
| DR-06 | Contrato vigente PayKlik | ADR-0002 | despliegue | Confirmar que PayKlik sigue siendo el único proveedor de pago integrado |
| DR-07 | Contrato vigente LogiExpress | ADR-0004 | despliegue | Confirmar que LogiExpress sigue siendo el proveedor de logística integrado |
| DR-08 | Normativa SAT / protección de datos | ADR-0003 | componentes | Revisar que el XML fiscal conserve CUI y serie autorizada |
| DR-09 | Stack Java/.NET/Docker del equipo | ADR-0001, ADR-0005 | — | Checklist de stack (ver DC-09) |
| DR-10 | Despliegue inicial on-premises | ADR-0005 | despliegue | Confirmar despliegue on-prem con ruta de migración documentada |
| DR-11 | Minimizar consumo energético | ADR-0005 | despliegue | Revisar dimensionamiento de contenedores (evitar sobreaprovisionamiento) |

### Drivers funcionales (CDU) → Componente(s) → Driver de calidad/restricción relacionado

| CDU | Componente(s) que lo realizan | Vista | DC/DR relacionados |
|---|---|---|---|
| CDU-01 | Order Service, Inventory Service | componentes | DC-02, DC-05, DR-05, DR-10 |
| CDU-02 | Payment Service (ADR-0002) | componentes, despliegue | DC-01, DC-02, DC-06, DC-07, DC-08, DR-01, DR-02, DR-06 |
| CDU-03 | Invoicing Service | componentes | DC-04, DC-07, DR-08 |
| CDU-04 | Logistics Service (ADR-0004) | componentes, despliegue | DC-03, DC-06, DC-11, DR-05, DR-07 |
| CDU-05 | Order Service + Payment Service (extend) | componentes | DC-03, DC-07, DR-08 |
| CDU-06 | Order Service (consulta) | componentes | DC-03 |
| CDU-07 | ERP Sync Adapter (ADR-0003) | componentes, contexto, despliegue | DC-05, DC-07, DR-04 |
| CDU-08 | Inventory Service, POS Adapter | componentes | DC-02, DC-05, DR-05 |

## Cobertura (autoevaluación antes de entregar)

- [x] Todo stakeholder (02) tiene al menos una preocupación con driver asociado — ver 7.1.
- [x] Todo driver de calidad (05) tiene un escenario reflejado en `Docs/Diagramas/despliegue.drawio` — los 11 DC están anotados en el diagrama.
- [x] Los 5 drivers de mayor prioridad en `03-caracteristicas-priorizadas.md` (DC-01, CDU-01/08, DC-02, DC-07, DC-05) tienen ADR y vista.
- [x] DC-03 y DC-04 no tienen ADR dedicado — el equipo confirmó que es aceptable (ver nota en 7.2.a): son decisiones de implementación, no un tradeoff arquitectónico. Si aparece uno durante la implementación, se documentará como ADR-0006 en ese momento.
- [x] Todo ADR (`Docs/ADR/0001`–`0005`) referencia el/los driver(s) que responde y la(s) vista(s) afectada(s).
- [x] Ningún driver de prioridad **Alta** (03) queda sin decisión ni vista.

> Antes de la entrega final, revisar de nuevo que ningún cambio posterior a 01-06 o a los ADR haya roto esta trazabilidad.

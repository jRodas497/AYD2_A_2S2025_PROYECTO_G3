# Stakeholders y preocupaciones arquitectónicas

> Punto de partida: `Docs/Analisis/analisis-caso-megastore.md`. El enunciado exige **no asumir una clasificación dada de antemano** — el equipo debe validar, completar y re-priorizar esta tabla, no solo firmarla.

| ID | Stakeholder | Rol/tipo | Preocupación arquitectónica | Evidencia (referencia al caso) | Prioridad |
|---|---|---|---|---|---|
| ST-01 | Carlos Méndez | Gerente de TI (explícito) | Continuidad de negocio en picos de demanda, no modificar ERP-Core/POS, mantenibilidad por equipo interno, monitoreo de sistemas externos | "Si el sistema explota en el próximo Black Friday, mi puesto está en riesgo. Necesito que esté preparado para crecer." | Alta |
| ST-02 | Ana Lucía Fuentes | Directora de Finanzas (explícito, **con poder de veto**) | Trazabilidad de operaciones, cumplimiento fiscal, auditabilidad (<1s de recuperación de evidencia) | "Posee autoridad de veto sobre cualquier decisión que reduzca la trazabilidad... o comprometa el cumplimiento fiscal" | Alta |
| ST-03 | Roberto Quezada | Jefe de Logística (explícito) | Reducir errores de despacho en 70%, visibilidad de inventario en tiempo real | "Cada envío incorrecto genera un costo aproximado de USD 25... objetivo reducir estos errores en un 70%" | Alta |
| ST-04 | Directora de Comercialización | Explícito | Experiencia consistente entre canales, eliminar silos | "Nuestro cliente compra desde el celular a las 10pm... La experiencia debe ser la misma. No podemos tener silos." | Alta |
| ST-05 | Jefe de Operaciones | Explícito | Impacto financiero de indisponibilidad en eventos de alta demanda | Caída de PayKlik 45 min en Black Friday pasado = USD 150,000 en pérdidas | Alta |
| ST-06 | Junta Directiva / Gerencia | Explícito | Presupuesto ($150,000 inicial, ≤$1,200/mes operación), decisión irrevocable de no tocar ERP-Core/POS | "La Gerencia aprobó un presupuesto total de $150,000..." | Alta |
| ST-07 | Cliente final | Implícito | Reconocimiento cross-canal, consulta de estado <5s, notificaciones de estado, carrito unificado | Sección 4.2 — operación omnicanal esperada | Alta |
| ST-08 | Personal de tienda / atención al cliente | Implícito | Vista consolidada de compra/pago/despacho/entrega (hoy tarda hasta 7 días hábiles) | "Las devoluciones y cambios pueden tardar hasta siete días hábiles..." | Media |
| ST-09 | Equipo interno de TI (implementadores/operación) | Implícito | Stack conocido (Java/.NET/Docker); alternativa distinta exige plan de capacitación | "El equipo interno tiene experiencia principalmente en Java y .NET..." | Media |
| ST-10 | SAT | Implícito (regulador) | Cumplimiento de facturación electrónica (CUI, serie autorizada) y auditorías anuales | "Es obligatorio la emisión de facturas... antes de finalizar la orden" | Alta |
| ST-11 | PayKlik | Implícito (proveedor con contrato) | Contrato vigente por 3 años debe respetarse; SLA conocido (~800ms, hasta 5s en picos) | Sección 4.1 | Media |
| ST-12 | LogiExpress | Implícito (proveedor con contrato) | Contrato vigente por 2 años debe respetarse; SLA conocido (~2% timeout) | Sección 4.1 | Media |

## Criterio de prioridad usado (borrador — validar con el equipo)

- **Alta:** stakeholder con poder de veto, autoridad presupuestaria, o cuya preocupación está ligada a un incidente ya materializado y cuantificado en el caso (pérdida de $150K, 70% de errores a reducir, etc.).
- **Media:** stakeholder cuya preocupación es real pero no tiene poder de veto ni un incidente cuantificado directamente asociado; suele traducirse en restricciones (DR) más que en drivers de calidad de máxima prioridad.

_(Agregar filas si el equipo descubre más stakeholders al releer el caso. Mantener los ID `ST-NN` estables — se referencian desde la matriz de trazabilidad en `07-matrices-trazabilidad.md`.)_

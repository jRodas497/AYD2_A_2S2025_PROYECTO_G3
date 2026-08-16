# Drivers de Restricción

| ID | Restricción | Tipo | Fuente/evidencia | Implicación arquitectónica |
|---|---|---|---|---|
| DR-01 | Inversión inicial máxima $150,000 | Presupuesto | "La Gerencia aprobó un presupuesto total de $150,000" | Limita alcance de licenciamiento/herramientas comerciales; favorece componentes open-source o ya poseídos por MegaStore |
| DR-02 | Costo operativo ≤ $1,200/mes sin aprobación adicional | Presupuesto | Sección 4.2 | Restringe el tamaño de infraestructura on-prem/cloud temprana; cualquier servicio administrado de pago debe justificarse explícitamente en su ADR |
| DR-03 | Black Friday en noviembre, fecha fija | Tiempo | "La fecha comercial no puede trasladarse" | La ruta de resiliencia de pagos y facturación debe estar operativa desde el primer mes — no puede tratarse como trabajo de una fase posterior |
| DR-04 | No modificar ni reemplazar ERP-Core (AS/400) | Tecnología/organizacional | Decisión de Junta Directiva | Integración obligatoriamente batch vía CSV/XML en ventanas de 30 min; ningún flujo puede asumir sincronización en tiempo real con el ERP |
| DR-05 | No modificar ni reemplazar POS de tiendas | Tecnología/organizacional | "Estas instalaciones tampoco forman parte de un programa de reemplazo" | POS debe recibir eventos desde SGO-Logic vía un adaptador con manejo de errores y reintentos, nunca al revés |
| DR-06 | Contrato vigente con PayKlik (3 años) | Contractual | Sección 4.1 | No se reemplaza el proveedor de pagos; cualquier mecanismo de resiliencia debe construirse alrededor de PayKlik, no en sustitución de él (salvo un segundo proveedor complementario, a decidir por ADR) |
| DR-07 | Contrato vigente con LogiExpress (2 años) | Contractual | Sección 4.1 | No se reemplaza el proveedor de logística; el diseño debe tolerar su tasa de timeout (~2%) en vez de asumir un proveedor alterno |
| DR-08 | Cumplimiento normativa de protección de datos y facturación electrónica SAT | Regulatorio | Sección 4.2 | XML fiscal debe conservar CUI y serie autorizada; posible variación normativa entre Guatemala/El Salvador/Costa Rica a validar con el equipo |
| DR-09 | Equipo interno domina Java/.NET y Docker básico | Organizacional/capacidad | "Una alternativa que requiera competencias distintas deberá incluir impacto de adopción, capacitación y operación" | Preferir stack ya dominado; toda alternativa distinta debe traer análisis explícito de adopción/capacitación en su ADR |
| DR-10 | Despliegue inicial obligatorio on-premises | Tecnología/estratégico | "El despliegue inicial se realizará en infraestructura local" | La arquitectura debe funcionar on-prem desde el día uno, y a la vez dejar una ruta de migración a nube sin rediseño completo (ver DC-10) |
| DR-11 | Minimizar consumo energético de infraestructura | Sostenibilidad | "La organización desea minimizar el consumo energético" | Favorecer dimensionamiento ajustado (evitar sobre-aprovisionamiento on-prem) y considerarlo como criterio al comparar alternativas de infraestructura |

_(Agregar filas según se descubran más restricciones. Cada DR debe quedar referenciado en la matriz de trazabilidad, sección 07.)_

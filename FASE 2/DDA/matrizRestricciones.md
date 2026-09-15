# **Matriz de Restricciones**

 Cruza los drivers de restricción (`R 01`–`R 11`) contra los drivers funcionales (`RF 01`–`RF 11`) y de calidad (`RC 01`–`RC 10`) definidos en [`driversArquitectonicos.md`](driversArquitectonicos.md). `X` indica que la restricción condiciona directamente **cómo** debe implementarse ese driver (limita alternativas, obliga un mecanismo específico o fija un plazo/tope); una celda vacía indica que no hay una relación directa — el driver se resuelve por decisión de diseño del equipo, sin que una restricción externa lo determine.

## Matriz R × (RF + RC)

| R | RF01 | RF02 | RF03 | RF04 | RF05 | RF06 | RF07 | RF08 | RF09 | RF10 | RF11 | RC01 | RC02 | RC03 | RC04 | RC05 | RC06 | RC07 | RC08 | RC09 | RC10 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **R 01** | X | | X | X | X | X | X | X | X | X | X | | | X | X | X | | X | X | X | X |
| **R 02** | X | | X | X | X | X | X | X | X | X | X | | | X | X | X | | X | X | X | X |
| **R 03** | | | | | | | | | | | | | | X | | | | | | | X |
| **R 04** | X | | X | X | | X | X | X | X | X | | | X | | | | | X | X | | |
| **R 05** | | | | | | | | | | | | | | | | | | | | | |
| **R 06** | | | | | | | | | | | | | | | | | | | | | |
| **R 07** | | | | | | | | X | X | | | | | | X | | | | | X | |
| **R 08** | | | | | X | | | | | | | | | X | | | | | | | X |
| **R 09** | | | | | | | | | | | | | | X | | | | | | | X |
| **R 10** | | | | | X | X | X | | | | | | | X | X | X | | | | X | |
| **R 11** | | | | | | X | X | | | | | | X | | | | | X | | | |

> Convención de marca: **X = impacto directo**. No se usan niveles intermedios (H/M/B) en esta iteración; se deja como posible refinamiento futuro si el equipo lo requiere.

## Justificación por restricción

- **R 01 — Arquitectura de Fase 1:** afecta todos los RF que se realizan mediante un componente/patrón ya fijado en los ADR de Fase 1 (Order/Checkout, Inventory, Payment con outbox+circuit breaker, Invoicing/SAT, ERP Sync Adapter, POS Adapter, Logistics, Notification), y a los RC que dependen de esos patrones (escalabilidad, disponibilidad, tolerancia a fallos, seguridad de registro, consistencia, portabilidad). No aplica a RF02 (consulta de órdenes) ni RC01 (rendimiento de consulta) ni RC06 (no PAN/CVV) porque, igual que en Fase 1, son decisiones de implementación sin un ADR/estilo específico que las determine.
- **R 02 — Microservicios/Capas desacoplados:** es la contraparte estructural de R 01 (misma arquitectura, visto desde el ángulo de desacoplamiento/separación de responsabilidades); por eso comparte exactamente las mismas columnas que R 01.
- **R 03 — Docker:** solo condiciona atributos de infraestructura transversal (escalabilidad vía Compose/Swarm, portabilidad vía contenedores), no un RF puntual.
- **R 04 — Persistencia:** afecta a todo RF que requiere estado durable (carrito, inventario, reserva temporal, auditoría de pagos, facturación, sync AS/400, sync POS, despacho) y a los RC que dependen de ese estado (rendimiento de auditoría, registro de seguridad, consistencia de inventario).
- **R 05 — Control de versiones** y **R 06 — Git Flow:** son restricciones de proceso de desarrollo, no de arquitectura de software; no determinan cómo se comporta ningún RF/RC, por lo que quedan sin marcas (igual tratamiento que Fase 1 dio a DC-03/DC-04: se documentan explícitamente en vez de dejarlas como un olvido).
- **R 07 — Sistemas legados:** limita específicamente cómo se integran RF08 (CSV/XML batch hacia AS/400) y RF09 (eventos hacia POS), y por extensión RC04/RC09 (la resiliencia debe construirse en el adaptador, no modificando el sistema legado).
- **R 08 — Presupuesto inicial ($150,000):** limita la resiliencia de pagos a mecanismos propios/open-source en vez de un segundo proveedor comercial (RF05), y en general favorece infraestructura no licenciada (RC03, RC10).
- **R 09 — Infraestructura ($1,200/mes):** mismo efecto que R 08 pero en el costo operativo recurrente; condiciona el dimensionamiento de escalabilidad y portabilidad (RC03, RC10).
- **R 10 — Fecha de operación (antes de Black Friday):** la evidencia del caso liga explícitamente "pagos y facturación" a la fecha fija, y la auditoría de intentos fallidos de pago como parte de esa misma ruta — de ahí RF05/RF06/RF07; a nivel de calidad, obliga a que escalabilidad, disponibilidad y tolerancia a fallos ya estén operativas para esa fecha (RC03, RC04, RC05, RC09).
- **R 11 — Auditoría fiscal:** condiciona directamente los RF que generan el registro auditable (auditoría de pagos, facturación) y los RC de rendimiento/seguridad de ese registro (RC02, RC07).

## Cobertura (autoevaluación antes de entregar)

- [x] Las 11 restricciones (`R 01`–`R 11`) están representadas como fila, incluidas R 05/R 06 (documentadas como "sin relación directa" en vez de omitidas).
- [x] Los 11 RF y los 10 RC aparecen como columna.
- [x] RF02, RC01 y RC06 quedan sin ninguna X — se documenta explícitamente el motivo (decisión de implementación / no cubierta por ninguna de las 11 restricciones listadas) en vez de dejarlo ambiguo.
- [ ] Pendiente de revisión por el equipo: confirmar que ninguna celda marcada o vacía contradiga una decisión ya tomada en el diagrama de componentes o en los ADR de Fase 1.
- [ ] Si el equipo decide más adelante introducir niveles de impacto (H/M/B), reemplazar la X por la letra correspondiente en esta misma tabla, no crear una tabla paralela.

_(Documento nuevo — mismo estilo narrativo de `FASE 1/Docs/DDA/07-matrices-trazabilidad.md`: tabla + justificación + checklist de cobertura, adaptado a la matriz de restricciones de Fase 2.)_

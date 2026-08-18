# Drivers Funcionales — Casos de Uso Expandidos (CDU)

> Cada CDU deriva de un CUN de `01-caso-negocio.md`. La especificación completa de cada uno (actor, precondiciones, flujo principal, flujos alternativos, flujos de excepción, postcondiciones, reglas de negocio) vive como documento independiente en [`casos-de-uso/`](casos-de-uso/) — esta página es el índice de trazabilidad rápida.

## Diagrama de Casos de Uso Expandidos (CDU) — Sistema SGO-Logic

![Diagrama de Casos de Uso Expandidos (CDU)](diagramas/cdu.png)

Fuente editable: [`diagramas/cdu.drawio`](diagramas/cdu.drawio). A diferencia del CUN (`01-caso-negocio.md`, nivel de negocio, actores y casos de uso con diagonal en la esquina inferior derecha), este diagrama fija el límite del **sistema de interés** (SGO-Logic) con notación UML estándar (sin diagonal) y expande cada caso de uso con sus actores secundarios (PayKlik, LogiExpress, SAT, ERP-Core, POS).

| CDU | Nombre | Actor principal | Drivers de calidad | Drivers de restricción | Documento completo |
|---|---|---|---|---|---|
| CDU-01 | Realizar Compra Omnicanal | Cliente | DC-02, DC-05 | DR-05, DR-10 | [casos-de-uso/CDU-01-realizar-compra-omnicanal.md](casos-de-uso/CDU-01-realizar-compra-omnicanal.md) |
| CDU-02 | Procesar Pago de la Orden | Cliente | DC-01, DC-02, DC-06, DC-07, DC-08 | DR-01, DR-02, DR-06 | [casos-de-uso/CDU-02-procesar-pago-de-la-orden.md](casos-de-uso/CDU-02-procesar-pago-de-la-orden.md) |
| CDU-03 | Emitir Documentación Fiscal | Sistema (automático) | DC-04, DC-07 | DR-08 | [casos-de-uso/CDU-03-emitir-documentacion-fiscal.md](casos-de-uso/CDU-03-emitir-documentacion-fiscal.md) |
| CDU-04 | Gestionar Despacho y Entrega | Personal de Logística | DC-03, DC-06, DC-11 | DR-05, DR-07 | [casos-de-uso/CDU-04-gestionar-despacho-y-entrega.md](casos-de-uso/CDU-04-gestionar-despacho-y-entrega.md) |
| CDU-05 | Gestionar Devolución y Reembolso | Cliente / Personal de Atención | DC-03, DC-07 | DR-08 | [casos-de-uso/CDU-05-gestionar-devolucion-y-reembolso.md](casos-de-uso/CDU-05-gestionar-devolucion-y-reembolso.md) |
| CDU-06 | Consultar Estado de Orden | Cliente / Personal de Atención | DC-03 | — | [casos-de-uso/CDU-06-consultar-estado-de-orden.md](casos-de-uso/CDU-06-consultar-estado-de-orden.md) |
| CDU-07 | Conciliar Ventas con ERP | Finanzas | DC-05, DC-07 | DR-04 | [casos-de-uso/CDU-07-conciliar-ventas-con-erp.md](casos-de-uso/CDU-07-conciliar-ventas-con-erp.md) |
| CDU-08 | Gestionar Inventario Centralizado | Personal de Logística | DC-02, DC-05 | DR-05 | [casos-de-uso/CDU-08-gestionar-inventario-centralizado.md](casos-de-uso/CDU-08-gestionar-inventario-centralizado.md) |

## Decisiones de negocio ya confirmadas por el equipo (referenciadas en varios CDU)

- **Liberación de inventario reservado:** 20 minutos de inactividad (CDU-01, CDU-08).
- **Aprobación de reembolsos:** obligatoria para montos > USD 500 o ventas con financiamiento activo (CDU-05).
- **Meta de resolución de devoluciones:** máximo 2 días hábiles, frente a los 7 días hábiles actuales (CDU-05).

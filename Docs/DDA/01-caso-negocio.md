# Identificación del caso de negocio

> Fuente: `Docs/Analisis/analisis-caso-megastore.md`. El equipo debe revisarlo, discutirlo y apropiárselo antes de considerarlo parte del DDA final.

## Objetivo estratégico

MegaStore quiere que un cliente pueda **iniciar, continuar y completar una compra desde cualquier canal** (tienda física, web, app móvil, centro de atención) con una experiencia consistente, sin silos de información entre canales. La iniciativa que habilita este objetivo es **SGO-Logic**. El sistema de interés no reemplaza los sistemas legacy (ERP-Core, POS) sino que orquesta la operación omnicanal por encima de ellos.

## Diagrama de Casos de Uso de Negocio (CUN) — alto nivel

Actores de negocio identificados: **Cliente**, **Personal de Tienda/Atención**, **Personal de Logística**, **Finanzas**. Los sistemas externos (PayKlik, LogiExpress, SAT, ERP-Core) aparecen como actores secundarios porque el negocio depende de ellos pero no los controla.

![Diagrama de Casos de Uso de Negocio (CUN)](diagramas/cun.png)

Fuente editable: [`diagramas/cun.drawio`](diagramas/cun.drawio) (draw.io — layout jerárquico generado con Graphviz, ajustable manualmente en VS Code con la extensión `hediet.vscode-drawio`).

> **Notación:** los actores y casos de uso de este diagrama llevan una diagonal en la esquina inferior izquierda — la marca estándar de modelado de negocio (UML Business Actor / Business Use Case) que distingue el nivel de negocio (CUN) del nivel de sistema (CDU, sin diagonal — ver [`04-drivers-funcionales.md`](04-drivers-funcionales.md)).

## Primera descomposición

| CUN | Actor de negocio | Objetivo | CUN relacionados |
|---|---|---|---|
| CUN-01 | Realizar Compra Omnicanal | Permitir iniciar/continuar/completar una compra cruzando canales, con carrito unificado y reconocimiento del cliente en todo el proceso | CUN-02, CUN-08 |
| CUN-02 | Procesar Pago de la Orden | Registrar y confirmar el cobro de una orden (tarjeta, transferencia, billetera digital), incluyendo intentos fallidos, sin depender exclusivamente de PayKlik | CUN-01, CUN-03 |
| CUN-03 | Emitir Documentación Fiscal | Generar y enviar la factura electrónica a la SAT (XML, CUI, serie autorizada) antes de finalizar la orden | CUN-02, CUN-07 |
| CUN-04 | Gestionar Despacho y Entrega | Determinar desde dónde y a quién despachar (CD, tienda o pickup), incluso si el método cambia después de confirmada la compra | CUN-01, CUN-08 |
| CUN-05 | Gestionar Devolución y Reembolso | Vincular una devolución/reembolso con la venta original, manteniendo trazabilidad completa | CUN-02, CUN-06 |
| CUN-06 | Consultar Estado de Orden | Permitir a cliente y personal de atención ver el estado consolidado (compra, pago, despacho, entrega) desde cualquier canal | CUN-01, CUN-04, CUN-05 |
| CUN-07 | Conciliar Ventas con ERP | Sincronizar resúmenes de venta con el ERP-Core vía batch CSV/XML cada 30 min, sin modificar el ERP | CUN-03 |
| CUN-08 | Gestionar Inventario Centralizado | Dar visión única de existencias/reservas entre los 2 centros de distribución y las 32 tiendas, evitando doble compromiso de una unidad | CUN-01, CUN-04 |

## Alcance y fuera de alcance

**Dentro del alcance de SGO-Logic:**
- Orquestación de la compra omnicanal (carrito unificado, reconocimiento de cliente entre canales).
- Reserva/liberación de inventario y visión centralizada de existencias.
- Registro y trazabilidad de intentos de pago (relacionados a orden, canal, fecha, resultado).
- Coordinación de despacho/entrega y su cambio post-confirmación.
- Emisión de documentación fiscal antes de finalizar la orden.
- Consulta de estado de orden e historial (compras, devoluciones, incidencias).
- Notificaciones al cliente, de forma no bloqueante ante fallas del proveedor externo.
- Sincronización batch con el ERP-Core.

**Fuera de alcance (explícitamente, por evidencia del caso):**
- Reemplazo o modificación del ERP-Core (AS/400) — decisión de la Junta Directiva.
- Reemplazo o modificación de los POS de tienda — sin programa de reemplazo.
- Reemplazo de PayKlik o LogiExpress — contratos vigentes (3 y 2 años respectivamente) deben respetarse.
- Implementación funcional del prototipo (Entregable 4 pide mockups no funcionales, no código).

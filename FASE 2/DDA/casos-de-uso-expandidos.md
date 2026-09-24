# Casos de uso expandidos — Fase 2

Cada CDU expandido parte de un caso de uso de negocio (CUN) y de su CDU descriptivo de la Fase 1,
y baja a los casos concretos que el sistema implementa. Los seis de la segunda tabla llevan
abajo un recuadro de **trazabilidad** que amarra el CDU con su modelo de datos, su componente en
el despliegue y su código, que son los cuatro artefactos que exige la tabla de condiciones por
omisión de trazabilidad.

La matriz completa, criterio por criterio de la hoja de calificación, está en
[matriz-trazabilidad-fase2.md](matriz-trazabilidad-fase2.md).

## CDU expandidos del refinamiento documental

| CDU expandido | CUN / CDU de origen | Imagen · editable |
|---|---|---|
| Realizar Compra | CUN-01 · CDU-01 | [PNG](../image/CDU-Expandido-Realizar-Compra.png) · [drawio](../DRAWIO/CDU-Expandido-Realizar-Compra.drawio) |
| Consultar Producto | CUN-01 · CDU-01 | [PNG](../image/CDU-Expandido-Consultar-Producto.png) · [drawio](../DRAWIO/CDU-Expandido-Consultar-Producto.drawio) |
| Gestionar Clientes | Gestionar Clientes (CDU de alto nivel) | [PNG](../image/CDU-Expandido-Gestionar-Clientes.png) · [drawio](../DRAWIO/CDU-Expandido-Gestionar-Clientes.drawio) |
| Gestión Logística y Distribución | CUN-04 · CDU-04, CDU-05 | [PNG](../image/CDU-Expandido-Gestion-Logistica.png) · [drawio](../DRAWIO/CDU-Expandido-Gestion-Logistica.drawio) |
| Auditoría y Trazabilidad | CUN-07 · CDU-07 | [PNG](../image/CDU-Expandido-Auditoria.png) · [drawio](../DRAWIO/CDU-Expandido-Auditoria.drawio) |
| Configuración del Sistema | Configuración (CDU de alto nivel) | [PNG](../image/CDU-Expandido-Configuracion.png) · [drawio](../DRAWIO/CDU-Expandido-Configuracion.drawio) |

## CDU expandidos de la implementación, uno por sección de la hoja

Se agregaron porque varios criterios de la hoja de calificación no tenían un caso de uso con su
nombre en ningún diagrama —reintentar pago, consultar factura, continuar la compra en otro canal,
reservar y liberar inventario, asignar origen, registrar atención, consultar historial,
sincronizar con el ERP— y la tabla de omisión deja una funcionalidad así en 25% aunque el código
exista. Amplían los de arriba; no los reemplazan.

| CDU expandido | Criterios de la hoja que cubre | CUN / CDU de origen | Imagen · editable |
|---|---|---|---|
| Carrito Omnicanal y Confirmar Orden | Confirmar orden · Continuar compra en otro canal · Agregar o quitar productos | CUN-01 · CDU-01 | [PNG](../image/CDU-Expandido-Carrito-Omnicanal.png) · [drawio](../DRAWIO/CDU-Expandido-Carrito-Omnicanal.drawio) |
| Pago y Facturación Electrónica | Recibir pago · Reintentar pago · Emitir factura · Consultar factura | CUN-02, CUN-03 · CDU-02, CDU-03 | [PNG](../image/CDU-Expandido-Pago-y-Facturacion.png) · [drawio](../DRAWIO/CDU-Expandido-Pago-y-Facturacion.drawio) |
| Gestión de Inventario Centralizado | Consultar · Reservar · Liberar · Actualizar inventario | CUN-08 · CDU-08 | [PNG](../image/CDU-Expandido-Gestion-Inventario.png) · [drawio](../DRAWIO/CDU-Expandido-Gestion-Inventario.drawio) |
| Despacho y Entrega | Solicitar envío a LogiExpress · Asignar origen y destino · Actualizar estado de envío | CUN-04 · CDU-04 | [PNG](../image/CDU-Expandido-Despacho-y-Entrega.png) · [drawio](../DRAWIO/CDU-Expandido-Despacho-y-Entrega.drawio) |
| Atención al Cliente | Consultar estado de la orden · Registrar atención · Consultar historial | CUN-05, CUN-06 · CDU-05, CDU-06 | [PNG](../image/CDU-Expandido-Atencion-al-Cliente.png) · [drawio](../DRAWIO/CDU-Expandido-Atencion-al-Cliente.drawio) |
| Auditar y Consolidar | Sincronizar ventas con ERP · Informe de ventas | CUN-07 · CDU-07 | [PNG](../image/CDU-Expandido-Auditar-y-Consolidar.png) · [drawio](../DRAWIO/CDU-Expandido-Auditar-y-Consolidar.drawio) |

## Notación

Misma paleta y notación que los CDU del refinamiento. Los actores primarios van a la izquierda en
azul; los sistemas externos (PayKlik, SAT, LogiExpress, POS, ERP-Core) a la derecha en amarillo.
`<<Include>>` apunta del caso base al incluido. `<<Extend>>` apunta de la extensión al caso que
extiende, como define UML: por ejemplo, *Reintentar Pago* extiende *Recibir Pago* cuando PayKlik
no responde, y *Liberar Inventario* extiende *Reservar Producto* cuando la compra no se concreta.

Donde el caso de uso está modelado pero el MVP no lo implementa, el recuadro de trazabilidad lo
dice en la línea **Pendiente en el MVP**, en vez de listar un código que no existe.

# Drivers Funcionales — Casos de Uso Expandidos (CDU)

> Cada CDU deriva de un CUN de `01-caso-negocio.md`. Flujos alternativos y postcondiciones revisados y confirmados por el equipo.

---

### CDU-01 — Realizar Compra Omnicanal

- **CUN de origen:** CUN-01
- **Actor(es):** Cliente (principal); Inventario Centralizado (CDU-08, secundario)
- **Precondiciones:** Cliente identificado o identificable en el canal; catálogo y disponibilidad accesibles.
- **Flujo principal:**
  1. Cliente agrega productos al carrito desde cualquier canal (tienda, web, app, call center).
  2. Sistema verifica disponibilidad en tiempo real contra el inventario centralizado (CDU-08).
  3. Sistema reserva la unidad para evitar doble compromiso.
  4. Cliente puede continuar la compra desde un canal distinto al que inició, conservando el carrito.
  5. Cliente confirma la compra y selecciona método de entrega.
  6. Sistema dispara CDU-02 (Procesar Pago de la Orden).
- **Flujos alternativos:**
  - 2a. Producto no disponible → sistema notifica y sugiere alternativa o tienda con existencia.
  - 5a. Cliente abandona la compra sin confirmar → el inventario reservado se libera automáticamente a los **20 minutos** de inactividad (confirmado por el equipo; balance entre no bloquear stock y dar tiempo suficiente para completar el pago).
- **Postcondiciones:** Orden creada en estado "pendiente de pago" con inventario reservado; carrito visible igual en cualquier canal.
- **Drivers de calidad relacionados:** DC-02, DC-05
- **Drivers de restricción relacionados:** DR-05, DR-10

---

### CDU-02 — Procesar Pago de la Orden

- **CUN de origen:** CUN-02
- **Actor(es):** Cliente (principal); PayKlik (secundario/externo)
- **Precondiciones:** Orden en estado "pendiente de pago" con inventario reservado.
- **Flujo principal:**
  1. Cliente elige método de pago (tarjeta, transferencia, billetera digital).
  2. Sistema envía el intento de cobro a PayKlik.
  3. Sistema registra el intento (orden, canal, fecha, resultado), exitoso o fallido.
  4. Si el cobro es exitoso, sistema confirma la orden y dispara CDU-03 (Emitir Documentación Fiscal).
- **Flujos alternativos:**
  - 2a. PayKlik no responde o falla → sistema reintenta/encola el intento sin perder la orden (mecanismo concreto a definir vía ADR de resiliencia de pagos).
  - 2b. Latencia de PayKlik supera el umbral aceptable en pico de demanda → se aplica degradación controlada.
- **Postcondiciones:** Orden confirmada, o marcada como pago pendiente/fallido, con historial auditable de todos los intentos.
- **Drivers de calidad relacionados:** DC-01, DC-02, DC-06, DC-07, DC-08
- **Drivers de restricción relacionados:** DR-01, DR-02, DR-06

---

### CDU-03 — Emitir Documentación Fiscal

- **CUN de origen:** CUN-03
- **Actor(es):** Sistema (automático, principal); SAT (secundario/externo)
- **Precondiciones:** Pago confirmado (CDU-02).
- **Flujo principal:**
  1. Sistema genera el XML de factura con CUI y serie autorizada.
  2. Sistema envía el XML a la SAT antes de finalizar la orden.
  3. SAT responde con validación/autorización.
  4. Sistema marca la orden como facturada y continúa hacia CDU-04 (Gestionar Despacho y Entrega).
- **Flujos alternativos:**
  - 3a. SAT responde con demora o error → sistema reintenta; la orden no se despacha sin resolución fiscal.
- **Postcondiciones:** Factura electrónica emitida y vinculada a la orden; evento queda listo para CDU-07 (Conciliar con ERP).
- **Drivers de calidad relacionados:** DC-04, DC-07
- **Drivers de restricción relacionados:** DR-08

---

### CDU-04 — Gestionar Despacho y Entrega

- **CUN de origen:** CUN-04
- **Actor(es):** Personal de Logística (principal); LogiExpress (secundario/externo); Cliente
- **Precondiciones:** Orden facturada (CDU-03).
- **Flujo principal:**
  1. Sistema determina el punto de despacho (centro de distribución, tienda o pickup) según disponibilidad e inventario centralizado (CDU-08).
  2. Logística recibe la orden a preparar con ubicación de origen y destinatario.
  3. Sistema genera guía con LogiExpress cuando aplica.
  4. Sistema recibe y propaga actualizaciones de estado (preparación, tránsito, entrega).
- **Flujos alternativos:**
  - 1a. Cliente cambia el método de entrega después de confirmada la compra → sistema actualiza el punto de despacho sin perder trazabilidad de la orden.
  - 3a. LogiExpress responde con timeout (~2% de las solicitudes) → sistema reintenta y no bloquea la operación principal.
- **Postcondiciones:** Orden despachada con estado de entrega actualizado; inventario de origen decrementado.
- **Drivers de calidad relacionados:** DC-03, DC-06, DC-11
- **Drivers de restricción relacionados:** DR-05, DR-07

---

### CDU-05 — Gestionar Devolución y Reembolso

- **CUN de origen:** CUN-05
- **Actor(es):** Cliente, Personal de Atención
- **Precondiciones:** Orden entregada (o parcialmente entregada).
- **Flujo principal:**
  1. Cliente o personal de atención inicia una devolución/cambio referenciando la venta original.
  2. Sistema muestra vista consolidada de compra, pago, despacho y entrega — sin llamadas ni conciliación manual.
  3. Sistema valida elegibilidad y procesa el reembolso (extiende CDU-02).
  4. Sistema vincula la devolución/reembolso a la venta original de forma trazable.
- **Flujos alternativos:**
  - 3a. Reembolso mayor a **USD 500** o de una venta con financiamiento activo (3/6/12 meses) → requiere aprobación de Finanzas (Directora de Finanzas o persona delegada) antes de liberarse (confirmado por el equipo).
- **Postcondiciones:** Devolución resuelta en **máximo 2 días hábiles** (meta confirmada por el equipo frente a los 7 días hábiles actuales, habilitada por la vista consolidada del paso 2), con historial completo disponible para auditoría.
- **Drivers de calidad relacionados:** DC-03, DC-07
- **Drivers de restricción relacionados:** DR-08

---

### CDU-06 — Consultar Estado de Orden

- **CUN de origen:** CUN-06
- **Actor(es):** Cliente, Personal de Atención
- **Precondiciones:** Orden existente en el sistema.
- **Flujo principal:**
  1. Actor solicita el estado de una orden desde cualquier canal o dispositivo.
  2. Sistema responde con la vista consolidada (compra, pago, despacho, entrega, incidencias) en menos de 5 segundos.
- **Flujos alternativos:**
  - 1a. Falla el canal de notificación proactiva → el cliente igual puede consultar el estado bajo demanda; la operación principal no depende de las notificaciones.
- **Postcondiciones:** Ninguna (consulta de solo lectura).
- **Drivers de calidad relacionados:** DC-03
- **Drivers de restricción relacionados:** —

---

### CDU-07 — Conciliar Ventas con ERP

- **CUN de origen:** CUN-07
- **Actor(es):** Finanzas (principal); ERP-Core (secundario/externo)
- **Precondiciones:** Existen órdenes facturadas pendientes de sincronizar.
- **Flujo principal:**
  1. Sistema agrupa las ventas confirmadas en una ventana de tiempo.
  2. Sistema genera archivo CSV/XML compatible con ERP-Core.
  3. Sistema deja disponible el archivo para que el ERP lo procese (ventana de 30 min).
  4. Sistema registra la confirmación de sincronización para auditoría.
- **Flujos alternativos:**
  - 3a. Se detectan diferencias en la conciliación → el sistema debe exponer el detalle transaccional para reducir la investigación manual actual.
- **Postcondiciones:** Ventas reflejadas en el ERP-Core sin modificar el ERP mismo.
- **Drivers de calidad relacionados:** DC-05, DC-07
- **Drivers de restricción relacionados:** DR-04

---

### CDU-08 — Gestionar Inventario Centralizado

- **CUN de origen:** CUN-08
- **Actor(es):** Personal de Logística, Personal de Tienda
- **Precondiciones:** Existen movimientos de inventario en tiendas o centros de distribución.
- **Flujo principal:**
  1. Sistema consolida existencias, ubicaciones, reservas, entradas y salidas de los 2 centros de distribución y las 32 tiendas en una sola vista.
  2. Sistema expone disponibilidad en tiempo real a CDU-01 y CDU-04.
  3. Sistema libera reservas de compras no concluidas a los 20 minutos de inactividad (mismo valor confirmado en CDU-01).
- **Flujos alternativos:**
  - 1a. Evento de inventario proveniente de un POS falla al entregarse → sistema reintenta con manejo de errores garantizado.
- **Postcondiciones:** Vista de inventario consistente entre canales; ninguna unidad comprometida a más de un cliente simultáneamente.
- **Drivers de calidad relacionados:** DC-02, DC-05
- **Drivers de restricción relacionados:** DR-05

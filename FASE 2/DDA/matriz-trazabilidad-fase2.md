# Matriz de trazabilidad — Fase 2

Recorre, criterio por criterio, la hoja de calificación de la Fase 2 y ubica cada funcionalidad
en los cuatro artefactos que exige la **tabla de condiciones por omisión de trazabilidad**:
CDU expandido, modelo de datos, diagrama de despliegue y código. Donde algo falta, lo dice.

Auditada el 2026-09-23 y actualizada el mismo día, contra la rama `feature/202109114_backend`, con el sistema levantado y
cada endpoint ejecutado.

## Cómo leer la columna "Estado"

| Estado | Significa, según la tabla de omisión |
|---|---|
| **100%** | Está en el CDU expandido, el modelo de datos, el despliegue y el código |
| **Parcial** | Está en los cuatro artefactos, pero el código no cubre todo lo que el criterio pide |
| **0% · sin código** | Documentado, pero la funcionalidad no está desarrollada |

Todas las funcionalidades implementadas corren dentro del contenedor `sgologic-backend`, así que
la columna "Despliegue" nombra el componente de la [vista implementada](diagrama-de-despliegue.md#despliegue-implementado-mvp),
donde cada componente tiene su paquete. Todas las tablas nombradas aparecen en el
[diagrama entidad-relación](../image/Diagrama-Entidad-Relacion-SGO-Logic-Fase2.png); las vistas
están documentadas en [`db/README.md`](../db/README.md#vistas-de-lectura).

---

## I. Funcionalidades (50 pts)

### Gestión de venta (20 pts)

| Criterio | Pts | CDU expandido | Modelo de datos | Despliegue | Código | Evidencia | Estado |
|---|---|---|---|---|---|---|---|
| Confirmar orden | 5 | [Carrito Omnicanal](../image/CDU-Expandido-Carrito-Omnicanal.png) · Realizar Compra | `purchase_order`, `order_item`, `reservation` | Order / Checkout Service | `POST /api/orders/checkout`; estados hasta despacho en `GET /api/orders/{id}/trace` | `pruebas/prueba_flujo_volumen.py`: 60/60 hasta guía | **100%** |
| Recibir pago | 3 | [Pago y Facturación](../image/CDU-Expandido-Pago-y-Facturacion.png) · Realizar Compra | `payment_attempt` (sin PAN/CVV), vista `payment_audit` | Payment Service → PayKlik (REST) | `POST /api/orders/{id}/payments` · `PaymentService`, `PayKlikClient` | Cada intento en `GET /api/orders/{id}/payments` | **100%** |
| Reintentar pago | 2 | Pago y Facturación (*Reintentar Pago* extiende *Recibir Pago*) | `integration.outbox` | Message Broker (outbox) + Payment Service | `PaymentRetryHandler`, `OutboxDispatcher`, `CircuitBreaker`; umbral `payment.timeout_ms` = 5000 | PayKlik en `DOWN`: 5 fallas, circuito abierto, al volver se completa sola | **100%** |
| Emitir factura | 3 | Pago y Facturación · Realizar Compra (*Generar Comprobante*) | `invoice` (`cui`, `series`, `xml`) | Invoicing Service → SAT (XML) | `InvoicingService`, `InvoiceXmlBuilder`; asíncrona vía `OrderPaidHandler` | SAT en `REJECT`: la orden no se despacha y queda escalada | **100%** |
| Consultar factura | 2 | Pago y Facturación | `invoice.order_id` único | Invoicing Service | `GET /api/orders/{id}/invoice` y `/invoice/xml` | — | **100%** |
| Continuar compra en otro canal | 3 | Carrito Omnicanal | `cart` (índice único `one_active_cart_per_customer`), `cart.last_channel_id` | Order / Checkout Service | `POST /api/customers/{id}/cart/items` con `channel` · `CartService` | `prueba_flujo_volumen.py`: 20 órdenes por canal | **100%** |
| Agregar o quitar productos | 2 | Carrito Omnicanal · Realizar Compra (*Gestionar Carrito*) | `cart_item` | Order / Checkout Service | `POST /api/customers/{id}/cart/items` (upsert atómico) · `PUT` y `DELETE /api/customers/{id}/cart/items/{productId}` · `CartItemController` | Agregar, cambiar y quitar desde canales distintos sobre el mismo carrito | **100%** |

### Gestión de inventario (10 pts)

| Criterio | Pts | CDU expandido | Modelo de datos | Despliegue | Código | Evidencia | Estado |
|---|---|---|---|---|---|---|---|
| Consultar inventario | 3 | [Gestión de Inventario](../image/CDU-Expandido-Gestion-Inventario.png) | `location` (2 CD + 32 tiendas), `stock` | Inventory Service | `GET /api/inventory/products/{id}/availability` | — | **100%** |
| Reservar producto | 2 | Gestión de Inventario · Carrito Omnicanal | `reservation`, `stock` (`check reserved <= on_hand`) | Inventory Service | `InventoryReservationService.reserve` (UPDATE condicional atómico) | `pruebas/prueba_reserva_concurrente.py`: 80 simultáneos, 0 sobreventa, 4 corridas | **100%** |
| Liberar inventario | 2 | Gestión de Inventario (*Liberar* extiende *Reservar*) | `reservation.expires_at`; `config.setting` `reservation.ttl_minutes` | Inventory Service | `ReservationExpiryJob` (cada 30 s), TTL configurable en base | — | **100%** |
| Actualizar inventario | 3 | Gestión de Inventario | `stock`, `stock_movement`, `pos_event` | Inventory Service + POS Adapter | `POST /api/inventory/movements` (entradas y salidas; una salida nunca toca lo reservado) · salidas al despachar · `GET /api/inventory/products/{id}/movements` · eventos al POS | Entrada y salida en T-07 entregadas a su POS; salida mayor a lo disponible → 409 | **100%** |

### Gestión de logística y entrega (8 pts)

| Criterio | Pts | CDU expandido | Modelo de datos | Despliegue | Código | Evidencia | Estado |
|---|---|---|---|---|---|---|---|
| Solicitar envío a LogiExpress | 3 | [Despacho y Entrega](../image/CDU-Expandido-Despacho-y-Entrega.png) · Gestión Logística | `shipment` (`tracking_number`), `carrier` | Logistics Service → LogiExpress (REST) | `DispatchService.requestGuide`, circuit breaker; `POST /api/shipments/{id}/guide` | LogiExpress en `DOWN`: se despacha igual y queda la alerta | **100%** |
| Asignar origen y destino | 3 | Despacho y Entrega | `shipment.origin_location_id`, `reservation`, `stock` | Logistics Service | `DispatchService.chooseOrigin` (ubicación con más unidades, CD primero); cambio: `PUT /api/shipments/{id}/origin` | — | **100%** |
| Actualizar estado de envío | 2 | Despacho y Entrega · Gestión Logística | `tracking_event`, `shipment_status` | Logistics Service + Notification Service | `POST /api/shipments/{id}/tracking`; reintentos por outbox | — | **100%** |

### Atención al cliente (5 pts)

| Criterio | Pts | CDU expandido | Modelo de datos | Despliegue | Código | Evidencia | Estado |
|---|---|---|---|---|---|---|---|
| Consultar estado de la orden | 2 | [Atención al Cliente](../image/CDU-Expandido-Atencion-al-Cliente.png) | vista `order_overview` | Order / Checkout Service | `GET /api/orders/{id}` · `OrderQueryService` | `pruebas/prueba_rendimiento.py`: máx. 51 ms con 20 000 órdenes (meta < 5 s) | **100%** |
| Registrar atención | 1 | Atención al Cliente · Gestión Logística (*Registrar Devolución*) | `incident`, `incident_type`, `incident_status`, `audit_log` | Order / Checkout Service | `POST /api/orders/{id}/incidents` · `PUT /api/incidents/{id}/status` (requiere sesión) · `IncidentService`; devolución resuelta → orden `RETURNED` | Cada paso en la auditoría (`INCIDENCIA_*`) con el usuario del token | **100%** |
| Consultar historial | 2 | Atención al Cliente | vista `order_overview`, índice `purchase_order (customer_id, created_at)`, `incident` | Customer Service + Order / Checkout Service | `GET /api/customers/{id}/history` (órdenes y atenciones) · `GET /api/customers/{id}/orders` | — | **100%** |

### Auditar y consolidar (7 pts)

| Criterio | Pts | CDU expandido | Modelo de datos | Despliegue | Código | Evidencia | Estado |
|---|---|---|---|---|---|---|---|
| Sincronizar ventas con ERP | 3 | [Auditar y Consolidar](../image/CDU-Expandido-Auditar-y-Consolidar.png) · Configuración (*Integración con ERP/POS*) | `erp_batch`, `erp_batch_order` (una orden, un lote), vista `erp_batch_summary`; `erp.batch_interval_minutes` | ERP Sync Adapter → AS/400 (CSV/XML), volumen `erp-out` | `ErpSyncJob` (ventana de 30 min configurable), `ErpBatchService`, reintento automático y `POST .../batches/{id}/retry` | Carpeta del AS/400 en `DOWN`: lote `PENDING`, se reentrega sin duplicar | **100%** |
| Informe de ventas | 4 | Auditar y Consolidar · Auditoría (*Generar Reporte Fiscal*) | `purchase_order`, `invoice`, `erp_batch_order`, `audit_log` | Audit / Traceability & Reporting Service | `GET /api/reports/sales` con conciliación contra el ERP; cada generación queda auditada | `cuadra: false` con un lote pendiente, `true` al entregarlo | **100%** |

---

## II. Marco de trabajo Scrum (10 pts)

El documento Scrum del equipo está en [`FASE 2/Scrum/Scrum - Grupo 3.md`](../Scrum/Scrum%20-%20Grupo%203.md):
Product Backlog con estado real, y Sprint Planning, Sprint Backlog, Daily Scrum y Sprint
Retrospective de los 3 sprints, reconstruidos del historial de commits. La bitácora del proyecto
está en la raíz, en [`BITACORA.md`](../../BITACORA.md), como pide el enunciado.

Falta lo que solo puede aportar el equipo desde su tablero: las capturas del Kanban al inicio y al
cierre, y el burndown o el resumen de tareas completadas contra pendientes. Tampoco existen las
ramas `main` ni `release` de git-flow.

## III. Documentación técnica (20 pts)

| Criterio | Pts | Evidencia | Estado |
|---|---|---|---|
| Actualización y coherencia de diagramas | 10 | Las vistas originales de bloques, componentes y despliegue dibujan la meta de evolución (microservicios, cinco hosts, API Gateway, RabbitMQ). Ahora cada una tiene su **vista implementada**, que coincide con el código y con `docker-compose.yml`: [bloques y componentes](diagrama-de-componentes.md) y [despliegue](diagrama-de-despliegue.md#despliegue-implementado-mvp), con la correspondencia componente → paquete → contenedor. El JPG de bloques, que no estaba en `develop`, se recuperó de la rama `feat/202109114-Farmahosp` | **Cumple** |
| Cambios justificados según feedback | 6 | Según el equipo, la retroalimentación de la Fase 1 fue sobre los diagramas; se corrigieron y el auxiliar los aprobó. **El repositorio no tiene un documento que lo registre**: el criterio pide *evidencia* de las correcciones, así que conviene un documento corto con qué se observó y qué se cambió | **Evidencia pendiente** |
| Organización modular / capas coherente con el DDA | 2 | Un paquete y un esquema por componente (ADR-0001). Los pasos entre componentes que dependen de un tercero (pago → factura → despacho) avanzan por eventos del outbox; las llamadas directas quedan para lo que tiene que ocurrir en la misma transacción, como reservar stock en el checkout o encolar un aviso | **Cumple** |
| Uso correcto de frameworks y patrones | 1 | Transactional Outbox, Circuit Breaker, Adapter y reintentos con espera creciente, cada uno implementado y trazado a su ADR (0002, 0004, 0007, 0008) | **Cumple** |
| Legibilidad y mantenibilidad | 1 | Nombres descriptivos, comentarios que explican el porqué, README por carpeta, colección de Postman que corre completa | **Cumple** |

---

## Resumen de riesgos

Ordenados por puntos en juego:

| # | Riesgo | Pts en juego | Quién lo resuelve |
|---|---|---|---|
| 1 | Scrum de Fase 2: faltan las capturas del Kanban y el burndown | parte de 10 | Todo el equipo |
| 2 | Sin documento que evidencie las correcciones por retroalimentación de la Fase 1 | 6 | Quien tenga las observaciones del auxiliar |

Las 20 funcionalidades de la sección I quedan en **100%**: cada una tiene CDU expandido, modelo de
datos, despliegue y código.

## Qué se corrigió durante esta auditoría

- **Reintentos del ERP.** Si la carpeta del AS/400 no estaba disponible, el lote quedaba `PENDING`
  para siempre: sus órdenes ya estaban asignadas a él y no volvían a entrar en otro. Ahora el job
  lo reentrega cada minuto y existe el reintento manual.
- **Informe de ventas conciliado.** El informe no comparaba lo facturado con lo entregado al ERP;
  ahora lo hace y cada generación queda en la auditoría.
- **Error 500 con SQL expuesto.** Crear un cliente con un correo repetido respondía 500 con la
  sentencia SQL completa. Ahora responde 409 con un mensaje legible; lo mismo cualquier otra
  violación de integridad.
- **Consulta de orden con cobros.** `GET /api/orders/{id}` respondía 500 en cuanto la orden tenía
  un intento de cobro (corregido antes de esta auditoría, en el commit `29237c5`).
- **Los cuatro huecos del núcleo comercial**: quitar y cambiar productos del carrito, historial del
  cliente, registro de incidencias y movimientos de inventario con aviso al POS.
- **Colección de Postman corrible en orden**: con el Collection Runner, de punta a punta y varias
  veces seguidas (68 de 69 en 2xx; el que falta es el 400 que prueba la guardia de tarjetas).
- **Seis CDU expandidos nuevos**, uno por sección de la hoja, con su recuadro de trazabilidad.
- **Vistas implementadas de bloques, componentes y despliegue**, que coinciden con el código.
- **Aporte individual de Scrum de Backend 2**: daily, estado de sus 16 historias y retrospectiva.
- **Tres pruebas ejecutables** con sus resultados en [`pruebas/`](../pruebas/README.md).

---

## Segunda auditoría: incongruencias entre documentos, código y enunciado

Hecha el 2026-09-23 sobre todo lo anterior. Incluye una instalación desde cero en una base nueva
(`docker compose up` con un volumen vacío): corren las 8 migraciones y la colección de Postman da
69 de 70 en 2xx (el que falta es el 400 esperado de la guardia de tarjetas).

### Corregidas

| # | Incongruencia | Gravedad | Cómo quedó |
|---|---|---|---|
| 1 | **Fidelidad al ADR-0001.** El ADR-0001 y el ADR-0005 piden los componentes en *contenedores Docker independientes*; el código los tiene en un solo contenedor. Además, varios documentos nuevos atribuían al ADR-0001 la decisión de "un solo despliegue", lo cual era falso | Alta | [ADR-0009](ADR/0009-alcance-de-despliegue-del-mvp.md) registra y justifica la desviación (el mismo ADR-0001 pide llamadas *in-process* para lo que exige consistencia, y el checkout necesita atomicidad). Se corrigieron el README del backend, el documento de despliegue y los diagramas implementados |
| 2 | **Paso 10 del flujo principal.** "Se emiten los eventos de actualización hacia las instancias del POS": en el camino feliz no salía ningún evento, porque el POS solo se avisaba cuando se movía stock de una tienda y el despacho normal sale de un CD | Alta | Al cerrar cada ventana del ERP, las 32 tiendas reciben la existencia consolidada (`InventoryConsolidated`). Verificado en base nueva: 32 de 32 entregados |
| 3 | **Entregable "README.md detallado con instrucciones de instalación y despliegue"**: no existía para la Fase 2 | Alta | [`FASE 2/README.md`](../README.md), probado paso a paso sobre una base nueva |
| 4 | **Tiempo de reserva.** CDU-01 y CDU-08 fijan 20 minutos "confirmado por el equipo"; la base tenía 15 | Media | `V8__reserva_de_20_minutos.sql` y valor por defecto en el código; el checkout reserva por 20 minutos |
| 5 | **API Gateway / BFF y Pricing & Promotions** aparecen en el caso de acción y en los diagramas de la Fase 2, sin implementar y sin un ADR que lo decida | Media | Decididos en el ADR-0009; nota en `casoDeAccion.md` que remite a los ADR 0007 a 0009 |
| 6 | **Momento de la reserva.** El CDU-01 reserva al agregar al carrito; el enunciado y el código, al iniciar el checkout | Media | Registrado en el ADR-0009: prevalece el enunciado |
| 7 | **ADR-0002** registra el cobro en el outbox "en la misma transacción que crea la orden"; el código lo hace distinto | Media | El ADR-0007 explica cómo se conserva la misma garantía (la orden pasa a `PAYMENT_IN_PROGRESS` antes de llamar a PayKlik) |
| 8 | **CDU-06, E2**: una consulta que pase de 5 s "debe registrarse para revisión de capacidad"; no se registraba | Media | Filtro que deja un `WARN` en el log `sgologic.capacidad` (5 s para el estado de orden, 1 s para auditoría y cobros) |
| 9 | **CDU-08, E2**: el ajuste por conteo físico que reporta el POS debía aceptarse y auditarse; no había forma de registrarlo | Media | `POST /api/inventory/adjustments`: aplica la diferencia, la audita y avisa al POS; rechaza (y audita) un conteo menor a lo reservado |
| 10 | **ADR-0004** pide métricas de éxito/fallo; la salud solo mostraba el broker y el POS | Baja | `/api/integration/health` suma los avisos y los lotes del ERP |
| 11 | **ADR-0008** listaba cinco adaptadores; son seis (faltaba la carpeta del AS/400) | Baja | Corregido |

### Pendientes, fuera de lo que este backend puede resolver solo

| # | Incongruencia | Gravedad | Qué haría falta |
|---|---|---|---|
| 13 | **Evidencia del feedback de la Fase 1** (ver sección III) | Media | Un documento con las observaciones del auxiliar y los cambios hechos |
| 14 | **Devoluciones hacia el ERP.** El ADR-0003 incluía devoluciones en la sincronización; el MVP solo envía ventas. Tampoco hay canal para que el AS/400 rechace un lote (CDU-07, E1) | Media | Una tabla de ajustes contables por lote (la llave `erp_batch_order.order_id` impide mandar la misma orden dos veces) |
| 15 | **Reglas de los CDU de la Fase 1 sin implementar**: reembolso y aprobación de Finanzas arriba de USD 500 (CDU-05), recogida en tienda (CDU-04), sugerir alternativa sin existencia (CDU-01, 2a), reidentificación al cambiar de canal (CDU-01, E2) | Baja | Quedan documentadas en `backend/README.md` como fuera del MVP |
| 16 | **Autenticación parcial.** Hay login con JWT y el frontend lo usa en el backoffice, pero solo protege crear o editar productos, procesar incidencias, cambiar parámetros y gestionar al personal; auditoría, reportes, reintentos y `/api/simulation` son públicos | Media | Extender las reglas de `SecurityConfig` a los endpoints de operación y un perfil que no registre la simulación fuera de la demo |
| 17 | `matrizRestricciones.md` conserva un pendiente propio sin cerrar ("confirmar que ninguna celda contradiga una decisión ya tomada") | Baja | Revisarla contra el ADR-0009, que cambia cómo se cumplen R 01 y R 02 |

### Resueltas después de la calificación

| # | Incongruencia | Cómo quedó |
|---|---|---|
| 12 | **El frontend no estaba integrado**: usaba mocks, no tenía Dockerfile ni servicio en el compose, y su README era la plantilla de Vite | La tienda y el backoffice completo consumen la API real (`/api/...`), con inicio de sesión del personal. El frontend se compila y se sirve con nginx en el compose, así que `docker compose up -d --build` levanta los tres contenedores. Su README describe la aplicación. Solo Promociones sigue en mock, porque el backend no tiene ese servicio (ADR-0009) |
| 18 | **La lista de personal (`GET /api/users`) era pública** y exponía quién tiene acceso y con qué roles | Exige rol `ADMIN`, igual que el resto de `/api/users` |


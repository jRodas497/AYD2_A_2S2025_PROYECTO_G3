---
title: Scrum - Grupo 3

---

## Universidad de San Carlos de Guatemala | Facultad de Ingeniería
### Análisis y Diseño de Sistemas 2
### Sección: A
#### Catedrático: _(pendiente)_
#### Auxiliar: _(pendiente)_

### Sistema de Gestión de Órdenes y Logística Omnicanal — SGO-Logic (Fase 2)
### Scrum del Grupo 3

### Integrantes del Grupo
| Nombre | Carnet | Rol en el equipo |
|---|---|---|
| Hernán Ricardo Ávila Castillo | 9516085 | Backend 1 — Núcleo comercial |
| Sebastián Alejandro Vásquez Cartagena | 202109114 | Backend 2 — Transacciones e integraciones |
| Juan José Rodas Mansilla | 202200389 | Frontend 1 — Cliente / Compra omnicanal |
| Williams Bramlley Constanza Oscal | 199919737 | Frontend 2 — Operación interna / Backoffice |
| Carmen María Marroquín Llamas | 202001132 | Documentación, Docker y pruebas E2E |

---

## Índice

- [Product Backlog](#product-backlog)
- [Sprint Planning](#sprint-planning)
- [Sprint Backlog](#sprint-backlog)
- [Daily Scrum](#daily-scrum)
- [Sprint Retrospective](#sprint-retrospective)

---

## Product Backlog

> Historias derivadas de `FASE 2/DDA/driversArquitectonicos.md` (RF/RC/R) y de los CDU expandidos de Fase 1 (`FASE 1/Docs/DDA/casos-de-uso/`), agrupadas por el componente de `FASE 2/DRAWIO/Diagrama-Componentes-SGO-Logic-Fase2.drawio` que las realiza. Cada bloque indica el componente y el backend responsable (Backend 1 = núcleo comercial; Backend 2 = transacciones e integraciones). La pantalla de frontend se marca por historia: **[F1]** = Frontend 1 (Cliente / Compra omnicanal), **[F2]** = Frontend 2 (Operación interna / Backoffice); una historia sin marca no tiene pantalla propia. Integrante 5 = documentación, Docker y E2E.
>
> `Sprint sugerido` es una propuesta de secuenciación por dependencia (backbone → integraciones externas → cierre/calidad), **no un compromiso** — el compromiso real de sprint, fechas y story points se define en Sprint Planning de cada sprint.

**Bloque: Catálogo, precios y carrito omnicanal** — *Order/Checkout Service, Catalog/Product Service, Pricing & Promotions Service* · Backend 1 · RF01, CDU-01

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Estado | Criterios de aceptación |
|---|---|---:|---:|---|---|---|
| PB-001 | [F1] Como **cliente**, quiero consultar el catálogo de productos con su disponibilidad y precio vigente para decidir qué comprar desde cualquier canal. | Alta | 5 | Sprint 1 | Hecho — falta precio con descuento (Pricing & Promotions no existe en backend) | 1) El catálogo cubre línea blanca, electrónica, ropa y calzado; 2) el precio mostrado incluye promociones vigentes (Pricing & Promotions); 3) la disponibilidad mostrada proviene del inventario centralizado (RF03), no de una copia local por canal. |
| PB-002 | [F1] Como **cliente**, quiero agregar productos a un carrito que se mantenga igual sin importar si cambio de canal, para continuar mi compra sin perder lo ya elegido. | Alta | 5 | Sprint 1 | Hecho — solo agregar/incrementar; el backend no soporta bajar cantidad ni eliminar ítem | 1) El carrito persiste asociado al cliente, no al canal/dispositivo (regla de negocio de CDU-01); 2) es visible de forma idéntica desde web, app y centro de atención; 3) agregar un producto verifica disponibilidad en tiempo real contra Inventory Service antes de reservar. |
| PB-003 | [F1] Como **cliente**, quiero que el sistema me avise si un producto ya no está disponible y me sugiera una alternativa o tienda con existencia, para no quedarme sin opciones. | Media | 3 | Sprint 1 | Hecho — la sugerencia de alternativa es texto fijo de demo, sin dato dinámico del backend | 1) Si la reserva falla por falta de disponibilidad, se muestra el motivo; 2) se sugiere un producto alternativo o la tienda más cercana con existencia; 3) el resto del carrito no se ve afectado. |
| PB-004 | [F1] Como **cliente**, quiero confirmar mi compra seleccionando el método de entrega para pasar al proceso de pago. | Alta | 3 | Sprint 1 | Hecho — sin selector de centro/tienda/recogida; el backend solo modela una dirección de texto libre | 1) Puedo elegir centro de distribución, tienda o recogida como método de entrega; 2) al confirmar, la orden pasa a estado "pendiente de pago"; 3) se dispara el flujo de Procesar Pago (RF05). |

**Bloque: Inventario centralizado** — *Inventory Service* · Backend 1 · RF03, RF04, CDU-08

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Estado | Criterios de aceptación |
|---|---|---:|---:|---|---|---|
| PB-005 | [F2] Como **personal de logística**, quiero ver una vista consolidada de existencias, ubicaciones y reservas de los 2 centros de distribución y las 32 tiendas, para no depender de llamadas telefónicas. | Alta | 8 | Sprint 1 | Hecho | 1) La vista consolida entradas/salidas/reservas de ambos centros y las 32 tiendas; 2) se actualiza con cada evento reportado desde un POS o centro; 3) reemplaza la confirmación telefónica manual actual. |
| PB-006 | [F2] Como **sistema**, quiero reservar temporalmente la unidad de inventario al agregarla a un carrito, para evitar que se comprometa a más de un cliente. | Alta | 5 | Sprint 1 | Hecho | 1) Al agregar al carrito se crea una reserva atómica en Inventory Service; 2) si dos canales intentan reservar la misma unidad casi simultáneamente, solo uno tiene éxito; 3) la reserva queda con marca de tiempo para el temporizador de liberación; 4) las reservas activas (unidad, carrito, vencimiento) y las liberadas por expiración se consultan en la pantalla de Reservas de stock. |
| PB-007 | [F2] Como **sistema**, quiero liberar automáticamente el inventario reservado tras 20 minutos de inactividad, para no bloquear stock de compras abandonadas. | Alta | 3 | Sprint 1 | Hecho — TTL de 20 min confirmado en `V8__reserva_de_20_minutos.sql` | 1) El temporizador de liberación es configurable (20 min por defecto); 2) al expirar sin confirmación de compra, la unidad vuelve a estar disponible; 3) la liberación no afecta carritos con checkout ya en curso. |
| PB-008 | [F2] Como **sistema**, quiero aceptar el ajuste de inventario más reciente de una tienda como fuente de verdad cuando contradice el estado centralizado, dejando el conflicto registrado. | Media | 3 | Sprint 2 | Hecho | 1) El evento más reciente de la tienda prevalece sobre el estado centralizado; 2) la diferencia queda registrada para auditoría; 3) no bloquea otras operaciones sobre esa unidad. |

**Bloque: Clientes** — *Customer Service* · Backend 1 · soporte de RF01

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Estado | Criterios de aceptación |
|---|---|---:|---:|---|---|---|
| PB-009 | [F1] Como **cliente**, quiero ser identificado de forma consistente entre canales (sesión, teléfono o cuenta) para que mi carrito y mi historial se reconozcan sin importar por dónde entro. | Alta | 3 | Sprint 1 | Hecho — reidentificación manual ("¿No eres tú?"), no autodetección de sesión perdida | 1) El sistema identifica al cliente por sesión, teléfono o cuenta según el canal; 2) si la sesión no es reconocible, se solicita reidentificación antes de continuar; 3) el carrito queda asociado al cliente, no al dispositivo. |

**Bloque: Pagos y resiliencia** — *Payment Service, Message Broker/Outbox, integración PayKlik* · Backend 2 · RF05, RF06, CDU-02

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Estado | Criterios de aceptación |
|---|---|---:|---:|---|---|---|
| PB-010 | [F1] Como **cliente**, quiero pagar mi orden con tarjeta, transferencia o billetera digital para completar mi compra con el método que prefiera. | Crítica | 5 | Sprint 1 | Hecho | 1) El checkout ofrece tarjeta, transferencia y billetera digital; 2) el cobro se envía a PayKlik vía REST; 3) el resultado (éxito, fallo o "pago en proceso") se refleja en la orden y se muestra al cliente en la pantalla de estado del pago. |
| PB-011 | Como **sistema**, quiero registrar cada intento de cobro (orden, canal, fecha, resultado) sin almacenar PAN ni CVV, para mantener auditabilidad sin comprometer datos sensibles. | Crítica | 5 | Sprint 1 | Hecho | 1) Cada intento, exitoso o fallido, queda relacionado con orden/canal/fecha/resultado; 2) no se persiste número completo de tarjeta ni CVV, solo el token/referencia de PayKlik; 3) el registro es consultable para auditoría. |
| PB-012 | Como **sistema**, quiero encolar y reintentar un intento de cobro vía Transactional Outbox + Circuit Breaker cuando PayKlik no responde o falla, para no perder la orden. | Crítica | 8 | Sprint 2 | Hecho | 1) Si PayKlik falla o no responde, el intento se encola en el Message Broker en vez de perderse; 2) el circuit breaker detiene los reintentos inmediatos ante degradación y pasa el intento a cola; 3) el cliente ve el estado "pago en proceso" mientras se reintenta. |
| PB-013 | [F1] Como **cliente**, quiero poder reintentar el pago con otro método si mi cobro es rechazado, para no perder la orden por un problema puntual del método elegido. | Alta | 3 | Sprint 1 | Hecho | 1) Un cobro rechazado devuelve la orden a "pendiente de pago"; 2) se muestra el motivo devuelto por PayKlik; 3) puedo elegir un método de pago distinto sin recrear el carrito. |
| PB-014 | [F1] Como **sistema**, quiero marcar un intento como fallido definitivo y notificar al cliente cuando se agotan los reintentos configurados con PayKlik, en vez de dejarlo en espera indefinida. | Alta | 3 | Sprint 2 | Hecho — el límite de reintentos es regla de frontend; falta la notificación real (SMS/correo/in-app) | 1) Existe un número máximo de reintentos configurado; 2) al agotarse, el intento queda auditado como fallido definitivo; 3) el cliente recibe una notificación para reintentar más tarde. |

**Bloque: Facturación electrónica** — *Invoicing Service, integración SAT* · Backend 2 · RF07, CDU-03

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Estado | Criterios de aceptación |
|---|---|---:|---:|---|---|---|
| PB-015 | Como **sistema**, quiero generar y enviar a la SAT el XML de factura con CUI y serie autorizada apenas se confirma el pago, para que ninguna orden avance sin respaldo fiscal. | Alta | 5 | Sprint 2 | Hecho | 1) El XML se genera al confirmarse el pago (post PB-010/011); 2) conserva CUI y serie autorizada; 3) la orden no se marca como facturada hasta recibir validación de la SAT. |
| PB-016 | Como **sistema**, quiero reintentar el envío a la SAT y escalar como incidencia auditable si no hay respuesta tras los reintentos, para que la orden nunca se despache sin factura válida. | Alta | 5 | Sprint 2 | Hecho | 1) Un rechazo de la SAT dispara reintento de generación/envío; 2) si se agotan los reintentos, se genera una incidencia auditable para revisión manual; 3) la orden queda retenida antes de despacho mientras no haya factura válida. |

**Bloque: Integración con sistemas legados** — *ERP Sync Adapter, POS Adapter* · Backend 2 · RF08, RF09, CDU-07

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Estado | Criterios de aceptación |
|---|---|---:|---:|---|---|---|
| PB-017 | Como **Finanzas**, quiero que las ventas facturadas se sincronicen con el ERP-Core cada 30 minutos vía CSV/XML sin modificar el ERP, para eliminar la conciliación manual actual. | Alta | 8 | Sprint 2 | Hecho | 1) El sistema agrupa ventas facturadas dentro de la ventana de 30 minutos; 2) genera un archivo CSV/XML en el formato que acepta el ERP-Core; 3) registra la confirmación de sincronización para auditoría, sin modificar el ERP-Core. |
| PB-018 | Como **sistema**, quiero que la sincronización con el ERP sea idempotente y se reintente en la siguiente ventana si el lote es rechazado, para no duplicar ni perder registros contables. | Alta | 5 | Sprint 2 | Hecho | 1) Un lote rechazado genera alerta y se reintenta en la siguiente ventana; 2) reprocesar un lote no genera registros duplicados; 3) una interrupción a medias no produce doble registro en el ERP. |
| PB-019 | Como **sistema**, quiero enviar eventos de actualización desde SGO-Logic hacia los POS de las 32 tiendas con manejo de errores y reintentos, sin requerir cambios en el POS. | Alta | 5 | Sprint 2 | Hecho | 1) El adaptador POS envía eventos salientes hacia las 32 tiendas; 2) los reintentos no requieren modificar el POS; 3) un evento no entregado se reintenta sin perderse. |

**Bloque: Logística y despacho** — *Logistics Service, integración LogiExpress* · Backend 2 · RF10, CDU-04

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Estado | Criterios de aceptación |
|---|---|---:|---:|---|---|---|
| PB-020 | [F2] Como **personal de logística**, quiero que el sistema determine el punto de despacho (centro, tienda o pickup) apenas la orden está facturada, para saber qué preparar y desde dónde. | Alta | 5 | Sprint 2 | Hecho | 1) El punto de despacho se determina contra el inventario centralizado vigente; 2) logística recibe la orden con ubicación de origen y datos del destinatario; 3) el disparador es la orden facturada (post PB-015). |
| PB-021 | [F2] Como **sistema**, quiero generar la guía con LogiExpress y reintentar vía circuit breaker ante un timeout, sin bloquear la operación principal. | Alta | 5 | Sprint 2 | Hecho | 1) La guía se genera con LogiExpress cuando el método de entrega lo requiere; 2) un timeout de LogiExpress dispara reintento vía circuit breaker; 3) el timeout no bloquea la confirmación de la orden. |
| PB-022 | [F2] Como **personal de logística**, quiero recibir una alerta operativa si LogiExpress no genera la guía tras los reintentos, para intervenir manualmente sin perder la orden. | Media | 3 | Sprint 2 | Hecho | 1) Se genera una alerta visible para logística; 2) la orden queda pendiente de asignación manual, nunca "perdida"; 3) la alerta referencia la orden y el motivo del fallo. |
| PB-023 | [F1] Como **cliente**, quiero poder cambiar el método de entrega después de confirmada mi compra, para ajustar mi pedido sin perder el proceso ya avanzado. | Media | 3 | Sprint 2 | En progreso — backend listo (`PUT /api/shipments/{id}/origin`), sin pantalla en frontend | 1) El cambio de método de entrega actualiza el punto de despacho; 2) no se reinicia el proceso ni se pierde la trazabilidad de la orden; 3) el cambio queda registrado en el historial de la orden. |

**Bloque: Notificaciones** — *Notification Service* · Backend 2 · RF11

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Estado | Criterios de aceptación |
|---|---|---:|---:|---|---|---|
| PB-024 | Como **cliente**, quiero recibir notificaciones de confirmación, preparación, tránsito, entrega o incidencias, sin que una falla del canal de notificación bloquee mi compra. | Media | 5 | Sprint 2 | Hecho (backend) — la vista de cliente es PB-040, todavía pendiente | 1) Se envían notificaciones por SMS, correo o push en cada hito de la orden; 2) el envío es asíncrono/desacoplado (fire-and-forget); 3) una falla del proveedor de notificaciones no impide confirmar ni avanzar la orden. |

**Bloque: Consulta, devoluciones y auditoría** — *Order Service (consulta), Payment Service (extend), Audit/Traceability/Reporting* · Backend 1 + Backend 2 · RF02, RC01, RC02, R11, CDU-05, CDU-06

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Estado | Criterios de aceptación |
|---|---|---:|---:|---|---|---|
| PB-025 | [F1] Como **cliente o personal de atención**, quiero consultar el estado consolidado (compra, pago, despacho, entrega, incidencias) de cualquier orden en menos de 5 segundos desde cualquier canal. | Media | 5 | Sprint 3 | En progreso — `OrderStatusPage` muestra el estado; falta la vista consolidada de incidencias | 1) La consulta responde en menos de 5 segundos en operación normal; 2) la vista consolida compra, pago, despacho, entrega e incidencias; 3) una orden inexistente responde con mensaje claro sin exponer información de otras órdenes. |
| PB-026 | [F2] Como **personal de atención**, quiero iniciar una devolución o cambio referenciando la venta original con vista consolidada, para resolverla sin llamadas ni conciliación manual. | Media | 5 | Sprint 3 | En progreso — el backend tiene gestión de incidencias genérica; el flujo específico de devolución con vista consolidada no está confirmado en frontend | 1) La devolución/cambio referencia la orden original; 2) se muestra la vista consolidada de compra, pago, despacho y entrega; 3) una orden no elegible informa el motivo sin bloquear la consulta del historial. |
| PB-027 | [F2] Como **sistema**, quiero procesar el reembolso de una devolución extendiendo el flujo de pago, exigiendo aprobación de Finanzas si el monto supera USD 500 o la venta tiene financiamiento activo. | Media | 5 | Sprint 3 | Pendiente — fuera del alcance del MVP (reembolso y aprobación de Finanzas, ver `matriz-trazabilidad-fase2.md`) | 1) El reembolso reutiliza el mecanismo de intento de cobro/pago (registro y reintento igual que PB-011/012); 2) montos > USD 500 o con financiamiento activo quedan pendientes de aprobación de Finanzas; 3) un fallo en el reembolso queda registrado, auditable y se reintenta. |
| PB-028 | [F2] Como **Directora de Finanzas o auditor**, quiero recuperar la evidencia completa de cualquier transacción (quién, cuándo, qué cambió) en menos de 1 segundo, para sostener una auditoría fiscal sin retrasos. | Alta | 5 | Sprint 3 | Hecho — auditoría de cobros p99 36 ms contra la meta de 1 s (`pruebas/README.md`) | 1) Toda operación relevante (pago, factura, conciliación, devolución) queda registrada en el Audit/Traceability Service; 2) la recuperación de evidencia de una transacción responde en menos de 1 segundo; 3) el registro nunca incluye PAN/CVV, solo token/referencia. |

**Bloque: Calidad, pruebas, documentación e infraestructura** — Integrante 5 (documentación, Docker, E2E) + equipo de Backend (unitarias) + equipo de Frontend (verificación RF/RNF) · R01–R06

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Estado | Criterios de aceptación |
|---|---|---:|---:|---|---|---|
| PB-029 | Como **equipo**, queremos dockerizar los componentes backend con `docker-compose.yml` y persistencia incluida, para que el sistema se ejecute de forma reproducible. | Alta | 5 | Sprint 1 | En progreso — DB y backend dockerizados; el frontend corre con Node/Vite, no con Docker | 1) Existe `Dockerfile` por componente backend y un `docker-compose.yml` raíz; 2) la persistencia (base de datos, colas) queda incluida en la definición de Docker; 3) el proyecto documenta cómo levantar el entorno localmente. |
| PB-030 | Como **equipo de backend**, queremos implementar pruebas unitarias de los servicios críticos (Order, Payment, Inventory, Invoicing, Logistics) para reducir regresiones. | Alta | 8 | Sprint 2 | Pendiente — `backend/src/test/java` no tiene pruebas unitarias | 1) Existen pruebas unitarias por cada servicio backend crítico; 2) cubren al menos el flujo principal y un flujo de excepción documentado en su CDU; 3) se ejecutan con un comando reproducible. |
| PB-031 | Como **equipo**, queremos implementar pruebas E2E de los flujos críticos (compra, pago, facturación, despacho, devolución) para validar el sistema de extremo a extremo. | Alta | 8 | Sprint 3 | Hecho como pruebas de integración end-to-end vía API (`pruebas/`); no hay E2E de UI automatizada | 1) Existen escenarios E2E para los flujos de PB-001 a PB-004, PB-010 a PB-016, PB-020 a PB-023 y PB-026/027 como mínimo; 2) los escenarios cubren al menos un flujo alternativo/de excepción documentado; 3) se ejecutan con la herramienta acordada por el curso. |
| PB-032 | [F1][F2] Como **equipo de frontend**, queremos verificar que cada pantalla cumple los requerimientos funcionales y no funcionales asignados (tiempos de respuesta, mensajes de error, disponibilidad de canal) antes de darla por terminada. | Alta | 5 | Sprint 3 | Hecho — `frontend/docs/checklist-verificacion.md` | 1) Existe un checklist de verificación RF/RNF por pantalla; 2) toda pantalla crítica valida su RC asociado (ej. <5s en consulta de orden); 3) los hallazgos quedan documentados para su corrección antes de cerrar la tarjeta. |
| PB-033 | Como **equipo**, queremos redactar la documentación restante del proyecto (manuales, arquitectura de Fase 2, evidencias) para cumplir los entregables académicos. | Alta | 5 | Sprint 3 | Hecho — READMEs, `backend/API.md`, `API-Transacciones.md`, ADR 0006 a 0009 | 1) Existe documentación de arquitectura/decisiones de Fase 2 actualizada; 2) existen manuales de uso/despliegue; 3) la documentación queda versionada en el repositorio. |
| PB-034 | Como **equipo**, queremos mantener el tablero Kanban actualizado con las tarjetas de este backlog, para reflejar el progreso real de cada sprint. | Alta | 2 | Sprint 1 | Sin verificar — no se pudo confirmar si hay un tablero Kanban activo (GitHub Projects/Trello) | 1) Cada historia de este backlog tiene su tarjeta en el tablero; 2) el tablero usa las columnas oficiales del enunciado (To Do, Blocked, In Progress, Ready for Testing, Test/QA, Done); 3) el estado se actualiza durante los eventos Scrum. |

**Bloque: Frontend 1 — pantallas de cliente sin historia previa** — *Catalog, Pricing, Order/Checkout, Customer, Notification* · [F1]

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Estado | Criterios de aceptación |
|---|---|---:|---:|---|---|---|
| PB-035 | [F1] Como **cliente**, quiero buscar productos por nombre o categoría y ver el detalle de cada uno, para encontrar lo que necesito antes de agregarlo al carrito. | Alta | 5 | Sprint 1 | Hecho — falta el campo de descripción en el backend | 1) La búsqueda filtra por nombre y categoría (línea blanca, electrónica, ropa, calzado); 2) el detalle muestra descripción, precio vigente y disponibilidad; 3) desde el detalle puedo agregar al carrito (PB-002); 4) requiere endpoint de búsqueda/detalle en Catalog/Product Service (Backend 1). |
| PB-036 | [F1] Como **cliente**, quiero ver las promociones vigentes y el precio final con el descuento aplicado en catálogo y carrito, para saber cuánto voy a pagar. | Media | 3 | Sprint 1 | Hecho | 1) Las promociones vigentes se listan y se identifican en el producto; 2) carrito y checkout muestran precio original, descuento y total; 3) los datos provienen de Pricing & Promotions Service (Backend 1). |
| PB-037 | [F1] Como **cliente**, quiero ver una confirmación de mi compra con número de orden, resumen, método de entrega y estado del pago, para tener certeza de que quedó registrada. | Alta | 2 | Sprint 2 | Hecho, integrada a la vista de orden — no hay pantalla de confirmación separada | 1) Se muestra tras un pago aprobado o en proceso; 2) incluye número de orden, productos, total, entrega y estado del pago; 3) enlaza a la consulta de estado de la orden (PB-025). |
| PB-038 | [F1] Como **cliente**, quiero ver el historial de mis compras y abrir el detalle de cada una, para dar seguimiento a lo que he pedido. | Media | 3 | Sprint 3 | En progreso — listado ok vía índice local (el backend no tiene endpoint de listado); detalle ampliado pendiente | 1) Lista las órdenes del cliente desde cualquier canal, ordenadas por fecha; 2) cada una abre su estado consolidado (PB-025); 3) solo muestra órdenes del cliente identificado; 4) requiere endpoint de listado en Order Service (Backend 1). |
| PB-039 | [F1] Como **cliente**, quiero ver y editar mis datos básicos de contacto, para que mis pedidos y notificaciones lleguen correctamente. | Media | 3 | Sprint 2 | Pendiente — placeholder (`PerfilPlaceholderPage`) | 1) Puedo ver y editar nombre, teléfono y correo; 2) los cambios se reflejan en todos los canales (misma identidad, PB-009); 3) requiere endpoints en Customer Service (Backend 1). |
| PB-040 | [F1] Como **cliente**, quiero ver dentro de la aplicación las notificaciones de mi orden (confirmación, preparación, tránsito, entrega, incidencia), para no depender solo de SMS o correo. | Media | 3 | Sprint 3 | Pendiente — placeholder (`NotificacionesPlaceholderPage`) | 1) Lista cronológica de notificaciones por orden con su estado de envío; 2) si un canal externo falló, la notificación sigue visible aquí; 3) depende del registro de notificaciones de PB-024 (Backend 2). |

**Bloque: Frontend 2 — pantallas de backoffice sin historia previa** — *Order, Customer, Audit/Traceability/Reporting, Identity/Configuration* · [F2]

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Estado | Criterios de aceptación |
|---|---|---:|---:|---|---|---|
| PB-041 | [F2] Como **gerencia u operaciones**, quiero un dashboard administrativo con indicadores clave de la operación, para ver el estado del negocio de un vistazo. | Media | 5 | Sprint 3 | En progreso — Dashboard con datos simulados, sin conectar al backend real | 1) Muestra como mínimo órdenes por estado, incidencias abiertas y pagos fallidos; 2) los datos se actualizan al recargar; 3) acceso restringido por rol (PB-047); 4) requiere endpoints de métricas en Audit/Traceability/Reporting (Backend 2). |
| PB-042 | [F2] Como **personal de atención u operaciones**, quiero listar, buscar y abrir cualquier orden con su estado consolidado, para resolver consultas sin llamadas ni conciliación manual. | Alta | 5 | Sprint 2 | Pendiente — el backend no tiene endpoint de listado/búsqueda de órdenes | 1) Listado con búsqueda por número de orden, cliente y estado; 2) el detalle consolida compra, pago, despacho, entrega e incidencias (misma vista de PB-025); 3) desde el detalle puedo iniciar un cambio o devolución (PB-026); 4) requiere endpoint de listado/búsqueda en Order Service (Backend 1). |
| PB-043 | [F2] Como **personal de operaciones**, quiero una bandeja de incidencias (falla de factura SAT, guía LogiExpress, pago fallido definitivo) con su estado, para atenderlas manualmente y que nada quede perdido. | Media | 5 | Sprint 3 | En progreso — backend de incidencias listo, sin pantalla en frontend | 1) Lista las incidencias generadas por PB-014, PB-016 y PB-022 con orden, motivo y fecha; 2) puedo marcarlas como en atención o resueltas; 3) cada cambio queda auditado (PB-028); 4) requiere registro de incidencias (Backend 2). |
| PB-044 | [F2] Como **personal de logística**, quiero dar seguimiento al estado de las entregas (preparación, tránsito, entrega) por orden y por guía, para detectar retrasos. | Media | 3 | Sprint 3 | Pendiente — sin pantalla en frontend | 1) Muestra el estado de cada envío y su guía de LogiExpress cuando exista; 2) permite filtrar por estado y punto de despacho; 3) refleja los cambios de método de entrega (PB-023); 4) consume los estados de Logistics Service (Backend 2). |
| PB-045 | [F2] Como **personal de atención**, quiero consultar y gestionar los datos de los clientes, para atender casos que llegan por cualquier canal. | Media | 3 | Sprint 2 | En progreso — backend de historial de cliente listo, sin pantalla dedicada | 1) Búsqueda de clientes por nombre, teléfono o correo; 2) el detalle muestra datos de contacto e historial de órdenes; 3) la edición se limita a datos de contacto; 4) requiere endpoints en Customer Service (Backend 1). |
| PB-046 | [F2] Como **gerencia**, quiero reportes y métricas de ventas, pagos, despachos y devoluciones, para tomar decisiones con datos oportunos. | Media | 5 | Sprint 3 | En progreso — Reportes con datos simulados, sin conectar al backend real | 1) Reportes filtrables por rango de fechas y canal; 2) incluyen órdenes, pagos (aprobados/fallidos), despachos y devoluciones; 3) los datos coinciden con los registros de Audit/Traceability Service; 4) requiere endpoints de reporting (Backend 2). |
| PB-047 | [F2] Como **administrador**, quiero gestionar roles y parámetros de configuración del sistema, para controlar quién accede a cada pantalla y ajustar valores como el tiempo de liberación de reservas. | Alta | 5 | Sprint 2 | En progreso — login/roles/JWT existen en backend; sin panel de administración de roles en frontend | 1) Puedo asignar un rol a un usuario interno; 2) las pantallas de backoffice se muestran u ocultan según el rol; 3) los parámetros configurables (p. ej. TTL de reserva de PB-007) se consultan y editan; 4) requiere Identity/Configuration Service — **backend por asignar**. |

---

---

# Sprint Planning y Sprint Backlog

> Reconstruido a partir del historial real de `git log` (commits, autores y fechas) sobre `develop`, no de actas de reunión — el equipo no dejó minutas de las ceremonias. Se hicieron 3 Sprint Planning, uno cada lunes: 2026-09-07, 2026-09-14 y 2026-09-21. Los dos primeros continuaron el DDA de Fase 1 (sin código todavía); el tercero fue el sprint de implementación del MVP.

## Sprint Planning

### Sprint 1 — lunes 2026-09-07

**Objetivo de Sprint:** refinar el DDA de Fase 1 con los CDU expandidos que pide el enunciado de Fase 2 (uno por sección de la hoja de calificación) y fijar el diagrama de componentes de la arquitectura a implementar.

- Fecha: 2026-09-07 · Fin de sprint: 2026-09-13
- Roles presentes: Scrum Master — Juan José Rodas Mansilla (202200389); Product Owner — Williams Bramlley Constanza Oscal (199919737); Dev Team — Hernán Ricardo Ávila Castillo (9516085), Sebastián Alejandro Vásquez Cartagena (202109114), Carmen María Marroquín Llamas (202001132)
- Decisiones técnicas: ninguna de stack todavía — sprint de documentación. Herramienta de diagramación: Draw.io (`.drawio`), igual que en Fase 1
- Story points comprometidos: no aplica — el Product Backlog con SP no existía aún (se creó hasta el Sprint 2, ver abajo)

### Sprint 2 — lunes 2026-09-14

**Objetivo de Sprint:** cerrar la documentación de arquitectura pendiente (matriz de restricciones, diagrama de despliegue) y dejar listo el Product Backlog con historias y story points para poder planear la implementación.

- Fecha: 2026-09-14 · Fin de sprint: 2026-09-20
- Roles presentes: mismos que Sprint 1
- Decisiones técnicas: ninguna de stack todavía
- Story points comprometidos: no aplica — el backlog se terminó de escribir el 2026-09-18, al cierre de este mismo sprint

### Sprint 3 — lunes 2026-09-21

**Objetivo de Sprint:** llevar SGO-Logic de la definición arquitectónica a un MVP funcional de punta a punta sobre el backend real (Java 21 + Spring Boot + PostgreSQL): carrito, checkout, pago con PayKlik simulado y resiliencia vía outbox transaccional, facturación electrónica a la SAT, despacho con LogiExpress, conciliación batch con el ERP AS/400 y eventos hacia el POS de las 32 tiendas — con el frontend de cliente conectado a la API real en sus flujos críticos, y evidencia de pruebas de concurrencia, rendimiento y volumen que respalde los EAC de la Fase 1.

- Fecha: 2026-09-21 · Fin de sprint: 2026-09-23 (Entrega Final del enunciado) — el trabajo real se extendió hasta 2026-09-25, ya sobre la fecha de entrega
- Roles presentes: mismos que Sprint 1 y 2
- Story points comprometidos: no se registró un compromiso previo a la ejecución (no hubo backlog refinement documentado); reconstruido contra lo entregado — 141 de 214 SP completados (30 de 47 historias; detalle en la columna Estado del Product Backlog), 44 SP en progreso y 27 SP pendientes
- Decisiones técnicas:

| Decisión | Elegido |
|---|---|
| Framework Frontend | React 19 + Vite 8 + TypeScript 6 + Tailwind CSS 3.4 |
| Framework Backend | Java 21 + Spring Boot 3.3.4 |
| Base de datos | PostgreSQL 16, un esquema por componente (ver ADR-0001 de Fase 1 y `db/README.md`) |
| Message Broker | Ninguno externo — outbox transaccional en la propia base de datos (ADR-0007: "Outbox en la base como broker del MVP") |
| Pipeline de automatización | No implementado — no hay workflows de CI/CD versionados en el repositorio |
| Herramienta de tablero Kanban | Sin verificar — no se pudo confirmar si existe un tablero activo (GitHub Projects/Trello); confirmar con el equipo |

---

## Sprint Backlog

### Sprint 1 (sin Product Backlog todavía — tareas de arquitectura)

| Tarea | Responsable | Resultado |
|---|---|---|
| Actualizar los diagramas UML | Williams Bramlley Constanza Oscal | `feat(uml) se actualizolos uml` |
| CDU Alto Nivel + CDU Expandidos de Consultas, Gestión Logística y Compras | Hernán Ricardo Ávila Castillo | `9516085: se modifico el CDU Alto Nivel...` |
| CDU Expandidos de Auditoría y Configuración | Hernán Ricardo Ávila Castillo | `9516085: se crearon los CDU de auditoria y configuracion` |
| Diagrama de Gestionar Clientes | Sebastián Alejandro Vásquez Cartagena | `feat(gestionar clientes): Se creo el diagrama...` |
| Diagrama de Componentes de Fase 2 | Juan José Rodas Mansilla | `feat(fase2): se agrega el diagrama de componentes de SGO-Logic` |
| Drivers Arquitectónicos (RF/RC/R) | Williams Bramlley Constanza Oscal | `feat(drivers): se crearon los drivers arquitectonicos` |

Sin actividad registrada de Carmen María Marroquín Llamas.

### Sprint 2 (sin Product Backlog todavía — tareas de arquitectura)

| Tarea | Responsable | Resultado |
|---|---|---|
| Arreglar el diagrama de Gestionar Clientes | Sebastián Alejandro Vásquez Cartagena | `feat(gestionar clientes): diagrama arreglado` |
| Matriz de Restricciones (R × RF/RC) | Juan José Rodas Mansilla | `docs(restricciones) se creo diagrama/matriz de restricciones` |
| Diagrama de Despliegue | Sebastián Alejandro Vásquez Cartagena | `feat(diagrama de despliegue): diagrama de despliegue terminado` (x2, incluye PNG) |
| Product Backlog con historias y story points | Juan José Rodas Mansilla | `agregado reporte con PB y formato de SP` |

Sin actividad registrada de Hernán Ricardo Ávila Castillo, Williams Bramlley Constanza Oscal ni Carmen María Marroquín Llamas.

### Sprint 3 (Product Backlog completo — ver tabla de la sección Product Backlog para el detalle historia por historia)

| Bloque | Historias | SP del bloque | Motivo de selección | Responsable principal |
|---|---|---:|---|---|
| Catálogo, precios y carrito omnicanal | PB-001 a PB-004 | 16 | Backbone del flujo de compra (RF01, CDU-01) | Hernán Ricardo Ávila Castillo |
| Inventario centralizado | PB-005 a PB-008 | 19 | Evita sobreventa (RC08); habilita catálogo y checkout | Hernán Ricardo Ávila Castillo |
| Clientes | PB-009 | 3 | Identidad consistente entre canales (CDU-01) | Hernán Ricardo Ávila Castillo |
| Pagos y resiliencia | PB-010 a PB-014 | 24 | Driver de mayor prioridad del proyecto (DC-01/RF05) | Sebastián Alejandro Vásquez Cartagena |
| Facturación electrónica | PB-015, PB-016 | 10 | Ninguna orden se despacha sin factura SAT válida | Sebastián Alejandro Vásquez Cartagena |
| Integración con sistemas legados | PB-017 a PB-019 | 18 | Restricción R07 (no modificar AS/400 ni POS) | Sebastián Alejandro Vásquez Cartagena |
| Logística y despacho | PB-020 a PB-023 | 16 | Objetivo de negocio: -70% errores de despacho | Sebastián Alejandro Vásquez Cartagena |
| Notificaciones | PB-024 | 5 | Desacople exigido por RC04/RC05 | Sebastián Alejandro Vásquez Cartagena |
| Consulta, devoluciones y auditoría | PB-025 a PB-028 | 20 | Cumplimiento fiscal y trazabilidad (R11) | Hernán Ricardo Ávila Castillo / Sebastián Alejandro Vásquez Cartagena |
| Calidad, pruebas, documentación e infraestructura | PB-029 a PB-034 | 33 | Restricciones R01-R06 y entregables obligatorios del enunciado | Todo el equipo |
| Frontend 1 — pantallas de cliente | PB-035 a PB-040 | 19 | Completa las pantallas de cliente sin historia previa | Juan José Rodas Mansilla |
| Frontend 2 — pantallas de backoffice | PB-041 a PB-047 | 31 | Completa las pantallas de administración sin historia previa | Williams Bramlley Constanza Oscal / Juan José Rodas Mansilla |

Sin commits propios de Carmen María Marroquín Llamas en ningún sprint de Fase 2 (ver Sprint Retrospective, Sprint 3).

---

## Daily Scrum

> Reconstruido de los commits reales; solo se listan integrante y día con actividad registrada en `git log`. Formato exigido por el enunciado de Fase 2: (1) qué se materializó/refactorizó ayer y su resultado numérico o funcional, (2) qué se codificará hoy con trazabilidad a drivers/EAC/restricciones, (3) impedimentos técnicos.

### Sprint 1

**Martes 2026-09-09 — Williams Bramlley Constanza Oscal (199919737)**
1. Actualizó los 3 diagramas UML de Fase 1 (Core, CUN, CDU) para que reflejen el alcance de Fase 2.
2. Hoy iniciará los Drivers Arquitectónicos (RF/RC/R) que exige el DDA de Fase 2.
3. Ninguno.

**Martes 2026-09-09 — Hernán Ricardo Ávila Castillo (9516085)**
1. Modificó el CDU Alto Nivel y creó los CDU Expandidos de Consultas, Gestión Logística y Compras; después, los de Auditoría y Configuración — 5 de los 8 CDU expandidos de Fase 2 quedaron listos en el día.
2. Hoy no hay commit posterior registrado de este integrante hasta el 2026-09-21 (siguiente actividad, ya en Sprint 3).
3. Ninguno.

**Martes 2026-09-09 — Sebastián Alejandro Vásquez Cartagena (202109114)**
1. Creó el diagrama de Gestionar Clientes (CDU expandido).
2. Ese mismo diagrama tenía un error de trazabilidad — se corregirá el 2026-09-14 (Sprint 2).
3. Ninguno.

**Jueves 2026-09-11 — Juan José Rodas Mansilla (202200389)**
1. Agregó el diagrama de componentes de SGO-Logic para Fase 2, con base en los drivers y ADR de Fase 1.
2. Hoy no hay commit posterior registrado de este integrante hasta el 2026-09-12.
3. Ninguno.

**Viernes 2026-09-12 — Williams Bramlley Constanza Oscal (199919737)**
1. Creó los Drivers Arquitectónicos (RF 01-11, RC 01-10, R 01-11) que documentan el alcance técnico de Fase 2.
2. Cierra Sprint 1; el siguiente trabajo de este integrante es en Sprint 3 (dashboard/reportes, 2026-09-23).
3. Ninguno.

### Sprint 2

**Lunes 2026-09-14 — Sebastián Alejandro Vásquez Cartagena (202109114)**
1. Corrigió el diagrama de Gestionar Clientes de Sprint 1.
2. Hoy iniciará el diagrama de despliegue de Fase 2.
3. Ninguno.

**Lunes 2026-09-14 — Juan José Rodas Mansilla (202200389)**
1. Creó la matriz de restricciones (R × RF/RC, 11 restricciones contra 21 drivers), con convención X = impacto directo.
2. Hoy no hay commit posterior registrado hasta el 2026-09-18.
3. Ninguno.

**Martes 2026-09-15 — Sebastián Alejandro Vásquez Cartagena (202109114)**
1. Terminó el diagrama de despliegue de Fase 2 (incluida su exportación a PNG).
2. Cierra su actividad de Sprint 2; el siguiente trabajo de este integrante es en Sprint 3 (2026-09-23).
3. Ninguno.

**Viernes 2026-09-18 — Juan José Rodas Mansilla (202200389)**
1. Armó el Product Backlog completo con historias de usuario y story points, cerrando la documentación previa a la implementación.
2. Cierra Sprint 2; el siguiente trabajo de este integrante es en Sprint 3 (2026-09-22).
3. Ninguno — pero deja anotado que aún faltan 3 días sin actividad de Hernán, Williams ni Carmen en este sprint.

### Sprint 3

**Lunes 2026-09-21 — Hernán Ricardo Ávila Castillo (9516085)**
1. Sin trabajo previo de backend que retomar — arrancó desde cero.
2. Hoy: base de datos completa (esquemas por componente, datos de prueba, rol de aplicación sin privilegios de superusuario — ADR-0006), modelo de Identity/Configuration, y el esqueleto de Spring Boot con carrito, checkout, catálogo, clientes e inventario con reserva atómica y liberación automática de reservas vencidas (RF04, RC08).
3. Ninguno — un solo día de trabajo dejó 5 servicios base y su base de datos funcionando (30 commits).

**Martes 2026-09-22 — Hernán Ricardo Ávila Castillo (9516085)**
1. Documentó la API para el frontend (colección de Postman) y uniformó el formato de errores (404/400/409 con el mismo cuerpo en toda la API).
2. Hoy no hay commit posterior registrado de este integrante hasta el 2026-09-23.
3. Ninguno.

**Martes 2026-09-22 — Juan José Rodas Mansilla (202200389)**
1. Scaffold del frontend (Vite + React + TypeScript + Tailwind + Vitest) y, sobre él, catálogo, carrito, checkout, orden y pago completos contra un backend simulado (mock) — 40 commits, cubriendo PB-001 a PB-014.
2. Hoy: reidentificación de cliente (PB-009) y notificaciones flotantes de estado de orden/pago.
3. Ninguno, aunque el backend real todavía no estaba listo para conectar — todo el día se trabajó contra mocks documentados.

**Miércoles 2026-09-23 — Sebastián Alejandro Vásquez Cartagena (202109114)**
1. En una sola madrugada: cobro con PayKlik (outbox + circuit breaker + guardia de tarjetas, CDU-02), facturación electrónica a la SAT (CDU-03), despacho con LogiExpress (CDU-04), conciliación batch con el ERP AS/400 (CDU-07), adaptador de POS, notificaciones desacopladas, auditoría transversal y su documentación de API — los 5 módulos que exige el enunciado quedaron con código.
2. Hoy (segunda tanda, la noche del mismo día): entradas/salidas/ajuste de inventario, historial de cliente, registro de incidencias, seis CDU expandidos con trazabilidad, las vistas implementadas (bloques/componentes/despliegue), las 3 pruebas ejecutables (concurrencia/rendimiento/volumen) y la matriz de trazabilidad contra la hoja de calificación — con hallazgos propios: el paso 10 del flujo principal no emitía ningún evento al POS, y el ADR-0001 pedía contenedores independientes que el código no tenía (ambos corregidos con ADR-0009).
3. El AS/400 simulado dependía de que la carpeta de salida existiera; si no, el lote quedaba `PENDING` para siempre — corregido el mismo día con reintento cada minuto.

**Miércoles 2026-09-23 — Williams Bramlley Constanza Oscal (199919737)**
1. Dashboard administrativo y Reportes administrativos, como proyecto de frontend separado (`frontend2`).
2. No hay commit posterior de este integrante — su trabajo fue portado al frontend unificado por Juan José Rodas Mansilla al día siguiente (ver 2026-09-24) y el proyecto separado se eliminó del repositorio.
3. Trabajar en un proyecto de frontend aparte del que ya existía (`frontend/`) obligó a portar el código en vez de integrarlo directamente.

**Miércoles 2026-09-23 — Hernán Ricardo Ávila Castillo (9516085)**
1. Crear y editar productos con existencia inicial en las 34 ubicaciones, y gestión de incidencias (registrar, listar, procesar cambios y devoluciones).
2. Hoy no hay commit posterior registrado de este integrante hasta el 2026-09-24.
3. Ninguno.

**Jueves 2026-09-24 — Hernán Ricardo Ávila Castillo (9516085)**
1. Autenticación con login y JWT, protegiendo crear/editar productos y procesar incidencias; usuario de prueba sembrado para poder loguearse.
2. Cierra su actividad de este sprint.
3. Ninguno.

**Jueves 2026-09-24 — Juan José Rodas Mansilla (202200389)**
1. Portó el Dashboard y Reportes de Williams Bramlley Constanza Oscal al frontend unificado, con sus propios componentes visuales (StatCard, DonutBreakdown, BarBreakdown) y corrigió el enum de estado de orden y el contrato `/bff` que no coincidía con el backend real.
2. Hoy no hay commit posterior registrado de este integrante hasta el 2026-09-25.
3. El backoffice quedó documentado como pendiente de conectar al backend real — el backend no expone todavía endpoints de métricas ni reportes.

**Viernes 2026-09-25 (hoy) — Juan José Rodas Mansilla (202200389)**
1. Conectó catálogo, cliente, carrito, checkout, pago y orden al backend real (ya no mocks) — corrigiendo en el camino que los tipos del frontend no coincidían con la API real (`'tarjeta'`/`'aprobado'` contra `CARD`/`APPROVED`, ids de texto contra numéricos).
2. Hoy: documentación final (contratos actualizados, checklist, README raíz) y reasignación del backlog Frontend 1/2 a Cliente/Backoffice.
3. Sin backend levantado localmente en varios puntos del día por el puerto 5432 ocupado — resuelto documentando la variable `DB_PORT` alternativa en el README.

**Viernes 2026-09-25 (hoy) — Sebastián Alejandro Vásquez Cartagena (202109114)**
1. Actualizó README y documentación con la autenticación JWT, las incidencias y la migración V8; alineó los diagramas con las incidencias integradas.
2. Cierra su actividad de este sprint.
3. Ninguno.

Sin actividad registrada de Carmen María Marroquín Llamas en ningún día de los 3 sprints de Fase 2.

---

## Sprint Retrospective

> Reconstruida de los commits reales, no de una sesión de retrospectiva documentada por el equipo — no se encontró un registro propio de esta ceremonia.

### Sprint 1

1. **¿Qué se hizo bien?** Se cubrieron 6 de los 8 CDU expandidos de Fase 2 y el diagrama de componentes en menos de una semana, sin bloquear a nadie entre sí (cada persona tomó un artefacto distinto).
2. **¿Qué se hizo mal / qué impedimentos hubo?** No se dejó registro de una reunión de Sprint Planning ni de Daily Scrum — toda la coordinación se reconstruye ahora, después del hecho, a partir de los commits.
3. **Mejoras propuestas:** dejar la bitácora de Scrum al día durante el sprint, no al final de la Fase 2.

### Sprint 2

1. **¿Qué se hizo bien?** Se cerró toda la documentación de arquitectura pendiente (matriz de restricciones, diagrama de despliegue) y el Product Backlog quedó listo con story points antes de escribir una sola línea de código de Fase 2 — la implementación de Sprint 3 arrancó con un plan, no a ciegas.
2. **¿Qué se hizo mal?** Solo 2 de los 5 integrantes (Sebastián y Juan José) tienen commits en este sprint; Hernán, Williams y Carmen no participaron de la documentación de este período.
3. **Mejoras propuestas:** repartir explícitamente quién documenta qué en cada sprint, para no depender de que 2 personas carguen con toda la preparación.

### Sprint 3

1. **¿Qué decisiones y patrones se consolidaron con éxito al interactuar con el código real?** El outbox transaccional en la base de datos (ADR-0007, sin broker externo) sostuvo 80 checkouts concurrentes sin sobreventa y sin órdenes a medias; la reserva atómica de inventario (`UPDATE ... WHERE on_hand - reserved >= :cantidad`) se verificó en 3 corridas seguidas. El rendimiento de consulta de orden y auditoría quedó dos órdenes de magnitud por debajo de sus metas (p99 36 ms contra metas de 1-5 segundos).
2. **¿Qué supuestos de la Fase 1 fallaron o requirieron refactorización de emergencia?** El ADR-0001 y el ADR-0005 pedían los componentes en contenedores Docker independientes; el equipo los implementó en un solo contenedor por razones de tiempo y consistencia transaccional del checkout — desviación registrada y justificada en el ADR-0009, no ocultada. El paso 10 del flujo principal ("eventos hacia el POS") no ocurría en el camino feliz tal como estaba diseñado, porque el despacho normal sale de un centro de distribución, no de una tienda; se corrigió emitiendo la existencia consolidada a las 32 tiendas al cerrar cada ventana del ERP. El tiempo de reserva de inventario estaba en 15 minutos en la base cuando CDU-01/CDU-08 fijan 20 — corregido con una migración dedicada (`V8`).
3. **¿Qué mejoras técnicas concretas se proponen?** Agregar pruebas unitarias de backend (`src/test/java` está vacío hoy); dockerizar el frontend para que el `docker-compose.yml` levante el sistema completo, no solo base de datos y backend; y — la más urgente para la nota de este sprint — que Carmen María Marroquín Llamas, responsable de documentación/Docker/pruebas E2E, no tiene ningún commit propio en los 3 sprints de Fase 2; ese trabajo terminó cubierto por el resto del equipo (documentación por Sebastián y Juan José, Docker parcial por Hernán) sin que quedara explícito en el reparto original.

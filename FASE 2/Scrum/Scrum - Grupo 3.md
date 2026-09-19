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
| Estudiante 1 | | Backend 1 — Núcleo comercial |
| Estudiante 2 | | Backend 2 — Transacciones e integraciones |
| Estudiante 3 | | Frontend 1 — Núcleo comercial |
| Estudiante 4 | | Frontend 2 — Transacciones e integraciones |
| Estudiante 5 | | Documentación, Docker y pruebas E2E |

---

## Índice

1. [Product Backlog](#1-product-backlog)
2. [Sprint Planning](#2-sprint-planning)
3. [Sprint Backlog](#3-sprint-backlog)
4. [Daily Scrum](#4-daily-scrum)
5. [Sprint Retrospective](#5-sprint-retrospective)

---

## 1. Product Backlog

> Historias derivadas de `FASE 2/DDA/driversArquitectonicos.md` (RF/RC/R) y de los CDU expandidos de Fase 1 (`FASE 1/Docs/DDA/casos-de-uso/`), agrupadas por el componente de `FASE 2/DRAWIO/Diagrama-Componentes-SGO-Logic-Fase2.drawio` que las realiza. Cada bloque indica de qué backend/frontend depende, según la asignación acordada por el equipo (Backend 1/Frontend 1 = núcleo comercial; Backend 2/Frontend 2 = transacciones e integraciones; Integrante 5 = documentación, Docker y E2E).
>
> `Sprint sugerido` es una propuesta de secuenciación por dependencia (backbone → integraciones externas → cierre/calidad), **no un compromiso** — el compromiso real de sprint, fechas y story points se define en la sección 2 (Sprint Planning) de cada sprint.

**Bloque: Catálogo, precios y carrito omnicanal** — *Order/Checkout Service, Catalog/Product Service, Pricing & Promotions Service* · Backend 1 / Frontend 1 · RF01, CDU-01

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Criterios de aceptación |
|---|---|---:|---:|---|---|
| PB-001 | Como **cliente**, quiero consultar el catálogo de productos con su disponibilidad y precio vigente para decidir qué comprar desde cualquier canal. | Alta | 5 | Sprint 1 | 1) El catálogo cubre línea blanca, electrónica, ropa y calzado; 2) el precio mostrado incluye promociones vigentes (Pricing & Promotions); 3) la disponibilidad mostrada proviene del inventario centralizado (RF03), no de una copia local por canal. |
| PB-002 | Como **cliente**, quiero agregar productos a un carrito que se mantenga igual sin importar si cambio de canal, para continuar mi compra sin perder lo ya elegido. | Alta | 5 | Sprint 1 | 1) El carrito persiste asociado al cliente, no al canal/dispositivo (regla de negocio de CDU-01); 2) es visible de forma idéntica desde web, app y centro de atención; 3) agregar un producto verifica disponibilidad en tiempo real contra Inventory Service antes de reservar. |
| PB-003 | Como **cliente**, quiero que el sistema me avise si un producto ya no está disponible y me sugiera una alternativa o tienda con existencia, para no quedarme sin opciones. | Media | 3 | Sprint 1 | 1) Si la reserva falla por falta de disponibilidad, se muestra el motivo; 2) se sugiere un producto alternativo o la tienda más cercana con existencia; 3) el resto del carrito no se ve afectado. |
| PB-004 | Como **cliente**, quiero confirmar mi compra seleccionando el método de entrega para pasar al proceso de pago. | Alta | 3 | Sprint 1 | 1) Puedo elegir centro de distribución, tienda o recogida como método de entrega; 2) al confirmar, la orden pasa a estado "pendiente de pago"; 3) se dispara el flujo de Procesar Pago (RF05). |

**Bloque: Inventario centralizado** — *Inventory Service* · Backend 1 / Frontend 1 · RF03, RF04, CDU-08

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Criterios de aceptación |
|---|---|---:|---:|---|---|
| PB-005 | Como **personal de logística**, quiero ver una vista consolidada de existencias, ubicaciones y reservas de los 2 centros de distribución y las 32 tiendas, para no depender de llamadas telefónicas. | Alta | 8 | Sprint 1 | 1) La vista consolida entradas/salidas/reservas de ambos centros y las 32 tiendas; 2) se actualiza con cada evento reportado desde un POS o centro; 3) reemplaza la confirmación telefónica manual actual. |
| PB-006 | Como **sistema**, quiero reservar temporalmente la unidad de inventario al agregarla a un carrito, para evitar que se comprometa a más de un cliente. | Alta | 5 | Sprint 1 | 1) Al agregar al carrito se crea una reserva atómica en Inventory Service; 2) si dos canales intentan reservar la misma unidad casi simultáneamente, solo uno tiene éxito; 3) la reserva queda con marca de tiempo para el temporizador de liberación. |
| PB-007 | Como **sistema**, quiero liberar automáticamente el inventario reservado tras 20 minutos de inactividad, para no bloquear stock de compras abandonadas. | Alta | 3 | Sprint 1 | 1) El temporizador de liberación es configurable (20 min por defecto); 2) al expirar sin confirmación de compra, la unidad vuelve a estar disponible; 3) la liberación no afecta carritos con checkout ya en curso. |
| PB-008 | Como **sistema**, quiero aceptar el ajuste de inventario más reciente de una tienda como fuente de verdad cuando contradice el estado centralizado, dejando el conflicto registrado. | Media | 3 | Sprint 2 | 1) El evento más reciente de la tienda prevalece sobre el estado centralizado; 2) la diferencia queda registrada para auditoría; 3) no bloquea otras operaciones sobre esa unidad. |

**Bloque: Clientes** — *Customer Service* · Backend 1 / Frontend 1 · soporte de RF01

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Criterios de aceptación |
|---|---|---:|---:|---|---|
| PB-009 | Como **cliente**, quiero ser identificado de forma consistente entre canales (sesión, teléfono o cuenta) para que mi carrito y mi historial se reconozcan sin importar por dónde entro. | Alta | 3 | Sprint 1 | 1) El sistema identifica al cliente por sesión, teléfono o cuenta según el canal; 2) si la sesión no es reconocible, se solicita reidentificación antes de continuar; 3) el carrito queda asociado al cliente, no al dispositivo. |

**Bloque: Pagos y resiliencia** — *Payment Service, Message Broker/Outbox, integración PayKlik* · Backend 2 / Frontend 2 · RF05, RF06, CDU-02

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Criterios de aceptación |
|---|---|---:|---:|---|---|
| PB-010 | Como **cliente**, quiero pagar mi orden con tarjeta, transferencia o billetera digital para completar mi compra con el método que prefiera. | Crítica | 5 | Sprint 1 | 1) El checkout ofrece tarjeta, transferencia y billetera digital; 2) el cobro se envía a PayKlik vía REST; 3) el resultado (éxito/fallo) se refleja en la orden. |
| PB-011 | Como **sistema**, quiero registrar cada intento de cobro (orden, canal, fecha, resultado) sin almacenar PAN ni CVV, para mantener auditabilidad sin comprometer datos sensibles. | Crítica | 5 | Sprint 1 | 1) Cada intento, exitoso o fallido, queda relacionado con orden/canal/fecha/resultado; 2) no se persiste número completo de tarjeta ni CVV, solo el token/referencia de PayKlik; 3) el registro es consultable para auditoría. |
| PB-012 | Como **sistema**, quiero encolar y reintentar un intento de cobro vía Transactional Outbox + Circuit Breaker cuando PayKlik no responde o falla, para no perder la orden. | Crítica | 8 | Sprint 2 | 1) Si PayKlik falla o no responde, el intento se encola en el Message Broker en vez de perderse; 2) el circuit breaker detiene los reintentos inmediatos ante degradación y pasa el intento a cola; 3) el cliente ve el estado "pago en proceso" mientras se reintenta. |
| PB-013 | Como **cliente**, quiero poder reintentar el pago con otro método si mi cobro es rechazado, para no perder la orden por un problema puntual del método elegido. | Alta | 3 | Sprint 1 | 1) Un cobro rechazado devuelve la orden a "pendiente de pago"; 2) se muestra el motivo devuelto por PayKlik; 3) puedo elegir un método de pago distinto sin recrear el carrito. |
| PB-014 | Como **sistema**, quiero marcar un intento como fallido definitivo y notificar al cliente cuando se agotan los reintentos configurados con PayKlik, en vez de dejarlo en espera indefinida. | Alta | 3 | Sprint 2 | 1) Existe un número máximo de reintentos configurado; 2) al agotarse, el intento queda auditado como fallido definitivo; 3) el cliente recibe una notificación para reintentar más tarde. |

**Bloque: Facturación electrónica** — *Invoicing Service, integración SAT* · Backend 2 / Frontend 2 · RF07, CDU-03

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Criterios de aceptación |
|---|---|---:|---:|---|---|
| PB-015 | Como **sistema**, quiero generar y enviar a la SAT el XML de factura con CUI y serie autorizada apenas se confirma el pago, para que ninguna orden avance sin respaldo fiscal. | Alta | 5 | Sprint 2 | 1) El XML se genera al confirmarse el pago (post PB-010/011); 2) conserva CUI y serie autorizada; 3) la orden no se marca como facturada hasta recibir validación de la SAT. |
| PB-016 | Como **sistema**, quiero reintentar el envío a la SAT y escalar como incidencia auditable si no hay respuesta tras los reintentos, para que la orden nunca se despache sin factura válida. | Alta | 5 | Sprint 2 | 1) Un rechazo de la SAT dispara reintento de generación/envío; 2) si se agotan los reintentos, se genera una incidencia auditable para revisión manual; 3) la orden queda retenida antes de despacho mientras no haya factura válida. |

**Bloque: Integración con sistemas legados** — *ERP Sync Adapter, POS Adapter* · Backend 2 / Frontend 2 · RF08, RF09, CDU-07

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Criterios de aceptación |
|---|---|---:|---:|---|---|
| PB-017 | Como **Finanzas**, quiero que las ventas facturadas se sincronicen con el ERP-Core cada 30 minutos vía CSV/XML sin modificar el ERP, para eliminar la conciliación manual actual. | Alta | 8 | Sprint 2 | 1) El sistema agrupa ventas facturadas dentro de la ventana de 30 minutos; 2) genera un archivo CSV/XML en el formato que acepta el ERP-Core; 3) registra la confirmación de sincronización para auditoría, sin modificar el ERP-Core. |
| PB-018 | Como **sistema**, quiero que la sincronización con el ERP sea idempotente y se reintente en la siguiente ventana si el lote es rechazado, para no duplicar ni perder registros contables. | Alta | 5 | Sprint 2 | 1) Un lote rechazado genera alerta y se reintenta en la siguiente ventana; 2) reprocesar un lote no genera registros duplicados; 3) una interrupción a medias no produce doble registro en el ERP. |
| PB-019 | Como **sistema**, quiero enviar eventos de actualización desde SGO-Logic hacia los POS de las 32 tiendas con manejo de errores y reintentos, sin requerir cambios en el POS. | Alta | 5 | Sprint 2 | 1) El adaptador POS envía eventos salientes hacia las 32 tiendas; 2) los reintentos no requieren modificar el POS; 3) un evento no entregado se reintenta sin perderse. |

**Bloque: Logística y despacho** — *Logistics Service, integración LogiExpress* · Backend 2 / Frontend 2 · RF10, CDU-04

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Criterios de aceptación |
|---|---|---:|---:|---|---|
| PB-020 | Como **personal de logística**, quiero que el sistema determine el punto de despacho (centro, tienda o pickup) apenas la orden está facturada, para saber qué preparar y desde dónde. | Alta | 5 | Sprint 2 | 1) El punto de despacho se determina contra el inventario centralizado vigente; 2) logística recibe la orden con ubicación de origen y datos del destinatario; 3) el disparador es la orden facturada (post PB-015). |
| PB-021 | Como **sistema**, quiero generar la guía con LogiExpress y reintentar vía circuit breaker ante un timeout, sin bloquear la operación principal. | Alta | 5 | Sprint 2 | 1) La guía se genera con LogiExpress cuando el método de entrega lo requiere; 2) un timeout de LogiExpress dispara reintento vía circuit breaker; 3) el timeout no bloquea la confirmación de la orden. |
| PB-022 | Como **personal de logística**, quiero recibir una alerta operativa si LogiExpress no genera la guía tras los reintentos, para intervenir manualmente sin perder la orden. | Media | 3 | Sprint 2 | 1) Se genera una alerta visible para logística; 2) la orden queda pendiente de asignación manual, nunca "perdida"; 3) la alerta referencia la orden y el motivo del fallo. |
| PB-023 | Como **cliente**, quiero poder cambiar el método de entrega después de confirmada mi compra, para ajustar mi pedido sin perder el proceso ya avanzado. | Media | 3 | Sprint 2 | 1) El cambio de método de entrega actualiza el punto de despacho; 2) no se reinicia el proceso ni se pierde la trazabilidad de la orden; 3) el cambio queda registrado en el historial de la orden. |

**Bloque: Notificaciones** — *Notification Service* · Backend 2 / Frontend 2 · RF11

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Criterios de aceptación |
|---|---|---:|---:|---|---|
| PB-024 | Como **cliente**, quiero recibir notificaciones de confirmación, preparación, tránsito, entrega o incidencias, sin que una falla del canal de notificación bloquee mi compra. | Media | 5 | Sprint 2 | 1) Se envían notificaciones por SMS, correo o push en cada hito de la orden; 2) el envío es asíncrono/desacoplado (fire-and-forget); 3) una falla del proveedor de notificaciones no impide confirmar ni avanzar la orden. |

**Bloque: Consulta, devoluciones y auditoría** — *Order Service (consulta), Payment Service (extend), Audit/Traceability/Reporting* · Backend 1 + Backend 2 / Frontend 1 + Frontend 2 · RF02, RC01, RC02, R11, CDU-05, CDU-06

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Criterios de aceptación |
|---|---|---:|---:|---|---|
| PB-025 | Como **cliente o personal de atención**, quiero consultar el estado consolidado (compra, pago, despacho, entrega, incidencias) de cualquier orden en menos de 5 segundos desde cualquier canal. | Media | 5 | Sprint 3 | 1) La consulta responde en menos de 5 segundos en operación normal; 2) la vista consolida compra, pago, despacho, entrega e incidencias; 3) una orden inexistente responde con mensaje claro sin exponer información de otras órdenes. |
| PB-026 | Como **cliente o personal de atención**, quiero iniciar una devolución o cambio referenciando la venta original con vista consolidada, para resolverla sin llamadas ni conciliación manual. | Media | 5 | Sprint 3 | 1) La devolución/cambio referencia la orden original; 2) se muestra la vista consolidada de compra, pago, despacho y entrega; 3) una orden no elegible informa el motivo sin bloquear la consulta del historial. |
| PB-027 | Como **sistema**, quiero procesar el reembolso de una devolución extendiendo el flujo de pago, exigiendo aprobación de Finanzas si el monto supera USD 500 o la venta tiene financiamiento activo. | Media | 5 | Sprint 3 | 1) El reembolso reutiliza el mecanismo de intento de cobro/pago (registro y reintento igual que PB-011/012); 2) montos > USD 500 o con financiamiento activo quedan pendientes de aprobación de Finanzas; 3) un fallo en el reembolso queda registrado, auditable y se reintenta. |
| PB-028 | Como **Directora de Finanzas o auditor**, quiero recuperar la evidencia completa de cualquier transacción (quién, cuándo, qué cambió) en menos de 1 segundo, para sostener una auditoría fiscal sin retrasos. | Alta | 5 | Sprint 3 | 1) Toda operación relevante (pago, factura, conciliación, devolución) queda registrada en el Audit/Traceability Service; 2) la recuperación de evidencia de una transacción responde en menos de 1 segundo; 3) el registro nunca incluye PAN/CVV, solo token/referencia. |

**Bloque: Calidad, pruebas, documentación e infraestructura** — Integrante 5 (documentación, Docker, E2E) + equipo de Backend (unitarias) + equipo de Frontend (verificación RF/RNF) · R01–R06

| Código | Historia de usuario | Prioridad | SP | Sprint sugerido | Criterios de aceptación |
|---|---|---:|---:|---|---|
| PB-029 | Como **equipo**, queremos dockerizar los componentes backend con `docker-compose.yml` y persistencia incluida, para que el sistema se ejecute de forma reproducible. | Alta | 5 | Sprint 1 | 1) Existe `Dockerfile` por componente backend y un `docker-compose.yml` raíz; 2) la persistencia (base de datos, colas) queda incluida en la definición de Docker; 3) el proyecto documenta cómo levantar el entorno localmente. |
| PB-030 | Como **equipo de backend**, queremos implementar pruebas unitarias de los servicios críticos (Order, Payment, Inventory, Invoicing, Logistics) para reducir regresiones. | Alta | 8 | Sprint 2 | 1) Existen pruebas unitarias por cada servicio backend crítico; 2) cubren al menos el flujo principal y un flujo de excepción documentado en su CDU; 3) se ejecutan con un comando reproducible. |
| PB-031 | Como **equipo**, queremos implementar pruebas E2E de los flujos críticos (compra, pago, facturación, despacho, devolución) para validar el sistema de extremo a extremo. | Alta | 8 | Sprint 3 | 1) Existen escenarios E2E para los flujos de PB-001 a PB-004, PB-010 a PB-016, PB-020 a PB-023 y PB-026/027 como mínimo; 2) los escenarios cubren al menos un flujo alternativo/de excepción documentado; 3) se ejecutan con la herramienta acordada por el curso. |
| PB-032 | Como **equipo de frontend**, queremos verificar que cada pantalla cumple los requerimientos funcionales y no funcionales asignados (tiempos de respuesta, mensajes de error, disponibilidad de canal) antes de darla por terminada. | Alta | 5 | Sprint 3 | 1) Existe un checklist de verificación RF/RNF por pantalla; 2) toda pantalla crítica valida su RC asociado (ej. <5s en consulta de orden); 3) los hallazgos quedan documentados para su corrección antes de cerrar la tarjeta. |
| PB-033 | Como **equipo**, queremos redactar la documentación restante del proyecto (manuales, arquitectura de Fase 2, evidencias) para cumplir los entregables académicos. | Alta | 5 | Sprint 3 | 1) Existe documentación de arquitectura/decisiones de Fase 2 actualizada; 2) existen manuales de uso/despliegue; 3) la documentación queda versionada en el repositorio. |
| PB-034 | Como **equipo**, queremos mantener el tablero Kanban actualizado con las tarjetas de este backlog, para reflejar el progreso real de cada sprint. | Alta | 2 | Sprint 1 | 1) Cada historia de este backlog tiene su tarjeta en el tablero; 2) el tablero usa las columnas oficiales del enunciado (To Do, Blocked, In Progress, Ready for Testing, Test/QA, Done); 3) el estado se actualiza durante los eventos Scrum. |

---

# Sprint Planning y Sprint Backlog

## 2. Sprint Planning

**Objetivo de Sprint**

> _(pendiente — se define en la reunión de Sprint Planning correspondiente, a partir de las historias priorizadas de la sección 1)_

#### **Datos de la Reunión:**

- Fecha: _(pendiente)_
- Duración: _(pendiente)_
- Plataforma: _(pendiente)_
- Fin Sprint: _(pendiente)_

---

#### **Roles Presentes:**
- Scrum Master: _(pendiente)_
- Product Owner: _(pendiente)_
- Dev Team:
    - _(pendiente)_
    - _(pendiente)_
    - _(pendiente)_
    - _(pendiente)_

---

#### **Story Points Comprometidos:**
_(pendiente)_

#### **Decisiones técnicas**
- Framework Frontend: _(pendiente)_
- Framework Backend: _(pendiente)_
- Base de datos: _(pendiente — ver ADR-0001 de Fase 1)_
- Message Broker: _(pendiente — ver ADR-0001/ADR-0002 de Fase 1)_
- Pipeline de Automatización: _(pendiente)_
- Herramienta de tablero Kanban: _(pendiente)_

---

#### **Sprint Goal (Objetivo del Sprint)**
_(pendiente)_

---

## 3. Sprint Backlog

**Historias seleccionadas para el Sprint**

| Código | Historia | SP | Motivo de selección | Dependencias |
|---|---|---:|---|---|
| _(pendiente)_ | | | | |

---

## 4. Daily Scrum

> _(pendiente — una entrada por integrante y por día del sprint, formato: ¿Qué hice ayer? / ¿Qué haré hoy? / ¿Impedimentos?)_

---

## 5. Sprint Retrospective

> _(pendiente — cada integrante responde: 1) ¿Qué se hizo BIEN? 2) ¿Qué se hizo MAL? 3) ¿Qué MEJORAS se implementarán en el siguiente Sprint?)_

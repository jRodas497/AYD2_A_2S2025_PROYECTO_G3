# Drivers de Calidad — Escenarios de Atributos de Calidad (Eac)

> Cada escenario debe quedar reflejado en `Docs/Diagramas/despliegue.drawio`. El equipo debe revisar las medidas marcadas como "a definir" antes de la entrega.

---

### DC-01 — Disponibilidad / tolerancia a fallas de pagos

- **Source:** Pasarela de pago PayKlik (proveedor externo)
- **Stimulus:** PayKlik deja de responder o falla al procesar un cobro
- **Artifact:** Componente de Procesamiento de Pagos de SGO-Logic
- **Environment:** Operación normal, y especialmente picos de demanda (Black Friday, hasta 8x tráfico)
- **Response:** El sistema no pierde la orden; encola o reintenta el cobro, o aplica un mecanismo que no dependa exclusivamente de PayKlik; cada intento fallido queda auditable
- **Response Measure:** 0 órdenes perdidas por falla del proveedor de pago. Antecedente a superar: 45 minutos de caída = USD 150,000 en pérdidas (Black Friday anterior)

### DC-02 — Elasticidad / escalabilidad

- **Source:** Tráfico de clientes multicanal
- **Stimulus:** Demanda de Black Friday
- **Artifact:** SGO-Logic (componentes de orden, inventario, pagos)
- **Environment:** Pico de demanda estacional
- **Response:** El sistema escala para atender la carga sin degradar el servicio
- **Response Measure:** Soportar hasta 8x el tráfico de un día normal, manteniendo el resto de Eac (rendimiento, disponibilidad) dentro de su medida objetivo

### DC-03 — Rendimiento (consulta de estado)

- **Source:** Cliente o personal de atención
- **Stimulus:** Solicita el estado de una orden
- **Artifact:** Componente de Consulta de Órdenes
- **Environment:** Operación normal
- **Response:** El sistema retorna el estado consolidado (compra, pago, despacho, entrega)
- **Response Measure:** < 5 segundos

### DC-04 — Rendimiento (auditoría)

- **Source:** Directora de Finanzas / auditor SAT
- **Stimulus:** Solicita evidencia de una transacción específica
- **Artifact:** Componente de Auditoría/Trazabilidad
- **Environment:** Auditoría anual o revisión interna
- **Response:** El sistema recupera la evidencia completa de la transacción (quién, cuándo, qué cambió)
- **Response Measure:** < 1 segundo

### DC-05 — Confiabilidad de integración

- **Source:** POS de tienda / ERP-Core / componente de inventario
- **Stimulus:** Envío de un evento (venta, ajuste de inventario, resumen de ventas) entre SGO-Logic y un sistema legacy
- **Artifact:** Adaptadores de integración (POS, ERP, inventario)
- **Environment:** Operación normal, incluida degradación de red intermitente
- **Response:** El sistema reintenta el envío con manejo de errores hasta garantizar la entrega o escalar la falla
- **Response Measure:** 0 eventos de negocio perdidos silenciosamente; política de reintentos con backoff a definir en ADR

### DC-06 — Tolerancia a fallas de terceros con degradación conocida

- **Source:** LogiExpress / proveedor de notificaciones (SMS, correo, push)
- **Stimulus:** Timeout de LogiExpress (~2% de solicitudes) o indisponibilidad del proveedor de notificaciones
- **Artifact:** Adaptadores de LogiExpress y de Notificaciones
- **Environment:** Operación normal
- **Response:** El sistema continúa la operación principal (orden, pago, despacho) sin bloquearse por la falla del proveedor secundario
- **Response Measure:** La operación principal no se detiene; una falla del proveedor de notificaciones nunca impide confirmar, pagar o despachar una orden

### DC-07 — Auditabilidad / trazabilidad

- **Source:** Directora de Finanzas / auditoría SAT
- **Stimulus:** Necesidad de reconstruir quién ejecutó una operación, cuándo ocurrió y qué cambió
- **Artifact:** SGO-Logic completo (registro de auditoría transversal)
- **Environment:** Auditoría anual o investigación de incidente
- **Response:** El sistema expone un historial completo e inmutable de cada operación
- **Response Measure:** 100% de las operaciones con registro auditable; recuperación en < 1 segundo (ver DC-04)

### DC-08 — Seguridad / cumplimiento de datos de pago

- **Source:** Cliente al pagar
- **Stimulus:** Registro de un intento de cobro
- **Artifact:** Componente de Procesamiento de Pagos
- **Environment:** Operación normal
- **Response:** El sistema nunca almacena el número completo de tarjeta (PAN) ni el código CVV
- **Response Measure:** 0 instancias de PAN/CVV almacenados; verificable en auditoría de seguridad

### DC-09 — Mantenibilidad por equipo interno

- **Source:** Equipo interno de TI
- **Stimulus:** Necesidad de operar, dar soporte o extender SGO-Logic
- **Artifact:** SGO-Logic completo
- **Environment:** Operación normal, post-implementación
- **Response:** El equipo interno puede mantener el sistema con sus competencias actuales
- **Response Measure:** Stack dentro de Java/.NET/Docker, o alternativa con plan de capacitación documentado y su costo de adopción

### DC-10 — Evolutividad / portabilidad (on-premises → nube)

- **Source:** Gerencia / crecimiento regional
- **Stimulus:** Aumento sostenido de demanda u operación regional que supera la capacidad on-premises
- **Artifact:** SGO-Logic completo (arquitectura de despliegue)
- **Environment:** Evolución posterior a la Fase 1
- **Response:** La arquitectura permite migrar a nube de forma planificada sin rediseño completo
- **Response Measure:** Migración factible sin cambiar el modelo de componentes ni las interfaces externas (a validar con el ADR de estrategia de despliegue)

### DC-11 — Precisión operacional del despacho

- **Source:** Proceso de asignación de despacho
- **Stimulus:** Confirmación de una orden que requiere despacho
- **Artifact:** Componente de Logística/Despacho
- **Environment:** Operación normal
- **Response:** El sistema asigna correctamente ubicación de origen y destinatario, apoyado en inventario centralizado en tiempo real
- **Response Measure:** Reducir en 70% los envíos incorrectos (referencia: USD 25 de costo por logística inversa en cada error actual)

---

## Resumen (para lectura rápida)

| ID | Atributo | Medida objetivo |
|---|---|---|
| DC-01 | Disponibilidad / tolerancia a fallas de pagos | No perder la orden ante falla de PayKlik |
| DC-02 | Elasticidad / escalabilidad | 8x tráfico normal (Black Friday) |
| DC-03 | Rendimiento — consulta de estado | < 5 segundos |
| DC-04 | Rendimiento — auditoría | < 1 segundo |
| DC-05 | Confiabilidad de integración | 0 eventos perdidos silenciosamente |
| DC-06 | Tolerancia a fallas de terceros | Operación principal no se detiene |
| DC-07 | Auditabilidad / trazabilidad | 100% operaciones auditables |
| DC-08 | Seguridad / cumplimiento de pagos | 0 PAN/CVV almacenados |
| DC-09 | Mantenibilidad por equipo interno | Dentro de Java/.NET/Docker o plan de adopción |
| DC-10 | Evolutividad / portabilidad | Migración on-prem → nube sin rediseño completo |
| DC-11 | Precisión operacional del despacho | -70% envíos incorrectos |

> Al agregar un nuevo Eac, mantener el mismo formato (Source/Stimulus/Artifact/Environment/Response/Response Measure) y numeración consecutiva.

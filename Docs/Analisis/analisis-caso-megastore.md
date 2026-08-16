# Análisis del Caso — SGO-Logic (Fase 1)

**Curso:** Análisis y Diseño de Sistemas 2A
**Proyecto:** Sistema de Gestión de Órdenes y Logística Omnicanal (SGO-Logic) — MegaStore
**Fecha de análisis:** 2026-08-13
**Estado del cronograma:** Asignado 2026-08-06 · Entrega final 2026-08-26 · Calificación 2026-08-29 → **quedan 13 días hasta la entrega**

---

## Resumen del caso

MegaStore es una cadena de retail regional (Guatemala, El Salvador, Costa Rica), 32 tiendas físicas, 6,500 empleados, e-commerce = 25% de ventas (crece 15%/año), facturación anual $450M. La operación actual es un conjunto de bodegas (POS por tienda, e-commerce separado, conciliación manual con hojas de cálculo, confirmación de stock por teléfono). El objetivo estratégico es que una compra pueda **iniciar en un canal y terminar en otro** con experiencia consistente. La iniciativa que lo habilita es **SGO-Logic**.

**No se pide construir el sistema.** Se pide: delimitar el problema arquitectónico, descubrir y priorizar drivers, comparar alternativas, y documentar decisiones trazables en un DDA + ADRs + vistas + prototipo no funcional, defendido oralmente.

## Sistema de interés y contexto

SGO-Logic es la capa de orquestación omnicanal. **No reemplaza ni modifica** los sistemas legacy — se integra con ellos:

| Sistema/Actor externo | Naturaleza | Restricción dura | Dato cuantitativo relevante |
|---|---|---|---|
| ERP-Core | AS/400, años 90, contable-fiscal | No se reemplaza ni modifica (decisión de Junta) | Solo recibe CSV/XML, procesable cada 30 min → **integración batch, no tiempo real** |
| POS (x32 tiendas) | Instancia local por tienda | No hay programa de reemplazo | Debe *recibir* eventos desde SGO-Logic; requiere manejo de errores/reintentos |
| PayKlik (pasarela de pago) | Proveedor externo, contrato 3 años vigente | Debe respetarse el contrato | REST, latencia ~800ms (hasta 5s en picos); caída de 45 min en Black Friday pasado = **USD 150,000** en pérdidas |
| LogiExpress (logística) | Proveedor externo, contrato 2 años vigente | Debe respetarse el contrato | REST; **1 de cada 50 solicitudes (2%) termina en timeout** |
| SAT (facturación electrónica) | Regulador | Obligatorio antes de finalizar cada orden | XML con CUI y serie autorizada; tiempos de respuesta variables |
| Proveedor de notificaciones (SMS/correo/push) | Externo | Disponibilidad fuera de control de MegaStore | Una falla aquí **no debe** bloquear la operación principal |
| 2 Centros de Distribución | Internos | Sin visión centralizada de inventario hoy | — |

Esto ya sugiere un estilo con **integración asíncrona/event-driven** hacia POS y ERP, y **tolerancia a fallas** hacia PayKlik/LogiExpress/notificaciones (tres proveedores con degradación conocida y documentada en el caso).

## Stakeholders identificados

| Stakeholder | Tipo | Preocupación principal | Evidencia textual |
|---|---|---|---|
| Junta Directiva / Dirección | Explícito | Estrategia omnicanal, protege el ERP-Core y presupuesto | "no será reemplazada ni modificada" |
| Carlos Méndez — Gerente de TI | Explícito | Continuidad operativa, escalabilidad Black Friday, mantenibilidad interna, monitoreo | "Si el sistema explota... mi puesto está en riesgo" |
| Ana Lucía Fuentes — Directora de Finanzas | Explícito, **con poder de veto** | Trazabilidad, cumplimiento fiscal, auditoría SAT | Veto sobre decisiones que reduzcan trazabilidad |
| Roberto Quezada — Jefe de Logística | Explícito | Reducir errores de despacho 70%, visibilidad de inventario en tiempo real | Costo USD 25/envío erróneo |
| Directora de Comercialización | Explícito | Experiencia consistente entre canales, "no silos" | Cita textual |
| Jefe de Operaciones | Explícito | Impacto de indisponibilidad en ventas | Cifra del incidente Black Friday |
| Clientes finales | Implícito | Reconocimiento cross-canal, consulta de estado <5s, notificaciones | Sección 4.2 |
| Personal de tienda / atención | Implícito | Vista consolidada de compra/pago/despacho/entrega | Hoy tarda hasta 7 días hábiles |
| Equipo interno de TI (implementadores) | Implícito | Stack conocido (Java/.NET/Docker), soporte a largo plazo | "impacto de adopción, capacitación y operación" |
| SAT (auditor/regulador) | Implícito | Cumplimiento normativo anual | Auditorías anuales |
| PayKlik / LogiExpress | Implícito (terceros con contrato) | Cumplimiento de contrato vigente, SLA | — |

> El enunciado pide explícitamente **no asumir una clasificación dada de antemano** — esta tabla es un punto de partida, el equipo debe re-derivarla de la evidencia y podría encontrar stakeholders adicionales (ej. equipo legal/cumplimiento, encargados de centros de distribución).

## Drivers candidatos (borrador de trabajo)

### Funcionales (candidatos a Casos de Uso)
- Iniciar/continuar/completar compra cruzando canales (tienda, web, app, call center)
- Carrito de compras unificado multicanal
- Verificar disponibilidad antes de confirmar venta (evitar doble compromiso de una unidad)
- Liberar inventario reservado si la compra no concluye
- Procesar pago con múltiples métodos (tarjeta, transferencia, billetera digital)
- Registrar cada intento de cobro (orden, canal, fecha, resultado) — exitoso o fallido
- Emitir factura electrónica a SAT antes de finalizar la orden (con CUI/serie)
- Vincular venta original ↔ devoluciones ↔ reembolsos
- Sincronizar ventas con ERP-Core (batch CSV/XML, ventana de 30 min)
- Despachar desde CD, tienda o recogida por cliente; permitir cambio de método de entrega post-confirmación
- Consultar estado de orden desde cualquier canal/dispositivo
- Notificar al cliente (confirmación, preparación, tránsito, entrega, incidencias) sin bloquear la operación si el canal de notificación falla
- Recibir eventos de estado desde LogiExpress y desde POS (con reintentos)

### De calidad (candidatos a Escenarios de Atributos de Calidad — Eac)
| Atributo | Escenario (resumen) | Medida objetivo |
|---|---|---|
| Disponibilidad / Tolerancia a fallas | Falla de PayKlik durante pico de demanda | No perder la orden; poder operar sin depender 100% del proveedor externo |
| Elasticidad / Escalabilidad | Demanda Black Friday | Soportar hasta **8x** el tráfico de un día normal |
| Rendimiento | Cliente/agente consulta estado de una orden | Respuesta **< 5 segundos** |
| Rendimiento (auditoría) | Recuperar evidencia de una transacción para auditoría SAT | **< 1 segundo** |
| Confiabilidad de integración | Envío de eventos a POS | Manejo de errores y reintentos garantizado |
| Tolerancia a fallas de terceros | LogiExpress con 2% de timeouts, PayKlik hasta 5s de latencia | Degradación controlada, no fallo en cascada |
| Auditabilidad / Trazabilidad | Auditoría anual SAT | Reconstruir quién, cuándo, qué cambió, por operación |
| Seguridad / Cumplimiento | Almacenamiento de datos de pago | Nunca guardar PAN completo ni CVV |
| Mantenibilidad | Operación por equipo interno | Stack dentro de competencias existentes (Java/.NET/Docker) o plan de adopción documentado |
| Eficiencia energética | Infraestructura on-prem | Minimizar consumo |
| Evolutividad / Portabilidad | Crecimiento regional futuro | Migración planificada on-prem → nube sin rediseño completo |

### De restricción
- **Presupuesto:** inversión total aprobada $150,000; costo operativo post-lanzamiento ≤ $1,200/mes sin aprobación adicional
- **Tiempo:** Black Friday en noviembre es fecha fija; ruta viable para pagos/facturación debe existir desde el **primer mes**
- **Tecnología:** no modificar ERP-Core ni POS; equipo domina Java/.NET y Docker básico
- **Contractual:** PayKlik (3 años) y LogiExpress (2 años) vigentes — no se reemplazan proveedores
- **Regulatorio:** normativa de protección de datos + facturación electrónica SAT
- **Despliegue:** inicio obligatorio on-premises; la nube es evolución planificada, no decisión inicial

## Riesgos técnicos y de negocio detectados en el caso
1. Punto único de falla en pagos (ya materializado: 45 min de caída = $150K en Black Friday pasado).
2. Doble venta de inventario por falta de reserva centralizada en tiempo real.
3. Cuello de botella de integración: ERP solo acepta batch cada 30 min → riesgo de desalineación contable si el diseño asume tiempo real.
4. Dependencia de tres proveedores externos con degradación conocida y documentada (PayKlik, LogiExpress, notificaciones).
5. Falta de trazabilidad end-to-end → expone a MegaStore a hallazgos de auditoría SAT y multas.
6. Escalar 8x sin arquitectura elástica (limitado además por presupuesto operativo de $1,200/mes y despliegue on-prem).
7. Brecha de competencias si se elige una tecnología fuera de Java/.NET/Docker sin plan de capacitación.

## Vacíos / supuestos que el equipo debe resolver explícitamente
El enunciado deja huecos a propósito — se espera que el equipo los declare como **supuestos documentados** (no que los ignore):
- No se especifica el volumen exacto de transacciones/día ni el tamaño de catálogo — necesario para dimensionar.
- No se especifica el modelo de datos de inventario actual por tienda (formato, tecnología).
- No se especifica SLA exacto de la SAT ni de protección de datos aplicable (¿es Guatemala solamente, o también El Salvador/Costa Rica con normativas distintas?).
- No se especifica si existe ya un equipo de operación 24/7 o solo horario laboral.
- "Procesar pagos sin depender del proveedor externo" es ambiguo: ¿implica un segundo proveedor de pago (multi-PSP) o una cola de reintentos con confirmación diferida? — **decisión arquitectónica central a justificar con ADR**.

## Mapeo entregables ↔ artefactos del proceso

| Entregable (enunciado) | Insumo directo de este análisis |
|---|---|
| CUN + descomposición | Sección 2 (contexto) + drivers funcionales §4.1 |
| Stakeholders y preocupaciones | Sección 3 |
| Características priorizadas | Sección 4 (falta priorizar por valor/riesgo/urgencia/impacto — pendiente en equipo) |
| CDU + descripción textual | Expansión de §4.1 |
| Eac (drivers de calidad) → reflejados en diagrama de despliegue | Sección 4.2 |
| Drivers de restricción | Sección 4.3 |
| Matrices de trazabilidad | Vincular §3 ↔ §4 ↔ decisiones (ADR) ↔ vistas |
| Diagramas (contexto, componentes, despliegue, bloques) | Sección 2 + 4.2 |
| ADRs | Decisión sobre pagos (§6), integración batch ERP, patrón de resiliencia hacia terceros, estrategia on-prem→cloud |
| Prototipo (mockups, flujo principal) | Flujo: iniciar compra multicanal → pago → confirmación → despacho → notificación |

---

**Siguiente paso:** con este análisis como base, definir la estructura de trabajo del equipo (plantillas, responsabilidades y cronograma de 13 días para las 5 personas).

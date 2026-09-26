# DDA
# Caso de Accion

## Contexto Operativo

- MegaStore opera en tres países (Guatemala, El Salvador y Costa Rica).
- Cuenta con 32 tiendas físicas y un canal de comercio electrónico en crecimiento.
- Su facturación anual es de $450 millones.

## Gestión de Información Actual

- Los sistemas de ventas presenciales, inventario, logística y contabilidad funcionan de manera independiente.
- La integración entre aplicaciones es limitada y ocurre con diferentes ritmos y niveles de automatización.
- Se utilizan procesos manuales como llamadas telefónicas, hojas de cálculo y conciliaciones posteriores para completar una venta.

## Ineficiencias Detectadas

- Desconexión de canales: la información no fluye de manera uniforme entre sistemas.
- Procesos manuales: generan retrasos y errores en la operación.
- Experiencia del cliente afectada: compras poco ágiles y falta de consistencia entre canales.
- Impacto en ingresos: la falta de continuidad puede frenar ventas y generar pérdidas.
- Limitaciones en la toma de decisiones: la gerencia no cuenta con datos oportunos ni confiables para reaccionar rápidamente.

## Riesgos Asociados

- Pérdida de competitividad frente a retailers con operaciones omnicanal más maduras.
- Mayor costo operativo por duplicidad de procesos.
- Riesgo de insatisfacción y pérdida de clientes por experiencias fragmentadas.
- Dificultad para escalar el negocio en un entorno digital en expansión.

# Propuesta de Arquitectura de Software

## Principios de Diseño

- Omnicanalidad: integración fluida entre tiendas físicas, inventario, logística y contabilidad.
- Escalabilidad: preparada para crecimiento regional y aumento de transacciones.
- Mantenibilidad: modularidad y separación de responsabilidades.
- Seguridad: protección de datos de clientes y transacciones.
- Eficiencia: reducción de procesos manuales y optimización de flujos.

## Estructura General del Sistema

La arquitectura combina tres estilos complementarios — **monolítico** (despliegue), **Event-Driven vía broker de mensajería** (integración asíncrona) y **orientado a datos** (integración síncrona) — según lo decidido y justificado en ADR-0001:

- Capa de Presentación “Front-End”
  - Aplicaciones web y móviles para clientes.
  - Interfaces para empleados en tienda.
  - Experiencia unificada en todos los canales, mediada por un único API Gateway / BFF Omnicanal.

- Backbone de componentes (despliegue monolítico por contenedores Docker independientes — ADR-0001, ADR-0005)
  - Order Service (orquestación de compra omnicanal).
  - Inventory Service (inventario centralizado).
  - Payment Service (pagos, con Outbox + Circuit Breaker — ADR-0002).
  - Invoicing Service (facturación electrónica SAT).
  - Logistics Service (despacho y entrega, integración LogiExpress).
  - Notification Service (notificaciones best-effort).
  - ERP Sync Adapter / POS Adapter (integración batch/eventos con sistemas legacy — ADR-0003).
  - Audit / Traceability Service (auditoría y trazabilidad).
  - Sin orquestador de microservicios (Kubernetes) desde el inicio: el equipo no tiene esa competencia hoy y el costo/tiempo lo hace inviable antes de Black Friday — evolución planificada a servicios independientes en una fase futura (ADR-0005).

- Capa de Datos (orientada a datos — ADR-0001)
  - Base de datos relacional compartida, con esquemas separados por componente, para operaciones que exigen consistencia inmediata (inventario, consulta de estado).
  - Integración con sistemas heredados (ERP-Core, POS) mediante adaptadores batch/eventos, sin modificarlos (DR-04, DR-05).

- Capa de Integración (Event-Driven — ADR-0001)
  - Message Broker de mensajería open-source (ej. RabbitMQ) para las operaciones que requieren desacoplamiento y tolerancia a fallas: pagos, logística, notificaciones, sincronización con ERP.
  - Circuit breaker + reintentos para aislar fallas de PayKlik, LogiExpress y notificaciones sin bloquear el flujo principal (ADR-0002, ADR-0004).

- Capa de Seguridad y Cumplimiento
  - No se almacenan PAN/CVV de tarjetas (DC-08); solo el token/referencia que devuelve PayKlik.
  - Auditoría y trazabilidad de toda operación (Audit/Traceability Service).
  - Normativa de protección de datos y facturación electrónica SAT (DR-08).

> **Cómo quedó en el MVP de la Fase 2.** Esta estructura es la arquitectura objetivo. Al
> implementarla se tomaron tres decisiones que la ajustan, cada una con su ADR:
> - El Message Broker es la tabla `integration.outbox` con su repartidor, no un RabbitMQ aparte
>   ([ADR-0007](ADR/0007-outbox-en-la-base-como-broker-del-mvp.md)).
> - Los componentes comparten un contenedor de aplicación, para que el checkout sea atómico; el
>   API Gateway / BFF y Pricing & Promotions no están en el MVP
>   ([ADR-0009](ADR/0009-alcance-de-despliegue-del-mvp.md)).
> - PayKlik, la SAT, LogiExpress, la mensajería, el POS y el AS/400 se simulan detrás de un
>   adaptador ([ADR-0008](ADR/0008-terceros-simulados-tras-un-adaptador.md)).
>
> Las vistas que coinciden con el código están en [diagrama-de-componentes.md](diagrama-de-componentes.md)
> y en la sección "Despliegue implementado" de [diagrama-de-despliegue.md](diagrama-de-despliegue.md).

## Funciones Críticas Soportadas

- Gestión de inventario en tiempo real.
- Procesamiento de ventas omnicanal (tienda física + producto (LineaBlanca, Electronica, Ropa,Calzado).
- Logística integrada (órdenes, envíos, devoluciones).
- Contabilidad automatizada (conciliación batch cada 30 min con ERP-Core, sin modificarlo).
- Auditoría y trazabilidad de negocio (reportes para gerencia y SAT).

## Calidad del Diseño

- Mantenible: componentes desacoplados vía broker de mensajería, dentro del stack conocido del equipo (Java/.NET/Docker), documentado con ADR.
- Seguro: no persistencia de datos sensibles de pago, auditoría completa, cumplimiento SAT.
- Eficiente: reducción de duplicidad de procesos y automatización de flujos, con costo de infraestructura ajustado al presupuesto ($150K inversión / $1,200 mensual).
- Trazable: decisiones documentadas en DDA y ADR, alineadas con drivers arquitectónicos.

# Justificación de Decisiones ante la Alta Gerencia

## Perspectiva de Negocio

- La arquitectura propuesta responde directamente a la estrategia omnicanal de MegaStore, integrando ventas físicas y digitales en un flujo único.
- Se busca mejorar la experiencia del cliente, eliminando procesos manuales y garantizando continuidad en las transacciones.
- La solución permite a la gerencia contar con información confiable y en tiempo real, fortaleciendo la toma de decisiones estratégicas.

## Selección de Tecnologías y Metodologías

- Monolito modular en contenedores Docker + API Gateway/BFF: balance entre lo que el equipo puede operar hoy (sin Kubernetes) y fronteras de componente claras para evolucionar a servicios independientes (ADR-0001, ADR-0005).
- Broker de mensajería open-source (ej. RabbitMQ) + Circuit Breaker: habilita desacoplamiento y tolerancia a fallas de PayKlik, LogiExpress y notificaciones sin bloquear la operación principal (ADR-0001, ADR-0002, ADR-0004).
- Base de datos relacional compartida (esquemas por componente): sostiene consistencia inmediata en inventario y consulta de estado, con costo compatible con el presupuesto operativo (ADR-0001).
- Adaptadores batch/eventos con ERP-Core y POS: respetan la restricción de no modificar los sistemas legacy (ADR-0003, DR-04, DR-05).
- Documentación con DDA y ADR: asegura trazabilidad y transparencia en las decisiones técnicas.

## Beneficios Tangibles

- Reducción de costos operativos: menos duplicidad de procesos y conciliaciones manuales.
- Incremento en ingresos: mayor fluidez en ventas y satisfacción del cliente.
- Costo de infraestructura ajustado al presupuesto real ($150K inversión / $1,200 mensual), sin exigir competencias que el equipo no tiene hoy.
- Resiliencia tecnológica: componentes ya desacoplados vía broker de mensajería, lo que facilita una evolución futura a servicios independientes sin rediseño (ADR-0005).

## Riesgos Mitigados

- Se disminuye la dependencia de sistemas aislados.
- Se reduce el riesgo de pérdida de clientes por experiencias fragmentadas.
- Se asegura continuidad operativa frente a cambios en volumen de transacciones.

## Diagrama de despliegue — Fase 2

La [vista de despliegue](diagrama-de-despliegue.md) ubica los componentes de fase 2 en hosts locales con Docker, base de datos compartida y mensajería persistente, conservando las integraciones externas.

[Draw.io editable](../DRAWIO/Diagrama-Despliegue-SGO-Logic-Fase2.drawio) · [Imagen](../image/Diagrama-Despliegue-SGO-Logic-Fase2.png).

# **Drivers Arquitectónicos**

## **Drivers Arquitectónicos: Requerimientos Funcionales**

| ID | Driver funcional | Descripción | Impacto arquitectónico |
|---|---|---|---|
| RF 01 | Carrito omnicanal | Mantener el estado de compra entre aplicación móvil, sitio web y centro de atención telefónica. | Requiere un componente de carrito centralizado y acceso compartido entre canales. |
| RF 02 | Consulta de órdenes | Consultar el estado completo de la orden, despacho y entrega. | Requiere servicios de consulta centralizados y disponibilidad de información en tiempo real. |
| RF 03 | Gestión de inventario | Consolidar existencias de 2 centros de distribución y 32 tiendas. | Requiere una vista/repositorio centralizado de inventario. |
| RF 04 | Reserva temporal de inventario | Reservar automáticamente unidades durante el checkout y liberarlas si la compra no se concreta. | Requiere manejo de concurrencia, transacciones y temporizadores. |
| RF 05 | Procesamiento de pagos | Procesar pagos mediante PayKlik utilizando REST. | Requiere integración con un servicio externo y manejo de errores. |
| RF 06 | Auditoría de pagos | Registrar cada intento de cobro con orden, canal, fecha y resultado. | Requiere un mecanismo de auditoría persistente y seguro. |
| RF 07 | Facturación electrónica | Generar XML con CUI y serie autorizada y enviarlo a SAT. | Requiere integración con SAT y procesamiento asíncrono. |
| RF 08 | Sincronización con AS/400 | Generar y transmitir archivos CSV/XML cada 30 minutos. | Requiere un proceso de integración programado. |
| RF 09 | Sincronización con POS | Enviar eventos de actualización a los POS de las 32 tiendas. | Requiere comunicación basada en eventos y reintentos. |
| RF 10 | Despacho logístico | Determinar la ubicación óptima para despachar cada pedido y comunicarse con LogiExpress. | Requiere integración con servicios externos y lógica de asignación. |
| RF 11 | Notificaciones | Enviar SMS, correo y push sin afectar la confirmación de la orden. | Requiere procesamiento desacoplado/asíncrono. |

---

## **Drivers Arquitectónicos: De Calidad**

| ID | Atributo de calidad | Driver arquitectónico | Escenario / métrica |
|---|---|---|---|
| RC 01 | Rendimiento | Las consultas de órdenes deben responder rápidamente. | Estado de orden, despacho y entrega en menos de 5 segundos. |
| RC 02 | Rendimiento | Las consultas de auditoría financiera deben ser rápidas. | Consultas de intentos de cobro en menos de 1 segundo. |
| RC 03 | Escalabilidad | El sistema debe soportar un gran volumen de órdenes simultáneas. | El flujo de demostración contempla gran volumen de órdenes simultáneas. |
| RC 04 | Disponibilidad | Las fallas de servicios externos no deben detener el proceso de venta. | PayKlik, SAT, mensajería y LogiExpress deben manejar fallos. |
| RC 05 | Disponibilidad | Las operaciones críticas deben poder continuar ante fallos temporales. | Uso de colas, reintentos y procesamiento asíncrono. |
| RC 06 | Seguridad | No almacenar información sensible de tarjetas. | No almacenar números completos de tarjeta ni CVV. |
| RC 07 | Seguridad | Registrar las operaciones de pago para auditoría. | Cada intento debe registrar orden, canal, fecha, resultado y referencia. |
| RC 08 | Consistencia | Evitar la sobreventa de productos. | Reserva temporal de inventario durante checkout. |
| RC 09 | Tolerancia a fallos | El sistema debe recuperarse de fallos de red o proveedores externos. | Reintentos para PayKlik, POS, LogiExpress y notificaciones. |
| RC 10 | Portabilidad | El sistema debe poder ejecutarse independientemente de la infraestructura física. | Uso de tecnologías de contenedorización. |

---

## **Drivers Arquitectónicos: De Restricción**

| ID | Restricción | Descripción | Impacto |
|---|---|---|---|
| R 01 | Arquitectura de Fase 1 | El código debe reflejar exactamente las decisiones arquitectónicas tomadas en la Fase 1. | No se puede cambiar libremente el estilo arquitectónico seleccionado. |
| R 02 | Microservicios/Capas | Si en Fase 1 se escogieron Microservicios, deben permanecer desacoplados; si se escogieron Capas, debe existir separación clara de responsabilidades. | Condiciona la estructura del código y componentes. |
| R 03 | Docker | El sistema debe poder ejecutarse mediante Docker. | Se debe entregar `docker-compose.yml`. |
| R 04 | Persistencia | Docker debe incluir la persistencia necesaria. | La solución debe contemplar almacenamiento persistente. |
| R 05 | Control de versiones | Uso obligatorio de GitHub/GitLab. | Todo el código y configuración deben estar centralizados en repositorio. |
| R 06 | Git Flow | Se debe utilizar estrategia git-flow. | Deben existir ramas `main`, `release`, `develop`, `feature`, `hotfix`, etc. |
| R 07 | Sistemas legados | No se deben modificar AS/400 ni POS local. | La integración debe hacerse mediante mecanismos externos. |
| R 08 | Presupuesto inicial | El MVP debe respetar un presupuesto de $150,000. | Limita tecnologías, infraestructura y servicios que pueden utilizarse. |
| R 09 | Infraestructura | Presupuesto máximo de $1,200/mes para infraestructura. | Influye en selección de infraestructura y arquitectura. |
| R 10 | Fecha de operación | El MVP debe habilitar la operación omnicanal antes de Black Friday. | Condiciona alcance y prioridad de implementación. |
| R 11 | Auditoría fiscal | Las transacciones deben poder auditarse. | Obliga a mantener registros de las operaciones. |  
---
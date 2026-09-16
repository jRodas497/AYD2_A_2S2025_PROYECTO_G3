# Diagrama de despliegue — SGO-Logic (Fase 2)

![Diagrama de despliegue](../image/Diagrama-Despliegue-SGO-Logic-Fase2.png)

[Archivo editable](../DRAWIO/Diagrama-Despliegue-SGO-Logic-Fase2.drawio).

La vista propone la ubicación de los 14 componentes de fase 2 en infraestructura local, con contenedores Docker independientes, una base relacional compartida y un broker. Los nombres de los artefactos corresponden a los componentes que implementan; no designan imágenes Docker ya construidas.

## Distribución

| Host | Artefactos desplegados |
|---|---|
| Entrada | API Gateway / BFF Omnicanal |
| Aplicaciones | Catalog / Product Service; Pricing & Promotions Service; Order / Checkout Service; Customer Service; Inventory Service; Identity / Configuration Service; Audit / Traceability & Reporting Service |
| Integraciones | Payment Service; Invoicing Service; Logistics Service; Notification Service; ERP Sync Adapter; POS Adapter |
| Datos | Base de datos relacional compartida, con esquemas por componente y volumen persistente |
| Mensajería | Message Broker, con almacenamiento persistente de mensajes |

Esta distribución en cinco hosts es una propuesta de asignación sobre la infraestructura existente, no un inventario ni un dimensionamiento comprobado. Se propone Docker Compose por host; las comunicaciones entre hosts utilizan la red local y direcciones configuradas explícitamente. Una red de Compose no se considera compartida automáticamente entre máquinas. El broker y el motor relacional permanecen sin producto ni versión definitiva, como en el diagrama de componentes.

Los equipos de cliente, tienda, atención y administración alojan los cinco canales de acceso. El AS/400 permanece dentro de la infraestructura local y fuera del software SGO-Logic; los POS permanecen en las 32 tiendas. PayKlik, SAT, LogiExpress y el proveedor de notificaciones se representan como nodos externos.

## Relaciones y notación

Los cubos representan nodos de despliegue. Dentro de cada host, los entornos de ejecución Docker contienen los artefactos de software. Las conexiones entre contenedores detallan las comunicaciones que deben habilitarse en el host o en la red local. Los volúmenes son notación complementaria para almacenamiento persistente.

Se conservan las 38 relaciones del diagrama de componentes. El enlace agregado de canales se desglosa en cinco conexiones y se añaden dos montajes de volumen: **44 conexiones en total**. La relación broker → auditoría, cuyos extremos estaban libres en el archivo de referencia, queda vinculada a ambos contenedores en esta vista.

- Líneas continuas con flecha: llamadas API; los cinco canales acceden mediante HTTPS al API Gateway/BFF.
- Líneas discontinuas: mensajería e integraciones externas. Se conserva el intercambio bidireccional del broker con pagos, facturación y logística.
- Líneas punteadas: acceso a los esquemas de la base compartida, incluido el acceso de pagos para su outbox.
- Líneas sin flecha: montaje de almacenamiento persistente. Los arcos en cruces de líneas no representan una unión.

Las integraciones mantienen REST para PayKlik y LogiExpress, XML para SAT, CSV/XML cada 30 minutos para AS/400 y eventos para POS. SMS, correo y push identifican los canales del proveedor de notificaciones, no un protocolo de transporte específico.

## Correspondencia entre las fuentes

El [JPG de bloques](../image/Diagrama-bloques-SGO-Logic-Fase2.jpg) presenta diferencias con el [diagrama de componentes](../DRAWIO/Diagrama-Componentes-SGO-Logic-Fase2.drawio), el [caso de acción](casoDeAccion.md) y los [drivers de fase 2](driversArquitectonicos.md). Para el despliegue inicial se aplican el enunciado y las decisiones documentadas:

| Elemento del JPG | Representación adoptada |
|---|---|
| Nube y Kubernetes | Infraestructura local con Docker Compose, según ADR-0005. La migración a nube es una evolución posterior. |
| Arquitectura de microservicios | Componentes en contenedores independientes dentro del backbone documentado en ADR-0001. |
| Varias bases de datos | Una base relacional compartida con esquemas separados. |
| Servicio de incidencias | Responsabilidad de Order / Checkout Service, conforme al diagrama de componentes. |
| Servicio de integración de legados | ERP Sync Adapter y POS Adapter separados. |
| Balanceador y herramientas de monitoreo | El acceso conserva el API Gateway/BFF; no se añaden productos, réplicas ni una plataforma de monitoreo que aún no estén definidos en los componentes. |

El JPG tampoco muestra explícitamente todos los componentes de catálogo, precios, clientes, configuración y auditoría; se mantienen los cinco en el despliegue. La nota del JPG sobre alta disponibilidad no constituye evidencia de un clúster desplegado.

## Objetivos de calidad

El diagrama muestra los objetivos de carga de 8×, consulta de órdenes en menos de 5 segundos y auditoría en menos de 1 segundo. La separación de contenedores, el broker persistente, Outbox, Circuit Breaker y reintentos dan soporte al diseño de resiliencia. La persistencia de mensajes también requiere configurar colas durables y confirmaciones; un volumen por sí solo no garantiza la entrega.

Estas son metas de diseño, pendientes de dimensionamiento y pruebas de carga y recuperación. Los cinco hosts no implican réplicas ni failover: la disponibilidad de la infraestructura local y los respaldos necesitan concretarse al implementar. Se mantiene el presupuesto documentado como restricción, sin afirmar un costo operativo calculado.

## Referencias

- [Enunciado, apartados 4.2 y 4.4](<../../FASE 1/Docs/Enunciado/Proyecto Fase 1.pdf>).
- [ADR-0001: componentes, broker y base compartida](<../../FASE 1/Docs/ADR/0001-estilo-arquitectonico-monolito-modular-con-broker.md>).
- [ADR-0002: resiliencia de pagos](<../../FASE 1/Docs/ADR/0002-resiliencia-pagos-payklik.md>).
- [ADR-0003: integración con ERP-Core](<../../FASE 1/Docs/ADR/0003-integracion-batch-erp-core.md>).
- [ADR-0004: tolerancia a fallas de terceros](<../../FASE 1/Docs/ADR/0004-tolerancia-fallas-terceros.md>).
- [ADR-0005: despliegue local y evolución a nube](<../../FASE 1/Docs/ADR/0005-despliegue-on-premises-evolucion-nube.md>).
- [Vista de despliegue de fase 1](<../../FASE 1/Docs/Diagramas/despliegue.drawio>).

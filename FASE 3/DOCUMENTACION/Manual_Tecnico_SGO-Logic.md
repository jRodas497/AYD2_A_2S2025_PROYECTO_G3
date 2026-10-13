# Manual técnico de SGO-Logic

## Plataforma de comercio electrónico omnicanal basada en microservicios

**Versión:** 1.0\
**Fecha:** 13 de octubre de 2026\
**Tipo de documento:** Manual técnico de arquitectura, despliegue y
operación

------------------------------------------------------------------------

## Control y alcance del documento

  -----------------------------------------------------------------------
  Campo                               Descripción
  ----------------------------------- -----------------------------------
  Sistema                             SGO-Logic

  Propósito                           Coordinar las operaciones de
                                      comercio electrónico y tiendas
                                      físicas

  Estilo principal                    Arquitectura de microservicios

  Patrones complementarios            API Gateway, arquitectura orientada
                                      a eventos, contenedores y nube

  Tecnologías de referencia           Node.js, Express, React, Docker,
                                      Kubernetes, Kafka o RabbitMQ

  Integraciones                       PayKlik, SAT, LogiExpress, AS/400 y
                                      POS
  -----------------------------------------------------------------------

> Este manual documenta la arquitectura representada en el diagrama de
> despliegue. Kafka/RabbitMQ, proveedores de nube, motores de base de
> datos y herramientas de CI/CD son opciones de referencia; las
> elecciones definitivas, versiones, direcciones, credenciales y
> recursos deben registrarse en la configuración real del proyecto.

## 1. Introducción

SGO-Logic es una plataforma omnicanal que integra canales digitales y
físicos, servicios especializados de negocio, mensajería asíncrona,
bases de datos por dominio e integraciones externas. La arquitectura
separa responsabilidades para facilitar la evolución independiente de
los servicios, el escalamiento, la disponibilidad y la trazabilidad de
las operaciones.

Este documento describe los componentes, las comunicaciones, el
despliegue, las medidas de seguridad, la observabilidad y los criterios
de validación técnica.

## 2. Objetivos

### 2.1 Objetivo general

Establecer una referencia técnica para implementar, desplegar, operar,
probar y mantener SGO-Logic de manera consistente con la arquitectura
propuesta.

### 2.2 Objetivos específicos

-   Documentar las capas de acceso, entrada, microservicios, mensajería,
    datos e infraestructura.
-   Describir las responsabilidades de los servicios y sus límites.
-   Definir lineamientos para integraciones externas y sistemas
    heredados.
-   Establecer prácticas de seguridad, disponibilidad, monitoreo y
    recuperación.
-   Proponer una lista de verificación para la entrega técnica.

## 3. Alcance funcional

El sistema comprende la gestión de órdenes y carrito, inventario y
reservas, pagos, facturación electrónica, despacho logístico,
seguimiento de entregas, integración con sistemas heredados y POS,
notificaciones, incidencias, usuarios, roles, configuración y auditoría.

La integración con AS/400 y los POS se realiza desde componentes de
integración externos. No se contempla modificar internamente esos
sistemas heredados.

## 4. Estilos y patrones arquitectónicos

### 4.1 Microservicios

La lógica se divide en servicios orientados a dominios de negocio. Cada
servicio debe tener una responsabilidad definida, contratos explícitos y
pruebas propias. La independencia de despliegue depende de que los
servicios no compartan indebidamente sus estructuras internas ni accedan
directamente a las tablas privadas de otros dominios.

### 4.2 API Gateway

El API Gateway constituye el punto de entrada lógico a las APIs. Sus
responsabilidades incluyen:

-   Enrutar solicitudes a los servicios correspondientes.
-   Aplicar políticas comunes de autenticación, autorización y límites
    de solicitudes.
-   Centralizar aspectos transversales de las APIs.
-   Facilitar el registro y la correlación de peticiones.

El frontend debe consumir el API Gateway, no conectarse directamente con
cada microservicio.

### 4.3 Arquitectura orientada a eventos

Kafka o RabbitMQ se consideran alternativas para el bus de mensajes. Los
productores publican eventos y los consumidores ejecutan tareas sin
exigir que todos los pasos se completen dentro de la misma petición
HTTP.

Ejemplos de eventos que el equipo puede formalizar: `OrderCreated`,
`PaymentApproved`, `PaymentRejected`, `InvoiceRequested`,
`ShipmentCreated`, `DeliveryStatusUpdated` e `InventoryUpdated`. Estos
nombres son ilustrativos; deben aprobarse como contratos reales antes de
implementarse.

La mensajería debe contemplar confirmaciones, reintentos limitados,
idempotencia, seguimiento de mensajes fallidos y versiones de los
esquemas.

### 4.4 Contenedores y orquestación

Docker empaqueta las aplicaciones y sus dependencias. Kubernetes se
propone para orquestar contenedores, administrar réplicas, ejecutar
verificaciones de salud y controlar despliegues. Docker Compose puede
utilizarse para entornos locales o de desarrollo.

### 4.5 Integración con sistemas heredados

El servicio de Integración Legacy encapsula las particularidades de
AS/400 y los POS. Debe validar formatos, controlar lotes, registrar
errores y facilitar la recuperación sin propagar detalles del sistema
legado al resto de los servicios.

## 5. Vista general de la arquitectura

![1](../DOCUMENTACION/image/Arquitectura%20Omnicanal%20SGO-Logic.png)  


El esquema es conceptual. Las rutas, protocolos, réplicas, reglas de red
y topología física deben quedar reflejados en los manifiestos y la
configuración del entorno.

## 6. Capas y componentes

### 6.1 Canales de acceso

  Componente         Responsabilidad
  ------------------ ---------------------------------------------------------
  Cliente web        Acceso a la plataforma desde navegador
  Aplicación móvil   Operaciones desde iOS o Android
  Tiendas físicas    Canal presencial de venta
  POS                Registro e intercambio de operaciones de punto de venta

### 6.2 Capa de entrada

  Componente       Responsabilidad
  ---------------- ------------------------------------------------------
  Internet         Conectividad entre clientes y plataforma
  CDN (opcional)   Distribución de recursos estáticos
  Load Balancer    Distribución de tráfico entre instancias disponibles
  API Gateway      Enrutamiento y políticas comunes de API

El balanceador y el Gateway no reemplazan las validaciones de negocio
que corresponden a cada servicio.

### 6.3 Capa de microservicios

#### Servicio de Órdenes y Carrito

Administra carritos, creación y consulta de órdenes, validación inicial
y estado del proceso de compra. Coordina con Inventario, Pagos,
Facturación y Logística mediante contratos de API y eventos.

#### Servicio de Inventario

Gestiona existencias y disponibilidad por ubicación. Debe implementar
reservas temporales y actualizaciones consistentes para reducir el
riesgo de sobreventa.

#### Servicio de Pagos

Coordina las solicitudes de pago con PayKlik y registra el resultado y
la referencia de la transacción. No debe almacenar el número completo de
tarjeta ni el CVV.

#### Servicio de Facturación

Gestiona la preparación y seguimiento de facturas y la comunicación con
SAT. Debe registrar los estados, respuestas y rechazos de la
integración.

#### Servicio de Despacho Logístico

Coordina la preparación de despachos, asignaciones y comunicación con
LogiExpress. Mantiene la información necesaria para consultar el estado
de entrega.

#### Servicio de Integración Legacy

Gestiona el intercambio de información con AS/400 y POS, incluyendo
validación de archivos o mensajes, sincronización, errores y resultados
de los lotes.

#### Servicio de Notificaciones

Envía notificaciones por los canales configurados, como correo, SMS o
push. Los fallos de un proveedor no deberían bloquear innecesariamente
la confirmación de una orden.

#### Servicio de Gestión de Incidencias

Registra y da seguimiento a problemas operativos relacionados con
órdenes, pagos, inventario, logística o integraciones. Conserva estado,
responsable, resolución y trazabilidad.

### 6.4 Bus de mensajes / cola de eventos

El bus permite desacoplar tareas que no requieren una respuesta
inmediata. Se recomienda:

-   Definir esquemas y versiones de los eventos.
-   Incluir identificadores de correlación y referencias de negocio.
-   Implementar consumidores idempotentes.
-   Configurar reintentos con espera progresiva.
-   Supervisar la antigüedad y longitud de las colas.
-   Establecer un mecanismo para mensajes que agoten los reintentos.
-   Evitar publicar secretos o información sensible innecesaria.

### 6.5 Capa de datos

  Base de datos      Contenido principal
  ------------------ -----------------------------------------------
  BD Órdenes         Órdenes y transacciones del proceso de compra
  BD Inventario      Existencias, almacenes y reservas
  BD Pagos           Referencias y resultados de pagos
  BD Facturación     Facturas y estados de facturación
  BD Logística       Despachos y seguimiento
  BD Usuarios        Clientes, usuarios y agentes
  BD Auditoría       Registros de trazabilidad
  BD Configuración   Parámetros y roles

La separación del diagrama es lógica; no implica un motor específico.
Cada servicio debe ser propietario de los datos de su dominio. El acceso
a datos de otro dominio debe realizarse mediante APIs o eventos
acordados, no mediante acceso directo a sus tablas privadas.

## 7. Integraciones externas

  -----------------------------------------------------------------------
  Sistema                 Propósito               Consideraciones
  ----------------------- ----------------------- -----------------------
  PayKlik                 Procesamiento de pagos  HTTPS, validación de
                                                  respuestas, referencias
                                                  y reintentos
                                                  controlados

  SAT                     Facturación electrónica Validación documental,
                                                  seguimiento del envío y
                                                  tratamiento de rechazos

  LogiExpress             Despacho logístico      Autenticación, tiempos
                                                  de espera y
                                                  actualización de
                                                  estados

  AS/400                  Sistema heredado        Adaptador,
                                                  sincronización
                                                  controlada y registro
                                                  de errores

  POS de tiendas          Operaciones de punto de Validación de eventos y
                          venta                   sincronización de datos

  Proveedores de          Correo, SMS y push      Límites, reintentos y
  notificación                                    registro de resultados
  -----------------------------------------------------------------------

Las credenciales deben almacenarse en un mecanismo seguro, nunca dentro
del código fuente. Cada integración debe manejar indisponibilidad,
respuestas inválidas, límites de consumo y operaciones pendientes.

## 8. Flujo principal del negocio

### 8.1 Procesamiento de una orden

1.  El cliente inicia una compra desde web, aplicación móvil, tienda o
    POS.
2.  La solicitud llega por HTTPS al balanceador y al API Gateway.
3.  El Gateway enruta la solicitud al Servicio de Órdenes y Carrito.
4.  Se valida la información y se consulta la disponibilidad del
    inventario.
5.  Se reserva stock temporalmente cuando corresponde.
6.  El Servicio de Pagos coordina el cobro con PayKlik.
7.  La orden continúa o se gestiona según el resultado del pago.
8.  Facturación prepara la información y coordina el envío a SAT.
9.  Despacho coordina la entrega con LogiExpress.
10. Los eventos activan tareas asíncronas, incluidas las notificaciones.
11. Se actualizan los estados y se registran los eventos relevantes para
    auditoría.

Las transiciones exactas, compensaciones y reglas de cancelación deben
definirse en los casos de uso y contratos del sistema.

### 8.2 Sincronización con sistemas heredados

1.  El servicio de Integración Legacy inicia la sincronización según la
    frecuencia acordada.
2.  Lee o recibe datos en el formato o interfaz disponible.
3.  Valida estructura, campos obligatorios y consistencia.
4.  Procesa registros válidos y separa los errores.
5.  Actualiza la información a través de interfaces autorizadas.
6.  Registra el resultado y permite reprocesar los registros fallidos.

Como referencia funcional, se ha planteado sincronizar AS/400 cada 30
minutos. La frecuencia final debe ser configurable y validarse con las
restricciones del sistema legado.

## 9. Modelo de despliegue

El diagrama muestra cinco nodos lógicos:

  -----------------------------------------------------------------------
  Nodo                                Función
  ----------------------------------- -----------------------------------
  Nodo 1 --- Frontend React           Interfaz de usuario del BackOffice
                                      y aplicación web

  Nodo 2 --- Microservicios           Ejecución de los servicios de
                                      negocio

  Nodo 3 --- Bases de datos           Motores de datos y volúmenes
                                      persistentes

  Nodo 4 --- Message Broker           Kafka o RabbitMQ

  Nodo 5 --- Servicios externos       Conectividad con proveedores y
                                      plataformas externas
  -----------------------------------------------------------------------

Estos nodos son una vista lógica; no obligan a utilizar cinco máquinas
físicas. En Kubernetes pueden corresponder a pods, deployments, stateful
sets, servicios de red o grupos de nodos.

### 9.1 Docker

-   Utilizar imágenes base mantenidas y versiones explícitas.
-   Ejecutar procesos con privilegios mínimos.
-   Mantener secretos fuera de las imágenes.
-   Definir verificaciones de salud.
-   Establecer límites de CPU y memoria.
-   Escanear imágenes y dependencias.
-   Versionar las imágenes publicadas.

### 9.2 Kubernetes

Según las necesidades del entorno, definir:

-   `Deployment` para aplicaciones sin estado.
-   `Service` para comunicación interna.
-   `Ingress` o equivalente para entrada HTTP/HTTPS.
-   `ConfigMap` para parámetros no confidenciales.
-   `Secret` o gestor externo para credenciales.
-   `PersistentVolumeClaim` para almacenamiento persistente.
-   `readinessProbe` y `livenessProbe`.
-   Solicitudes y límites de CPU y memoria.
-   Réplicas, políticas de actualización y reglas de red.

Bases de datos y brokers requieren planes específicos de persistencia,
respaldo, recuperación y actualización. Un contenedor por sí solo no
garantiza alta disponibilidad.

### 9.3 Entornos

-   **Desarrollo:** ejecución local y datos de prueba.
-   **Pruebas/integración:** validación de contratos, servicios e
    integraciones.
-   **Producción:** infraestructura protegida, secretos administrados,
    monitoreo, respaldo y control de acceso.

Los datos reales no deben copiarse a entornos no productivos sin
autorización y controles adecuados.

## 10. Configuración

Los parámetros deben inyectarse mediante variables de entorno o el
sistema de configuración del despliegue. Ejemplo ilustrativo:

``` dotenv
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.example.com
LOG_LEVEL=info
```

Los nombres reales deben adaptarse a cada aplicación. Las contraseñas,
tokens, claves privadas y credenciales no deben almacenarse en el
repositorio. Los archivos `.env` locales deben excluirse del control de
versiones y se debe mantener un archivo de ejemplo sin secretos.

## 11. Seguridad

### 11.1 Comunicaciones y acceso

-   Utilizar HTTPS para las comunicaciones externas.
-   Autenticar usuarios y servicios.
-   Aplicar autorización basada en roles y permisos.
-   Restringir puertos y conexiones internas.
-   Proteger las interfaces administrativas.
-   Configurar CORS para los orígenes autorizados.
-   Validar entradas y limitar solicitudes.

### 11.2 Datos y pagos

-   No almacenar el número completo de tarjeta ni el CVV.
-   Conservar únicamente referencias y datos necesarios para la
    operación y auditoría.
-   Proteger datos almacenados y en tránsito según su sensibilidad.
-   Evitar datos personales innecesarios en logs y eventos.
-   Definir políticas de retención y eliminación.

### 11.3 Secretos y privilegios

-   Usar un gestor de secretos o mecanismo seguro equivalente.
-   Rotar credenciales según la política operativa.
-   Evitar cuentas compartidas y privilegios excesivos.
-   Separar permisos por entorno.
-   Auditar las acciones administrativas relevantes.

### 11.4 Auditoría

Para operaciones relevantes, registrar fecha/hora, usuario o servicio
responsable, acción, resultado, canal de origen e identificadores de
orden, transacción o correlación. Nunca registrar contraseñas, tokens,
CVV ni otros secretos.

## 12. Disponibilidad y tolerancia a fallos

### Reintentos y timeouts

Las llamadas a proveedores deben tener tiempos de espera explícitos y
reintentos limitados. Se recomienda espera progresiva. No se deben
repetir indefinidamente operaciones que puedan duplicar pagos u otros
efectos.

### Idempotencia

Las operaciones que puedan repetirse por reintentos o mensajes
duplicados deben impedir efectos duplicados. Para órdenes, pagos y
eventos se deben definir claves de idempotencia o mecanismos
equivalentes.

### Outbox y mensajes fallidos

Cuando se persiste un cambio de negocio y se publica un evento, el
patrón Outbox puede reducir el riesgo de que se guarde el cambio sin
publicar el mensaje. Los mensajes que agoten los reintentos deben quedar
disponibles para investigación y reprocesamiento controlado.

### Recuperación

Se necesitan copias de seguridad, pruebas de restauración, monitoreo de
dependencias y procedimientos para recuperar datos y mensajes. Los
objetivos RTO y RPO deben acordarse con el negocio; este manual no
presupone valores concretos.

## 13. Observabilidad

El diagrama considera Prometheus, Grafana y una solución de logs como
ELK. La selección final debe corresponder al entorno real.

### 13.1 Logs

Emitir logs estructurados con fecha/hora, nivel, servicio, entorno e
identificador de correlación. No registrar secretos ni datos personales
innecesarios.

### 13.2 Métricas recomendadas

-   Solicitudes por segundo y tasa de errores.
-   Latencia de APIs y percentiles.
-   Uso de CPU y memoria.
-   Órdenes procesadas y pendientes.
-   Resultados y duración de pagos.
-   Reservas activas y expiradas.
-   Longitud y antigüedad de colas.
-   Reintentos y mensajes fallidos.
-   Latencia y disponibilidad de integraciones.
-   Fallos y retrasos de sincronización con AS/400 y POS.

### 13.3 Trazas y alertas

Usar identificadores de correlación para relacionar logs de distintos
servicios. Las alertas deben detectar errores sostenidos, latencia
elevada, colas acumuladas, proveedores caídos o sincronizaciones
fallidas. Los umbrales deben calibrarse con pruebas y datos reales.

## 14. Rendimiento y requisitos de calidad

Los objetivos del proyecto deben comprobarse mediante pruebas
reproducibles.

  -----------------------------------------------------------------------
  Requisito de referencia Objetivo                Validación
  ----------------------- ----------------------- -----------------------
  Consulta de orden o     Menos de 5 segundos     Prueba de carga y
  estado                                          medición extremo a
                                                  extremo

  Consulta de auditoría   Menos de 1 segundo      Prueba con volúmenes
                                                  representativos

  Disponibilidad          Balanceador y réplicas  Pruebas de caída y
                          según despliegue        recuperación

  Escalabilidad           Escalado horizontal     Pruebas de carga y
                          cuando aplique          aumento de réplicas

  Seguridad               Autenticación,          Pruebas y revisión de
                          autorización y          configuración
                          protección de datos     

  Integraciones           Recuperación controlada Pruebas de timeout,
                          ante fallos externos    desconexión y
                                                  reintentos
  -----------------------------------------------------------------------

Para evaluar latencia, registrar carga concurrente, tamaño de datos,
percentil medido y condiciones de prueba. No declarar cumplido un
requisito sin evidencia.

## 15. CI/CD

GitHub Actions o GitLab CI son alternativas contempladas en el diseño.
El pipeline concreto depende del repositorio seleccionado.

Flujo recomendado:

1.  Validar formato y calidad del código.
2.  Ejecutar pruebas unitarias.
3.  Ejecutar pruebas de integración.
4.  Revisar dependencias y vulnerabilidades.
5.  Construir imágenes Docker.
6.  Etiquetar y publicar artefactos versionados.
7.  Desplegar en pruebas.
8.  Ejecutar verificaciones posteriores al despliegue.
9.  Promover a producción con autorización.
10. Conservar resultados y registros de la ejecución.

Las credenciales del pipeline deben administrarse mediante secretos del
proveedor. Cada despliegue debe permitir identificar el código y la
imagen utilizados y contar con un procedimiento de reversión.

## 16. Estrategia de pruebas

-   **Unitarias:** validan reglas de negocio de cada servicio.
-   **Integración:** verifican comunicación con bases de datos, broker y
    proveedores.
-   **Contrato:** comprueban compatibilidad de APIs y eventos.
-   **Extremo a extremo:** validan flujos completos de compra, pago,
    facturación, despacho y notificación.
-   **Carga y resiliencia:** miden latencia y errores bajo carga y ante
    caídas o retrasos.
-   **Seguridad:** revisan autenticación, permisos, entradas, secretos,
    dependencias y configuración de red.

Los resultados deben guardarse como evidencia de aceptación.

## 17. Operación y mantenimiento

Las tareas de operación deben incluir:

-   Revisar alertas, métricas y logs.
-   Verificar salud de servicios y dependencias.
-   Revisar mensajes fallidos y reintentos agotados.
-   Supervisar sincronizaciones de AS/400 y POS.
-   Comprobar respaldos y probar restauraciones.
-   Actualizar imágenes y dependencias vulnerables.
-   Rotar secretos y revisar permisos.
-   Registrar cambios de configuración y despliegues.
-   Documentar incidentes, causa raíz y acciones correctivas.

Los procedimientos deben identificar responsables, criterios de
escalamiento, pasos de recuperación y comprobaciones posteriores.

## 18. Riesgos y mitigaciones

  -----------------------------------------------------------------------
  Riesgo                  Impacto                 Mitigación
  ----------------------- ----------------------- -----------------------
  Proveedor externo       Retrasos en pagos,      Timeouts, reintentos
  indisponible            facturación, logística  limitados, colas y
                          o notificaciones        seguimiento

  Mensajes duplicados     Procesamiento repetido  Idempotencia y
                                                  deduplicación

  Inventario              Sobreventa o            Reservas, validaciones
  desactualizado          disponibilidad          y sincronización
                          incorrecta              

  Fallo con sistemas      Datos inconsistentes    Registro por lote,
  heredados                                       alertas y
                                                  reprocesamiento

  Acceso no autorizado    Exposición o            Roles, privilegio
                          modificación de datos   mínimo y auditoría

  Pérdida de datos        Interrupción operativa  Respaldos y pruebas de
                                                  restauración

  Saturación del broker   Retraso en tareas       Monitoreo de colas,
                          asíncronas              capacidad y alertas

  Despliegue defectuoso   Interrupción o          Pruebas, despliegue
                          regresiones             controlado y reversión
  -----------------------------------------------------------------------

## 19. Decisiones pendientes antes de producción

El equipo debe concretar y documentar:

-   Selección definitiva de Kafka o RabbitMQ.
-   Motor y versión de cada base de datos.
-   Autenticación, emisión y renovación de tokens.
-   Contratos de APIs y esquemas de eventos.
-   Retención, reintentos y tratamiento de mensajes fallidos.
-   Topología de red, DNS, TLS y reglas de firewall.
-   Proveedor de nube y dimensionamiento de recursos.
-   Réplicas y estrategia de alta disponibilidad.
-   RTO, RPO, frecuencia de respaldos y recuperación.
-   Umbrales de monitoreo y alertas.
-   Estrategia de despliegue y reversión.
-   Responsables de operación y soporte.
-   Presupuesto definitivo de infraestructura.

## 20. Lista de verificación para la entrega

-   [ ] Los componentes del diagrama están identificados y documentados.
-   [ ] Las responsabilidades y contratos de los microservicios están
    definidos.
-   [ ] El frontend consume el API Gateway.
-   [ ] Las comunicaciones externas utilizan HTTPS.
-   [ ] Las integraciones tienen timeout y manejo de errores.
-   [ ] Las operaciones repetibles cuentan con controles de
    idempotencia.
-   [ ] Los eventos y sus esquemas están documentados.
-   [ ] Las bases de datos cuentan con persistencia y respaldo.
-   [ ] Los secretos no están incluidos en el repositorio.
-   [ ] Los logs y métricas permiten investigar fallos.
-   [ ] Se ejecutaron pruebas unitarias, de integración y de carga
    pertinentes.
-   [ ] Se realizaron pruebas de seguridad.
-   [ ] El despliegue es reproducible y dispone de reversión.
-   [ ] Los objetivos de rendimiento se validaron con evidencia.
-   [ ] Existe un procedimiento de recuperación ante fallos.

## 21. Glosario

  -----------------------------------------------------------------------
  Término                             Definición
  ----------------------------------- -----------------------------------
  API                                 Interfaz para la comunicación entre
                                      componentes

  API Gateway                         Punto de entrada que enruta
                                      solicitudes y aplica políticas
                                      comunes

  BackOffice                          Interfaz administrativa para la
                                      operación interna

  Broker                              Componente que distribuye mensajes
                                      entre productores y consumidores

  CI/CD                               Automatización de integración,
                                      validación y despliegue

  Contenedor                          Paquete ejecutable con una
                                      aplicación y sus dependencias

  Idempotencia                        Propiedad por la que repetir una
                                      operación no genera efectos
                                      adicionales no deseados

  Microservicio                       Servicio independiente orientado a
                                      una responsabilidad de negocio

  Observabilidad                      Capacidad de comprender el sistema
                                      mediante logs, métricas y trazas

  Outbox                              Patrón que registra eventos
                                      pendientes junto con cambios de
                                      negocio para publicarlos de forma
                                      confiable

  POS                                 Sistema de punto de venta

  RPO                                 Punto de recuperación: cantidad de
                                      datos que se acepta poder perder

  RTO                                 Tiempo objetivo para recuperar un
                                      servicio tras una interrupción  

                                      
  -----------------------------------------------------------------------  






# Diagramas Importantes  

## Diagrama de bloques  
![2](../DOCUMENTACION/image/Arquitectura%20SGO-Logic%20Omnicanal.png)  

## Diagrama de componentes  
![3](../DOCUMENTACION/image/Arquitectura%20de%20Componentes%20SGO-Logic.png)  

## Diagrama de despliegue  
![4](../DOCUMENTACION/image/Diagrama%20de%20Despliegue%20de%20Microservicios%20SGO-Logic.png)  


## 22. Conclusión

SGO-Logic combina microservicios, API Gateway, mensajería orientada a
eventos, almacenamiento separado por dominio e integración con sistemas
externos y heredados. Esta estructura facilita organizar los procesos
del negocio, desacoplar tareas asíncronas y evolucionar componentes con
límites claros.

La calidad de la implementación dependerá de contratos consistentes,
protección de datos y credenciales, mecanismos de recuperación,
observabilidad y pruebas que demuestren el cumplimiento de los objetivos
de rendimiento y disponibilidad. El documento debe actualizarse cuando
se concreten decisiones técnicas o cambie el despliegue real.

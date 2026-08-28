# Caso de Accion

## 1. Contexto Operativo

- MegaStore opera en tres países (Guatemala, El Salvador y Costa Rica).
- Cuenta con 32 tiendas físicas y un canal de comercio electrónico en crecimiento.
- Su facturación anual es de $450 millones.

## 2. Gestión de Información Actual

- Los sistemas de ventas presenciales, inventario, logística y contabilidad funcionan de manera independiente.
- La integración entre aplicaciones es limitada y ocurre con diferentes ritmos y niveles de automatización.
- Se utilizan procesos manuales como llamadas telefónicas, hojas de cálculo y conciliaciones posteriores para completar una venta.

## 3. Ineficiencias Detectadas

- Desconexión de canales: la información no fluye de manera uniforme entre sistemas.
- Procesos manuales: generan retrasos y errores en la operación.
- Experiencia del cliente afectada: compras poco ágiles y falta de consistencia entre canales.
- Impacto en ingresos: la falta de continuidad puede frenar ventas y generar pérdidas.
- Limitaciones en la toma de decisiones: la gerencia no cuenta con datos oportunos ni confiables para reaccionar rápidamente.

## 4. Riesgos Asociados

- Pérdida de competitividad frente a retailers con operaciones omnicanal más maduras.
- Mayor costo operativo por duplicidad de procesos.
- Riesgo de insatisfacción y pérdida de clientes por experiencias fragmentadas.
- Dificultad para escalar el negocio en un entorno digital en expansión.

# Propuesta de Arquitectura de Software

## 1. Principios de Diseño

- Omnicanalidad: integración fluida entre tiendas físicas, inventario, logística y contabilidad.
- Escalabilidad: preparada para crecimiento regional y aumento de transacciones.
- Mantenibilidad: modularidad y separación de responsabilidades.
- Seguridad: protección de datos de clientes y transacciones.
- Eficiencia: reducción de procesos manuales y optimización de flujos.

## 2. Estructura General del Sistema

La arquitectura se plantea en capas y servicios desacoplados, con soporte para integración continua:

- Capa de Presentación “Front-End”
  - Aplicaciones web y móviles para clientes.
  - Interfaces para empleados en tienda.
  - Experiencia unificada en todos los canales.

- Capa de Servicios “Back-End / API Gateway”
  - API Gateway para centralizar accesos.
  - Microservicios especializados:
    - Ventas (presenciales y online).
    - Inventario.
    - Logística y distribución.
    - Contabilidad y finanzas.
    - Gestión de clientes (CRM).

- Capa de Datos
  - Base de datos relacional para transacciones críticas.
  - Data warehouse para análisis y reportes.
  - Integración con sistemas heredados mediante ETL o conectores.

- Capa de Integración
  - Bus de mensajería ej. Kafka o RabbitMQ.
  - Sincronización en tiempo real entre inventario, ventas y logística.

- Capa de Seguridad y Gobernanza
  - Autenticación y autorización centralizada ej: IAM “AWS”.
  - Encriptación de datos sensibles.
  - Monitoreo y auditoría de accesos.

## 3. Funciones Críticas Soportadas

- Gestión de inventario en tiempo real.
- Procesamiento de ventas omnicanal (tienda física + producto (LineaBlanca, Electronica, Ropa,Calzado).
- Logística integrada (órdenes, envíos, devoluciones).
- Contabilidad automatizada (conciliación inmediata).
- Analítica de negocio (reportes para gerencia).

## 4. Calidad del Diseño

- Mantenible: uso de microservicios desacoplados y documentación con ADR.
- Seguro: políticas de acceso, cifrado y monitoreo.
- Eficiente: reducción de duplicidad de procesos y automatización de flujos.
- Trazable: decisiones documentadas en DDA y ADR, alineadas con drivers arquitectónicos.

# Justificación de Decisiones ante la Alta Gerencia

## 1. Perspectiva de Negocio

- La arquitectura propuesta responde directamente a la estrategia omnicanal de MegaStore, integrando ventas físicas y digitales en un flujo único.
- Se busca mejorar la experiencia del cliente, eliminando procesos manuales y garantizando continuidad en las transacciones.
- La solución permite a la gerencia contar con información confiable y en tiempo real, fortaleciendo la toma de decisiones estratégicas.

## 2. Selección de Tecnologías y Metodologías

- Microservicios y API Gateway: aseguran flexibilidad, escalabilidad y facilidad de mantenimiento.
- Bus de mensajería/eventos: habilita sincronización en tiempo real entre inventario, ventas y logística.
- Data warehouse y analítica: proveen visibilidad integral para la gerencia.
- Seguridad centralizada (IAM, OAuth2): protege datos sensibles y garantiza cumplimiento normativo.
- Documentación con DDA y ADR: asegura trazabilidad y transparencia en las decisiones técnicas.

## 3. Beneficios Tangibles

- Reducción de costos operativos: menos duplicidad de procesos y conciliaciones manuales.
- Incremento en ingresos: mayor fluidez en ventas y satisfacción del cliente.
- Escalabilidad regional: preparada para crecimiento en Centroamérica y expansión futura.
- Resiliencia tecnológica: arquitectura modular que facilita evolución y adaptación a nuevas tendencias.

## 4. Riesgos Mitigados

- Se disminuye la dependencia de sistemas aislados.
- Se reduce el riesgo de pérdida de clientes por experiencias fragmentadas.
- Se asegura continuidad operativa frente a cambios en volumen de transacciones.
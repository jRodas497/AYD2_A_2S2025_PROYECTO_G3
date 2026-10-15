# Drivers y escenarios de calidad de la Fase 3

Lo que la Fase 3 agrega a los drivers de las fases anteriores ([FASE 1](../../FASE%201/Docs/DDA/) y [FASE 2](../../FASE%202/DDA/driversArquitectonicos.md)). Los drivers anteriores siguen vigentes; aquí solo están los nuevos y cómo se verifica cada uno.

## Actores nuevos

| Actor | Qué espera del sistema |
|---|---|
| Gerencia General | Abrir una línea de ingresos nueva antes de que termine el trimestre sin detener lo que ya funciona |
| Gerente de marketing (María José Rivas) | Lanzar la campaña «Compra ahora, paga en 30 días» y aumentar el ticket promedio |
| Finanzas | No dar crédito sin criterio: cada solicitud sustentada en el comportamiento real del cliente, y poder justificarla |
| Cliente con crédito | Ver la opción de crédito en el checkout, comprar sin pagar en ese momento y abonar después |
| Cliente sin crédito | Seguir comprando con PayKlik sin fricción, enterado del motivo |
| ERP heredado | Ser la fuente del historial del cliente, sin que su lentitud detenga la venta |
| Equipo de desarrollo | Integrar y desplegar de forma continua, con la garantía de que nada se despliega si las pruebas fallan |

## Drivers funcionales nuevos

| ID | Requerimiento |
|---|---|
| RN-C01 | En el checkout, el sistema decide qué rutas de pago ofrece a cada cliente: PayKlik siempre, crédito propio solo si es elegible |
| RN-C02 | La elegibilidad se basa en el historial: compras entregadas, importe, devoluciones, incidencias y pagos fuera de plazo o rechazados, sumando el historial del ERP |
| RN-C03 | Los criterios, el límite y el plazo son configurables por el administrador, sin despliegue |
| RN-C04 | Cada solicitud, aprobada o rechazada, queda registrada con su motivo, auditada y notificada al cliente |
| RN-C05 | El cliente puede consultar su crédito y abonar sus cargos |
| RN-D01 | Cada cambio se integra, se prueba y se despliega de forma automática, y no se despliega si las pruebas fallan |

## Drivers de calidad nuevos

| ID | Atributo | Requerimiento | Medida |
|---|---|---|---|
| CC-01 | Rendimiento | La decisión de crédito debe ser rápida | p95 de la decisión por debajo de 2 s |
| CC-02 | Disponibilidad | Ni la caída del ERP ni la del crédito detienen la venta | El cliente puede seguir con PayKlik |
| CC-03 | Consistencia | Dos compras a crédito simultáneas no se evalúan contra el mismo cupo | Gasto de crédito serializado por cliente |
| CC-04 | Trazabilidad | Toda decisión de crédito se puede justificar | Registro con el detalle de la evaluación |
| CC-05 | Calidad del producto | Las pruebas cubren las cinco categorías | Al menos 5 casos de unitarias, integración, E2E, carga y estrés |
| CC-06 | Despliegue | Un cambio roto no llega a producción | Deploy condicionado a que pasen los checks, y health check antes de reemplazar la versión |

## Escenarios de calidad

**CC-01. Decisión de crédito rápida**

| Elemento | Descripción |
|---|---|
| Fuente | Cliente que llega al checkout |
| Estímulo | El sistema evalúa su elegibilidad para crédito |
| Artefacto | `CreditService` y la proyección del historial del ERP |
| Entorno | Operación normal con 16 clientes en paralelo |
| Respuesta | Evalúa con el historial local y devuelve la decisión |
| Medida | p95 por debajo de 2,000 ms. Medido: 10.35 ms (prueba L04) |

**CC-02. ERP caído durante el checkout**

| Elemento | Descripción |
|---|---|
| Fuente | El ERP heredado |
| Estímulo | No responde dentro de 800 ms |
| Artefacto | `ErpCustomerHistoryService` |
| Entorno | Operación normal, sin historial vigente del cliente |
| Respuesta | La opción de crédito se retira y el checkout sigue con PayKlik |
| Medida | La orden termina confirmada o rechazada; ninguna queda esperando. Cubierto por I06 (límite de tiempo del ERP) y E05 (el crédito retirado y el pago con tarjeta siguen operando) |

**CC-02b. Proveedor de pago lento**

| Elemento | Descripción |
|---|---|
| Fuente | PayKlik |
| Estímulo | Responde con 6 s de demora a 32 ventas simultáneas |
| Artefacto | Adaptador de PayKlik, reintentos y outbox |
| Entorno | Carga por encima de la esperada |
| Respuesta | Las ventas se recuperan al restaurar al proveedor; la ruta de crédito sigue operativa |
| Medida | Las 32 ventas se recuperaron en 39.5 s (prueba S05) |

**CC-03. Compras simultáneas del mismo cliente**

| Elemento | Descripción |
|---|---|
| Fuente | Un cliente con dos pestañas |
| Estímulo | Dos compras a crédito al mismo tiempo |
| Artefacto | `CreditService`, con el candado sobre la fila del cliente |
| Entorno | Operación normal |
| Respuesta | Las evaluaciones y los cargos se serializan; la segunda ve el cupo ya usado |
| Medida | Nunca se excede el límite ni se crea deuda duplicada. Cubierto por U07, U08, I05 y `prueba_operaciones.py` |

**CC-06. Deploy de un cambio roto**

| Elemento | Descripción |
|---|---|
| Fuente | Un integrante que sube un cambio |
| Estímulo | Las pruebas fallan, o el backend nuevo no responde tras desplegar |
| Artefacto | `.github/workflows/ci.yml` y `render.yaml` |
| Entorno | Push a `develop` |
| Respuesta | Render no despliega si algún check de GitHub Actions falla; si el backend nuevo no responde en el health check, Render conserva la versión anterior |
| Medida | Ningún commit con pruebas rojas llega a producción, porque Render no despliega por su cuenta |

## Decisiones arquitectónicas asociadas

| Decisión | Documento |
|---|---|
| Evaluación de crédito propio con historial del ERP en una proyección local | [ADR-0010](ADR/0010-evaluacion-de-credito-propio.md) |
| CI/CD con gate de pruebas y despliegue en Render, Neon y R2 | [ADR-0011](ADR/0011-cicd-y-despliegue-en-la-nube.md) |
| Kafka como broker, con el outbox como puente | [ADR-0012](ADR/0012-kafka-como-broker-con-el-outbox-como-puente.md) |
| Un solo contenedor de aplicación | [ADR-0009](../../FASE%202/DDA/ADR/0009-alcance-de-despliegue-del-mvp.md) |
| Outbox y Kafka para las integraciones y las notificaciones | [ADR-0007](../../FASE%202/DDA/ADR/0007-outbox-en-la-base-como-broker-del-mvp.md) |

## Casos de uso

| Caso de uso | Drivers |
|---|---|
| [CDU-09: comprar a crédito](casos-de-uso/CDU-09-comprar-a-credito.md) | RN-C01 a RN-C04, CC-01 a CC-04 |
| [CDU-10: abonar el saldo de un crédito](casos-de-uso/CDU-10-abonar-saldo-de-credito.md) | RN-C05, CC-02, CC-04 |

## Trazabilidad con las pruebas

Cada driver nuevo tiene casos en la [matriz de trazabilidad](../MATRIZ-TRAZABILIDAD.md) y su resultado en la [evidencia](../EVIDENCIA.md).

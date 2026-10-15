# Evidencia de ejecución de Fase 3

Corrida completa **aprobada**, terminada el 15 de octubre de 2026 a las 00:21:18 (America/Guatemala).

Comando ejecutado desde la raíz:

```text
python "FASE 3/verificar.py"
```

Identificador: `20261015T060858Z-4d6364`. `passed=true`, `complete_acceptance=true`.
Todas las 23 etapas terminaron con código 0; las pruebas de navegador se ejecutaron con cero reintentos.

| Categoría | Ejecutadas y aprobadas | Mínimo del PDF |
|---|---:|---:|
| Unitarias | 182 (60 backend + 122 frontend) | 5 |
| Integración | 8 | 5 |
| Carga | 5 | 5 |
| Estrés | 5 | 5 |
| E2E | 42 | 5 |

**Total: 242 casos reportados**, sin fallos, errores ni omisiones. Los scripts adicionales de regresión, concurrencia, volumen, rendimiento y caídas también aprobaron; no se inflan los conteos con sus assertions internas.

## Carga

| Caso | Operaciones | Concurrencia | p95 (ms) | Máximo (ms) | Umbral (ms) |
|---|---:|---:|---:|---:|---:|
| L01 catalog | 256 | 16 | 12.9 | 16.57 | < 5000 |
| L02 order status RC01 | 256 | 16 | 8.1 | 9.44 | < 5000 |
| L03 audit RC02 | 256 | 8 | 7.01 | 11.31 | < 1000 |
| L04 credit decision | 256 | 16 | 10.35 | 13.03 | < 2000 |
| L05 full sales | 16 | 16 | 133.59 | 162.57 | < 10000 |

L05 mide la secuencia carrito/checkout/pago por venta, y además exige factura y guía para todas sus órdenes. Los otros casos miden una consulta por operación.

## Estrés e integridad

| Perfil | Concurrencia | p95 (ms) | Máximo (ms) | Resultados |
|---|---:|---:|---:|---|
| S01 mixed read ramp 16 | 16 | 7.45 | 13.27 | accepted: 1024 |
| S01 mixed read ramp 32 | 32 | 14.05 | 22.78 | accepted: 1024 |
| S01 mixed read ramp 64 | 64 | 30.05 | 47.73 | accepted: 1024 |
| S01 mixed read ramp 128 | 128 | 55.42 | 89.98 | accepted: 1024 |
| S02 overselling competition | 80 | 37.79 | 41.73 | accepted: 10, HTTP 409: 70 |
| S03 duplicate payment contention | 32 | 15.13 | 26.73 | accepted: 1, HTTP 409: 31 |
| S04 duplicate checkout contention | 32 | 21.7 | 22.3 | accepted: 1, HTTP 400: 31 |
| S05 slow provider burst | 32 | 5040.5 | 5040.66 | accepted: 32 |

Las 32 ventas con proveedor lento se recuperaron en 39.53 s tras restaurarlo. La ruta de crédito siguió operativa. Se comprobaron reservas, stock, facturas y registros efectivos de PayKlik: una sola orden/cobro en los escenarios de duplicados, sin sobreventa ni órdenes sin reserva.

## Rendimiento adicional

| Consulta | Peticiones | Concurrencia | p95 (ms) | Máximo (ms) | Errores |
|---|---:|---:|---:|---:|---:|
| RC01 · GET /api/orders/{id} (estado, despacho y entrega) | 1000 | 32 | 11.1 | 21.9 | 0 |
| RC02 · GET /api/reports/payments?orderId={id} (intentos de cobro) | 1000 | 32 | 9 | 16.3 | 0 |
| DC-04 · GET /api/orders/{id}/trace (evidencia de auditoría) | 1000 | 32 | 10.8 | 15 | 0 |

## Recursos y entorno

Se conservaron 14 muestras de CPU, memoria, red, I/O y procesos. Los máximos siguientes son los observados en esas muestras, no mediciones continuas de todos los picos.

| Servicio | CPU máxima observada | Memoria máxima observada (MiB) |
|---|---:|---:|
| kafka | 68.03% | 559.40 |
| backend | 92.48% | 476.40 |
| db | 38.19% | 111.00 |
| frontend | 0.00% | 12.82 |

Los invariantes de inventario y las consultas de recuperación pasaron después de cada escenario. Docker expresa CPU respecto a un núcleo, por lo que puede superar 100% cuando se usan varios.

Entorno local: `macOS-27.0.1-arm64-arm-64bit-Mach-O`, 12 CPU, Python 3.14.8, Node v22.23.3, Docker Desktop 4.87.0 con Docker Engine 29.7.2, 12 CPU y 7.748 GiB disponibles. Backend compilado para Java 21; PostgreSQL 16 y Kafka 3.8.1 en contenedores.

## Simulaciones y regresiones

- 60 compras simultáneas: 20 WEB, 20 MOBILE, 20 CALL_CENTER; todas aprobadas, facturadas y con guía.
- 80 reservas concurrentes: 28 aceptadas y 52 rechazadas; 1 148 unidades reservadas de 1 149 disponibles; cero órdenes sin reserva y cero sobreventa.
- Stop/start físico de Kafka, PayKlik, SAT, LogiExpress, mensajería y POS: recuperación verificada.
- Ocho reintentos agotados de abono y notificación: dead-letter y replay exitosos sin cobro duplicado.
- ERP no disponible: historial vencido bloquea crédito y mantiene PayKlik; conciliación se recupera.
- Roles, propiedad de recursos, alcance por tienda, revocación durable, recuperación por correo, promociones, cancelaciones, devoluciones, cambios y abonos: regresiones aprobadas.

## Correcciones verificadas

- Scripts de shell con LF y regla `.gitattributes`: las migraciones arrancan correctamente desde Windows en Linux.
- Tokens simulados de pago y abono con UUID codificado en letras: se eliminan falsos rechazos aleatorios por secuencias que parecen PAN, manteniendo las guardias existentes y seis regresiones unitarias.
- Pruebas existentes parametrizadas para el proyecto Docker aislado, incluyendo SQL, caídas y lectura del correo de recuperación.
- Fixtures de concurrencia y volumen exigen la cantidad solicitada de clientes y rechazos efectivos; no pueden aprobar con una muestra vacía o insuficiente.

## Artefactos y alcance

Los reportes completos están en `resultados/20261015T060858Z-4d6364/`: XML de las cinco categorías, reportes HTML de Playwright, métricas JSON, logs por etapa y `resumen.json` con hashes de artefactos y fuentes comprobadas. La corrida se retiró automáticamente con sus volúmenes temporales. Los resultados completos no se versionan: están ignorados por Git y GitHub Actions los publica como artefacto.

SHA-256 de `resumen.json`: `911de67499e84ad7b932faca77d19d252cff990c5bb177884d3ed2f80d7f38ae`.

La evidencia corresponde a ejecución local con proveedores simulados independientes. No certifica SLAs de terceros reales, capacidad de nube ni disponibilidad anual. El CI ejecuta el mismo comando en cada push y pull request. Lint terminó con cero errores y 23 advertencias existentes de hooks/optimización y Fast Refresh, que quedaron en su log.

Esta corrida es la segunda de ese día sobre el mismo código. La primera (`20261015T055530Z-01c411`) falló en una sola prueba E2E, «devolución desde la orden actualiza estado y reembolso», que esperó 10 segundos a ver la orden «Devuelta» y no la vio; las otras 41 pasaron. El CI de GitHub Actions mostró fallas intermitentes parecidas en otras pruebas sensibles al tiempo (`I08`, `E02` y una del carrito). Los resultados de las corridas fallidas no se mezclaron con esta aceptación completa, y la estabilización de esas pruebas sigue abierta (ver [GESTION-DEL-PROYECTO.md](GESTION-DEL-PROYECTO.md)). El plan y la matriz delimitan los criterios del PDF que pertenecen al testeo.

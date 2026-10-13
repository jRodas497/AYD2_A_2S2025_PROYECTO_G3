# Evidencia de ejecución de Fase 3

Corrida completa **aprobada**, terminada el 2026-10-12 20:36:39 (America/Guatemala).

Comando ejecutado desde la raíz:

```text
python "FASE 3/verificar.py"
```

Identificador: `20261013T021648Z-a4dab5`. `passed=true`, `complete_acceptance=true`.
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
| L01 catalog | 256 | 16 | 93.68 | 136.86 | < 5000 |
| L02 order status RC01 | 256 | 16 | 49.33 | 113.66 | < 5000 |
| L03 audit RC02 | 256 | 8 | 42.99 | 63.32 | < 1000 |
| L04 credit decision | 256 | 16 | 128.33 | 237.08 | < 2000 |
| L05 full sales | 16 | 16 | 826.39 | 835.12 | < 10000 |

L05 mide la secuencia carrito/checkout/pago por venta, y además exige factura y guía para todas sus órdenes. Los otros casos miden una consulta por operación.

## Estrés e integridad

| Perfil | Concurrencia | p95 (ms) | Máximo (ms) | Resultados |
|---|---:|---:|---:|---|
| S01 mixed read ramp 16 | 16 | 73.16 | 164.06 | accepted: 1024 |
| S01 mixed read ramp 32 | 32 | 205.36 | 547.74 | accepted: 1024 |
| S01 mixed read ramp 64 | 64 | 443.56 | 1055.53 | accepted: 1024 |
| S01 mixed read ramp 128 | 128 | 604.74 | 1299.18 | accepted: 1024 |
| S02 overselling competition | 80 | 481.25 | 529.08 | accepted: 10, HTTP 409: 70 |
| S03 duplicate payment contention | 32 | 132.9 | 184.0 | HTTP 409: 31, accepted: 1 |
| S04 duplicate checkout contention | 32 | 151.91 | 163.23 | HTTP 400: 31, accepted: 1 |
| S05 slow provider burst | 32 | 5222.19 | 5236.09 | accepted: 32 |

Las 32 ventas con proveedor lento se recuperaron en 36.24 s tras restaurarlo. La ruta de crédito siguió operativa. Se comprobaron reservas, stock, facturas y registros efectivos de PayKlik: una sola orden/cobro en los escenarios de duplicados, sin sobreventa ni órdenes sin reserva.

## Rendimiento adicional

| Consulta | Peticiones | Concurrencia | p95 (ms) | Máximo (ms) | Errores |
|---|---:|---:|---:|---:|---:|
| RC01 · GET /api/orders/{id} (estado, despacho y entrega) | 1000 | 32 | 89.7 | 196.4 | 0 |
| RC02 · GET /api/reports/payments?orderId={id} (intentos de cobro) | 1000 | 32 | 85.3 | 186.9 | 0 |
| DC-04 · GET /api/orders/{id}/trace (evidencia de auditoría) | 1000 | 32 | 133.6 | 353.0 | 0 |

## Recursos y entorno

Se conservaron 14 muestras de CPU, memoria, red, I/O y procesos. Los máximos siguientes son los observados en esas muestras, no mediciones continuas de todos los picos.

| Servicio | CPU máxima observada | Memoria máxima observada (MiB) |
|---|---:|---:|
| backend | 367.74% | 473.70 |
| db | 116.08% | 102.10 |
| kafka | 149.00% | 477.50 |
| frontend | 40.44% | 8.04 |

Durante carga y estrés no hubo OOM ni reinicios automáticos; los invariantes de inventario y las consultas de recuperación pasaron después de cada escenario. Docker expresa CPU respecto a un núcleo, por lo que puede superar 100% cuando se usan varios.

Entorno local: `Windows-11-10.0.26300-SP0`, 8 CPU, Python 3.13.3, Node v24.19.0, Docker Engine 28.4.0 con 8 CPU y 9.617 GiB disponibles. Backend compilado para Java 21; PostgreSQL 16 y Kafka 3.8.1 en contenedores.

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

Los reportes completos están en `resultados/20261013T021648Z-a4dab5/`: XML de las cinco categorías, reportes HTML de Playwright, métricas JSON, logs por etapa y `resumen.json` con hashes de artefactos y fuentes comprobadas. La corrida se retiró automáticamente con sus volúmenes temporales.

SHA-256 de `resumen.json`: `5235f83820572eb1b220ec935a3597ce642f64335d7109a6e36db2b3f2b923d6`.

La evidencia corresponde a ejecución local con proveedores simulados independientes. No certifica SLAs de terceros reales, capacidad de nube ni disponibilidad anual. El CI se configuró para ejecutar el mismo comando; no se disparó una ejecución remota ni se realizaron despliegues. Lint terminó con cero errores y 23 advertencias existentes de hooks/optimización y Fast Refresh, que quedaron en su log.

Las corridas de diagnóstico previas se conservaron como fallidas; no se mezclaron sus resultados con esta aceptación completa. El plan y la matriz delimitan los criterios del PDF que pertenecen al testeo.

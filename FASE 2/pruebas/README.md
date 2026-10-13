# Pruebas de los escenarios de calidad

Para ejecutar automáticamente todas las categorías, las regresiones y las caídas reales en un
entorno aislado, desde la raíz: `python "FASE 3/verificar.py"`.
La [documentación de Fase 3](../../FASE%203/README.md) contiene el plan, matriz, manuales y evidencia actual.
Los resultados históricos que siguen corresponden a la corrida de Fase 2 indicada en su fecha.

Evidencia ejecutable de los criterios que la hoja de calificación pide verificar "mediante prueba
concurrente" y "con métrica de rendimiento". Los tres scripts usan solo la librería estándar de
Python y corren contra el sistema levantado con `docker compose up -d`.

| Script | Qué demuestra | Criterio de la hoja |
|---|---|---|
| [`prueba_reserva_concurrente.py`](prueba_reserva_concurrente.py) | 80 checkouts simultáneos por más unidades de las que existen: no hay sobreventa ni órdenes a medias | Reservar producto (RF04, RC08) |
| [`prueba_rendimiento.py`](prueba_rendimiento.py) | Tiempos de respuesta de la consulta de orden y de la auditoría de cobros bajo carga | Consultar estado de la orden (RC01), auditoría de cobros (RC02) |
| [`prueba_flujo_volumen.py`](prueba_flujo_volumen.py) | Muchos clientes compran a la vez desde los tres canales y cada orden llega sola hasta la guía | Flujo principal, paso 1 a 8 (RC03) |

## Antes de correrlas

```
cd "FASE 2"
docker compose up -d --build
./db/scripts/cargar-datos-de-prueba.sh 20000     # volumen para que la métrica signifique algo
```

Las pruebas de concurrencia y de volumen hacen una reposición conocida de inventario antes de
empezar (registrada como movimiento de entrada, `Reposición para prueba ...`). Sin eso dependerían
de cuánto stock dejaron las corridas anteriores: la carga de 20 000 órdenes deja casi toda la
existencia reservada por órdenes confirmadas.

## Resultados (2026-09-23, base con 20 037 órdenes, 17 714 intentos de cobro y 130 490 registros de auditoría)

### Reserva concurrente — `python3 prueba_reserva_concurrente.py`

80 clientes piden a la vez, cada uno, una cantidad tal que la ubicación más surtida solo alcance
para unas 10 órdenes. Las verificaciones se hacen **en la base**, no en lo que respondió el API.
Tres corridas seguidas:

| Corrida | Disponible | Pedido total | Aceptados | Rechazados (409) | Reservado | Órdenes a medias | Filas con reservado > existencia |
|---|---|---|---|---|---|---|---|
| 1 | 268 | 80 × 27 = 2160 | 9 | 71 | 243 = 9 × 27 | 0 | 0 |
| 2 | 225 | 80 × 23 = 1840 | 9 | 71 | 207 = 9 × 23 | 0 | 0 |
| 3 | 218 | 80 × 22 = 1760 | 9 | 71 | 198 = 9 × 22 | 0 | 0 |

Lo reservado siempre es exactamente aceptados × cantidad, nunca supera lo que había, y ningún
checkout rechazado dejó una orden sin reserva. La atomicidad está en el `UPDATE ... WHERE
on_hand - reserved >= :cantidad` de `InventoryReservationService`, y detrás de él el
`check (reserved <= on_hand)` de la base.

### Rendimiento — `python3 prueba_rendimiento.py`

5000 consultas por escenario sobre órdenes al azar, 64 en paralelo. Tiempos en milisegundos.

| Escenario | Meta | p50 | p95 | p99 | Máx | Req/s | Errores |
|---|---|---|---|---|---|---|---|
| RC01 · `GET /api/orders/{id}` (estado, despacho y entrega) | < 5000 | 17.1 | 29.1 | 36.6 | 51.5 | 3462 | 0 |
| RC02 · `GET /api/reports/payments?orderId={id}` (intentos de cobro) | < 1000 | 16.8 | 28.7 | 36.1 | 50.9 | 3531 | 0 |
| DC-04 · `GET /api/orders/{id}/trace` (evidencia de auditoría) | < 1000 | 17.8 | 29.4 | 36.6 | 50.1 | 3373 | 0 |

El peor caso de cada escenario queda dos órdenes de magnitud por debajo de su meta. La
consulta de orden lee una sola fila de la vista `orders.order_overview`; la de cobros y la de
auditoría van por los índices `(order_id, ...)` de sus tablas.

Algunos ids sorteados no existen porque la secuencia deja huecos cuando un checkout se revierte;
esos responden 404, se reportan aparte y no cuentan en la métrica.

### Flujo con volumen — `python3 prueba_flujo_volumen.py`

60 clientes compran a la vez, alternando web, móvil y centro de atención.

```
60 clientes compraron a la vez en 0.24 s (resultados del cobro: {'APPROVED': 60})

Tras 21.6 s desde la primera compra:

| Estado de la orden | Factura | Envío        | Órdenes |
| IN_DISPATCH        | ACCEPTED | GUIDE_ISSUED | 60      |

Canales: {'WEB': 20, 'MOBILE': 20, 'CALL_CENTER': 20}
Con guía de LogiExpress: 60 de 60
```

Los ~20 s no son lentitud de la aplicación: son el recorrido del outbox (sondeo cada 2 s) por
facturación, despacho y guía, más el ~2% de timeouts simulados de LogiExpress, que se reintentan
con espera creciente.

## Qué no demuestran estas pruebas

- **Tiempos con los proveedores reales.** PayKlik, la SAT y LogiExpress están simulados con 80 ms
  de latencia (ADR-0008); PayKlik real tarda ~800 ms. Para medir tiempos de punta a punta con el
  SLA real hay que subir `sgologic.simulation.normal-latency-ms` a esos valores.
- **Carga sostenida de Black Friday (8×).** Son ráfagas de segundos sobre una sola instancia, no
  una prueba de resistencia de horas. Muestran que la arquitectura no tiene un cuello de botella
  evidente; no dimensionan la infraestructura.

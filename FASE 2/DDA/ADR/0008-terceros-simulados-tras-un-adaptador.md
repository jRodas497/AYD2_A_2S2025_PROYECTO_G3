# ADR-0008: Los terceros se simulan detrás de un adaptador, no se omiten

**Estado:** Propuesta
**Fecha:** 2026-09-22
**Decisores:** Quien implementa transacciones e integraciones (Backend 2) — pendiente de ratificación en reunión de equipo

## Contexto

Cinco de los componentes del sistema dependen de un tercero: PayKlik para cobrar, la SAT para
facturar, LogiExpress para las guías, un proveedor de mensajería para los avisos y el POS local
de las 32 tiendas. Ninguno de los cinco existe para conectarse de verdad: no hay credenciales de
PayKlik, ni un ambiente de pruebas de la SAT, ni un contrato con LogiExpress que este equipo
pueda ejercer.

Al mismo tiempo, lo que la Fase 2 pide demostrar es precisamente el comportamiento **ante la
falla** de esos terceros: que una caída de PayKlik no pierda la orden (DC-01, el driver de mayor
prioridad de todo el proyecto), que una orden no se despache sin factura, que un timeout de
LogiExpress no bloquee la operación. Sin los proveedores, esos escenarios no se pueden provocar,
y sin poder provocarlos no se pueden validar.

## Decisión

Cada tercero tiene su propio adaptador en el paquete `external` (`PayKlikClient`, `SatClient`,
`LogiExpressClient`, `MessagingClient`, `PosClient`) con la firma que tendría la integración
real: recibe los datos del negocio, devuelve la respuesta del proveedor y lanza
`ProviderUnavailableException` cuando no responde. Los módulos de negocio solo conocen esa
firma.

Hoy el cuerpo de esos métodos simula al proveedor en vez de hacer un POST. El día que el
proveedor exista, cambia ese archivo y nada más: ni el servicio que lo llama, ni el circuit
breaker, ni el outbox, ni la base.

El comportamiento simulado se controla en caliente desde `PUT /api/simulation/{proveedor}` con
cuatro modos —`NORMAL`, `SLOW`, `DOWN` y `REJECT`— para poder recorrer los escenarios de calidad
en vivo durante la demo, sin reiniciar el sistema ni tocar configuración. LogiExpress arranca
además con el ~2% de timeouts que su histórico documenta, para que el reintento se ejercite solo
en una corrida con volumen.

Lo que **no** se simula es la reacción del sistema: el circuit breaker, la cola de reintentos, la
degradación y el registro de auditoría son código de producción real, y lo que se prueba es eso.

## Alternativas consideradas

| Alternativa | Ventajas | Desventajas | Por qué se descartó |
|---|---|---|---|
| Dejar los módulos sin integración y marcar los estados a mano por endpoint | Menos código | La demo tendría que empujar cada paso a mano, y no se podría demostrar ningún escenario de falla: no habría a qué reaccionar | No cumple el objetivo de la fase, que es validar los escenarios de calidad, no ver pantallas |
| Simular dentro de cada servicio de negocio (un `if modoDemo` en pagos, en facturación, etc.) | Ahorra una capa | La lógica de demo queda entreverada con la de negocio y hay que desenredarla después; se pierde el punto único de cambio hacia la integración real | Deja una deuda garantizada en el código que más importa |
| Levantar servidores falsos aparte (WireMock o similar) en el compose | El backend haría HTTP de verdad, más parecido a producción | Un contenedor más por cada tercero, con su configuración, sin ganar nada que el escenario de calidad necesite: lo que se valida es la reacción de SGO-Logic, no su cliente HTTP | Costo de infraestructura y de configuración que no cambia lo que se demuestra |
| Adaptador con simulación conmutable en caliente (elegida) | Los escenarios de falla se provocan en segundos durante la demo; el punto de cambio a la integración real es un solo archivo por proveedor; nada de esto toca el código de negocio | Queda un endpoint de demo que no debe existir en un despliegue real | Es lo que permite validar los EAC hoy sin hipotecar la integración de mañana |

## Consecuencias

**Positivas:**
- Los escenarios de calidad son demostrables y repetibles: poner PayKlik en `DOWN`, cobrar, ver
  la orden viva en `PAYMENT_IN_PROGRESS` con el circuito abierto, devolverlo a `NORMAL` y verla
  completarse sola hasta la guía.
- La frontera con cada proveedor queda explícita y en un solo lugar, que es lo que pedía el
  estilo de adaptadores del ADR-0001.

**Negativas / tradeoffs aceptados:**
- `/api/simulation` no debe existir en producción. Hoy no hay autenticación, así que queda
  expuesto; la forma correcta de cerrarlo es un perfil de Spring que no registre ese controlador,
  y queda pendiente junto con el login.
- Las latencias simuladas son más cortas que las reales (80 ms en vez de los ~800 ms de PayKlik)
  para que la demo no se arrastre. Una prueba de estrés que mida tiempos de respuesta tiene que
  subirlas a los valores del SLA, o estará midiendo un sistema más rápido que el real.
- Ningún error real de integración —un campo mal nombrado, un certificado vencido, un formato que
  la SAT rechaza por algo que no previmos— va a aparecer hasta que exista el proveedor. Esto
  valida la arquitectura, no la integración.

## Drivers que atiende

- DC-01, DC-06 (Fase 1) — los hace verificables, que es distinto de implementarlos.
- DC-11 — permite provocar el error de despacho y comprobar que el sistema lo contiene.

## Vistas afectadas

- `FASE 2/backend/src/main/java/com/sgologic/external/`
- `FASE 2/backend/API-Transacciones.md`, sección "Simulación de terceros"
- `FASE 2/backend/README.md`, sección "Cuando un tercero falla"

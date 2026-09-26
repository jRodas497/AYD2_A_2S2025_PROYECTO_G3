# ADR-0009: Alcance de despliegue del MVP — un contenedor de aplicación, sin API Gateway ni Pricing

**Estado:** Propuesta
**Fecha:** 2026-09-23
**Decisores:** Quien implementa transacciones e integraciones (Backend 2) — pendiente de ratificación en reunión de equipo

## Contexto

Al auditar el código contra la Fase 1 aparecieron cuatro decisiones de diseño que el MVP no
implementa tal como se escribieron, y que ningún ADR había registrado:

1. **Contenedores independientes por componente.** El ADR-0001 dice que los componentes "se
   despliegan como contenedores Docker independientes dentro de un mismo backbone", y el ADR-0005
   lo repite. El MVP corre todos los componentes en un solo contenedor de aplicación
   (`sgologic-backend`) más la base.
2. **API Gateway / BFF Omnicanal.** El caso de acción de las Fases 1 y 2 y los diagramas de
   componentes y despliegue de la Fase 2 lo ponen como punto único de entrada de los canales. El
   MVP no lo tiene: los canales llaman directo al backend.
3. **Pricing & Promotions Service.** Aparece en los diagramas de la Fase 2 como componente
   derivado del refinamiento. El MVP no lo tiene.
4. **Momento de la reserva.** El CDU-01 (flujo principal, paso 3) reserva la unidad al agregarla
   al carrito; el enunciado de la Fase 2 pide reservarla "al iniciar el checkout".

La restricción R 01 exige que el código refleje las decisiones de la Fase 1, así que cada
diferencia tiene que estar decidida y justificada, no solo existir.

El primer punto tiene además una tensión dentro del propio ADR-0001: pide contenedores
independientes y, en el mismo párrafo, que las operaciones que requieren consistencia inmediata
—reservar inventario, consultar estado— usen "**llamadas directas in-process** sobre una base
compartida". Una llamada *in-process* entre contenedores distintos no existe: o es una llamada de
red, o los componentes comparten proceso.

## Decisión

Para el MVP:

1. **Todos los componentes corren en un solo contenedor de aplicación**, cada uno como un paquete
   propio con su propio esquema en la base. Se resuelve la tensión del ADR-0001 a favor de las
   llamadas *in-process*, porque el checkout necesita crear la orden y reservar el stock en **una
   sola transacción**: si falta existencia de un producto, no puede quedar ni la orden ni ninguna
   reserva parcial. Con contenedores separados eso exigiría una transacción distribuida o una saga
   con compensaciones, que el MVP no justifica.

   Las otras dos partes del ADR-0001 se mantienen tal cual: la integración asíncrona por broker
   (implementada con el outbox, ADR-0007) para todo paso que depende de un tercero, y la base
   compartida con un esquema por componente. Separar componentes en contenedores sigue siendo la
   evolución prevista del ADR-0005, y las fronteras ya están donde tienen que estar: un paquete y
   un esquema por componente, y los pasos entre pago, facturación y despacho conectados solo por
   eventos.
2. **Sin API Gateway / BFF en el MVP.** Con un solo backend, el gateway no tendría a dónde enrutar:
   agregaría un salto de red sin repartir carga ni ocultar servicios. Sus otras funciones
   —autenticación, límite de peticiones— siguen pendientes y quedan como la deuda principal del
   MVP (ver consecuencias). Se incorpora cuando existan dos o más servicios detrás.
3. **Sin Pricing & Promotions en el MVP.** El enunciado de la Fase 2 no lo incluye entre los
   módulos del MVP. El precio sale de `catalog.product` y se congela en `order_item` al hacer
   checkout, que es lo que la auditoría fiscal necesita.
4. **La reserva se hace al iniciar el checkout**, como pide el enunciado. Reservar al agregar al
   carrito bloquearía existencia de carritos que nunca se compran, justo lo que la reserva
   temporal quiere evitar. El CDU-01 queda desactualizado en su paso 3; el tiempo de liberación sí
   se respeta (20 minutos, V8).

## Alternativas consideradas

| Alternativa | Ventajas | Desventajas | Por qué se descartó |
|---|---|---|---|
| Un contenedor por componente, como dice literalmente el ADR-0001 | Fidelidad textual al ADR; escalado independiente por componente | La reserva del checkout pasa a ser una llamada de red entre contenedores y deja de ser atómica con la creación de la orden; exige saga o transacción distribuida; catorce contenedores que operar sin orquestador | Rompe la consistencia de inventario (RC08), que el propio ADR-0001 manda resolver *in-process* |
| API Gateway delante del único backend | Punto de entrada único desde ya, listo para cuando haya varios servicios | Un componente más que operar sin nada que enrutar; la autenticación, su función más valiosa, igual no está implementada | Costo sin beneficio mientras exista un solo servicio |
| Pricing & Promotions como módulo vacío | Aparece en el código como en el diagrama | Código sin funcionalidad real, que la hoja de calificación castigaría como "código huérfano" o "no implementado" | No aporta y no está en el alcance del MVP del enunciado |
| Mantener el alcance del MVP y documentarlo (elegida) | Fidelidad al ADR-0001 donde importa (los tres estilos) y consistencia transaccional real; las desviaciones quedan registradas y justificadas | La vista objetivo y la implementada divergen, y hay que mantener las dos | Es la opción honesta: el código cumple los drivers y cada diferencia con la Fase 1 queda trazada |

## Consecuencias

**Positivas:**
- El checkout es atómico: se comprobó con 80 checkouts simultáneos sin sobreventa ni órdenes a
  medias (`FASE 2/pruebas/`).
- El despliegue son dos contenedores y un `docker compose up`, operable por el equipo hoy (DR-09).
- Cada diferencia entre la Fase 1 y el código tiene su justificación en un ADR y su lugar en las
  vistas implementadas de bloques, componentes y despliegue.

**Negativas / tradeoffs aceptados:**
- Los componentes no escalan por separado: para absorber el pico se escala el contenedor
  completo. Es la motivación de la evolución del ADR-0005.
- **La autenticación es parcial.** Sin gateway, el login con JWT se aplica dentro del backend y hoy
  solo protege crear o editar productos y procesar incidencias; los endpoints de operación y
  `/api/simulation` siguen públicos. Es la deuda más grande que deja el MVP.
- El frontend asume un BFF en `/bff/...`; al integrarse con el backend tiene que usar `/api/...` o
  el equipo tiene que agregar el BFF.

## Drivers que atiende

- RC 08 (consistencia: sin sobreventa), RC 03 y RC 10 (despliegue en contenedores operable)
- R 01 y R 02: registra y justifica cada diferencia con la arquitectura de la Fase 1
- DR-09 (capacidad del equipo), DR-01 y DR-02 (presupuesto)

## Vistas afectadas

- `FASE 2/DDA/diagrama-de-despliegue.md` — vista implementada
- `FASE 2/DDA/diagrama-de-componentes.md` — vistas implementadas de bloques y componentes
- `FASE 1/Docs/DDA/casos-de-uso/CDU-01-realizar-compra-omnicanal.md` — el paso 3 queda reemplazado por la reserva al iniciar el checkout
- `FASE 2/db/migrations/V8__reserva_de_20_minutos.sql`

# Bitácora de desarrollo — SGO-Logic

Registro cronológico del trabajo real del Grupo 3 en las tres fases del proyecto, reconstruido a partir del historial de `git log` (autor, fecha y mensaje de cada commit), no de notas tomadas durante el desarrollo — el equipo no llevó una bitácora al día. Donde no hay commit no hay entrada: no se inventa actividad de un día sin evidencia en el historial.

## Fase 1 — Definición de arquitectura (15 – 27 de agosto de 2026)

**15 de agosto.** Entrega inicial del DDA de Fase 1: ADRs, diagramas en draw.io, presentación y prototipo. Punto de partida del estilo arquitectónico (monolito modular, orientado a datos, con integración asíncrona para los flujos que lo necesitan).

**17 de agosto.** Casos de uso descriptivos (CDU-01 a CDU-08) y sus diagramas: Core (sistema y actores de alto nivel) y CUN, con la notación de negocio corregida dos veces sobre la orientación de la diagonal.

**18 de agosto.** Ajustes de layout sobre el CDU y las marcas de negocio del CUN, a partir de la revisión del punto anterior.

**24 de agosto.** Se agregó el tablero Kanban al README y se documentaron los pilares fundamentales de la arquitectura.

**25 de agosto.** Carga de mockups del prototipo.

**26 de agosto.** Paleta de colores consistente aplicada a todos los diagramas de arquitectura.

**27 de agosto.** Cierre de Fase 1: se quitó la numeración de los títulos del README, se consolidó como informe principal del proyecto, y se hizo merge de `develop` a `master` como entrega de la fase.

## Fase 2 — Documentación de arquitectura (4 – 18 de septiembre de 2026)

**4 de septiembre.** Primer trabajo de Fase 2: se alineó `casoDeAccion.md` con el estilo arquitectónico decidido en el ADR-0001 (monolítico + arquitectura orientada a eventos/broker + orientado a datos) y se agregaron los diagramas de casos de uso expandidos (CDU-01 a CDU-08) que el enunciado de Fase 2 pide por cada sección de la hoja de calificación.

**9 de septiembre.** Arranca en firme el DDA de Fase 2: CDU Alto Nivel revisado y CDU expandidos de Consultas, Gestión Logística, Compras, Auditoría y Configuración; diagrama de Gestionar Clientes; actualización de los 3 diagramas UML de Fase 1 al alcance de Fase 2. Primer Sprint Planning del equipo (detalle de roles y objetivo en [`FASE 2/Scrum/Scrum - Grupo 3.md`](FASE%202/Scrum/Scrum%20-%20Grupo%203.md)).

**11 de septiembre.** Diagrama de componentes de SGO-Logic para Fase 2, construido sobre los drivers y los ADR de Fase 1.

**12 de septiembre.** Drivers arquitectónicos completos: 11 funcionales (RF), 10 de calidad (RC) y 11 de restricción (R), en [`FASE 2/DDA/driversArquitectonicos.md`](FASE%202/DDA/driversArquitectonicos.md).

**14 de septiembre.** Segundo Sprint Planning. Se corrigió el diagrama de Gestionar Clientes y se creó la matriz de restricciones (R × RF/RC, con la convención "X = impacto directo") en [`FASE 2/DDA/matrizRestricciones.md`](FASE%202/DDA/matrizRestricciones.md).

**15 de septiembre.** Diagrama de despliegue de Fase 2 terminado, con su exportación a PNG.

**18 de septiembre.** Cierre de la documentación de arquitectura: Product Backlog completo con historias de usuario y story points, en [`FASE 2/Scrum/Scrum - Grupo 3.md`](FASE%202/Scrum/Scrum%20-%20Grupo%203.md). A partir de aquí el equipo tenía un plan escrito para empezar a programar, no solo la arquitectura definida.

## Fase 2 — Implementación del MVP (21 – 25 de septiembre de 2026)

Tercer Sprint Planning (21 de septiembre), y el sprint de implementación real: llevar SGO-Logic de la definición arquitectónica a un sistema funcional de punta a punta. El detalle día por persona, con la evidencia de commits, está en la sección Daily Scrum de [`FASE 2/Scrum/Scrum - Grupo 3.md`](FASE%202/Scrum/Scrum%20-%20Grupo%203.md); aquí se deja el resumen de lo que cambió cada día y las decisiones o incidentes que valen como bitácora.

**21 de septiembre.** Arranca el backend desde cero: esquemas de base de datos por componente con datos de prueba (`FASE 2/db/migrations`), rol de aplicación sin privilegios de superusuario (ADR-0006), y el esqueleto de Spring Boot con catálogo, clientes, carrito, checkout e inventario (reserva atómica y liberación automática de reservas vencidas). Un solo día de trabajo dejó 5 servicios base funcionando.

**22 de septiembre.** Documentación de la API para consumo del frontend y formato de errores uniforme (404/400/409). En paralelo arranca el frontend: scaffold con Vite + React + TypeScript + Tailwind + Vitest, y sobre él catálogo, carrito, checkout, orden y pago completos contra un backend simulado (mock), documentados en `FASE 2/frontend/docs/`.

**23 de septiembre.** El día de mayor volumen del proyecto: se completaron los 5 módulos que exige el enunciado (cobro con PayKlik vía outbox transaccional y circuit breaker, facturación electrónica a la SAT, despacho con LogiExpress, conciliación batch con el ERP AS/400 vía CSV/XML, adaptador de eventos hacia el POS de las 32 tiendas), más auditoría transversal, gestión de incidencias, historial de cliente, los 6 CDU expandidos restantes con trazabilidad, y las 3 pruebas ejecutables de concurrencia/rendimiento/volumen (`FASE 2/pruebas/`). De esta corrida salieron dos hallazgos propios, corregidos el mismo día y documentados en el ADR-0009: el paso 10 del flujo principal (eventos hacia el POS) no ocurría tal como estaba diseñado porque el despacho normal sale de un centro de distribución, no de una tienda; y el ADR-0001 pedía contenedores independientes que el código no tenía, por razones de tiempo y consistencia transaccional del checkout. También se corrigió que la simulación del AS/400 dejaba un lote `PENDING` para siempre si la carpeta de salida no existía, con un reintento cada minuto. La auditoría completa de esa revisión, incluyendo incongruencias corregidas y pendientes, está en [`FASE 2/DDA/matriz-trazabilidad-fase2.md`](FASE%202/DDA/matriz-trazabilidad-fase2.md).

**24 de septiembre.** Autenticación con login y JWT, protegiendo crear/editar productos y procesar incidencias. Se portó el Dashboard y Reportes administrativos (que se habían empezado como un proyecto de frontend separado) al frontend unificado, con sus propios componentes visuales, y se corrigieron el enum de estado de orden y el contrato del BFF que no coincidían con el backend real.

**25 de septiembre.** Se conectaron catálogo, cliente, carrito, checkout, pago y orden al backend real, dejando atrás los mocks; se corrigieron los tipos del frontend que no coincidían con la API real (`'tarjeta'`/`'aprobado'` contra `CARD`/`APPROVED`, ids de texto contra numéricos). Documentación final del sprint: contratos de API actualizados, checklist de verificación por pantalla, y reasignación del Product Backlog de Frontend 1/2 a Cliente/Backoffice según la pantalla real que cada historia usa.

## Fase 2 — Cierre, auditoría y documentación final (25 – 26 de septiembre de 2026)

**25 de septiembre.** Revisión del repositorio completo contra el enunciado oficial de Fase 2. Se encontró y corrigió un defecto real: la validación del número de tarjeta en el formulario de pago aceptaba cualquier cantidad de dígitos a partir de 4, porque el código comparaba la longitud de los últimos 4 dígitos (siempre 4) en vez de la longitud del número completo; se corrigió para exigir los 16 dígitos completos antes de intentar el cobro. También se revisó todo el repositorio en busca de rastros de herramientas externas de generación de contenido (menciones sueltas, carpetas de configuración de agentes, texto en inglés dentro de documentos en español, comentarios de código con tono de conversación) y se limpiaron los que se encontraron, sin tocar el contenido técnico ni el comportamiento del código.

**26 de septiembre.** Se completaron las secciones de Sprint Planning, Sprint Backlog, Daily Scrum y Sprint Retrospective del documento de Scrum (reconstruidas del historial de commits, con la fecha, el autor y el resultado real de cada tarea), se agregaron pruebas unitarias de los servicios críticos del backend (pagos, inventario, facturación, logística y checkout, cada uno con su camino principal y al menos un flujo de excepción del CDU correspondiente), y se escribió esta bitácora.

## Fase 2 — Ajustes posteriores a la calificación (28 – 30 de septiembre de 2026)

**28 y 29 de septiembre.** Se construyeron las 9 pantallas del backoffice que seguían en placeholder (órdenes, incidencias, devoluciones, inventario, reservas, logística, seguimiento, clientes, auditoría y configuración) y se conectaron Dashboard, Reportes y Mis órdenes a datos reales en lugar de mocks. Para eso el backend sumó endpoints de listado y búsqueda de órdenes, clientes, incidencias y reservas, y la administración de parámetros y de personal; el frontend sumó el inicio de sesión del personal. Se corrigió el script de datos de prueba, que fallaba con clientes invitados sin dirección ni contacto. El detalle técnico está en [`PENDIENTES-BACKOFFICE.txt`](FASE%202/PENDIENTES-BACKOFFICE.txt).

**30 de septiembre.** Se dockerizó el frontend (compilado y servido con nginx, que reenvía `/api` al backend), así que `docker compose up -d --build` levanta el sistema completo en tres contenedores. La lista de personal (`GET /api/users`) pasó a exigir rol ADMIN, porque exponía quién tiene acceso y con qué roles. Se agregaron 22 pruebas a los repositorios HTTP del backoffice (el frontend queda con 87). Se actualizaron los README con el frontend en Docker, la versión de Node que exigen las pruebas (22) y cómo correr las pruebas sin instalar Maven ni Node, y se documentaron en `FASE 2/backend/API.md` los endpoints nuevos del backoffice.

**2 y 3 de octubre.** Segunda auditoría, cruzando cada endpoint del backend contra cada llamada real del frontend: el carrito del cliente todavía decía que para quitar un producto o bajar la cantidad había que llamar a servicio al cliente, aunque el backend ya tenía `PUT`/`DELETE` para eso; el perfil del cliente seguía en placeholder; no había forma de ver la factura ni el XML de una orden; y tres capacidades reales del backend (salud de las integraciones, avisos fallidos, facturas rechazadas) no tenían ninguna pantalla. Se corrigieron las cuatro y se agregaron las tres pantallas nuevas. Verificando esto en vivo (no solo leyendo el código) salieron dos defectos reales más: mandar `email: ''` en vez de `null` revienta la restricción `unique` de la base en cuanto hay un segundo cliente sin correo, y varios formularios tenían una `<label>` sin asociar a su `<input>` (sin `htmlFor`/`id`), lo que es un hueco de accesibilidad real además de impedir que las pruebas los encontraran. Se agregó Playwright (`FASE 2/frontend/e2e/`) con 6 pruebas de punta a punta contra el stack completo en Docker, no contra mocks: el flujo de compra completo, el carrito, el perfil, y que las 13 pantallas del backoffice carguen con datos reales. El detalle completo está en [`PENDIENTES-BACKOFFICE.txt`](FASE%202/PENDIENTES-BACKOFFICE.txt).

## Fase 3 — Despliegue, crédito, integraciones y pruebas (7 – 14 de octubre de 2026)

**7 de octubre.** Se preparó el despliegue en Render: el puerto sale de una variable de entorno y `DATABASE_URL` se traduce a las propiedades de Spring. Se agregó el blueprint `render.yaml`, el script para aplicar las migraciones a una base administrada y el workflow de CI en GitHub Actions (pruebas del backend, del frontend y el stack completo en Docker).

**8 de octubre.** La base de Render se cambió por Neon, y el archivo de intercambio con el ERP puede subirse a Cloudflare R2 porque el disco de Render no persiste. Se agregó el login y registro real de cliente, con 5 cuentas de demo (antes había un solo "Cliente invitado" compartido), `iniciar.sh` con `RESET_SEED` y `DATOS_SEED.md`. Los Dockerfile se movieron a la raíz porque Render no resolvía la ruta con espacio de `FASE 2`. Después del merge, el frontend dejó de apuntar al nombre interno del backend y usa su URL pública (`BACKEND_URL`), porque un servicio gratuito de Render no recibe tráfico por la red privada.

**10 de octubre.** Se integró el resto del backend de la Fase 2: Kafka, los seis proveedores externos dockerizados, evaluación y checkout de crédito, devoluciones, conciliación con el ERP, permisos por rol, reservas con stock repartido, ubicaciones, traslados y transporte alternativo (migraciones V10 a V21). Se agregaron las pantallas correspondientes y pruebas de compra, permisos, concurrencia y caídas de proveedores.

**12 de octubre.** Se construyó la verificación automática de la Fase 3: pruebas unitarias y de integración de crédito, escenarios E2E, carga y estrés en un entorno Docker aislado, tokens simulados corregidos con pruebas de regresión y la integración al CI. Se documentaron el plan, la matriz de trazabilidad, los manuales y la evidencia de 242 pruebas.

**13 de octubre.** Se agregó el manual técnico del sistema en `FASE 3/DOCUMENTACION/`. El despliegue del backend en Render quedó fallando en el health check porque la base de Neon no tenía las migraciones nuevas; se aplicaron a mano con `aplicar-migraciones-nube.sh` (versiones 1 a 21).

**14 de octubre.** Los servicios de Render pasaron a `autoDeployTrigger: checksPass`: Render solo despliega un commit de `develop` cuando todos los checks del CI pasan. Se reescribió el manual técnico para que describa lo implementado (monolito modular con Kafka y crédito propio, en lugar de microservicios y Kubernetes), se agregó el manual de usuario con capturas en `FASE 3/DOCUMENTACION/`, y se documentó la arquitectura de la fase en `FASE 3/DDA/`. Las guías de las pruebas se renombraron para no confundirse con los manuales. Se documentaron siete flujos del camino feliz (compra con tarjeta, entrega, devolución, compra a crédito, venta asistida, traslado y consultas del personal) en `FASE 3/FLUJOS/`, con diagramas y capturas tomadas de una ejecución real del sistema completo.

## Lo que queda pendiente

- Pruebas unitarias de Order Query/consulta de estado y de los adaptadores de integración (ERP, POS) más allá de los servicios ya cubiertos.
- Pruebas de Vitest para los repositorios HTTP agregados en la segunda auditoría (factura, notificaciones del cliente, integraciones, notificaciones y facturas del backoffice); hoy solo quedan cubiertos por Playwright.
- Revisión visual de cada pantalla en el navegador (layout, responsive) — Playwright confirma que funcionan, no que se vean bien.
- Confirmar si existe un tablero Kanban activo y mantenido (GitHub Projects, Trello u otro) — no se pudo verificar desde el repositorio.
- Sin actividad de Carmen María Marroquín Llamas registrada en el historial de commits de Fase 2, pese a tener asignada la documentación, Docker y las pruebas E2E; ver Sprint Retrospective (Sprint 3) en el documento de Scrum para el detalle.

# Despliegue en Render + Neon + Cloudflare R2

`render.yaml` (en la raíz) levanta el backend (Spring Boot) y el frontend (React servido con
nginx) como dos servicios de Render, usando `Dockerfile.backend` y `Dockerfile.frontend` (en la
raíz del repo, no dentro de `FASE 2/backend` o `FASE 2/frontend`: Render no resuelve bien una
ruta con espacio como "FASE 2" en `dockerfilePath`/`dockerContext`) — son los mismos Dockerfile
que usa `docker-compose` en local (ver `FASE 2/docker-compose.yml`), Render no construye nada
distinto de lo que ya se construye en local. La base de datos es **Neon** (<https://neon.com>), no un recurso de Render:
por eso `render.yaml` no tiene una sección `databases`. El archivo que el backend deja para que
el ERP lo recoja (ver más abajo) se guarda en **Cloudflare R2**, tampoco un recurso de Render.

## Local vs. la nube: un solo interruptor

No hay que elegir entre "modo local" y "modo nube" en ningún lado del código. Hay dos variables
de entorno, cada una resuelve una cosa distinta:

- **`DB_PORT`** (ya existía, no es nuevo de esta rama) cambia el puerto en el que
  `docker-compose` publica Postgres **en el host local**, nada más. Sirve para no chocar con
  otro Postgres que ya esté corriendo en la máquina:
  ```bash
  DB_PORT=5435 docker compose up -d
  ```
  Esto no toca cómo se conecta el backend a la base — el backend y la base hablan por la red
  interna de docker-compose, siempre en el puerto 5432 real del contenedor.

- **`DATABASE_URL`** es el interruptor entre "base local" y "base en la nube" para el
  **backend**. Si existe, el backend se conecta con eso y ya (Neon, o cualquier otro Postgres);
  si no existe, usa `DB_HOST`/`DB_PORT`/`DB_APP_USER`/etc. como en local. Nunca las dos a la vez.
  La pieza que lo resuelve es
  `FASE 2/backend/src/main/java/com/sgologic/config/DatabaseUrlEnvironmentPostProcessor.java`:
  traduce la cadena de conexión de Neon (que trae usuario y clave embebidos, formato
  `postgresql://usuario:clave@host/base?sslmode=require&channel_binding=require`) a
  `spring.datasource.url/username/password`, porque el driver de PostgreSQL JDBC —a diferencia
  de `psql`— no acepta usuario y clave dentro de la URL.

En Render, `DATABASE_URL` se define en el dashboard del backend (`sync: false` en `render.yaml`,
que es la forma de decirle a Render "esto no lo generas tú, lo pega la persona"). Para probar el
mismo camino en la propia máquina sin tocar nada del compose, basta con:
```bash
DATABASE_URL="postgresql://usuario:clave@host/base?sslmode=require" java -jar app.jar
```

## Por qué R2 y no el filesystem del contenedor

`ErpDropClient` deja un archivo (CSV o XML, según `sgologic.erp.format`) para que el ERP-Core
AS/400 lo recoja (ADR-0003) — hoy, en local, lo escribe dentro del propio contenedor del backend
(`/app/erp-out`). Eso funciona en docker-compose porque el volumen vive mientras el contenedor
vive, pero en Render el filesystem de un servicio **no persiste entre despliegues** (ni entre
reinicios por inactividad): el próximo deploy borra lo que se haya escrito. `ErpFileStorage`
(`FASE 2/backend/src/main/java/com/sgologic/external/`) es la pieza que resuelve esto — igual
que con `DATABASE_URL`, es un interruptor por presencia de variable, no una bandera a elegir:

- Si **no** existe `R2_BUCKET`, se usa `LocalErpFileStorage` — el comportamiento de siempre,
  nada cambia en local ni en CI.
- Si existe, se usa `R2ErpFileStorage`: sube el archivo a un bucket de Cloudflare R2 con el SDK
  de S3 (R2 expone una API compatible), usando `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY` y `R2_BUCKET`.

### Crear el bucket y el token en Cloudflare

1. **Crear el bucket.** [dash.cloudflare.com](https://dash.cloudflare.com) → R2 Object Storage →
   Create bucket. Nombre sugerido: `sgologic-erp` (no hay que hacerlo coincidir con nada del
   código, va en `R2_BUCKET`). No pide tarjeta para el plan gratuito.
2. **Copiar el Account ID.** Aparece en la misma página de R2 (columna derecha, "Account
   details") — va en `R2_ACCOUNT_ID`. No es el nombre del bucket ni el de la cuenta, es un id
   hexadecimal.
3. **Crear un API token de R2** (no el Global API Key, que es de toda la cuenta). En la misma
   página de R2 → "Manage API tokens" → Create API token. Permiso "Object Read & Write",
   restringido al bucket del paso 1 si la UI lo permite. Al crearlo muestra **una sola vez**
   `Access Key ID` y `Secret Access Key` — van en `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY`.
4. **Pegar las cuatro variables en Render**, igual que `DATABASE_URL`: al aplicar o actualizar el
   blueprint, Render las pide porque están con `sync: false`.

Si se prefiere no configurar R2 todavía, no pasa nada: el backend sigue escribiendo a
`/app/erp-out` dentro del contenedor y todo lo demás funciona igual — simplemente ese archivo en
particular no sobrevive al siguiente deploy.

## Por qué Neon y no el Postgres de Render

El plan gratuito de Postgres de Render **expira 30 días después de creado** y no tiene
respaldos. Neon, en su plan gratuito, no expira: solo apaga el cómputo tras 5 minutos sin uso
(primer query después de eso tarda un poco más mientras arranca de nuevo) y tiene 1 GB de
almacenamiento por proyecto. Para una demo de un proyecto académico que no se usa todo el
tiempo, eso es justamente lo que conviene.

## Pasos

1. **Crear el proyecto en Neon.** [console.neon.tech](https://console.neon.tech) → New Project.
   No pide tarjeta. Nombre de la base: `sgologic` (o el que se quiera, no hay que hacerlo
   coincidir con nada del código).
2. **Copiar la cadena de conexión.** Neon la muestra en el dashboard del proyecto
   ("Connection string"). La que se ve por defecto ya es la agrupada (`-pooler` en el host), que
   es la que Neon recomienda para una aplicación de servidor como esta. Trae usuario, clave,
   host, base y `?sslmode=require&channel_binding=require` — se copia completa, tal cual.
3. **Aplicar las migraciones (una sola vez).** Desde una máquina con `psql`:
   ```bash
   FASE\ 2/db/scripts/aplicar-migraciones-nube.sh "<cadena-de-conexion-de-neon>"
   ```
   Deja el esquema completo, el catálogo de prueba y el usuario de personal `admin` / `admin123`.
4. **Crear el bucket y el token en Cloudflare R2** (opcional, pasos detallados arriba) — si se
   salta este paso, el blueprint igual se aplica, solo que el archivo del ERP no sobrevive a un
   redeploy.
5. **Conectar el repositorio a Render.** render.com → New → Blueprint. Render detecta
   `render.yaml` y propone crear `sgologic-backend` y `sgologic-frontend`.
6. **Pegar los secretos.** Al aplicar el blueprint, Render pide el valor de cada variable con
   `sync: false`: `DATABASE_URL` (la cadena de Neon del paso 2), `BACKEND_URL` (la URL pública del backend,
   p. ej. `https://sgologic-backend.onrender.com`; si Render le puso otro nombre, se copia de
   su pantalla; si no se conoce aún, se deja en blanco y se completa después en Environment del
   frontend) y, si se hizo el paso 4,
   `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET`. `JWT_SECRET` lo genera
   Render solo (`generateValue: true`); no hay que escribirlo a mano.
7. **Esperar el deploy** de los dos servicios y abrir la URL del frontend
   (`https://sgologic-frontend.onrender.com` o el nombre que Render asigne). El catálogo y el
   login de personal deberían funcionar igual que en `http://localhost:8081` en local.
8. **Activar el deploy automático por commit** (opcional, pasos detallados abajo en
   "CI/CD: de cada commit al deploy real") — sin esto, cada deploy a Render se dispara a mano
   desde su dashboard.

## Qué cambia frente a docker-compose

- **Un solo usuario de base.** En local hay dos (`sgologic`, dueño de la base y de las
  migraciones, y `sgologic_app`, de solo lectura salvo lo que necesita escribir). Neon, igual que
  el Postgres de Render, da un solo usuario por base, así que el backend se conecta con ese mismo
  usuario para todo. Es una reducción real del aislamiento que tiene local — se documenta aquí en
  vez de escondérsela — aceptable para una demo, no para producción.
- **El frontend ya no apunta a `backend:8080`.** Ese nombre solo resuelve dentro de la red de
  docker-compose. `FASE 2/frontend/nginx.conf.template` usa `${BACKEND_URL}` en su lugar, y
  la imagen oficial de nginx lo resuelve con `envsubst` al arrancar el contenedor (mecanismo de
  `/etc/nginx/templates/`, no un script propio). En Render esa variable es la URL pública del
  backend (`https://sgologic-backend.onrender.com` o la que asigne Render), que se pega a mano
  en el dashboard del frontend; la dirección interna no sirve porque un servicio gratuito no
  recibe tráfico por la red privada.
- **Las migraciones no se aplican solas.** El mecanismo que las corre en local
  (`docker-entrypoint-initdb.d`) es específico del contenedor oficial de Postgres que uno mismo
  arranca; ni Neon ni ninguna base administrada lo tiene. Se aplican una sola vez, a mano, con el
  script del paso 3.

## Límites de los planes gratuitos (importante)

- **Neon:** 1 GB de almacenamiento por proyecto, el cómputo se apaga a los 5 minutos sin uso
  (vuelve a arrancar solo con la siguiente consulta, sin intervención). No expira.
- **Render (los dos servicios web):** se duermen tras 15 minutos sin tráfico y tardan unos
  segundos en volver a responder a la primera visita después de eso. Máximo 750 horas de
  servicio gratis por cuenta al mes, compartidas entre todos los servicios gratuitos de la
  cuenta.
- **Cloudflare R2:** 10 GB de almacenamiento gratis al mes, 1 millón de operaciones de escritura
  y 10 millones de lectura gratis al mes. No expira. A diferencia de S3, R2 no cobra por sacar
  datos (egress), que es justamente lo que hace el backend al subir cada archivo.

Ninguno de estos límites es un defecto de esta configuración: son de los planes gratuitos y
están pensados para pruebas, no para producción.

## CI/CD: de cada commit al deploy real

`.github/workflows/ci.yml` corre en cada push a `develop` y a las ramas `feature/**`, y en cada
pull request hacia `develop`. Tiene tres etapas:

- **Build y pruebas rápidas** (`backend` y `frontend`): JUnit del backend; tsc, Vitest, oxlint y
  build del frontend.
- **Pruebas de la Fase 3** (`e2e`, solo si las dos anteriores pasan): integración, carga, estrés,
  caídas de proveedores y E2E con Playwright, contra el docker-compose completo (ver
  `FASE 3/README.md`).
- **Deploy** (`deploy`, solo en un push a `develop` y solo si `e2e` pasó): aplica las migraciones
  pendientes a Neon, dispara el deploy de los dos servicios de Render y espera a que el backend
  responda 200.

El gate "no hay deploy si las pruebas fallan" lo da `needs: [e2e]` en el job de deploy. Para que
sea real, los servicios de Render tienen `autoDeployTrigger: off` en `render.yaml`: Render ya no
despliega por su cuenta cada commit, y la única forma de llegar a producción es este job. Si un
secreto falta, el job falla con un mensaje claro en vez de saltarse el deploy en silencio.

### Configurar el deploy (una sola vez)

1. **Aplicar el blueprint** (pasos 4-5 de arriba). Si los servicios ya existían, en Render →
   Blueprints → el blueprint → *Manual sync* para que tome `autoDeployTrigger: off`.
2. **Copiar el Deploy Hook de cada servicio.** Dashboard de Render → el servicio
   (`sgologic-backend` o `sgologic-frontend`) → Settings → Deploy Hook.
3. **Guardar estos secretos en el repositorio** (Settings → Secrets and variables → Actions →
   *Secrets*):
   - `RENDER_DEPLOY_HOOK_BACKEND` y `RENDER_DEPLOY_HOOK_FRONTEND`.
   - `DATABASE_URL`: la misma cadena de Neon que está en Render, copiada aparte (GitHub Actions
     no puede leer los secretos de Render).
   - `DB_APP_PASSWORD`: la clave del rol `sgologic_app`; el script de migraciones la asigna en
     cada corrida.
4. **Guardar esta variable** (pestaña *Variables*, no es sensible):
   `DEPLOY_HEALTH_URL` = `https://sgologic-backend.onrender.com/api/products` (o la URL real del
   backend). Con ella el job espera hasta 20 minutos a que la versión nueva responda 200; sin
   ella termina apenas dispara los deploys.

### Migraciones en cada deploy

Antes de disparar el deploy, el job corre `FASE 2/db/scripts/aplicar-migraciones-nube.sh`. Es
incremental: lleva el registro en `public.schema_migration` y solo aplica las versiones que
faltan, sin borrar datos. Así un backend nuevo no arranca contra un esquema viejo, que fue lo que
hizo fallar el health check de los deploys del 12 y 13 de octubre.

### Reiniciar la base de Neon en un deploy (opcional)

`iniciar.sh` tiene `RESET_SEED` para borrar y recrear la base local antes de levantar el stack
(ver más arriba). El job `deploy` tiene el mismo interruptor para Neon: `RESET_SEED_CLOUD`, una
**variable** del repositorio en `true` o `false`.

**Importante**: en local, `RESET_SEED=true` borra un contenedor propio; aquí borra **la base de
Neon de verdad**. Si se deja en `true`, cada push a `develop` vuelve a borrar lo que se haya
probado. Sirve para dejar un punto de partida limpio antes de una demo, y hay que volver a
ponerla en `false` después. Con `true` corre `reiniciar-base-nube.sh` (borra los esquemas con
`drop schema ... cascade` y reaplica todas las migraciones) en lugar del script incremental.

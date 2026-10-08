# Despliegue en Render + Neon

`render.yaml` (en la raíz) levanta el backend (Spring Boot) y el frontend (React servido con
nginx) como dos servicios de Render, usando exactamente los `Dockerfile` que ya existen en
`FASE 2/backend` y `FASE 2/frontend` — Render no construye nada distinto de lo que ya se
construye en local. La base de datos es **Neon** (<https://neon.com>), no un recurso de Render:
por eso `render.yaml` no tiene una sección `databases`.

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
4. **Conectar el repositorio a Render.** render.com → New → Blueprint. Render detecta
   `render.yaml` y propone crear `sgologic-backend` y `sgologic-frontend`.
5. **Pegar `DATABASE_URL`.** Al aplicar el blueprint, Render pide el valor de las variables con
   `sync: false` — ahí va la misma cadena de conexión de Neon del paso 2. `JWT_SECRET` lo genera
   Render solo (`generateValue: true`); no hay que escribirlo a mano.
6. **Esperar el deploy** de los dos servicios y abrir la URL del frontend
   (`https://sgologic-frontend.onrender.com` o el nombre que Render asigne). El catálogo y el
   login de personal deberían funcionar igual que en `http://localhost:8081` en local.

## Qué cambia frente a docker-compose

- **Un solo usuario de base.** En local hay dos (`sgologic`, dueño de la base y de las
  migraciones, y `sgologic_app`, de solo lectura salvo lo que necesita escribir). Neon, igual que
  el Postgres de Render, da un solo usuario por base, así que el backend se conecta con ese mismo
  usuario para todo. Es una reducción real del aislamiento que tiene local — se documenta aquí en
  vez de escondérsela — aceptable para una demo, no para producción.
- **El frontend ya no apunta a `backend:8080`.** Ese nombre solo resuelve dentro de la red de
  docker-compose. `FASE 2/frontend/nginx.conf.template` usa `${BACKEND_HOSTPORT}` en su lugar, y
  la imagen oficial de nginx lo resuelve con `envsubst` al arrancar el contenedor (mecanismo de
  `/etc/nginx/templates/`, no un script propio). `render.yaml` llena esa variable con la
  dirección interna real del servicio del backend en Render.
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

Ninguno de estos límites es un defecto de esta configuración: son de los planes gratuitos y
están pensados para pruebas, no para producción.

## CI antes de llegar aquí

`.github/workflows/ci.yml` corre en cada commit de `feature/202200389-deploy-render`: pruebas del
backend (JUnit), del frontend (tsc, Vitest, oxlint, build) y, si esas dos pasan, el stack
completo en Docker con la suite de Playwright (`FASE 2/frontend/e2e/`) contra contenedores reales
— el mismo docker-compose que corre en local, no un simulacro. Eso es lo que da confianza de que
lo que Render va a construir funciona, antes de aplicar el blueprint.

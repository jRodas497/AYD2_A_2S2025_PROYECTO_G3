# Despliegue en Render

`render.yaml` (en la raíz) describe el mismo sistema que `FASE 2/docker-compose.yml`, pero como
tres servicios separados de Render en vez de tres contenedores de un mismo compose: una base de
datos administrada, el backend (Spring Boot) y el frontend (React servido con nginx). Los dos
usan exactamente los `Dockerfile` que ya existen en `FASE 2/backend` y `FASE 2/frontend`; Render
no construye nada distinto de lo que ya se construye en local.

## Qué cambia frente a docker-compose

- **Un solo usuario de base.** En local hay dos (`sgologic`, dueño de la base y de las
  migraciones, y `sgologic_app`, de solo lectura salvo lo que necesita escribir). Render da un
  solo usuario por base administrada, así que el backend se conecta con ese usuario para todo.
  Es una reducción real del aislamiento que tiene local — se documenta aquí en vez de
  escondersela — aceptable para una demo de un proyecto académico, no para producción.
- **El backend recibe `DATABASE_URL`, no `DB_HOST`/`DB_APP_USER`/etc.** Render solo expone la
  cadena de conexión completa (`postgresql://usuario:clave@host:puerto/base`) por variable de
  entorno, nunca el host o el puerto por separado. El driver de PostgreSQL JDBC, a diferencia de
  `psql`, no acepta usuario y clave dentro de la URL. `DatabaseUrlEnvironmentPostProcessor`
  (`FASE 2/backend/src/main/java/com/sgologic/config/`) traduce `DATABASE_URL` a
  `spring.datasource.url/username/password` antes de que Spring arranque. Si `DATABASE_URL` no
  existe (local, CI), no hace nada y todo sigue como siempre con `DB_HOST` y el resto.
- **El frontend ya no apunta a `backend:8080`.** Ese nombre solo resuelve dentro de la red de
  docker-compose. `FASE 2/frontend/nginx.conf.template` usa `${BACKEND_HOSTPORT}` en su lugar, y
  la imagen oficial de nginx lo resuelve con `envsubst` al arrancar el contenedor (mecanismo de
  `/etc/nginx/templates/`, no un script propio). `render.yaml` llena esa variable con la
  dirección interna real del servicio del backend en Render.
- **Las migraciones no se aplican solas.** El mecanismo que las corre en local
  (`docker-entrypoint-initdb.d`) es específico del contenedor oficial de Postgres que uno mismo
  arranca; una base administrada de Render no lo tiene. Se aplican una sola vez, a mano, con el
  script de abajo.

## Pasos

1. **Cuenta y repositorio.** Conectar este repositorio de GitHub a Render (render.com → New →
   Blueprint). Render detecta `render.yaml` y propone crear los 3 recursos.
2. **Confirmar el blueprint.** Revisar los nombres y aplicar. Render crea `sgologic-db` primero;
   los dos servicios web quedan esperando el primer build.
3. **Aplicar las migraciones (una sola vez).** En el dashboard de `sgologic-db`, copiar la
   "External Connection String" y correr, desde una máquina con `psql`:
   ```
   FASE\ 2/db/scripts/aplicar-migraciones-render.sh "<connection-string-externa>"
   ```
   Deja el esquema completo, el catálogo de prueba y el usuario de personal `admin` / `admin123`.
4. **Esperar el deploy de `sgologic-backend` y `sgologic-frontend`.** Render construye cada
   `Dockerfile` y los levanta. `JWT_SECRET` lo genera Render solo (`generateValue: true`); no hay
   que escribirlo a mano.
5. **Abrir la URL del frontend** (`https://sgologic-frontend.onrender.com` o el nombre que Render
   asigne). El catálogo y el login de personal deberían funcionar igual que en
   `http://localhost:8081` en local.

## Límites del plan gratuito (importante)

- La base de datos gratuita **expira 30 días después de creada** y no tiene respaldos. Pasado
  ese plazo hay que crear una nueva y volver a correr el script de migraciones (o pasar a un
  plan pago antes de que expire).
- Los servicios web gratuitos **se duermen tras 15 minutos sin tráfico** y tardan unos segundos
  en volver a responder a la primera visita después de eso.
- Hay un máximo de 750 horas de servicio gratis por cuenta al mes, compartidas entre todos los
  servicios gratuitos de la cuenta.

Ninguno de estos límites es un defecto de esta configuración: son del plan gratuito de Render y
están pensados para pruebas, no para producción.

## CI antes de llegar aquí

`.github/workflows/ci.yml` corre en cada commit de `feature/202200389-deploy-render`: pruebas del
backend (JUnit), del frontend (tsc, Vitest, oxlint, build) y, si esas dos pasan, el stack
completo en Docker con la suite de Playwright (`FASE 2/frontend/e2e/`) contra contenedores reales
— el mismo docker-compose que corre en local, no un simulacro. Eso es lo que da confianza de que
lo que Render va a construir funciona, antes de aplicar el blueprint.

# En la raíz (no dentro de "FASE 2/frontend") por la misma razón que Dockerfile.backend: Render
# no resuelve bien una ruta con espacio ("FASE 2"). Contexto de build = raíz del repo (ver
# render.yaml y docker-compose.yml, que usan este mismo archivo en Render y en local).
FROM node:22-alpine AS build
WORKDIR /app
COPY ["FASE 2/frontend/package.json", "FASE 2/frontend/package-lock.json", "./"]
RUN npm ci
COPY ["FASE 2/frontend/", "."]
RUN npm run build

FROM nginx:1.27-alpine
# default.conf.template: la imagen oficial lo resuelve con envsubst al arrancar, antes de leerlo
# como configuración real (ver FASE 2/frontend/nginx.conf.template para el detalle de por qué es seguro).
COPY ["FASE 2/frontend/nginx.conf.template", "/etc/nginx/templates/default.conf.template"]
COPY --from=build /app/dist /usr/share/nginx/html
# Hace que el entrypoint de nginx exporte NGINX_LOCAL_RESOLVERS (DNS del contenedor), que usa la
# plantilla en la directiva resolver.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
EXPOSE 80

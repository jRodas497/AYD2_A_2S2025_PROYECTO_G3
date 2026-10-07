FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# default.conf.template: la imagen oficial lo resuelve con envsubst al arrancar, antes de leerlo
# como configuración real (ver nginx.conf.template para el detalle de por qué es seguro).
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

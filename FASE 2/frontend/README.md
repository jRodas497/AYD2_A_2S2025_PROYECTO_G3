# Frontend de SGO-Logic

Aplicación web de MegaStore construida con React 19, TypeScript, Vite y Tailwind. Tiene dos áreas
sobre la misma API del backend.

| Área | Ruta | Para quién |
|---|---|---|
| Tienda | `/catalogo`, `/carrito`, `/checkout`, `/ordenes/{id}`, `/mis-ordenes` | El cliente: catálogo, carrito, compra, pago y seguimiento de sus órdenes |
| Backoffice | `/administracion/...` | El personal: dashboard, órdenes, incidencias, devoluciones, inventario, reservas, logística, seguimiento, clientes, auditoría, reportes y configuración |

El cliente entra como invitado: al abrir la tienda se crea un cliente en el backend y su id se
guarda en el navegador. El personal inicia sesión en `/administracion/login` (`admin` / `admin123`
en desarrollo). Sin sesión, el backoffice muestra los datos, pero las acciones protegidas
(procesar incidencias, cambiar parámetros, gestionar usuarios) piden iniciar sesión.

## Levantarlo

Con Docker, junto con la base y el backend, desde `FASE 2`:

```
docker compose up -d --build
```

Queda en `http://localhost:8081`. El contenedor compila la aplicación y la sirve con nginx, que
reenvía `/api` al backend.

Para desarrollar, con Node 22 y el backend del compose corriendo:

```
npm install
npm run dev
```

Queda en `http://localhost:5173`, con recarga en caliente. El servidor de Vite reenvía `/api` a
`http://localhost:8080`.

## Comandos

```
npm run build     # verifica tipos y genera dist/
npm test          # pruebas con Vitest (requiere Node 22)
npm run lint      # oxlint
```

Para correr las pruebas sin instalar Node 22:

```
docker run --rm -v "$PWD":/app -v /app/node_modules -w /app node:22 sh -c "npm ci && npx vitest run"
```

## Estructura

```
src/
├── app/          rutas y navegación
├── features/     una carpeta por dominio (catalogo, carrito, checkout, orden, pago, cliente, backoffice/...)
└── shared/       cliente HTTP y manejo de errores, componentes, contextos de cliente y de sesión
```

Cada dominio accede a la API a través de un repositorio (`api/*Repository.http.ts`) con una
interfaz propia, así las páginas no conocen las URL ni el formato del backend. Los errores HTTP se
traducen en un solo lugar (`shared/api/httpErrors.ts`).

Algunos dominios conservan una implementación `*.mock.ts` de la etapa en que el backend todavía
no existía; las páginas usan las implementaciones HTTP. La excepción es Promociones, que sigue en
mock porque el backend no tiene el servicio de precios y promociones.

## Documentación

En `docs/` están las decisiones del stack (`decisiones-stack.md`), los contratos de cada servicio
que consume el frontend (`contratos-api/`), los escenarios que cubrían los mocks
(`escenarios-mock.md`) y la lista de verificación manual (`checklist-verificacion.md`). La API
completa del backend está en `../backend/API.md` y `../backend/API-Transacciones.md`.

# Checklist de verificación por pantalla (PB-032 — parte Frontend 1)

Plantilla por pantalla: marcar cada RF de su historia y el RNF aplicable antes de dar la historia por terminada.

## Catálogo (`/catalogo`) — PB-001, PB-035, PB-036

- [x] Cubre línea blanca, electrónica, ropa y calzado (RF PB-001.1)
- [x] El precio mostrado incluye promociones vigentes (RF PB-001.2 / PB-036.2)
- [x] La búsqueda filtra por nombre y por categoría (RF PB-035.1)
- [x] RNF: la carga de productos no bloquea el resto de la pantalla (buscador y filtros siguen interactivos mientras `cargando` es true)

## Detalle de producto (`/productos/:id`) — PB-035

- [x] Muestra descripción, precio vigente y disponibilidad (RF PB-035.2)
- [x] Desde el detalle se puede agregar al carrito (RF PB-035.3)

## Promociones (`/promociones`) — PB-036

- [x] Las promociones vigentes se listan (RF PB-036.1)

## Carrito (`/carrito`) — PB-002, PB-003

- [x] Agregar un producto verifica disponibilidad en tiempo real antes de reservar (RF PB-002.3)
- [x] Si la reserva falla, se muestra el motivo y una sugerencia (RF PB-003.1, PB-003.2)
- [x] El resto del carrito no se ve afectado cuando un producto falla al agregarse (RF PB-003.3)
- [x] El carrito persiste tras recargar la página, dentro del mismo navegador (simulación local de "el carrito es del cliente" — pendiente de validar cross-device con backend real)

## Hallazgos pendientes de este plan

- La sugerencia de producto/tienda alternativa en PB-003 es un texto fijo de demo — falta contrato real del backend para dato dinámico (ver `docs/contratos-api/catalog-service.md`).

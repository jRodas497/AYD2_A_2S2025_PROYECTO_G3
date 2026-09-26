# Contrato real — Catalog / Product Service

> Consumido por `httpCatalogRepository` (`src/features/catalogo/api/catalogRepository.http.ts`). El frontend llama directo al backend (Backend 1) vía el proxy de desarrollo de Vite (`/api/*` → `http://localhost:8080`) — no existe un BFF de agregación; el supuesto original de este documento (agregación por BFF) no se cumplió.

## `GET /api/products`

Lista los productos activos. **Response 200:**
```json
[{ "id": 1, "sku": "LB-003", "name": "Estufa de 4 quemadores", "category": "LINEA_BLANCA", "price": 2100.00, "active": true }]
```

## `GET /api/products/{id}`

Un producto, mismo shape. **Response 404** si no existe — `httpCatalogRepository.getById` lo traduce a `null`.

## `GET /api/inventory/products/{id}/availability`

Llamada aparte (no viene agregada en el producto). **Response 200:**
```json
{ "productId": 1, "totalAvailable": 920, "byLocation": [{ "locationCode": "CD-01", "locationName": "Centro de distribución 1", "available": 199 }] }
```
`disponible = totalAvailable > 0`. `list()` la pide en paralelo para cada producto — a la escala actual (12 productos sembrados) el costo es insignificante; si el catálogo real crece mucho, esto necesitará un endpoint de disponibilidad en lote.

## Limitaciones conocidas (no son errores de implementación, son huecos reales del backend actual)

- **Sin búsqueda en el backend.** No existe un `GET /api/products?search=...`. `search()` pide el catálogo completo y filtra en el cliente (mismo criterio que ya usaba el mock). No escala si el catálogo crece mucho más allá de la demo.
- **Sin descripción de producto.** El backend no devuelve ningún campo de descripción — `Product.descripcion` queda siempre `''` contra el backend real. `ProductDetailPage` sigue reservando el espacio, pero no muestra texto.
- **Sin promociones.** No existe Pricing & Promotions Service — `precio.promocion` queda siempre `undefined`, `precio.original === precio.final` siempre.
- La sugerencia de producto/tienda alternativa en PB-003 (cuando un producto no tiene existencia) sigue siendo un texto fijo de demo en `ProductDetailPage` — no hay ningún endpoint, real o asumido, que la provea todavía.

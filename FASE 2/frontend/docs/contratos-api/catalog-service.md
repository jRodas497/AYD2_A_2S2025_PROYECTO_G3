# Contrato asumido — Catalog / Product Service (vía BFF)

> Consumido hoy por `mockCatalogRepository` (`src/features/catalogo/api/catalogRepository.mock.ts`). El frontend nunca llama a Catalog/Product Service directamente — todo pasa por el API Gateway/BFF Omnicanal.

## Supuesto de agregación (a validar con Backend 1)

Se asume que el BFF agrega, en una sola respuesta por producto, el precio con descuento (Pricing & Promotions Service) y la disponibilidad (Inventory Service). Si Backend decide no agregar, el frontend necesita 2-3 llamadas por pantalla en vez de una — el cambio queda aislado en `useCatalogo`/`useProducto` sin tocar componentes de UI.

## `GET /bff/catalog?search={texto}&categoria={categoria}`

**Response 200**
```json
{
  "productos": [
    {
      "id": "string",
      "sku": "string",
      "nombre": "string",
      "categoria": "linea_blanca | electronica | ropa | calzado",
      "precio": { "original": 0, "final": 0, "promocion": "string | null" },
      "disponible": true,
      "disponibilidadMotivo": "string | null"
    }
  ]
}
```

## `GET /bff/catalog/{id}`

**Response 200:** mismo shape de un producto individual, más `descripcion: string`.
**Response 404:** producto no existe.

## Caso de excepción — producto sin disponibilidad (PB-003)

Cuando `disponible: false`, se asume que `disponibilidadMotivo` viene poblado por el backend con el motivo (ej. "Sin existencia en el centro de distribución más cercano"). La sugerencia de alternativa/tienda cercana (PB-003 AC2) **no está en este contrato todavía** — el mock la muestra como texto fijo de demo; falta que Backend defina si esa sugerencia viaja en este mismo response o en un endpoint aparte.

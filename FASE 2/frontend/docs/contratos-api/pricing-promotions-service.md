# Contrato asumido — Pricing & Promotions Service (vía BFF)

> Consumido hoy por `mockPricingRepository` (`src/features/catalogo/api/pricingRepository.mock.ts`).

## `GET /bff/promotions`

Lista de promociones vigentes, para la pantalla de Promociones (PB-036 AC1).

**Response 200**
```json
{
  "promociones": [
    {
      "id": "string",
      "nombre": "string",
      "descripcion": "string",
      "descuentoPorcentaje": 0,
      "categoriasAplicables": ["linea_blanca", "electronica", "ropa", "calzado"]
    }
  ]
}
```

## Relación con el precio embebido en catálogo/carrito

El campo `precio.promocion` que aparece en el contrato de `catalog-service.md` se asume igual al campo `nombre` de la promoción activa aplicada a ese producto — es responsabilidad del backend (Pricing & Promotions Service, posiblemente vía el BFF) resolver qué promoción aplica a cada producto antes de responder al catálogo.

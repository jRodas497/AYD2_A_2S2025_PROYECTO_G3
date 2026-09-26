# Decisiones de stack — Frontend 1 (Cliente / Compra Omnicanal)

Fecha: 2026-09-22 · Rama: `feature/202200389-frontend-cliente-compra`

Este documento registra las decisiones tomadas para el frontend de cliente de SGO-Logic, mientras el backend (Order/Checkout, Catalog, Pricing, Inventory, Customer, Payment, Notification) se construye en paralelo por otro equipo.

## Stack

| Decisión | Elegido | Por qué |
|---|---|---|
| Bundler/framework | **Vite + React (SPA)** | Sin servidor propio: consumimos todo vía API Gateway/BFF externo. Arranque instantáneo, ideal para navegar mocks sin esperar backend. |
| Estado global | **Context API + hooks nativos** | Alcance acotado a carrito + identidad de cliente; sin dependencias externas. |
| Estilos | **Tailwind CSS** | Rapidez para 12 pantallas consistentes. |
| Enrutamiento | **React Router** | Navegación SPA entre pantallas. |
| Capa de mocks | **Mocks locales en TS tras interfaz de repositorio** (no MSW, no json-server) | Cero configuración extra, cero procesos aparte — la prioridad es poder navegar la app completa sin esperar al backend. Cada dominio expone una interfaz de repositorio con una implementación mock hoy, reemplazable por una implementación HTTP el día que existan contratos reales, sin tocar componentes de UI. |
| Testing | **Vitest**, acotado a la lógica de los repositorios mock | Sin React Testing Library — fuera del alcance de Frontend 1 según el backlog. Protege los escenarios (SKU/tarjeta/orden "mágicos", latencia simulada, round-trip de `localStorage`) que el checklist manual de PB-032 no necesariamente detecta. |

## Estructura de carpetas

```
FASE 2/frontend/
├── docs/                    # este archivo, contratos-api/, escenarios-mock.md, checklist-verificacion.md
├── src/
│   ├── app/                 # App.tsx, router.tsx, providers.tsx
│   ├── features/
│   │   ├── catalogo/        # PB-001, PB-035, PB-036
│   │   ├── carrito/         # PB-002, PB-003
│   │   ├── checkout/        # PB-004
│   │   ├── pago/            # PB-010, PB-013, PB-014
│   │   ├── orden/           # PB-023, PB-025, PB-037, PB-038
│   │   ├── perfil/          # PB-039
│   │   └── notificaciones/  # PB-040
│   └── shared/
│       ├── components/      # UI genérica + ReidentifyPrompt (PB-009)
│       ├── context/         # CustomerContext, CartContext
│       ├── mocks/           # datos semilla compartidos
│       └── utils/
```

Notas de asignación (no obvias por el nombre de la carpeta):
- **PB-009** (identificación consistente entre canales) es transversal: vive en `CustomerContext` + `ReidentifyPrompt` (`shared/`), no exclusivo de `checkout/`, porque la reidentificación puede dispararse desde cualquier feature (CDU-01, flujo E2).
- **PB-023** (cambiar entrega post-compra) vive en `orden/`, no en `checkout/`: opera sobre una orden ya confirmada (CDU-04, flujo alterno 1a).

## Reglas que el mock debe respetar (no solo el backend real)

- **Nunca persistir PAN/CVV completo**, ni en `localStorage` de demo — el repositorio mock de pago solo guarda formato enmascarado (`**** 1111`). Esto viene de DC-08/RC06 de Fase 1, y debe cumplirse visualmente en la demo, no solo documentarse como pendiente del backend.
- El carrito persistido en `localStorage` **simula** "el carrito es del cliente, no del canal" dentro del mismo navegador — no es persistencia real cross-device; eso requiere el backend.

## Servicios backend de referencia (para nombrar contratos correctamente)

Del diagrama de componentes de Fase 2 (`FASE 2/DRAWIO/Diagrama-Componentes-SGO-Logic-Fase2.drawio`): API Gateway/BFF Omnicanal, Catalog/Product Service, **Pricing & Promotions Service** (separado de Catalog), Inventory Service, Order/Checkout Service, Payment Service, Customer Service, Notification Service, Identity/Configuration Service, Audit/Traceability & Reporting Service. El frontend solo llama al BFF; los contratos en `docs/contratos-api/` documentan esa vista, con nota explícita cuando se asume agregación de varios servicios en una sola respuesta.

## Riesgos / supuestos abiertos a validar con Backend

- **Agregación de precio/disponibilidad en catálogo**: se asume que el BFF (o Catalog/Product Service internamente) agrega el precio con descuento (Pricing & Promotions Service) y la disponibilidad (Inventory Service) en una sola respuesta, para que el frontend haga una sola llamada por pantalla de catálogo. Si Backend decide no agregar, el hook de catálogo necesita ajustarse a 2-3 llamadas en vez de una.
- **Mecanismo real de reidentificación (PB-009)**: el mock simula la pérdida de sesión de forma determinística; falta que Customer Service confirme qué dato usa realmente para reconocer al cliente entre canales (sesión, teléfono o cuenta).
- **Máximo de reintentos de pago (PB-014)**: lo debe controlar el backend (Payment Service); el mock usa un número fijo configurable como placeholder, a ajustar cuando exista el valor real.

Los "datos mágicos" para navegar los flujos alternos/de excepción sin backend (SKU sin stock, tarjetas de prueba, orden inexistente) están documentados en `escenarios-mock.md`, junto a la regla de que el mock nunca persiste el número de tarjeta completo.

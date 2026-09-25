# Integración real: Carrito, Checkout, Pago y Orden — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar los dominios `carrito`, `checkout`, `pago` y `orden` de `FASE 2/frontend` al backend real de `FASE 2/backend`, reemplazando sus repositorios mock por implementaciones HTTP, y ajustando la UI donde el backend real tiene capacidades distintas (más limitadas en algunos puntos) a lo que el mock asumía.

**Architecture:** Mismo patrón que ya usan `catalogo`/`cliente`: interfaz de repositorio + `.mock.ts` + `.http.ts`, con el hook/página importando la implementación activa. El proxy de Vite (`/api` → `http://localhost:8080`) ya existe. Donde el backend real no soporta una operación que el mock sí (editar carrito, listar órdenes de un cliente, máximo de reintentos de pago), se resuelve dentro del repositorio o con un índice/snapshot local en `localStorage`, sin exponer esa complejidad a las páginas.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind, Vitest para pruebas de repositorio (sin React Testing Library, sigue la convención del proyecto), `fetch` nativo.

**Spec:** `docs/superpowers/specs/2026-09-25-backend-integration-carrito-checkout-pago-orden-design.md`

## Global Constraints

- El proxy de Vite (`/api` → `http://localhost:8080`) ya está configurado en `vite.config.ts` — no se toca en este plan.
- Todo `.http.ts` maneja errores con `manejarRespuesta`/`NotFoundError` de `src/shared/api/httpErrors.ts`.
- Pruebas de red: `vi.spyOn(globalThis, 'fetch')` — nunca `global` (rompe `tsc -b`). Sin librerías de mocking de red nuevas.
- Vocabulario del frontend en español/snake_case (`estado`, `categoria`); el backend usa `UPPER_SNAKE_CASE` — el mapeo ocurre siempre dentro del `.http.ts`, nunca se filtra al resto del código.
- Patrón de repositorio: interfaz + `.mock.ts` + `.http.ts`; los mocks no se borran. Cuando un mock deja de anotarse como `: Interfaz` directamente (por conservar utilidades internas), se exporta con `satisfies Interfaz` — y en ese caso cada método del objeto literal debe anotar explícitamente el tipo de sus parámetros (con `satisfies`, a diferencia de `: Interfaz`, TypeScript no aplica tipado contextual a los parámetros de los métodos, y sin anotación explícita caerían en `any` implícito).
- Sin autenticación/JWT — ningún endpoint de este plan la requiere.
- Sin pruebas de componente (React Testing Library) — la convención del proyecto es Vitest solo sobre lógica pura de repositorio. Los cambios de página/UI se verifican con `npm run build` (`tsc -b`) y `npm test` (regresión), no con pruebas nuevas de componente.
- IDs numéricos del backend (`customerId`, `productId`, id de orden) se convierten con `Number(...)` al armar el request y `String(...)` al mapear la respuesta, igual que ya hacen `catalogRepository.http.ts` y `customerRepository.http.ts`.
- Todos los comandos de este plan se ejecutan desde `FASE 2/frontend/`.

## Review Focus

- `POST /api/customers/{id}/cart/items` responde `404` si el cliente o el producto no existen o el producto está inactivo — `httpCartRepository.addItem` debe lanzar un mensaje claro y accionable, no dejar pasar el `NotFoundError` genérico tal cual (cubierto en Tarea 2).
- `GET /api/customers/{id}/cart` responde `200` con `cartId`/`status`/`channel` en `null` cuando no hay carrito activo — debe tratarse como carrito vacío, no lanzar al leer una respuesta parcialmente nula (cubierto en Tarea 2).
- `POST /api/orders/checkout` puede responder `409` si un producto ya no está activo o se quedó sin stock justo al confirmar (distinto del chequeo ya hecho al agregar al carrito) — el mensaje real del backend debe propagarse sin perderse, para que `CheckoutPage` lo muestre (cubierto en Tarea 1).
- Un cobro con `result: "TIMEOUT"` o `"ERROR"` debe mapearse a `en_proceso`, nunca a `rechazado` — tratarlo como fallo definitivo cortaría un flujo que el backend está resolviendo solo (cubierto en Tarea 3).
- `GET /api/orders/{id}` para una orden que no está en el índice local de este navegador (por ejemplo, abierta por URL desde otro dispositivo) debe seguir devolviendo estado y total reales, solo sin el detalle de ítems — no debe lanzar ni devolver `null` (cubierto en Tarea 1).

---

### Task 1: Dominio Orden — tipos, etiquetas, índice local, snapshot y repositorio (mock + http)

**Files:**
- Modify: `src/features/orden/types.ts`
- Modify: `src/features/orden/estadoLabels.ts`
- Create: `src/features/orden/api/orderIndex.ts`
- Create: `src/features/orden/api/orderIndex.test.ts`
- Create: `src/features/orden/api/orderItemsSnapshot.ts`
- Create: `src/features/orden/api/orderItemsSnapshot.test.ts`
- Modify: `src/features/orden/api/orderRepository.mock.ts`
- Modify: `src/features/orden/api/orderRepository.mock.test.ts`
- Create: `src/features/orden/api/orderRepository.http.ts`
- Create: `src/features/orden/api/orderRepository.http.test.ts`

**Interfaces:**
- Consumes: `CartItem` de `src/features/carrito/types.ts` (ya existe, sin cambios: `{productId, nombre, sku, cantidad, precioUnitario}`); `manejarRespuesta`/`NotFoundError` de `src/shared/api/httpErrors.ts`.
- Produces: `EstadoOrden` (9 valores), `Order` (con `direccionEntrega`, `trackingNumber?`, sin `metodoEntrega`), `CrearOrdenInput` (con `direccionEntrega`, sin `metodoEntrega`), `ETIQUETA_ESTADO`, `ESTADOS_TERMINALES`, `registrarOrden(customerId, orderId)`, `listarIdsOrdenes(customerId)`, `guardarSnapshot(orderId, snapshot)`, `obtenerSnapshot(orderId)`, `mockOrderRepository`/`httpOrderRepository` (ambos implementan `OrderRepository`, sin cambios de firma respecto a hoy: `createOrder`, `getOrder`, `updateEstado`, `listOrders`) — todo esto lo consumen las Tareas 3, 4 y 5.

- [ ] **Step 1: Reescribir `types.ts` con los 9 estados y el campo de dirección**

```ts
import type { CartItem } from '../carrito/types'

export type EstadoOrden =
  | 'pendiente_pago'
  | 'pago_en_proceso'
  | 'pago_fallido'
  | 'pagada'
  | 'facturada'
  | 'en_despacho'
  | 'entregada'
  | 'cancelada'
  | 'devuelta'

export interface Order {
  id: string
  customerId: string
  items: CartItem[]
  total: number
  direccionEntrega: string
  estado: EstadoOrden
  creadaEn: string
  enProcesoDesde?: string
  trackingNumber?: string
}

export interface CrearOrdenInput {
  customerId: string
  items: CartItem[]
  direccionEntrega: string
}
```

Esto reemplaza el `types.ts` completo (elimina `MetodoEntrega`). Al guardar, `tsc -b` fallará hasta el final de esta tarea porque `orderRepository.mock.ts`, su test, `estadoLabels.ts`, `OrderStatusPage.tsx` y `CheckoutPage.tsx` todavía usan `metodoEntrega` — es esperado, se corrige en los siguientes pasos y en las Tareas 4-5. No ejecutes `npm run build` todavía.

- [ ] **Step 2: Reescribir `estadoLabels.ts` con las 9 etiquetas y los estados terminales**

```ts
import type { Order } from './types'

export const ETIQUETA_ESTADO: Record<Order['estado'], { texto: string; tono: 'ok' | 'alerta' | 'falla' | 'info' }> = {
  pendiente_pago: { texto: 'Pendiente de pago', tono: 'alerta' },
  pago_en_proceso: { texto: 'Pago en proceso', tono: 'info' },
  pagada: { texto: 'Pagada', tono: 'ok' },
  pago_fallido: { texto: 'Pago fallido', tono: 'falla' },
  facturada: { texto: 'Factura generada', tono: 'info' },
  en_despacho: { texto: 'En despacho', tono: 'info' },
  entregada: { texto: 'Entregada', tono: 'ok' },
  cancelada: { texto: 'Cancelada', tono: 'falla' },
  devuelta: { texto: 'Devuelta', tono: 'alerta' },
}

export const ESTADOS_TERMINALES: Order['estado'][] = ['entregada', 'cancelada', 'devuelta']
```

- [ ] **Step 3: Escribir las pruebas de `orderIndex.ts` (todavía no existe el archivo)**

Crear `src/features/orden/api/orderIndex.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { listarIdsOrdenes, registrarOrden } from './orderIndex'

describe('orderIndex', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('listarIdsOrdenes retorna [] si el cliente no tiene órdenes registradas', () => {
    expect(listarIdsOrdenes('cliente-x')).toEqual([])
  })

  it('registrarOrden agrega el id a la lista del cliente', () => {
    registrarOrden('cliente-x', 'SGO-000001')
    expect(listarIdsOrdenes('cliente-x')).toEqual(['SGO-000001'])
  })

  it('registrarOrden no duplica un id ya registrado', () => {
    registrarOrden('cliente-x', 'SGO-000001')
    registrarOrden('cliente-x', 'SGO-000001')
    expect(listarIdsOrdenes('cliente-x')).toEqual(['SGO-000001'])
  })

  it('el índice queda aislado por cliente', () => {
    registrarOrden('cliente-a', 'SGO-000001')
    expect(listarIdsOrdenes('cliente-b')).toEqual([])
  })

  it('un valor corrupto en localStorage no lanza excepción, retorna []', () => {
    localStorage.setItem('sgo-order-ids-cliente-x', '{esto no es json')
    expect(listarIdsOrdenes('cliente-x')).toEqual([])
  })
})
```

- [ ] **Step 4: Correr las pruebas y verificar que fallan**

Run: `npx vitest run src/features/orden/api/orderIndex.test.ts`
Expected: FAIL — `orderIndex.ts` no existe todavía.

- [ ] **Step 5: Implementar `orderIndex.ts`**

```ts
function claveDe(customerId: string): string {
  return `sgo-order-ids-${customerId}`
}

export function registrarOrden(customerId: string, orderId: string): void {
  const ids = listarIdsOrdenes(customerId)
  if (ids.includes(orderId)) return
  ids.push(orderId)
  localStorage.setItem(claveDe(customerId), JSON.stringify(ids))
}

export function listarIdsOrdenes(customerId: string): string[] {
  const crudo = localStorage.getItem(claveDe(customerId))
  if (!crudo) return []
  try {
    const valor = JSON.parse(crudo)
    return Array.isArray(valor) ? valor : []
  } catch {
    return []
  }
}
```

- [ ] **Step 6: Correr las pruebas y verificar que pasan**

Run: `npx vitest run src/features/orden/api/orderIndex.test.ts`
Expected: PASS (5 pruebas)

- [ ] **Step 7: Escribir las pruebas de `orderItemsSnapshot.ts`**

Crear `src/features/orden/api/orderItemsSnapshot.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { guardarSnapshot, obtenerSnapshot } from './orderItemsSnapshot'

const ITEM = { productId: '1', nombre: 'Refrigeradora', sku: 'LB-1440', cantidad: 1, precioUnitario: 4999 }

describe('orderItemsSnapshot', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('obtenerSnapshot retorna null si no hay snapshot guardado', () => {
    expect(obtenerSnapshot('SGO-000001')).toBeNull()
  })

  it('guardarSnapshot + obtenerSnapshot hacen un round-trip correcto', () => {
    guardarSnapshot('SGO-000001', { items: [ITEM], direccionEntrega: 'Zona 10' })
    expect(obtenerSnapshot('SGO-000001')).toEqual({ items: [ITEM], direccionEntrega: 'Zona 10' })
  })

  it('el snapshot queda aislado por orden', () => {
    guardarSnapshot('SGO-000001', { items: [ITEM], direccionEntrega: 'Zona 10' })
    expect(obtenerSnapshot('SGO-000002')).toBeNull()
  })

  it('un valor corrupto en localStorage no lanza excepción, retorna null', () => {
    localStorage.setItem('sgo-order-items-SGO-000001', '{esto no es json')
    expect(obtenerSnapshot('SGO-000001')).toBeNull()
  })
})
```

- [ ] **Step 8: Correr las pruebas y verificar que fallan**

Run: `npx vitest run src/features/orden/api/orderItemsSnapshot.test.ts`
Expected: FAIL — `orderItemsSnapshot.ts` no existe todavía.

- [ ] **Step 9: Implementar `orderItemsSnapshot.ts`**

```ts
import type { CartItem } from '../carrito/types'

export interface OrderSnapshot {
  items: CartItem[]
  direccionEntrega: string
}

function claveDe(orderId: string): string {
  return `sgo-order-items-${orderId}`
}

export function guardarSnapshot(orderId: string, snapshot: OrderSnapshot): void {
  localStorage.setItem(claveDe(orderId), JSON.stringify(snapshot))
}

export function obtenerSnapshot(orderId: string): OrderSnapshot | null {
  const crudo = localStorage.getItem(claveDe(orderId))
  if (!crudo) return null
  try {
    return JSON.parse(crudo) as OrderSnapshot
  } catch {
    return null
  }
}
```

- [ ] **Step 10: Correr las pruebas y verificar que pasan**

Run: `npx vitest run src/features/orden/api/orderItemsSnapshot.test.ts`
Expected: PASS (4 pruebas)

- [ ] **Step 11: Commit de tipos, etiquetas, índice y snapshot**

```bash
git add src/features/orden/types.ts src/features/orden/estadoLabels.ts src/features/orden/api/orderIndex.ts src/features/orden/api/orderIndex.test.ts src/features/orden/api/orderItemsSnapshot.ts src/features/orden/api/orderItemsSnapshot.test.ts
git commit -m "feat(orden): amplía EstadoOrden a los 9 estados reales y agrega índice/snapshot local"
```

- [ ] **Step 12: Actualizar `orderRepository.mock.test.ts` para usar `direccionEntrega`**

Reemplazar todo el contenido de `src/features/orden/api/orderRepository.mock.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { mockOrderRepository, ORDERS_STORAGE_KEY, RESOLUCION_EN_PROCESO_MS } from './orderRepository.mock'

const ITEM = { productId: '1', nombre: 'Refrigeradora', sku: 'LB-1440', cantidad: 1, precioUnitario: 4999 }

describe('mockOrderRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('crea una orden en estado pendiente_pago con el total calculado', async () => {
    const orden = await mockOrderRepository.createOrder({
      customerId: 'cliente-x',
      items: [ITEM],
      direccionEntrega: 'Zona 10, Ciudad de Guatemala',
    })
    expect(orden.estado).toBe('pendiente_pago')
    expect(orden.total).toBe(4999)
    expect(orden.direccionEntrega).toBe('Zona 10, Ciudad de Guatemala')
    expect(orden.id).toBeTruthy()
  })

  it('cada orden creada tiene un id distinto', async () => {
    const a = await mockOrderRepository.createOrder({ customerId: 'c', items: [ITEM], direccionEntrega: 'Zona 1' })
    const b = await mockOrderRepository.createOrder({ customerId: 'c', items: [ITEM], direccionEntrega: 'Zona 1' })
    expect(a.id).not.toBe(b.id)
  })

  it('getOrder recupera una orden ya creada', async () => {
    const creada = await mockOrderRepository.createOrder({
      customerId: 'cliente-x',
      items: [ITEM],
      direccionEntrega: 'Zona 2',
    })
    const recuperada = await mockOrderRepository.getOrder(creada.id)
    expect(recuperada).toEqual(creada)
  })

  it('getOrder retorna null si el id no existe', async () => {
    const resultado = await mockOrderRepository.getOrder('SGO-NOEXISTE')
    expect(resultado).toBeNull()
  })

  it('updateEstado cambia el estado de una orden existente', async () => {
    const creada = await mockOrderRepository.createOrder({
      customerId: 'cliente-x',
      items: [ITEM],
      direccionEntrega: 'Zona 2',
    })
    const actualizada = await mockOrderRepository.updateEstado(creada.id, 'pagada')
    expect(actualizada?.estado).toBe('pagada')
    const recuperada = await mockOrderRepository.getOrder(creada.id)
    expect(recuperada?.estado).toBe('pagada')
  })

  it('updateEstado retorna null si el id no existe', async () => {
    const resultado = await mockOrderRepository.updateEstado('SGO-NOEXISTE', 'pagada')
    expect(resultado).toBeNull()
  })

  it('las órdenes sobreviven a un round-trip de localStorage (simula recargar la página)', async () => {
    const creada = await mockOrderRepository.createOrder({
      customerId: 'cliente-x',
      items: [ITEM],
      direccionEntrega: 'Zona 2',
    })
    const crudo = localStorage.getItem(ORDERS_STORAGE_KEY)
    expect(crudo).toBeTruthy()
    const persistidas = JSON.parse(crudo!)
    expect(persistidas.find((o: { id: string }) => o.id === creada.id)).toBeTruthy()
  })

  it('un valor corrupto en localStorage no lanza excepción, retorna lista vacía', async () => {
    localStorage.setItem(ORDERS_STORAGE_KEY, '{esto no es json')
    const resultado = await mockOrderRepository.getOrder('SGO-000001')
    expect(resultado).toBeNull()
  })

  it('listOrders retorna solo las órdenes del cliente indicado, más reciente primero', async () => {
    const a = await mockOrderRepository.createOrder({ customerId: 'cliente-a', items: [ITEM], direccionEntrega: 'Zona 2' })
    await mockOrderRepository.createOrder({ customerId: 'cliente-b', items: [ITEM], direccionEntrega: 'Zona 2' })
    const c = await mockOrderRepository.createOrder({ customerId: 'cliente-a', items: [ITEM], direccionEntrega: 'Zona 2' })

    const propias = await mockOrderRepository.listOrders('cliente-a')
    expect(propias.map((o) => o.id)).toEqual([c.id, a.id])
  })

  it('getOrder resuelve pago_en_proceso a pagada si ya pasó el umbral, aunque se haya perdido el temporizador (recarga)', async () => {
    const creada = await mockOrderRepository.createOrder({
      customerId: 'cliente-x',
      items: [ITEM],
      direccionEntrega: 'Zona 2',
    })
    await mockOrderRepository.updateEstado(creada.id, 'pago_en_proceso')

    const ordenes = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY)!)
    const idx = ordenes.findIndex((o: { id: string }) => o.id === creada.id)
    ordenes[idx].enProcesoDesde = new Date(Date.now() - RESOLUCION_EN_PROCESO_MS - 1000).toISOString()
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(ordenes))

    const recuperada = await mockOrderRepository.getOrder(creada.id)
    expect(recuperada?.estado).toBe('pagada')
  })
})
```

- [ ] **Step 13: Correr las pruebas y verificar que fallan**

Run: `npx vitest run src/features/orden/api/orderRepository.mock.test.ts`
Expected: FAIL — `orderRepository.mock.ts` todavía usa `metodoEntrega`, no compila contra los nuevos tipos.

- [ ] **Step 14: Actualizar `orderRepository.mock.ts` (solo el campo de entrega cambia)**

Reemplazar todo el contenido de `src/features/orden/api/orderRepository.mock.ts`:

```ts
import type { OrderRepository } from './orderRepository'
import type { CrearOrdenInput, Order } from '../types'

const LATENCIA_MS = 200
export const ORDERS_STORAGE_KEY = 'sgo-orders'
export const RESOLUCION_EN_PROCESO_MS = 4000

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), LATENCIA_MS))
}

function cargarOrdenes(): Order[] {
  const crudo = localStorage.getItem(ORDERS_STORAGE_KEY)
  if (!crudo) return []
  try {
    return JSON.parse(crudo) as Order[]
  } catch {
    return []
  }
}

function guardarOrdenes(ordenes: Order[]): void {
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(ordenes))
}

function calcularTotal(items: CrearOrdenInput['items']): number {
  return items.reduce((suma, item) => suma + item.precioUnitario * item.cantidad, 0)
}

function generarId(ordenes: Order[]): string {
  const maximo = ordenes.reduce((max, o) => {
    const numero = Number(o.id.replace('SGO-', ''))
    return Number.isFinite(numero) && numero > max ? numero : max
  }, 0)
  return `SGO-${String(maximo + 1).padStart(6, '0')}`
}

function resolverSiCorresponde(orden: Order): Order {
  if (orden.estado !== 'pago_en_proceso' || !orden.enProcesoDesde) return orden
  const transcurrido = Date.now() - new Date(orden.enProcesoDesde).getTime()
  if (transcurrido >= RESOLUCION_EN_PROCESO_MS) {
    return { ...orden, estado: 'pagada', enProcesoDesde: undefined }
  }
  return orden
}

export const mockOrderRepository = {
  async createOrder(input: CrearOrdenInput) {
    const ordenes = cargarOrdenes()
    const orden: Order = {
      id: generarId(ordenes),
      customerId: input.customerId,
      items: input.items,
      total: calcularTotal(input.items),
      direccionEntrega: input.direccionEntrega,
      estado: 'pendiente_pago',
      creadaEn: new Date().toISOString(),
    }
    ordenes.push(orden)
    guardarOrdenes(ordenes)
    return esperar(orden)
  },

  async getOrder(id: string) {
    const ordenes = cargarOrdenes()
    const encontrada = ordenes.find((o) => o.id === id)
    if (!encontrada) return esperar(null)

    const resuelta = resolverSiCorresponde(encontrada)
    if (resuelta !== encontrada) {
      guardarOrdenes(ordenes.map((o) => (o.id === id ? resuelta : o)))
    }
    return esperar(resuelta)
  },

  async updateEstado(id: string, estado: Order['estado']) {
    const ordenes = cargarOrdenes()
    const idx = ordenes.findIndex((o) => o.id === id)
    if (idx === -1) return esperar(null)

    ordenes[idx] = {
      ...ordenes[idx],
      estado,
      enProcesoDesde: estado === 'pago_en_proceso' ? new Date().toISOString() : undefined,
    }
    guardarOrdenes(ordenes)
    return esperar(ordenes[idx])
  },

  async listOrders(customerId: string) {
    const ordenes = cargarOrdenes()
      .filter((o) => o.customerId === customerId)
      .map(resolverSiCorresponde)
      .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
    return esperar(ordenes)
  },
} satisfies OrderRepository
```

- [ ] **Step 15: Correr las pruebas y verificar que pasan**

Run: `npx vitest run src/features/orden/api/orderRepository.mock.test.ts`
Expected: PASS (10 pruebas)

- [ ] **Step 16: Commit del mock actualizado**

```bash
git add src/features/orden/api/orderRepository.mock.ts src/features/orden/api/orderRepository.mock.test.ts
git commit -m "refactor(orden): orderRepository.mock usa direccionEntrega en vez de metodoEntrega"
```

- [ ] **Step 17: Escribir las pruebas de `orderRepository.http.ts`**

Crear `src/features/orden/api/orderRepository.http.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { httpOrderRepository } from './orderRepository.http'
import { listarIdsOrdenes } from './orderIndex'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const ITEM = { productId: '1', nombre: 'Refrigeradora', sku: 'LB-1440', cantidad: 1, precioUnitario: 4999 }

const CHECKOUT_RESPONSE = {
  id: 12,
  cartId: 3,
  customerId: 7,
  channel: 'WEB',
  status: 'PENDING_PAYMENT',
  total: 4999,
  deliveryAddress: 'Zona 10',
  createdAt: null,
  updatedAt: '2026-09-25T04:05:48Z',
}

describe('httpOrderRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('createOrder() manda customerId numérico y deliveryAddress, y mapea la respuesta', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(CHECKOUT_RESPONSE, 201))

    const orden = await httpOrderRepository.createOrder({ customerId: '7', items: [ITEM], direccionEntrega: 'Zona 10' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/orders/checkout',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ customerId: 7, deliveryAddress: 'Zona 10' }) }),
    )
    expect(orden).toEqual({
      id: '12',
      customerId: '7',
      items: [ITEM],
      total: 4999,
      direccionEntrega: 'Zona 10',
      estado: 'pendiente_pago',
      creadaEn: '2026-09-25T04:05:48Z',
    })
  })

  it('createOrder() guarda el snapshot y registra la orden en el índice local del cliente', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(CHECKOUT_RESPONSE, 201))
    await httpOrderRepository.createOrder({ customerId: '7', items: [ITEM], direccionEntrega: 'Zona 10' })
    expect(listarIdsOrdenes('7')).toEqual(['12'])
  })

  it('createOrder() propaga el mensaje real de un 409 (producto inactivo o sin stock)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        { timestamp: '2026-09-25T00:00:00Z', status: 409, error: 'Conflict', message: 'no hay existencia suficiente del producto 1 para reservar 2 unidad(es)', path: '/api/orders/checkout' },
        409,
      ),
    )
    await expect(
      httpOrderRepository.createOrder({ customerId: '7', items: [ITEM], direccionEntrega: 'Zona 10' }),
    ).rejects.toThrow('no hay existencia suficiente del producto 1 para reservar 2 unidad(es)')
  })

  it('getOrder() mapea los 9 estados posibles y usa el snapshot para items/dirección', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(CHECKOUT_RESPONSE, 201))
    await httpOrderRepository.createOrder({ customerId: '7', items: [ITEM], direccionEntrega: 'Zona 10' })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        orderId: 12,
        createdAt: '2026-09-25T04:05:48Z',
        customerId: 7,
        customer: 'Cliente 7',
        channel: 'WEB',
        status: 'IN_DISPATCH',
        total: 4999,
        lastPaymentResult: 'APPROVED',
        paymentAttempts: 1,
        invoiceStatus: 'ACCEPTED',
        shipmentStatus: 'GUIDE_ISSUED',
        trackingNumber: 'LX-1',
      }),
    )
    const orden = await httpOrderRepository.getOrder('12')
    expect(orden?.estado).toBe('en_despacho')
    expect(orden?.items).toEqual([ITEM])
    expect(orden?.direccionEntrega).toBe('Zona 10')
    expect(orden?.trackingNumber).toBe('LX-1')
  })

  it('getOrder() devuelve null en 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ message: 'no existe' }, 404))
    const orden = await httpOrderRepository.getOrder('999')
    expect(orden).toBeNull()
  })

  it('getOrder() sin snapshot local devuelve items vacíos y dirección vacía, sin lanzar', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        orderId: 30,
        createdAt: '2026-09-25T04:05:48Z',
        customerId: 7,
        customer: 'Cliente 7',
        channel: 'WEB',
        status: 'PAID',
        total: 100,
        lastPaymentResult: 'APPROVED',
        paymentAttempts: 1,
        invoiceStatus: null,
        shipmentStatus: null,
        trackingNumber: null,
      }),
    )
    const orden = await httpOrderRepository.getOrder('30')
    expect(orden?.items).toEqual([])
    expect(orden?.direccionEntrega).toBe('')
  })

  it('listOrders() usa el índice local del cliente para consultar cada orden', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(CHECKOUT_RESPONSE, 201))
    await httpOrderRepository.createOrder({ customerId: '7', items: [ITEM], direccionEntrega: 'Zona 10' })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        orderId: 12,
        createdAt: '2026-09-25T04:05:48Z',
        customerId: 7,
        customer: 'Cliente 7',
        channel: 'WEB',
        status: 'PENDING_PAYMENT',
        total: 4999,
        lastPaymentResult: null,
        paymentAttempts: null,
        invoiceStatus: null,
        shipmentStatus: null,
        trackingNumber: null,
      }),
    )
    const ordenes = await httpOrderRepository.listOrders('7')
    expect(ordenes).toHaveLength(1)
    expect(ordenes[0].id).toBe('12')
  })

  it('updateEstado() lanza — el backend real controla el estado de la orden', async () => {
    await expect(httpOrderRepository.updateEstado('1', 'pagada')).rejects.toThrow()
  })
})
```

- [ ] **Step 18: Correr las pruebas y verificar que fallan**

Run: `npx vitest run src/features/orden/api/orderRepository.http.test.ts`
Expected: FAIL — `orderRepository.http.ts` no existe todavía.

- [ ] **Step 19: Implementar `orderRepository.http.ts`**

```ts
import type { OrderRepository } from './orderRepository'
import type { CrearOrdenInput, EstadoOrden, Order } from '../types'
import { NotFoundError, manejarRespuesta } from '../../../shared/api/httpErrors'
import { listarIdsOrdenes, registrarOrden } from './orderIndex'
import { guardarSnapshot, obtenerSnapshot } from './orderItemsSnapshot'

interface BackendOrder {
  id: number
  cartId: number | null
  customerId: number
  channel: string
  status: string
  total: number
  deliveryAddress: string
  createdAt: string | null
  updatedAt: string
}

interface BackendOrderDetail {
  orderId: number
  createdAt: string | null
  customerId: number
  customer: string
  channel: string
  status: string
  total: number
  lastPaymentResult: string | null
  paymentAttempts: number | null
  invoiceStatus: string | null
  shipmentStatus: string | null
  trackingNumber: string | null
}

const MAPA_ESTADO: Record<string, EstadoOrden> = {
  PENDING_PAYMENT: 'pendiente_pago',
  PAYMENT_IN_PROGRESS: 'pago_en_proceso',
  PAYMENT_FAILED: 'pago_fallido',
  PAID: 'pagada',
  INVOICED: 'facturada',
  IN_DISPATCH: 'en_despacho',
  DELIVERED: 'entregada',
  CANCELLED: 'cancelada',
  RETURNED: 'devuelta',
}

function mapearEstado(status: string): EstadoOrden {
  return MAPA_ESTADO[status] ?? 'pendiente_pago'
}

export const httpOrderRepository: OrderRepository = {
  async createOrder(input) {
    const backendOrder = await manejarRespuesta<BackendOrder>(
      await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: Number(input.customerId), deliveryAddress: input.direccionEntrega }),
      }),
    )
    const orden: Order = {
      id: String(backendOrder.id),
      customerId: input.customerId,
      items: input.items,
      total: backendOrder.total,
      direccionEntrega: backendOrder.deliveryAddress,
      estado: mapearEstado(backendOrder.status),
      // createdAt sale null en la respuesta de checkout (limitación conocida del backend) — se
      // usa updatedAt como fecha de creación para este caso puntual.
      creadaEn: backendOrder.updatedAt,
    }
    guardarSnapshot(orden.id, { items: input.items, direccionEntrega: input.direccionEntrega })
    registrarOrden(input.customerId, orden.id)
    return orden
  },

  async getOrder(id) {
    try {
      const detalle = await manejarRespuesta<BackendOrderDetail>(await fetch(`/api/orders/${id}`))
      const snapshot = obtenerSnapshot(id)
      return {
        id: String(detalle.orderId),
        customerId: String(detalle.customerId),
        items: snapshot?.items ?? [],
        total: detalle.total,
        direccionEntrega: snapshot?.direccionEntrega ?? '',
        estado: mapearEstado(detalle.status),
        creadaEn: detalle.createdAt ?? '',
        trackingNumber: detalle.trackingNumber ?? undefined,
      }
    } catch (e) {
      if (e instanceof NotFoundError) return null
      throw e
    }
  },

  async updateEstado() {
    throw new Error('El estado de la orden lo controla el backend real; no se puede forzar desde el frontend')
  },

  async listOrders(customerId) {
    const ids = listarIdsOrdenes(customerId)
    const ordenes = await Promise.all(ids.map((id) => httpOrderRepository.getOrder(id)))
    return ordenes.filter((o): o is Order => o !== null).sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
  },
}
```

- [ ] **Step 20: Correr las pruebas y verificar que pasan**

Run: `npx vitest run src/features/orden/api/orderRepository.http.test.ts`
Expected: PASS (8 pruebas)

- [ ] **Step 21: Commit de `orderRepository.http.ts`**

```bash
git add src/features/orden/api/orderRepository.http.ts src/features/orden/api/orderRepository.http.test.ts
git commit -m "feat(orden): agrega orderRepository.http contra el backend real"
```

---

### Task 2: Dominio Carrito — nueva interfaz, repositorio (mock + http) y wiring a la UI

**Files:**
- Modify: `src/features/carrito/api/cartRepository.ts`
- Modify: `src/features/carrito/api/cartRepository.mock.ts`
- Modify: `src/features/carrito/api/cartRepository.mock.test.ts`
- Create: `src/features/carrito/api/cartRepository.http.ts`
- Create: `src/features/carrito/api/cartRepository.http.test.ts`
- Modify: `src/features/carrito/context/CartContext.tsx`
- Modify: `src/features/carrito/hooks/useCarrito.ts`
- Modify: `src/features/carrito/pages/CartPage.tsx`

**Interfaces:**
- Consumes: `httpCatalogRepository.getById` de `src/features/catalogo/api/catalogRepository.http.ts` (ya existe: `(id: string) => Promise<Product | null>`); `mockCatalogRepository.getById` de `src/features/catalogo/api/catalogRepository.mock.ts` (ya existe, misma firma); `manejarRespuesta`/`NotFoundError` de `httpErrors.ts`; `useCustomer()` de `src/shared/context/CustomerContext.tsx` (ya existe, expone `customer.id: string`).
- Produces: `CartRepository { getCart(customerId): Promise<Cart>; addItem(customerId, productId, cantidad): Promise<Cart> }`; `useCarrito()` ahora expone `{ cart, cargando, agregarProducto, incrementarItem, resetearCarritoLocal, total }` (sin `actualizarCantidad`, `eliminarItem`, `vaciarCarrito`) — lo consume la Tarea 4 (`CheckoutPage` usa `resetearCarritoLocal`).

- [ ] **Step 1: Reescribir la interfaz `CartRepository`**

Reemplazar todo el contenido de `src/features/carrito/api/cartRepository.ts`:

```ts
import type { Cart } from '../types'

export interface CartRepository {
  getCart(customerId: string): Promise<Cart>
  addItem(customerId: string, productId: string, cantidad: number): Promise<Cart>
}
```

- [ ] **Step 2: Reescribir `cartRepository.mock.test.ts` para la nueva interfaz**

Reemplazar todo el contenido de `src/features/carrito/api/cartRepository.mock.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { mockCartRepository } from './cartRepository.mock'
import { EMPTY_CART } from '../types'

describe('mockCartRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('retorna un carrito vacío si el cliente no tiene carrito guardado', async () => {
    const cart = await mockCartRepository.getCart('cliente-x')
    expect(cart).toEqual(EMPTY_CART)
  })

  it('addItem agrega un producto nuevo con sus datos del catálogo mock', async () => {
    const cart = await mockCartRepository.addItem('cliente-x', '1', 2)
    expect(cart.items).toEqual([
      { productId: '1', nombre: 'Refrigeradora 14 pies³', sku: 'LB-1440', cantidad: 2, precioUnitario: 4999 },
    ])
  })

  it('addItem incrementa la cantidad si el producto ya estaba en el carrito', async () => {
    await mockCartRepository.addItem('cliente-x', '1', 1)
    const cart = await mockCartRepository.addItem('cliente-x', '1', 2)
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].cantidad).toBe(3)
  })

  it('el carrito persiste tras un round-trip de localStorage', async () => {
    await mockCartRepository.addItem('cliente-x', '1', 1)
    const recuperado = await mockCartRepository.getCart('cliente-x')
    expect(recuperado.items).toHaveLength(1)
  })

  it('el carrito queda aislado por cliente', async () => {
    await mockCartRepository.addItem('cliente-a', '1', 1)
    const carritoB = await mockCartRepository.getCart('cliente-b')
    expect(carritoB).toEqual(EMPTY_CART)
  })

  it('un valor corrupto en localStorage no lanza excepción, retorna carrito vacío', async () => {
    localStorage.setItem('sgo-cart-cliente-x', '{esto no es json')
    const cart = await mockCartRepository.getCart('cliente-x')
    expect(cart).toEqual(EMPTY_CART)
  })
})
```

- [ ] **Step 3: Correr las pruebas y verificar que fallan**

Run: `npx vitest run src/features/carrito/api/cartRepository.mock.test.ts`
Expected: FAIL — `mockCartRepository` todavía no tiene `addItem`.

- [ ] **Step 4: Reescribir `cartRepository.mock.ts`**

Reemplazar todo el contenido de `src/features/carrito/api/cartRepository.mock.ts`:

```ts
import type { CartRepository } from './cartRepository'
import { mockCatalogRepository } from '../../catalogo/api/catalogRepository.mock'
import { EMPTY_CART, type Cart, type CartItem } from '../types'

const LATENCIA_MS = 150

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), LATENCIA_MS))
}

function claveDe(customerId: string): string {
  return `sgo-cart-${customerId}`
}

function cargarCarrito(customerId: string): Cart {
  const crudo = localStorage.getItem(claveDe(customerId))
  if (!crudo) return EMPTY_CART
  try {
    return JSON.parse(crudo) as Cart
  } catch {
    return EMPTY_CART
  }
}

function guardarCarrito(customerId: string, cart: Cart): void {
  localStorage.setItem(claveDe(customerId), JSON.stringify(cart))
}

export const mockCartRepository = {
  async getCart(customerId: string) {
    return esperar(cargarCarrito(customerId))
  },

  async addItem(customerId: string, productId: string, cantidad: number) {
    const cart = cargarCarrito(customerId)
    const items: CartItem[] = cart.items.map((item) => ({ ...item }))
    const existente = items.find((i) => i.productId === productId)
    if (existente) {
      existente.cantidad += cantidad
    } else {
      const producto = await mockCatalogRepository.getById(productId)
      items.push({
        productId,
        nombre: producto?.nombre ?? '',
        sku: producto?.sku ?? '',
        cantidad,
        precioUnitario: producto?.precio.final ?? 0,
      })
    }
    const nuevoCart = { items }
    guardarCarrito(customerId, nuevoCart)
    return esperar(nuevoCart)
  },
} satisfies CartRepository
```

- [ ] **Step 5: Correr las pruebas y verificar que pasan**

Run: `npx vitest run src/features/carrito/api/cartRepository.mock.test.ts`
Expected: PASS (6 pruebas)

- [ ] **Step 6: Commit del mock actualizado**

```bash
git add src/features/carrito/api/cartRepository.ts src/features/carrito/api/cartRepository.mock.ts src/features/carrito/api/cartRepository.mock.test.ts
git commit -m "refactor(carrito): CartRepository pasa a getCart+addItem, igual que el backend real"
```

- [ ] **Step 7: Escribir las pruebas de `cartRepository.http.ts`**

Crear `src/features/carrito/api/cartRepository.http.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpCartRepository } from './cartRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const PRODUCTO_BACKEND = { id: 1, sku: 'LB-003', name: 'Estufa de 4 quemadores', category: 'LINEA_BLANCA', price: 2100, active: true }
const DISPONIBILIDAD = { productId: 1, totalAvailable: 5, byLocation: [] }

describe('httpCartRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getCart() enriquece cada item del backend con datos del catálogo', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ cartId: 1, status: 'OPEN', channel: 'WEB', items: [{ productId: 1, quantity: 2 }] }))
      .mockResolvedValueOnce(jsonResponse(PRODUCTO_BACKEND))
      .mockResolvedValueOnce(jsonResponse(DISPONIBILIDAD))

    const cart = await httpCartRepository.getCart('7')
    expect(cart.items).toEqual([
      { productId: '1', nombre: 'Estufa de 4 quemadores', sku: 'LB-003', cantidad: 2, precioUnitario: 2100 },
    ])
  })

  it('getCart() trata un carrito sin actividad (cartId null) como vacío', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ cartId: null, status: null, channel: null, items: [] }))
    const cart = await httpCartRepository.getCart('7')
    expect(cart.items).toEqual([])
  })

  it('getCart() omite un item cuyo producto ya no se puede consultar, sin tumbar el resto', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          cartId: 1,
          status: 'OPEN',
          channel: 'WEB',
          items: [
            { productId: 1, quantity: 1 },
            { productId: 2, quantity: 1 },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ message: 'no existe' }, 404))
      .mockResolvedValueOnce(jsonResponse({ ...PRODUCTO_BACKEND, id: 2 }))
      .mockResolvedValueOnce(jsonResponse({ ...DISPONIBILIDAD, productId: 2 }))

    const cart = await httpCartRepository.getCart('7')
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].productId).toBe('2')
  })

  it('addItem() manda productId numérico, cantidad y canal, y devuelve el carrito mapeado', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ cartId: 1, status: 'OPEN', channel: 'WEB', items: [{ productId: 1, quantity: 3 }] }))
      .mockResolvedValueOnce(jsonResponse(PRODUCTO_BACKEND))
      .mockResolvedValueOnce(jsonResponse(DISPONIBILIDAD))

    const cart = await httpCartRepository.addItem('7', '1', 3)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/customers/7/cart/items',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ productId: 1, quantity: 3, channel: 'WEB' }) }),
    )
    expect(cart.items[0].cantidad).toBe(3)
  })

  it('addItem() en un 404 (cliente o producto inexistente/inactivo) lanza un mensaje claro', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ message: 'no existe' }, 404))
    await expect(httpCartRepository.addItem('7', '999', 1)).rejects.toThrow('El producto ya no está disponible o no existe')
  })
})
```

- [ ] **Step 8: Correr las pruebas y verificar que fallan**

Run: `npx vitest run src/features/carrito/api/cartRepository.http.test.ts`
Expected: FAIL — `cartRepository.http.ts` no existe todavía.

- [ ] **Step 9: Implementar `cartRepository.http.ts`**

```ts
import type { CartRepository } from './cartRepository'
import { httpCatalogRepository } from '../../catalogo/api/catalogRepository.http'
import type { Cart, CartItem } from '../types'
import { NotFoundError, manejarRespuesta } from '../../../shared/api/httpErrors'

interface BackendCartItem {
  productId: number
  quantity: number
}

interface BackendCart {
  cartId: number | null
  status: string | null
  channel: string | null
  items: BackendCartItem[]
}

async function mapearItem(item: BackendCartItem): Promise<CartItem | null> {
  try {
    const producto = await httpCatalogRepository.getById(String(item.productId))
    if (!producto) return null
    return {
      productId: producto.id,
      nombre: producto.nombre,
      sku: producto.sku,
      cantidad: item.quantity,
      precioUnitario: producto.precio.final,
    }
  } catch {
    // Un producto que falla al consultarse no debe tumbar el carrito completo — se omite, igual
    // que ya hace catalogRepository.http.ts con la disponibilidad.
    return null
  }
}

async function mapearCarrito(backendCart: BackendCart): Promise<Cart> {
  const items = await Promise.all(backendCart.items.map(mapearItem))
  return { items: items.filter((item): item is CartItem => item !== null) }
}

export const httpCartRepository: CartRepository = {
  async getCart(customerId) {
    const backendCart = await manejarRespuesta<BackendCart>(await fetch(`/api/customers/${customerId}/cart`))
    return mapearCarrito(backendCart)
  },

  async addItem(customerId, productId, cantidad) {
    let backendCart: BackendCart
    try {
      backendCart = await manejarRespuesta<BackendCart>(
        await fetch(`/api/customers/${customerId}/cart/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: Number(productId), quantity: cantidad, channel: 'WEB' }),
        }),
      )
    } catch (e) {
      if (e instanceof NotFoundError) throw new Error('El producto ya no está disponible o no existe')
      throw e
    }
    return mapearCarrito(backendCart)
  },
}
```

- [ ] **Step 10: Correr las pruebas y verificar que pasan**

Run: `npx vitest run src/features/carrito/api/cartRepository.http.test.ts`
Expected: PASS (5 pruebas)

- [ ] **Step 11: Commit de `cartRepository.http.ts`**

```bash
git add src/features/carrito/api/cartRepository.http.ts src/features/carrito/api/cartRepository.http.test.ts
git commit -m "feat(carrito): agrega cartRepository.http contra el backend real"
```

- [ ] **Step 12: Reescribir `CartContext.tsx` para usar el repositorio HTTP**

Reemplazar todo el contenido de `src/features/carrito/context/CartContext.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { httpCartRepository } from '../api/cartRepository.http'
import { EMPTY_CART, type Cart } from '../types'
import { useCustomer } from '../../../shared/context/CustomerContext'

interface CartContextValue {
  cart: Cart
  cargando: boolean
  agregarItem: (productId: string, cantidad: number) => Promise<void>
  resetearLocal: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { customer } = useCustomer()
  const [cart, setCart] = useState<Cart>(EMPTY_CART)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    httpCartRepository.getCart(customer.id).then((resultado) => {
      setCart(resultado)
      setCargando(false)
    })
  }, [customer.id])

  async function agregarItem(productId: string, cantidad: number) {
    const nuevoCart = await httpCartRepository.addItem(customer.id, productId, cantidad)
    setCart(nuevoCart)
  }

  function resetearLocal() {
    setCart(EMPTY_CART)
  }

  return <CartContext.Provider value={{ cart, cargando, agregarItem, resetearLocal }}>{children}</CartContext.Provider>
}

export function useCartContext(): CartContextValue {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCartContext debe usarse dentro de <CartProvider>')
  return value
}
```

- [ ] **Step 13: Reescribir `useCarrito.ts`**

Reemplazar todo el contenido de `src/features/carrito/hooks/useCarrito.ts`:

```ts
import { httpCatalogRepository } from '../../catalogo/api/catalogRepository.http'
import type { Product } from '../../catalogo/types'
import { useCartContext } from '../context/CartContext'

export type ResultadoAgregar = { ok: true } | { ok: false; motivo: string }

export function useCarrito() {
  const { cart, cargando, agregarItem, resetearLocal } = useCartContext()

  async function agregarProducto(producto: Product, cantidad = 1): Promise<ResultadoAgregar> {
    let actual: Product | null
    try {
      actual = await httpCatalogRepository.getById(producto.id)
    } catch (e) {
      return { ok: false, motivo: e instanceof Error ? e.message : 'No se pudo verificar el producto' }
    }
    if (!actual || !actual.disponible) {
      return { ok: false, motivo: actual?.disponibilidadMotivo ?? 'Producto sin existencia disponible' }
    }

    try {
      await agregarItem(producto.id, cantidad)
    } catch (e) {
      return { ok: false, motivo: e instanceof Error ? e.message : 'No se pudo agregar el producto al carrito' }
    }
    return { ok: true }
  }

  async function incrementarItem(productId: string): Promise<void> {
    await agregarItem(productId, 1)
  }

  const total = cart.items.reduce((suma, item) => suma + item.precioUnitario * item.cantidad, 0)

  return { cart, cargando, agregarProducto, incrementarItem, resetearCarritoLocal: resetearLocal, total }
}
```

- [ ] **Step 14: Reescribir `CartPage.tsx` sin decrementar/eliminar**

Reemplazar todo el contenido de `src/features/carrito/pages/CartPage.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { useCarrito } from '../hooks/useCarrito'
import { Button } from '../../../shared/components/Button'
import { useNotify } from '../../../shared/notifications/NotificationContext'
import type { CartItem } from '../types'

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

export function CartPage() {
  const { cart, cargando, total, incrementarItem } = useCarrito()
  const { notificar } = useNotify()

  async function handleIncrementar(item: CartItem) {
    await incrementarItem(item.productId)
    notificar(`Cantidad de ${item.nombre} actualizada a ${item.cantidad + 1}`, 'ok')
  }

  if (cargando) return <p className="text-sm text-gray-400">Cargando carrito…</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-6">Carrito</h1>

      {cart.items.length === 0 ? (
        <p className="text-sm text-gray-400">
          Tu carrito está vacío. <Link to="/catalogo" className="text-brand underline">Ver catálogo</Link>
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">
            Por ahora solo se pueden agregar más unidades desde aquí. Para quitar productos o reducir
            cantidades, contacta a servicio al cliente.
          </p>
          <div className="bg-white border border-linea rounded p-4">
            <div className="divide-y divide-linea">
              {cart.items.map((item) => (
                <div key={item.productId} className="flex items-center gap-3 py-3">
                  <div className="w-14 h-14 bg-gray-100 rounded flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm">{item.nombre}</div>
                    <div className="text-xs text-gray-400">{item.sku}</div>
                  </div>
                  <div className="text-sm text-gray-500 w-24 text-center">Cantidad: {item.cantidad}</div>
                  <button
                    type="button"
                    onClick={() => handleIncrementar(item)}
                    className="w-8 h-8 flex items-center justify-center border border-linea rounded text-ink hover:bg-crema"
                    aria-label={`Agregar una unidad más de ${item.nombre}`}
                  >
                    +
                  </button>
                  <div className="text-sm w-24 text-right">{formatQ(item.precioUnitario * item.cantidad)}</div>
                </div>
              ))}
            </div>

            <div className="flex justify-between font-bold border-t border-linea mt-3 pt-3 text-sm">
              <span>Total</span>
              <span>{formatQ(total)}</span>
            </div>
          </div>

          <div className="text-right mt-4">
            <Link to="/checkout">
              <Button>Continuar</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 15: Confirmar que no hay regresiones en lo ya migrado (todavía NO corras `npm run build` completo)**

`npm run build` (`tsc -b`) fallará en este punto del plan por diseño: `CheckoutPage.tsx` (sin tocar hasta la Tarea 4) todavía desestructura `vaciarCarrito` de `useCarrito()`, que ya no existe, y `paymentRepository.mock.test.ts` (sin tocar hasta la Tarea 3) todavía crea órdenes con `metodoEntrega`, que ya no existe desde la Tarea 1. Ninguno de los dos es un error de esta tarea — no los corrijas aquí. La build completa vuelve a compilar al terminar la Tarea 4 (`CheckoutPage`) y la Tarea 3 (`paymentRepository.mock.test.ts`); el primer punto del plan donde `npm run build` debe pasar limpio es la Tarea 5, Step 2.

- [ ] **Step 16: Correr las pruebas de carrito para confirmar que no hay regresiones**

Run: `npx vitest run src/features/carrito`
Expected: PASS

- [ ] **Step 17: Commit del wiring de carrito**

```bash
git add src/features/carrito/context/CartContext.tsx src/features/carrito/hooks/useCarrito.ts src/features/carrito/pages/CartPage.tsx
git commit -m "feat(carrito): conecta CartContext/useCarrito/CartPage al carrito real, sin editar cantidades"
```

---

### Task 3: Dominio Pago — repositorio (mock simplificado + http) y PaymentPage

**Files:**
- Modify: `src/features/pago/api/paymentRepository.mock.ts`
- Modify: `src/features/pago/api/paymentRepository.mock.test.ts`
- Create: `src/features/pago/api/paymentRepository.http.ts`
- Create: `src/features/pago/api/paymentRepository.http.test.ts`
- Modify: `src/features/pago/pages/PaymentPage.tsx`

**Interfaces:**
- Consumes: `httpOrderRepository.getOrder` de la Tarea 1; `manejarRespuesta` de `httpErrors.ts`; `Order`, `EstadoOrden` de la Tarea 1.
- Produces: `mockPaymentRepository`/`httpPaymentRepository` (ambos implementan `PaymentRepository { charge, countIntentosFallidos, maxIntentosFallidos }`, sin cambios de firma) — los consume `PaymentPage.tsx` en este mismo task.

- [ ] **Step 1: Reescribir `paymentRepository.mock.test.ts` para el nuevo comportamiento (rechazo inmediato, reintentable)**

Reemplazar todo el contenido de `src/features/pago/api/paymentRepository.mock.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { mockPaymentRepository } from './paymentRepository.mock'
import { mockOrderRepository } from '../../orden/api/orderRepository.mock'

const ITEM = { productId: '1', nombre: 'Refrigeradora', sku: 'LB-1440', cantidad: 1, precioUnitario: 4999 }

async function crearOrden() {
  return mockOrderRepository.createOrder({ customerId: 'cliente-x', items: [ITEM], direccionEntrega: 'Zona 10' })
}

describe('mockPaymentRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('una tarjeta terminada en 0000 es rechazada y la orden queda en pago_fallido de inmediato', async () => {
    const orden = await crearOrden()
    const intento = await mockPaymentRepository.charge(orden.id, 'tarjeta', { ultimosDigitos: '0000' })
    expect(intento.resultado).toBe('rechazado')
    expect(intento.motivo).toBeTruthy()
    const actualizada = await mockOrderRepository.getOrder(orden.id)
    expect(actualizada?.estado).toBe('pago_fallido')
  })

  it('un rechazo no impide reintentar: un pago posterior aprobado deja la orden pagada', async () => {
    const orden = await crearOrden()
    await mockPaymentRepository.charge(orden.id, 'tarjeta', { ultimosDigitos: '0000' })
    const intento = await mockPaymentRepository.charge(orden.id, 'transferencia')
    expect(intento.resultado).toBe('aprobado')
    const actualizada = await mockOrderRepository.getOrder(orden.id)
    expect(actualizada?.estado).toBe('pagada')
  })

  it('una tarjeta terminada en 1111 deja la orden inmediatamente en pago_en_proceso, sin bloquear', async () => {
    const orden = await crearOrden()
    const inicio = Date.now()
    const intento = await mockPaymentRepository.charge(orden.id, 'tarjeta', { ultimosDigitos: '1111' })
    expect(Date.now() - inicio).toBeLessThan(500)
    expect(intento.resultado).toBe('en_proceso')

    const enProceso = await mockOrderRepository.getOrder(orden.id)
    expect(enProceso?.estado).toBe('pago_en_proceso')
  })

  it('cualquier otra tarjeta o método es aprobado y marca la orden como pagada', async () => {
    const orden = await crearOrden()
    const intento = await mockPaymentRepository.charge(orden.id, 'transferencia')
    expect(intento.resultado).toBe('aprobado')
    const actualizada = await mockOrderRepository.getOrder(orden.id)
    expect(actualizada?.estado).toBe('pagada')
  })

  it('countIntentosFallidos cuenta los rechazos acumulados, sin importar reintentos posteriores', async () => {
    const orden = await crearOrden()
    for (let i = 0; i < mockPaymentRepository.maxIntentosFallidos; i += 1) {
      await mockPaymentRepository.charge(orden.id, 'tarjeta', { ultimosDigitos: '0000' })
    }
    const fallidos = await mockPaymentRepository.countIntentosFallidos(orden.id)
    expect(fallidos).toBe(mockPaymentRepository.maxIntentosFallidos)
  })
})
```

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

Run: `npx vitest run src/features/pago/api/paymentRepository.mock.test.ts`
Expected: FAIL — `mockPaymentRepository` todavía revierte un rechazo a `pendiente_pago` en vez de `pago_fallido`.

- [ ] **Step 3: Simplificar `paymentRepository.mock.ts`**

Reemplazar todo el contenido de `src/features/pago/api/paymentRepository.mock.ts`:

```ts
import type { PaymentRepository } from './paymentRepository'
import type { DatosTarjeta, MetodoPago, PaymentAttempt, ResultadoCobro } from '../types'
import { mockOrderRepository, RESOLUCION_EN_PROCESO_MS } from '../../orden/api/orderRepository.mock'

const LATENCIA_MS = 200
const MAX_INTENTOS_FALLIDOS = 3
const ATTEMPTS_STORAGE_KEY = 'sgo-payment-attempts'

const TARJETA_RECHAZADA = '0000'
const TARJETA_EN_PROCESO = '1111'

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), LATENCIA_MS))
}

function cargarIntentos(): PaymentAttempt[] {
  const crudo = localStorage.getItem(ATTEMPTS_STORAGE_KEY)
  if (!crudo) return []
  try {
    return JSON.parse(crudo) as PaymentAttempt[]
  } catch {
    return []
  }
}

function guardarIntentos(intentos: PaymentAttempt[]): void {
  localStorage.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(intentos))
}

function generarIntentoId(intentos: PaymentAttempt[]): string {
  const maximo = intentos.reduce((max, i) => {
    const numero = Number(i.id.replace('PAY-', ''))
    return Number.isFinite(numero) && numero > max ? numero : max
  }, 0)
  return `PAY-${String(maximo + 1).padStart(6, '0')}`
}

function resolverResultado(metodo: string, ultimosDigitos?: string): { resultado: ResultadoCobro; motivo?: string } {
  if (metodo === 'tarjeta' && ultimosDigitos === TARJETA_RECHAZADA) {
    return { resultado: 'rechazado', motivo: 'Fondos insuficientes' }
  }
  if (metodo === 'tarjeta' && ultimosDigitos === TARJETA_EN_PROCESO) {
    return { resultado: 'en_proceso' }
  }
  return { resultado: 'aprobado' }
}

export const mockPaymentRepository = {
  maxIntentosFallidos: MAX_INTENTOS_FALLIDOS,

  async charge(orderId: string, metodo: MetodoPago, tarjeta?: DatosTarjeta) {
    const intentos = cargarIntentos()
    const { resultado, motivo } = resolverResultado(metodo, tarjeta?.ultimosDigitos)

    const intento: PaymentAttempt = {
      id: generarIntentoId(intentos),
      orderId,
      metodo,
      resultado,
      motivo,
      fecha: new Date().toISOString(),
    }
    intentos.push(intento)
    guardarIntentos(intentos)

    // El backend real deja la orden en pago_fallido desde el primer rechazo, sin una fase
    // intermedia de reintento silencioso — el mock refleja el mismo comportamiento. El límite de
    // reintentos (RF PB-014) lo aplica quien consume countIntentosFallidos (PaymentPage), no este
    // repositorio.
    if (resultado === 'aprobado') {
      await mockOrderRepository.updateEstado(orderId, 'pagada')
    } else if (resultado === 'en_proceso') {
      await mockOrderRepository.updateEstado(orderId, 'pago_en_proceso')
      setTimeout(() => {
        mockOrderRepository.updateEstado(orderId, 'pagada')
      }, RESOLUCION_EN_PROCESO_MS)
    } else {
      await mockOrderRepository.updateEstado(orderId, 'pago_fallido')
    }

    return esperar(intento)
  },

  async countIntentosFallidos(orderId: string) {
    const intentos = cargarIntentos()
    return esperar(intentos.filter((i) => i.orderId === orderId && i.resultado === 'rechazado').length)
  },
} satisfies PaymentRepository
```

- [ ] **Step 4: Correr las pruebas y verificar que pasan**

Run: `npx vitest run src/features/pago/api/paymentRepository.mock.test.ts`
Expected: PASS (5 pruebas)

- [ ] **Step 5: Commit del mock simplificado**

```bash
git add src/features/pago/api/paymentRepository.mock.ts src/features/pago/api/paymentRepository.mock.test.ts
git commit -m "refactor(pago): paymentRepository.mock refleja el rechazo inmediato del backend real"
```

- [ ] **Step 6: Escribir las pruebas de `paymentRepository.http.ts`**

Crear `src/features/pago/api/paymentRepository.http.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpPaymentRepository } from './paymentRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('httpPaymentRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('charge() manda el método mapeado y un token simulado, nunca el número de tarjeta', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        { orderId: 12, attemptNumber: 1, result: 'APPROVED', orderStatus: 'PAID', providerReference: 'PK-1', latencyMs: 80, message: 'cobro aprobado' },
        201,
      ),
    )
    const intento = await httpPaymentRepository.charge('12', 'tarjeta', { ultimosDigitos: '4242' })

    const [, opciones] = fetchMock.mock.calls[0]
    const cuerpo = JSON.parse((opciones as RequestInit).body as string)
    expect(cuerpo.method).toBe('CARD')
    expect(cuerpo.cardLast4).toBe('4242')
    expect(cuerpo.cardToken).toMatch(/^tok_/)
    expect(cuerpo).not.toHaveProperty('cardNumber')
    expect(intento.resultado).toBe('aprobado')
  })

  it.each([
    ['APPROVED', 'aprobado'],
    ['DECLINED', 'rechazado'],
    ['TIMEOUT', 'en_proceso'],
    ['ERROR', 'en_proceso'],
  ])('mapea result=%s a resultado=%s', async (result, esperado) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ orderId: 1, attemptNumber: 1, result, orderStatus: 'PENDING_PAYMENT', providerReference: null, latencyMs: 10, message: 'x' }, 201),
    )
    const intento = await httpPaymentRepository.charge('1', 'tarjeta', { ultimosDigitos: '4242' })
    expect(intento.resultado).toBe(esperado)
  })

  it('countIntentosFallidos() cuenta solo los intentos DECLINED del historial', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse([
        { id: 1, attemptNumber: 1, result: 'DECLINED', amount: 100, providerReference: null, cardLast4: '4242', failureReason: 'sin fondos', latencyMs: 5, attemptedAt: '2026-09-25T00:00:00Z' },
        { id: 2, attemptNumber: 2, result: 'ERROR', amount: 100, providerReference: null, cardLast4: '4242', failureReason: 'timeout', latencyMs: 0, attemptedAt: '2026-09-25T00:01:00Z' },
        { id: 3, attemptNumber: 3, result: 'APPROVED', amount: 100, providerReference: 'PK-1', cardLast4: '4242', failureReason: null, latencyMs: 80, attemptedAt: '2026-09-25T00:02:00Z' },
      ]),
    )
    const fallidos = await httpPaymentRepository.countIntentosFallidos('1')
    expect(fallidos).toBe(1)
  })
})
```

- [ ] **Step 7: Correr las pruebas y verificar que fallan**

Run: `npx vitest run src/features/pago/api/paymentRepository.http.test.ts`
Expected: FAIL — `paymentRepository.http.ts` no existe todavía.

- [ ] **Step 8: Implementar `paymentRepository.http.ts`**

```ts
import type { PaymentRepository } from './paymentRepository'
import type { DatosTarjeta, MetodoPago, PaymentAttempt, ResultadoCobro } from '../types'
import { manejarRespuesta } from '../../../shared/api/httpErrors'

const MAX_INTENTOS_FALLIDOS = 3

const MAPA_METODO: Record<MetodoPago, string> = {
  tarjeta: 'CARD',
  transferencia: 'TRANSFER',
  billetera: 'WALLET',
}

const MAPA_RESULTADO: Record<string, ResultadoCobro> = {
  APPROVED: 'aprobado',
  DECLINED: 'rechazado',
  TIMEOUT: 'en_proceso',
  ERROR: 'en_proceso',
}

interface BackendChargeResponse {
  orderId: number
  attemptNumber: number
  result: string
  orderStatus: string
  providerReference: string | null
  latencyMs: number
  message: string
}

interface BackendPaymentAttempt {
  id: number
  attemptNumber: number
  result: string
  amount: number
  providerReference: string | null
  cardLast4: string | null
  failureReason: string | null
  latencyMs: number
  attemptedAt: string
}

function generarTokenSimulado(): string {
  // No existe un widget real de PayKlik en este entorno de demo: se simula el límite que tendría
  // uno real, que nunca entrega el número de tarjeta al comercio, solo un token opaco. El backend
  // rechaza con 400 cualquier valor que parezca un número de tarjeta.
  return `tok_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export const httpPaymentRepository: PaymentRepository = {
  maxIntentosFallidos: MAX_INTENTOS_FALLIDOS,

  async charge(orderId, metodo: MetodoPago, tarjeta?: DatosTarjeta) {
    const respuesta = await manejarRespuesta<BackendChargeResponse>(
      await fetch(`/api/orders/${orderId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: MAPA_METODO[metodo],
          cardToken: generarTokenSimulado(),
          cardLast4: tarjeta?.ultimosDigitos,
        }),
      }),
    )
    const resultado = MAPA_RESULTADO[respuesta.result] ?? 'en_proceso'
    const intento: PaymentAttempt = {
      id: `${respuesta.orderId}-${respuesta.attemptNumber}`,
      orderId,
      metodo,
      resultado,
      motivo: resultado !== 'aprobado' ? respuesta.message : undefined,
      fecha: new Date().toISOString(),
    }
    return intento
  },

  async countIntentosFallidos(orderId) {
    const intentos = await manejarRespuesta<BackendPaymentAttempt[]>(await fetch(`/api/orders/${orderId}/payments`))
    return intentos.filter((i) => i.result === 'DECLINED').length
  },
}
```

- [ ] **Step 9: Correr las pruebas y verificar que pasan**

Run: `npx vitest run src/features/pago/api/paymentRepository.http.test.ts`
Expected: PASS (6 pruebas: 1 + 4 de `it.each` + 1)

- [ ] **Step 10: Commit de `paymentRepository.http.ts`**

```bash
git add src/features/pago/api/paymentRepository.http.ts src/features/pago/api/paymentRepository.http.test.ts
git commit -m "feat(pago): agrega paymentRepository.http contra el backend real"
```

- [ ] **Step 11: Reescribir `PaymentPage.tsx`**

Reemplazar todo el contenido de `src/features/pago/pages/PaymentPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BackLink } from '../../../shared/components/BackLink'
import { Button } from '../../../shared/components/Button'
import { Pill } from '../../../shared/components/Pill'
import { useNotify } from '../../../shared/notifications/NotificationContext'
import { httpOrderRepository } from '../../orden/api/orderRepository.http'
import { httpPaymentRepository } from '../api/paymentRepository.http'
import type { Order } from '../../orden/types'
import type { MetodoPago } from '../types'

const OPCIONES_METODO: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'tarjeta', etiqueta: 'Tarjeta de crédito/débito' },
  { valor: 'transferencia', etiqueta: 'Transferencia bancaria' },
  { valor: 'billetera', etiqueta: 'Billetera digital' },
]

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

export function PaymentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { notificar } = useNotify()
  const [orden, setOrden] = useState<Order | null>(null)
  const [intentosFallidos, setIntentosFallidos] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [metodo, setMetodo] = useState<MetodoPago>('tarjeta')
  const [numeroTarjeta, setNumeroTarjeta] = useState('')
  const [cvv, setCvv] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [rechazoMotivo, setRechazoMotivo] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([httpOrderRepository.getOrder(id), httpPaymentRepository.countIntentosFallidos(id)]).then(
      ([resultadoOrden, fallidos]) => {
        setOrden(resultadoOrden)
        setIntentosFallidos(fallidos)
        setCargando(false)
      },
    )
  }, [id])

  if (cargando) return <p className="text-sm text-gray-400">Cargando…</p>
  if (!orden) return <p className="text-sm text-falla">No encontramos una orden con ese número.</p>

  if (orden.estado === 'pagada') {
    return (
      <div>
        <BackLink to={`/ordenes/${orden.id}`} label="Volver a la orden" />
        <p className="text-sm text-ok">Esta orden ya está pagada.</p>
      </div>
    )
  }

  if (intentosFallidos >= httpPaymentRepository.maxIntentosFallidos) {
    return (
      <div>
        <BackLink to={`/ordenes/${orden.id}`} label="Volver a la orden" />
        <h1 className="text-2xl font-semibold text-ink mb-2">Pago fallido definitivamente</h1>
        <p className="text-sm text-gray-500">
          Se agotaron los intentos de cobro para esta orden. Te notificaremos para que puedas reintentar más
          tarde.
        </p>
      </div>
    )
  }

  async function handlePagar(e: React.FormEvent) {
    e.preventDefault()
    if (!orden) return
    setEnviando(true)
    setRechazoMotivo(null)

    const ultimosDigitos = numeroTarjeta.replace(/\D/g, '').slice(-4)
    setNumeroTarjeta('')
    setCvv('')

    const intento = await httpPaymentRepository.charge(
      orden.id,
      metodo,
      metodo === 'tarjeta' ? { ultimosDigitos } : undefined,
    )

    if (intento.resultado === 'aprobado') {
      notificar('Pago aprobado. Tu orden fue confirmada.', 'ok')
      navigate(`/ordenes/${orden.id}`)
      return
    }

    if (intento.resultado === 'en_proceso') {
      notificar('Tu pago quedó en proceso. Te avisaremos cuando se confirme.', 'info')
      navigate(`/ordenes/${orden.id}`)
      return
    }

    const fallidosActualizados = await httpPaymentRepository.countIntentosFallidos(orden.id)
    setIntentosFallidos(fallidosActualizados)
    const motivo = intento.motivo ?? 'El cobro fue rechazado'
    setRechazoMotivo(motivo)
    notificar(`Pago rechazado: ${motivo}`, 'falla')
    setEnviando(false)
  }

  return (
    <div>
      <BackLink to={`/ordenes/${orden.id}`} label="Volver a la orden" />
      <h1 className="text-2xl font-semibold text-ink mb-6">Pagar orden {orden.id}</h1>

      {rechazoMotivo && (
        <div className="border border-falla bg-red-50 rounded p-3 text-sm text-falla mb-4">
          <span className="flex items-center gap-2 font-medium mb-1">
            <Pill tone="falla">Rechazado</Pill>
          </span>
          {rechazoMotivo}. Puedes intentar con otro método de pago.
        </div>
      )}

      <form onSubmit={handlePagar}>
        <h2 className="text-sm font-medium text-ink mb-2">Método de pago</h2>
        <div className="space-y-2 mb-4">
          {OPCIONES_METODO.map((opcion) => (
            <label
              key={opcion.valor}
              className={`flex items-center gap-3 border rounded p-3 cursor-pointer bg-white ${
                metodo === opcion.valor ? 'border-brand border-2' : 'border-linea'
              }`}
            >
              <input
                type="radio"
                name="metodo"
                value={opcion.valor}
                checked={metodo === opcion.valor}
                onChange={() => setMetodo(opcion.valor)}
              />
              <span className="text-sm text-ink">{opcion.etiqueta}</span>
            </label>
          ))}
        </div>

        {metodo === 'tarjeta' && (
          <div className="bg-white border border-linea rounded p-4 mb-4 space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Número de tarjeta</label>
              <input
                value={numeroTarjeta}
                onChange={(e) => setNumeroTarjeta(e.target.value)}
                inputMode="numeric"
                placeholder="0000 0000 0000 0000"
                required
                className="w-full border border-linea rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs text-gray-500 mb-1">CVV</label>
              <input
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                inputMode="numeric"
                maxLength={4}
                required
                className="w-full border border-linea rounded px-3 py-2 text-sm"
              />
            </div>
            <p className="text-[11px] text-gray-400">
              Solo los últimos 4 dígitos se usan para procesar el cobro; el número completo nunca se guarda.
            </p>
          </div>
        )}

        <Button type="submit" disabled={enviando}>
          {enviando ? 'Procesando…' : `Pagar ${formatQ(orden.total)}`}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 12: Confirmar que las pruebas de pago pasan (todavía NO corras `npm run build` completo)**

`npm run build` seguirá fallando en este punto — `CheckoutPage.tsx` (sin tocar hasta la Tarea 4) todavía usa `metodoEntrega`, que ya no existe. No es un error de esta tarea. El primer punto del plan donde `npm run build` debe pasar limpio es la Tarea 5, Step 2.

Run: `npx vitest run src/features/pago`
Expected: PASS

- [ ] **Step 13: Commit de `PaymentPage.tsx`**

```bash
git add src/features/pago/pages/PaymentPage.tsx
git commit -m "feat(pago): PaymentPage usa el repositorio real y el conteo real de rechazos para PB-014"
```

---

### Task 4: CheckoutPage — dirección de entrega real

**Files:**
- Modify: `src/features/checkout/pages/CheckoutPage.tsx`

**Interfaces:**
- Consumes: `useCarrito()` de la Tarea 2 (`cart`, `cargando`, `total`, `resetearCarritoLocal`); `httpOrderRepository.createOrder` de la Tarea 1; `useCustomer()` (ya existe).

- [ ] **Step 1: Reescribir `CheckoutPage.tsx`**

Reemplazar todo el contenido de `src/features/checkout/pages/CheckoutPage.tsx`:

```tsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackLink } from '../../../shared/components/BackLink'
import { Button } from '../../../shared/components/Button'
import { useCarrito } from '../../carrito/hooks/useCarrito'
import { useCustomer } from '../../../shared/context/CustomerContext'
import { httpOrderRepository } from '../../orden/api/orderRepository.http'

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

export function CheckoutPage() {
  const { cart, cargando, total, resetearCarritoLocal } = useCarrito()
  const { customer } = useCustomer()
  const navigate = useNavigate()
  const [direccionEntrega, setDireccionEntrega] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (cargando) return <p className="text-sm text-gray-400">Cargando…</p>

  if (cart.items.length === 0) {
    return (
      <div>
        <BackLink to="/carrito" label="Volver al carrito" />
        <p className="text-sm text-gray-400">
          Tu carrito está vacío. <Link to="/catalogo" className="text-brand underline">Ver catálogo</Link>
        </p>
      </div>
    )
  }

  async function handleConfirmar() {
    if (!direccionEntrega.trim()) return
    setConfirmando(true)
    setError(null)
    try {
      const orden = await httpOrderRepository.createOrder({
        customerId: customer.id,
        items: cart.items,
        direccionEntrega: direccionEntrega.trim(),
      })
      resetearCarritoLocal()
      navigate(`/ordenes/${orden.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo confirmar la compra')
      setConfirmando(false)
    }
  }

  return (
    <div>
      <BackLink to="/carrito" label="Volver al carrito" />
      <h1 className="text-2xl font-semibold text-ink mb-6">Checkout</h1>

      <h2 className="text-sm font-medium text-ink mb-2">Dirección de entrega</h2>
      <input
        value={direccionEntrega}
        onChange={(e) => setDireccionEntrega(e.target.value)}
        placeholder="Zona 10, Ciudad de Guatemala"
        required
        className="w-full border border-linea rounded px-3 py-2 text-sm bg-white mb-6"
      />

      {error && <p className="text-sm text-falla mb-4">{error}</p>}

      <div className="bg-white border border-linea rounded p-4 mb-6">
        <div className="flex justify-between text-sm font-bold">
          <span>Total</span>
          <span>{formatQ(total)}</span>
        </div>
      </div>

      <Button onClick={handleConfirmar} disabled={confirmando || !direccionEntrega.trim()}>
        {confirmando ? 'Confirmando…' : 'Confirmar compra'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Confirmar visualmente el archivo (todavía NO corras `npm run build` completo)**

`npm run build` seguirá fallando en este punto — `OrderStatusPage.tsx` (sin tocar hasta la Tarea 5) todavía usa `metodoEntrega`/`ETIQUETA_ENTREGA`, que ya no existen. No es un error de esta tarea. El primer punto del plan donde `npm run build` debe pasar limpio es la Tarea 5, Step 2. Revisa que `CheckoutPage.tsx` haya quedado exactamente como el bloque del Step 1 (no hay pruebas automatizadas de componente para esta página, por convención del proyecto).

- [ ] **Step 3: Commit**

```bash
git add src/features/checkout/pages/CheckoutPage.tsx
git commit -m "feat(checkout): reemplaza el método de entrega por una dirección real de checkout"
```

---

### Task 5: OrderStatusPage — 9 estados, snapshot local, sondeo con corte y guía de envío

**Files:**
- Modify: `src/features/orden/pages/OrderStatusPage.tsx`

**Interfaces:**
- Consumes: `httpOrderRepository.getOrder` de la Tarea 1; `ETIQUETA_ESTADO`/`ESTADOS_TERMINALES` de la Tarea 1; `Order` de la Tarea 1 (incluye `direccionEntrega`, `trackingNumber?`).

- [ ] **Step 1: Reescribir `OrderStatusPage.tsx`**

Reemplazar todo el contenido de `src/features/orden/pages/OrderStatusPage.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Pill } from '../../../shared/components/Pill'
import { BackLink } from '../../../shared/components/BackLink'
import { Button } from '../../../shared/components/Button'
import { useNotify } from '../../../shared/notifications/NotificationContext'
import { httpOrderRepository } from '../api/orderRepository.http'
import { ESTADOS_TERMINALES, ETIQUETA_ESTADO } from '../estadoLabels'
import type { Order } from '../types'

const MENSAJE_TRANSICION: Partial<Record<Order['estado'], { texto: string; tono: 'ok' | 'falla' | 'info' }>> = {
  pagada: { texto: 'Tu pago fue confirmado.', tono: 'ok' },
  pago_fallido: { texto: 'El pago no se pudo confirmar.', tono: 'falla' },
  facturada: { texto: 'Se generó la factura de tu orden.', tono: 'info' },
  en_despacho: { texto: 'Tu orden está en despacho.', tono: 'info' },
  entregada: { texto: '¡Tu orden fue entregada!', tono: 'ok' },
  cancelada: { texto: 'La orden fue cancelada.', tono: 'falla' },
  devuelta: { texto: 'La orden fue registrada como devuelta.', tono: 'falla' },
}

const INTERVALO_SONDEO_MS = 2000

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

export function OrderStatusPage() {
  const { id } = useParams<{ id: string }>()
  const [orden, setOrden] = useState<Order | null>(null)
  const [cargando, setCargando] = useState(true)
  const { notificar } = useNotify()
  const estadoAnteriorRef = useRef<Order['estado'] | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelado = false
    let intervalo: ReturnType<typeof setInterval> | undefined

    async function consultar() {
      const resultado = await httpOrderRepository.getOrder(id!)
      if (cancelado) return
      if (resultado) {
        const anterior = estadoAnteriorRef.current
        if (anterior && anterior !== resultado.estado) {
          const transicion = MENSAJE_TRANSICION[resultado.estado]
          if (transicion) notificar(transicion.texto, transicion.tono)
        }
        estadoAnteriorRef.current = resultado.estado
        if (ESTADOS_TERMINALES.includes(resultado.estado) && intervalo) {
          clearInterval(intervalo)
        }
      }
      setOrden(resultado)
      setCargando(false)
    }

    consultar()

    // Mientras el pago está en proceso (o la orden sigue avanzando), se sondea sin bloquear la UI
    // — el backend real resuelve el flujo de forma asíncrona (cobro, factura, despacho, guía).
    // El sondeo se corta apenas se llega a un estado terminal (ver ESTADOS_TERMINALES).
    intervalo = setInterval(() => {
      if (!cancelado) consultar()
    }, INTERVALO_SONDEO_MS)

    return () => {
      cancelado = true
      if (intervalo) clearInterval(intervalo)
    }
  }, [id, notificar])

  if (cargando) return <p className="text-sm text-gray-400">Cargando orden…</p>
  if (!orden) return <p className="text-sm text-falla">No encontramos una orden con ese número.</p>

  const estado = ETIQUETA_ESTADO[orden.estado]

  return (
    <div>
      <BackLink to="/catalogo" label="Seguir comprando" />
      <h1 className="text-2xl font-semibold text-ink mb-1">Orden {orden.id}</h1>
      <Pill tone={estado.tono}>{estado.texto}</Pill>

      <div className="bg-white border border-linea rounded p-4 mt-4 mb-4">
        {orden.items.length > 0 ? (
          <div className="divide-y divide-linea">
            {orden.items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <div className="text-sm">{item.nombre}</div>
                  <div className="text-xs text-gray-400">{item.sku}</div>
                </div>
                <div className="text-sm text-gray-500 w-16">{item.cantidad}</div>
                <div className="text-sm w-24 text-right">{formatQ(item.precioUnitario * item.cantidad)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No tenemos el detalle de productos de esta orden en este navegador.</p>
        )}
        <div className="flex justify-between font-bold border-t border-linea mt-3 pt-3 text-sm">
          <span>Total</span>
          <span>{formatQ(orden.total)}</span>
        </div>
      </div>

      {orden.direccionEntrega && <p className="text-sm text-gray-500 mb-1">Entrega: {orden.direccionEntrega}</p>}
      {orden.trackingNumber && <p className="text-sm text-gray-500 mb-4">Guía de envío: {orden.trackingNumber}</p>}

      {(orden.estado === 'pendiente_pago' || orden.estado === 'pago_fallido') && (
        <>
          {orden.estado === 'pago_fallido' && <p className="text-sm text-falla mb-2">El pago no se pudo confirmar.</p>}
          <Link to={`/ordenes/${orden.id}/pago`}>
            <Button>Pagar ahora</Button>
          </Link>
        </>
      )}

      {orden.estado === 'pago_en_proceso' && (
        <p className="text-sm text-gray-400">
          Estamos confirmando tu pago. Esta página se actualiza sola cuando tengamos el resultado.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar que el proyecto compila y que toda la suite pasa**

Run: `npm run build`
Expected: éxito, sin errores en ningún archivo del plan.

Run: `npm test`
Expected: todas las pruebas pasan (las nuevas de las Tareas 1-3 más las ya existentes de catálogo/cliente, sin regresiones).

- [ ] **Step 3: Commit**

```bash
git add src/features/orden/pages/OrderStatusPage.tsx
git commit -m "feat(orden): OrderStatusPage muestra los 9 estados reales, dirección, guía y corta el sondeo al llegar a un estado terminal"
```

---

### Task 6: Documentación — contratos de API y checklist de verificación

**Files:**
- Modify: `docs/contratos-api/order-checkout-service.md`
- Modify: `docs/contratos-api/payment-service.md`
- Modify: `docs/checklist-verificacion.md`

**Interfaces:**
- Consumes: nada de código — documenta el comportamiento ya implementado en las Tareas 1-5.

- [ ] **Step 1: Reescribir `docs/contratos-api/order-checkout-service.md`**

Reemplazar todo el contenido del archivo:

```markdown
# Contrato real — Order / Checkout Service

> Consumido por `httpOrderRepository` (`src/features/orden/api/orderRepository.http.ts`). El frontend llama directo al backend (Backend 1) vía el proxy de Vite — no existe un BFF de agregación; el supuesto original de este documento (agregación por BFF) no se cumplió, igual que le pasó a `catalog-service.md`.

## `POST /api/orders/checkout`

Convierte el carrito activo del cliente en una orden — reserva stock y crea la orden en `PENDING_PAYMENT`.

**Request**
```json
{ "customerId": 1, "deliveryAddress": "Zona 10, Ciudad de Guatemala" }
```

**Response 201**
```json
{ "id": 1, "cartId": 1, "customerId": 1, "channel": "WEB", "status": "PENDING_PAYMENT", "total": 4500.00, "deliveryAddress": "Zona 10, Ciudad de Guatemala", "createdAt": null, "updatedAt": "2026-09-22T04:05:48Z" }
```
`createdAt` sale `null` en esta respuesta puntual (limitación conocida del backend) — `httpOrderRepository` usa `updatedAt` como `creadaEn` para este caso. `400` si el cliente no tiene carrito activo o está vacío; `409` si algún producto ya no está activo o no alcanza el stock — se muestran como texto en `CheckoutPage`.

**No lleva `items` en el request.** El backend usa el carrito activo del cliente tal cual está en el servidor. El frontend guarda localmente (`orderItemsSnapshot.ts`) los ítems que tenía el carrito justo antes de confirmar, solo para mostrarlos después — el backend no los devuelve en ningún endpoint de orden.

**No existe el concepto de "método de entrega"** (centro de distribución/tienda/recogida) que asumía este documento — solo `deliveryAddress`, texto libre. PB-004.1 ("elegir centro de distribución, tienda o recogida") queda no cumplido contra el backend real; se reemplazó por un campo de dirección.

## `GET /api/orders/{id}`

Estado completo de la orden en una sola consulta.

**Response 200**
```json
{
  "orderId": 1, "createdAt": "2026-09-22T04:05:48Z", "customerId": 1, "customer": "Cliente de prueba 1",
  "channel": "WEB", "status": "PENDING_PAYMENT", "total": 4500.00, "lastPaymentResult": null,
  "paymentAttempts": null, "invoiceStatus": null, "shipmentStatus": null, "trackingNumber": null
}
```
`404` si la orden no existe — `httpOrderRepository.getOrder` lo traduce a `null`.

**No trae line items ni dirección de entrega.** `httpOrderRepository.getOrder` los rellena desde el snapshot local guardado al momento del checkout (`orderItemsSnapshot.ts`) — si no existe (otro navegador, `localStorage` limpiado), `items` queda `[]` y `direccionEntrega` queda `''`; la UI lo muestra como "no tenemos el detalle en este navegador" en vez de fallar.

## Estados reales de la orden

`PENDING_PAYMENT, PAYMENT_IN_PROGRESS, PAYMENT_FAILED, PAID, INVOICED, IN_DISPATCH, DELIVERED, CANCELLED, RETURNED` — mapeados 1:1 a `EstadoOrden` (`pendiente_pago`, `pago_en_proceso`, `pago_fallido`, `pagada`, `facturada`, `en_despacho`, `entregada`, `cancelada`, `devuelta`). `entregada`/`cancelada`/`devuelta` son terminales — `OrderStatusPage` deja de sondear al llegar a cualquiera de ellos.

## "Mis órdenes" — sin endpoint de listado

El backend no tiene ningún `GET /api/customers/{id}/orders` ni equivalente. `httpOrderRepository.listOrders` mantiene un índice local por cliente (`orderIndex.ts`, `localStorage: sgo-order-ids-<customerId>`), poblado al crear cada orden (`createOrder`), y consulta el estado real de cada una con `GET /api/orders/{id}`. Esto es un índice de conveniencia del navegador, no autorización real — el endpoint de consulta de una orden sigue abierto para cualquier id, igual que el resto de la API hoy.

## Identificación / reidentificación (PB-009)

Sigue sin ser un endpoint de Order/Checkout — ver `customer-service.md`. Sin cambios respecto a la fase anterior.
```

- [ ] **Step 2: Reescribir `docs/contratos-api/payment-service.md`**

Reemplazar todo el contenido del archivo:

```markdown
# Contrato real — Payment Service

> Consumido por `httpPaymentRepository` (`src/features/pago/api/paymentRepository.http.ts`). Documentado en detalle en `FASE 2/backend/API-Transacciones.md`.

## Regla de seguridad (DC-08 / RC06 de Fase 1)

Sigue vigente: el frontend nunca envía ni persiste el número completo de tarjeta ni el CVV. Contra el backend real esto además es una regla que el propio backend hace cumplir: si el cuerpo trae un campo `cardNumber`, o si `cardToken` contiene algo que parece un número de tarjeta, responde `400` sin guardar nada. Como no existe un widget real de PayKlik en este entorno, `httpPaymentRepository` genera un token simulado (`tok_<aleatorio>`) que nunca deriva del número ingresado — simula el límite que tendría un formulario real de la pasarela.

## `POST /api/orders/{orderId}/payments`

**Request**
```json
{ "method": "CARD", "cardToken": "tok_demo123", "cardLast4": "4242" }
```
`method` es opcional (`CARD` por defecto): `CARD`, `TRANSFER` o `WALLET` — mapeado desde `tarjeta`/`transferencia`/`billetera`. `cardToken` es obligatorio; `cardLast4` obligatorio si el método es `CARD`.

**Response 201**
```json
{ "orderId": 12, "attemptNumber": 1, "result": "APPROVED", "orderStatus": "PAID", "providerReference": "PK-899B2F4A", "latencyMs": 81, "message": "cobro aprobado" }
```
`404` si la orden no existe. `409` si ya está pagada, tiene un cobro en proceso, o está cancelada/devuelta.

## Mapeo de resultado

| Backend `result` | Frontend `ResultadoCobro` | `orderStatus` real |
|---|---|---|
| `APPROVED` | `aprobado` | `PAID` |
| `DECLINED` | `rechazado` | `PAYMENT_FAILED` |
| `TIMEOUT` | `en_proceso` | `PAYMENT_IN_PROGRESS` |
| `ERROR` | `en_proceso` | `PAYMENT_IN_PROGRESS` |

`TIMEOUT`/`ERROR` no deben tratarse como fallo — el backend reintenta el cobro solo (cola de contingencia); el frontend solo debe dejar la orden visible y seguir sondeando `GET /api/orders/{id}` (`OrderStatusPage` ya lo hace).

## `GET /api/orders/{orderId}/payments` — historial de intentos

```json
[{ "id": 1, "attemptNumber": 1, "result": "ERROR", "amount": 4200.00, "providerReference": null, "cardLast4": "4242", "failureReason": "PayKlik no respondió a la solicitud de cobro", "latencyMs": 0, "attemptedAt": "2026-09-23T04:36:20Z" }]
```
`httpPaymentRepository.countIntentosFallidos` cuenta los elementos con `result: "DECLINED"`.

## Límite de reintentos (PB-014) — regla de frontend, no del backend

**El backend no tiene un concepto de "fallido definitivo".** Un solo `DECLINED` ya deja la orden en `PAYMENT_FAILED`, y nada impide un nuevo intento después (el propio backend dice "puede reintentar con otro método"). PB-014 exige un máximo de reintentos con un estado terminal — `maxIntentosFallidos = 3` se mantiene como una regla de negocio aplicada enteramente en el frontend (`PaymentPage`), contando los `DECLINED` reales del historial (`GET /api/orders/{orderId}/payments`), no el estado crudo de la orden. Esto es una decisión de producto, no una limitación técnica: el backend permitiría seguir intentando indefinidamente.

## Forzar escenarios de fallo para pruebas/demo

Como ya no existen las tarjetas "mágicas" del mock (`0000` rechaza, `1111` deja en proceso), los escenarios de rechazo/timeout se fuerzan cambiando el modo del simulador de PayKlik (fuera del frontend, vía Postman/curl):
```
PUT /api/simulation/payklik
{ "mode": "REJECT" }   // próximo cobro: DECLINED
{ "mode": "DOWN" }     // próximo cobro: se cae, entra a la cola de contingencia (PAYMENT_IN_PROGRESS)
{ "mode": "NORMAL" }   // vuelve a la normalidad
```
Ver `FASE 2/backend/API-Transacciones.md`, sección "Simulación de terceros".
```

- [ ] **Step 3: Actualizar `docs/checklist-verificacion.md` — Carrito**

En la sección `## Carrito (\`/carrito\`) — PB-002, PB-003`, reemplazar la línea:

```
- [x] El carrito persiste tras recargar la página, dentro del mismo navegador (simulación local de "el carrito es del cliente" — pendiente de validar cross-device con backend real)
```

por:

```
- [x] El carrito persiste tras recargar la página — ahora es el carrito real del backend, asociado al cliente (ya no una simulación local)
- [ ] Permite reducir la cantidad de un producto o eliminarlo del carrito (RF implícito de PB-002/PB-003) — el backend real (`POST /api/customers/{id}/cart/items`) solo soporta agregar o incrementar; no hay endpoint para bajar cantidad ni eliminar un ítem. Ver `docs/contratos-api/order-checkout-service.md` si se documenta un cart-service aparte, o el hallazgo en esta misma sección.
```

- [ ] **Step 4: Actualizar `docs/checklist-verificacion.md` — Checkout**

En la sección `## Checkout (\`/checkout\`) — PB-004`, reemplazar la línea:

```
- [x] Permite elegir centro de distribución, tienda o recogida como método de entrega (RF PB-004.1)
```

por:

```
- [ ] Permite elegir centro de distribución, tienda o recogida como método de entrega (RF PB-004.1) — contra el backend real no existe ese concepto, solo una dirección de entrega en texto libre (`deliveryAddress`); se reemplazó el selector por un campo de dirección. Ver `docs/contratos-api/order-checkout-service.md`.
```

- [ ] **Step 5: Actualizar `docs/checklist-verificacion.md` — Pago**

En la sección `## Pago (\`/ordenes/:id/pago\`) — PB-010, PB-013, PB-014`, reemplazar la línea:

```
- [x] Un cobro rechazado devuelve la orden a "pendiente de pago" y muestra el motivo (RF PB-013.1, PB-013.2)
```

por:

```
- [x] Un cobro rechazado muestra el motivo (RF PB-013.2) — contra el backend real, el estado de la orden pasa a "pago fallido" desde el primer rechazo (no "pendiente de pago"), pero sigue siendo reintentable; PB-013.1 se reinterpretó así. Ver `docs/contratos-api/payment-service.md`.
```

y reemplazar la línea:

```
- [x] Existe un máximo de reintentos fallidos; al agotarse, la orden queda "fallido definitivo" (RF PB-014.1, PB-014.2)
```

por:

```
- [x] Existe un máximo de reintentos fallidos; al agotarse, la orden queda "fallido definitivo" (RF PB-014.1, PB-014.2) — el backend real no tiene este límite; se aplica como regla de frontend sobre el historial real de intentos (`GET /api/orders/{orderId}/payments`). Ver `docs/contratos-api/payment-service.md`.
```

- [ ] **Step 6: Actualizar `docs/checklist-verificacion.md` — Mis órdenes**

En la sección `## Mis órdenes (\`/mis-ordenes\`) — adelanto de PB-038`, reemplazar la línea:

```
- [x] Lista las órdenes del cliente, ordenadas por fecha (RF PB-038.1)
```

por:

```
- [x] Lista las órdenes del cliente, ordenadas por fecha (RF PB-038.1) — el backend real no tiene un endpoint de listado; se mantiene un índice local por cliente (`localStorage`) poblado al hacer checkout, hidratado con el estado real de cada orden. Ver `docs/contratos-api/order-checkout-service.md`.
```

- [ ] **Step 7: Actualizar `docs/checklist-verificacion.md` — nota de la fase anterior y nueva sección de integración**

Reemplazar la línea (dentro de `## Integración real — Catálogo y Clientes`):

```
- Nota: carrito, checkout, pago y órdenes siguen en mock — es la siguiente fase. El panel de administración (Dashboard/Reportes) sigue en mock porque el backend no tiene esos endpoints.
```

por:

```
- Nota: carrito, checkout, pago y órdenes ya están conectados al backend real — ver la siguiente sección. El panel de administración (Dashboard/Reportes) sigue en mock porque el backend no tiene esos endpoints.
```

Y agregar, justo después de esa sección (antes de `## Hallazgos pendientes de este plan`), una nueva sección:

```markdown
## Integración real — Carrito, Checkout, Pago y Órdenes

- [x] El carrito (`/carrito`) usa el carrito real del backend (`GET/POST /api/customers/{id}/cart`); solo permite agregar/incrementar, no bajar cantidad ni eliminar (limitación real del backend, ver arriba)
- [x] El checkout (`/checkout`) pide una dirección de entrega real y crea la orden con `POST /api/orders/checkout`
- [x] La orden (`/ordenes/:id`) refleja los 9 estados reales del backend, corta el sondeo al llegar a un estado terminal (entregada/cancelada/devuelta) y muestra la guía de envío cuando existe
- [x] El pago (`/ordenes/:id/pago`) cobra contra el backend real (`POST /api/orders/{id}/payments`) con un token simulado, nunca el número de tarjeta
- [x] "Mis órdenes" sigue funcionando vía un índice local por cliente, ya que el backend no tiene endpoint de listado
- Para forzar escenarios de rechazo/timeout de pago en una demo, usar `PUT /api/simulation/payklik` (ver `docs/contratos-api/payment-service.md`) — las tarjetas "mágicas" del mock (`0000`/`1111`) ya no aplican contra el backend real.
```

- [ ] **Step 8: Commit de la documentación**

```bash
git add docs/contratos-api/order-checkout-service.md docs/contratos-api/payment-service.md docs/checklist-verificacion.md
git commit -m "docs: actualiza contratos de orden/pago y checklist con el comportamiento real del backend"
```

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { registrarCliente } from './helpers/cliente.js'

type Fixture = { cid: number; token: string; staff: Record<string, string>; pid: number }
test.describe.configure({ timeout: 90_000 })

async function setup(page: Page, request: APIRequestContext): Promise<Fixture> {
  const login = await request.post('/api/auth/login', { data: { username: 'admin', password: 'admin123' } })
  expect(login.ok()).toBeTruthy()
  const staff = { Authorization: `Bearer ${(await login.json()).token}` }
  for (const p of ['payklik', 'sat', 'logiexpress', 'messaging', 'pos', 'erp']) {
    expect((await request.put(`/api/simulation/${p}`, { headers: staff, data: { mode: 'NORMAL' } })).ok()).toBeTruthy()
  }
  await registrarCliente(page, 'Cliente Fase 3')
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('sgo-customer-session')!))
  const response = await request.post('/api/products', { headers: staff,
    data: { sku: `F3UI-${randomUUID()}`, name: 'Producto crédito Fase 3', category: 'CALZADO', price: 10 } })
  expect(response.status()).toBe(201)
  const { id: pid } = await response.json()
  const locations = await request.get('/api/inventory/locations').then(r => r.json())
  expect((await request.post('/api/inventory/movements', { headers: staff,
    data: { productId: pid, locationCode: locations.find((l: { type_id: number }) => l.type_id === 1).code,
      type: 'IN', quantity: 10, reason: 'Fixture E2E Fase 3' } })).ok()).toBeTruthy()
  return { cid: Number(session.id), token: session.token, staff, pid }
}

async function history(request: APIRequestContext, f: Fixture, changes = {}) {
  const response = await request.put(`/api/integration/erp/customers/${f.cid}/history`, { headers: f.staff,
    data: { deliveredOrders: 5, purchasedAmount: 500, latePayments: 0, overduePayments: 0,
      returns: 0, confirmedIncidents: 0, declinedPayments: 0, ...changes } })
  expect(response.ok()).toBeTruthy()
}

async function cart(page: Page, f: Fixture) {
  await page.goto(`/productos/${f.pid}`)
  await page.getByRole('button', { name: 'Agregar al carrito' }).click()
  await expect(page.getByText('Producto crédito Fase 3 (1) se agregó al carrito')).toBeVisible()
  await page.goto('/carrito')
  await expect(page.getByText('Producto crédito Fase 3', { exact: true })).toBeVisible()
  await page.goto('/checkout')
  await page.getByPlaceholder('Zona 10, Ciudad de Guatemala').fill('Zona 10 QA Fase 3')
}

async function card(page: Page) {
  await page.getByRole('radio', { name: 'Tarjeta de crédito/débito' }).check()
  await page.getByLabel('Número de tarjeta', { exact: true }).fill('4111111111111111')
  await page.getByLabel('CVV', { exact: true }).fill('123')
  await page.getByRole('button', { name: /^Pagar Q/ }).click()
  await page.waitForURL(/\/ordenes\/\d+$/)
}

async function completed(page: Page, request: APIRequestContext, f: Fixture) {
  const oid = Number(page.url().match(/ordenes\/(\d+)/)![1])
  const headers = { Authorization: `Bearer ${f.token}` }
  await expect.poll(async () => request.get(`/api/orders/${oid}`, { headers }).then(r => r.json())
    .then(o => o.trackingNumber), { timeout: 60_000 }).toBeTruthy()
  expect(await request.get(`/api/orders/${oid}/invoice`, { headers }).then(r => r.json()).then(i => i.status)).toBe('ACCEPTED')
  return oid
}

test('E01 cliente nuevo compra con PayKlik y no recibe opción de crédito', async ({ page, request }) => {
  const f = await setup(page, request)
  await cart(page, f)
  await expect(page.getByText('Se requieren más compras entregadas')).toBeVisible()
  await expect(page.getByRole('radio', { name: /Crédito MegaStore/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await page.getByRole('link', { name: 'Pagar ahora' }).click()
  await card(page)
  await completed(page, request, f)
})

test('E02 historial ERP confiable permite compra a 30 días, factura y aviso', async ({ page, request }) => {
  const f = await setup(page, request)
  await history(request, f)
  await cart(page, f)
  await page.getByRole('radio', { name: /Crédito MegaStore · paga en 30 días/ }).check()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await page.waitForURL(/\/ordenes\/\d+\/pago$/)
  await expect(page.getByRole('radio', { name: /Crédito MegaStore/ })).toBeChecked()
  await page.getByRole('button', { name: /^Pagar Q/ }).click()
  await page.waitForURL(/\/ordenes\/\d+$/)
  const oid = await completed(page, request, f)
  await expect.poll(async () => request.get(`/api/orders/${oid}/notifications`,
    { headers: { Authorization: `Bearer ${f.token}` } }).then(r => r.json())
    .then(rows => rows.some((r: { message: string; status: string }) => r.message.includes('Crédito aprobado') && r.status === 'DELIVERED')),
    { timeout: 60_000 }).toBeTruthy()
  await page.goto('/credito')
  await expect(page.getByText('Plazo de pago: 30 días. Compras entregadas: 5.')).toBeVisible()
  await expect(page.getByText(/Aprobada · Q 10.00 · Crédito aprobado/)).toBeVisible()
})

test('E03 cliente con pagos atrasados conserva la ruta de PayKlik', async ({ page, request }) => {
  const f = await setup(page, request)
  await history(request, f, { latePayments: 1 })
  await cart(page, f)
  await expect(page.getByText('El historial registra pagos fuera de plazo')).toBeVisible()
  await expect(page.getByRole('radio', { name: /Crédito MegaStore/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await page.getByRole('link', { name: 'Pagar ahora' }).click()
  await card(page)
  await completed(page, request, f)
})

test('E04 riesgo cambiado después del checkout rechaza crédito y permite pagar la misma orden', async ({ page, request }) => {
  const f = await setup(page, request)
  await history(request, f)
  await cart(page, f)
  await page.getByRole('radio', { name: /Crédito MegaStore/ }).check()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await page.waitForURL(/\/ordenes\/\d+\/pago$/)
  await expect(page.getByRole('radio', { name: /Crédito MegaStore/ })).toBeChecked()
  await history(request, f, { overduePayments: 1 })
  await page.getByRole('button', { name: /^Pagar Q/ }).click()
  await expect(page.getByText(/Existe un saldo vencido. Puedes intentar con otro método de pago/)).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Tarjeta de crédito/débito' })).toBeChecked()
  await card(page)
  await completed(page, request, f)
  await page.goto('/credito')
  await expect(page.getByText(/Rechazada · Q 10.00 · Existe un saldo vencido/)).toBeVisible()
})

test('E05 ERP caído no congela el checkout ni impide pagar con tarjeta', async ({ page, request }) => {
  const f = await setup(page, request)
  expect((await request.put('/api/simulation/erp', { headers: f.staff, data: { mode: 'DOWN' } })).ok()).toBeTruthy()
  try {
    await cart(page, f)
    await expect(page.getByText('No hay un historial ERP vigente. Puedes pagar con PayKlik.')).toBeVisible()
    await expect(page.getByRole('radio', { name: /Crédito MegaStore/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await page.getByRole('link', { name: 'Pagar ahora' }).click()
    await card(page)
    await completed(page, request, f)
  } finally {
    expect((await request.put('/api/simulation/erp', { headers: f.staff, data: { mode: 'NORMAL' } })).ok()).toBeTruthy()
  }
})

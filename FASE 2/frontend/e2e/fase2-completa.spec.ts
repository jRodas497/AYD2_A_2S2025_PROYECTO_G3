import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { registrarCliente } from './helpers/cliente.js'

async function admin(page: Page) {
  await page.goto('/administracion/login')
  await page.getByLabel('Usuario').fill('admin')
  await page.getByLabel('Contraseña').fill('admin123')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL('**/administracion/configuracion')
}
async function customerSession(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('sgo-customer-session')!)) as Promise<{ id: string; token: string }>
}
async function order(request: APIRequestContext, customer: { id: string; token: string }) {
  const headers = { Authorization: `Bearer ${customer.token}` }
  expect((await request.post(`/api/customers/${customer.id}/cart/items`, { headers, data: { productId: 7, quantity: 1, channel: 'WEB' } })).ok()).toBeTruthy()
  const response = await request.post('/api/orders/checkout', { headers, data: { customerId: Number(customer.id), deliveryAddress: 'Zona 10 QA navegador' } })
  expect(response.status()).toBe(201)
  return (await response.json()).id as number
}

test('catálogo administrativo guarda productos reales y ERP permite descarga autenticada', async ({ page }) => {
  await admin(page)
  await page.goto('/administracion/catalogo')
  const suffix = Date.now().toString()
  await page.getByLabel('SKU', { exact: true }).fill(`UI-${suffix}`)
  await page.getByLabel('Nombre', { exact: true }).fill(`Producto UI ${suffix}`)
  await page.getByLabel('Precio Q').fill('25.50')
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await expect(page.getByText(`UI-${suffix} · Producto UI ${suffix}`, { exact: false })).toBeVisible()
  await page.goto('/administracion/erp')
  await expect(page.getByRole('heading', { name: 'Conciliación ERP AS/400' })).toBeVisible()
  await page.getByRole('button', { name: 'Generar lote ahora' }).click()
  await expect(page.getByRole('button', { name: 'Detalle' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Detalle' }).first().click()
  await expect(page.getByRole('heading', { name: /Ventas del lote/ })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar', exact: true }).first().click()
  expect((await download).suggestedFilename()).toMatch(/\.(csv|xml)$/)
})

test('cuenta nueva muestra por qué todavía no tiene crédito', async ({ page }) => {
  await registrarCliente(page)
  await page.goto('/credito')
  await expect(page.getByText('Crédito aún no habilitado')).toBeVisible()
  await expect(page.getByText('Se requieren más compras entregadas')).toBeVisible()
  await expect(page.getByText('No tienes compras a crédito.')).toBeVisible()
})

test('cliente confiable paga a crédito y abona su saldo desde la interfaz sin enviar PAN ni CVV', async ({ page, request }) => {
  test.setTimeout(90_000)
  await registrarCliente(page, 'Cliente confiable UI')
  const customer = await customerSession(page)
  const headers = { Authorization: `Bearer ${customer.token}` }
  const staff = await request.post('/api/auth/login', { data: { username: 'admin', password: 'admin123' } }).then(r => r.json())
  for (let i = 0; i < 3; i++) {
    const oid = await order(request, customer)
    expect((await request.post(`/api/orders/${oid}/payments`, { headers, data: { method: 'CARD', cardToken: `tok_ui_${oid}`, cardLast4: '4242' } })).ok()).toBeTruthy()
    await expect.poll(async () => (await request.get(`/api/orders/${oid}`, { headers }).then(r => r.json())).trackingNumber, { timeout: 20_000 }).toBeTruthy()
    const shipment = await request.get(`/api/orders/${oid}/shipment`, { headers }).then(r => r.json())
    expect((await request.post(`/api/shipments/${shipment.id}/simulate-tracking`, { headers: { Authorization: `Bearer ${staff.token}` }, data: { status: 'DELIVERED', detail: 'Entrega QA' } })).ok()).toBeTruthy()
  }
  const oid = await order(request, customer)
  await page.goto(`/ordenes/${oid}/pago`)
  await page.getByRole('radio', { name: /Crédito MegaStore/ }).check()
  await page.getByRole('button', { name: /^Pagar Q/ }).click()
  await page.waitForURL(`**/ordenes/${oid}`)
  await page.goto('/credito')
  await expect(page.getByText('Crédito habilitado', { exact: true })).toBeVisible()
  await page.getByLabel('Número de tarjeta').fill('4111111111111111')
  await page.getByLabel('CVV', { exact: true }).fill('123')
  const repayment = page.waitForRequest(r => r.url().endsWith('/repay'))
  await page.getByRole('button', { name: 'Pagar saldo' }).click()
  const payload = (await repayment).postDataJSON()
  expect(payload.cardToken).toMatch(/^tok_credit_/)
  expect(JSON.stringify(payload)).not.toContain('4111111111111111')
  expect(payload.cvv).toBeUndefined()
  await expect(page.getByText('Abono registrado.')).toBeVisible()
  await expect(page.getByText('Pagado', { exact: true })).toBeVisible()
})

test('checkout permite retiro en tienda y cancelar libera la compra', async ({ page, request }) => {
  await registrarCliente(page)
  const customer = await customerSession(page)
  const headers = { Authorization: `Bearer ${customer.token}` }
  await request.post(`/api/customers/${customer.id}/cart/items`, { headers, data: { productId: 7, quantity: 1, channel: 'MOBILE' } })
  await page.goto('/checkout')
  await page.getByRole('checkbox', { name: 'Retirar en tienda' }).check()
  const stores = await request.get('/api/inventory/locations').then(r => r.json()) as { id: number; type_id: number }[]
  await page.getByLabel('Tienda de retiro').selectOption(String(stores.find(s => s.type_id === 2)!.id))
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await page.waitForURL(/\/ordenes\/\d+$/)
  await page.getByRole('button', { name: 'Cancelar orden' }).click()
  await expect(page.getByText('Cancelada', { exact: true })).toBeVisible()
})

test('menú móvil permite consultar crédito sin desbordar la pantalla', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await registrarCliente(page)
  await page.getByRole('button', { name: 'Abrir menú' }).click()
  await page.getByRole('link', { name: 'Mi crédito', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mi crédito' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'false')
  expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBeTruthy()
})

test('sesión inválida vuelve al ingreso y limpia la identidad guardada', async ({ page }) => {
  await registrarCliente(page)
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('sgo-customer-session')!)
    localStorage.setItem('sgo-customer-session', JSON.stringify({ ...session, token: 'invalid-expired-token' }))
  })
  await page.goto('/credito')
  await page.waitForURL('**/ingresar')
  expect(await page.evaluate(() => localStorage.getItem('sgo-customer-session'))).toBeNull()
})

test('devolución desde la orden actualiza estado y reembolso sin recargar la pantalla', async ({ page, request }) => {
  await registrarCliente(page)
  const customer = await customerSession(page)
  const headers = { Authorization: `Bearer ${customer.token}` }
  const staff = await request.post('/api/auth/login', { data: { username: 'admin', password: 'admin123' } }).then(r => r.json())
  const oid = await order(request, customer)
  await request.post(`/api/orders/${oid}/payments`, { headers, data: { method: 'CARD', cardToken: `tok_return_${oid}`, cardLast4: '4242' } })
  await expect.poll(async () => (await request.get(`/api/orders/${oid}`, { headers }).then(r => r.json())).trackingNumber).toBeTruthy()
  const shipment = await request.get(`/api/orders/${oid}/shipment`, { headers }).then(r => r.json())
  await request.post(`/api/shipments/${shipment.id}/simulate-tracking`, { headers: { Authorization: `Bearer ${staff.token}` }, data: { status: 'DELIVERED' } })
  await page.goto(`/ordenes/${oid}`)
  await expect(page.getByText('Entregada', { exact: true })).toBeVisible()
  await page.getByLabel('Motivo', { exact: true }).fill('Devolución solicitada desde la interfaz')
  const registered = page.waitForResponse(r => r.url().endsWith('/incidents') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Registrar solicitud' }).click()
  const incident = await (await registered).json()
  await request.put(`/api/incidents/${incident.id}/status`, { headers: { Authorization: `Bearer ${staff.token}` }, data: { status: 'RESOLVED' } })
  await expect(page.getByText('Devuelta', { exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Reembolso Q .*Procesado/)).toBeVisible({ timeout: 15_000 })
})

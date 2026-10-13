import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

async function admin(page: Page, request: APIRequestContext) {
  await page.goto('/administracion/login')
  await page.getByLabel('Usuario').fill('admin')
  await page.getByLabel('Contraseña', { exact: true }).fill('admin123')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.waitForURL('**/administracion/configuracion')
  const login = await request.post('/api/auth/login', { data: { username: 'admin', password: 'admin123' } }).then(r => r.json())
  return { Authorization: `Bearer ${login.token}` }
}

test('venta asistida continúa el carrito web, cobra y crea un reemplazo desde la bandeja', async ({ page, request }) => {
  const headers = await admin(page, request)
  const key = randomUUID()
  const customer = await request.post('/api/customers/register', { data: { fullName: `Cliente cierre ${key}`, email: `${key}@example.com`, password: 'inicial123456' } }).then(r => r.json())
  const customerHeaders = { Authorization: `Bearer ${customer.token}` }
  const product = await request.post('/api/products', { headers, data: { sku: `UI-${key}`, name: `Producto cierre ${key}`, category: 'ROPA', price: 15 } }).then(r => r.json())
  const locations = await request.get('/api/inventory/locations').then(r => r.json())
  const center = locations.find((l: { type_id: number }) => l.type_id === 1)
  const movement = await request.post('/api/inventory/movements', { headers, data: { locationCode: center.code, productId: product.id, type: 'IN', quantity: 10, reason: 'QA venta asistida UI' } })
  expect(movement.ok()).toBeTruthy()
  await request.post(`/api/customers/${customer.customerId}/cart/items`, { headers: customerHeaders, data: { productId: product.id, quantity: 1, channel: 'WEB' } })
  try {
    await page.goto(`/administracion/clientes/${customer.customerId}/venta`)
    await expect(page.getByRole('heading', { name: `Cliente seleccionado: Cliente cierre ${key}` })).toBeVisible()
    await expect(page.getByText(`Producto cierre ${key} · 1 · Q 15.00`, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Sumar unidad' }).click()
    await expect(page.getByText(`Producto cierre ${key} · 2 · Q 30.00`, { exact: true })).toBeVisible()
    await page.getByLabel('Dirección de entrega').fill('Dirección de venta telefónica QA')
    await page.getByRole('button', { name: 'Crear orden y continuar al pago' }).click()
    await page.waitForURL('**/administracion/ordenes/*/pago')
    const orderId = Number(page.url().match(/ordenes\/(\d+)\/pago/)![1])
    const order = await request.get(`/api/orders/${orderId}`, { headers }).then(r => r.json())
    expect(order.channel).toBe('CALL_CENTER')
    expect(Number(order.total)).toBe(30)
    await page.getByLabel('Número de tarjeta').fill('4242424242424242')
    await page.getByLabel('CVV', { exact: true }).fill('123')
    await page.getByRole('button', { name: 'Pagar Q 30.00', exact: true }).click()
    await page.waitForURL(`**/administracion/ordenes/${orderId}`)
    await expect.poll(async () => request.get(`/api/orders/${orderId}`, { headers }).then(r => r.json()).then(o => o.trackingNumber), { timeout: 30_000 }).toBeTruthy()
    const description = `Cambio UI ${key}`
    const incident = await request.post(`/api/orders/${orderId}/incidents`, { headers: customerHeaders, data: { type: 'EXCHANGE', description } })
    expect(incident.ok()).toBeTruthy()
    await page.goto('/administracion/incidencias')
    const row = page.locator('div.p-3').filter({ has: page.getByText(description, { exact: true }) })
    await row.getByRole('button', { name: 'Seleccionar reemplazo' }).click()
    await row.getByLabel('Buscar reemplazo').fill(key)
    await row.getByRole('button', { name: 'Buscar', exact: true }).click()
    await expect(row.getByLabel('Producto de reemplazo').locator('option')).toHaveCount(2)
    await row.getByLabel('Producto de reemplazo').selectOption(String(product.id))
    await row.getByLabel('Cantidad de reemplazo').fill('1')
    await row.getByRole('button', { name: 'Confirmar cambio y crear orden' }).click()
    await expect(page.getByText('Cambio registrado y orden de reemplazo creada.', { exact: true })).toBeVisible()
    await expect(row.getByRole('link', { name: /Orden de reemplazo/ })).toBeVisible()
    const replacementPath = await row.getByRole('link', { name: /Orden de reemplazo/ }).getAttribute('href')
    const replacementId = replacementPath!.split('/').pop()
    const replacement = await request.get(`/api/orders/${replacementId}`, { headers }).then(r => r.json())
    expect(replacement.status).toBe('PENDING_PAYMENT')
    expect(Number(replacement.total)).toBe(15)
    expect(await request.get(`/api/orders/${orderId}`, { headers }).then(r => r.json()).then(o => o.status)).toBe('RETURNED')
  } finally {
    await request.put(`/api/customers/${customer.customerId}/active`, { headers, data: { active: false } })
  }
})

test('recuperación por correo, cambio de contraseña y revocación de cuenta funcionan en navegador', async ({ page, request }) => {
  const headers = await admin(page, request)
  const email = `recuperacion-ui-${randomUUID()}@example.com`
  const customer = await request.post('/api/customers/register', { data: { fullName: 'Cuenta recuperación UI', email, password: 'inicial123456' } }).then(r => r.json())
  try {
    await page.goto('/recuperar')
    await page.getByLabel('Correo de tu cuenta').fill(email)
    await page.getByRole('button', { name: 'Enviar enlace de recuperación' }).click()
    await expect(page.getByRole('status')).toContainText('Si existe una cuenta activa')
    let link = ''
    await expect.poll(() => {
      const records = JSON.parse(execFileSync('docker', ['compose', '-f', process.env.QA_COMPOSE_FILE ?? '../docker-compose.yml', 'exec', '-T', 'messaging', 'python', '-c', "import urllib.request;print(urllib.request.urlopen('http://localhost:8090/records').read().decode())"], { encoding: 'utf8' }))
      const message = records.find((r: { request: { recipient: string } }) => r.request.recipient === email)
      link = message?.request.message.match(/https?:\/\/\S+\/recuperar\?token=[a-zA-Z0-9-]+/)?.[0] ?? ''
      return Boolean(link)
    }, { timeout: 30_000 }).toBeTruthy()
    await page.goto(new URL(link).pathname + new URL(link).search)
    await page.getByLabel('Nueva contraseña', { exact: true }).fill('recuperada123456')
    await page.getByLabel('Confirmar contraseña').fill('recuperada123456')
    await page.getByRole('button', { name: 'Restablecer contraseña', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Contraseña actualizada. Inicia sesión de nuevo.')
    await page.getByRole('link', { name: 'Volver a iniciar sesión' }).click()
    await page.getByLabel('Correo', { exact: true }).fill(email)
    await page.getByLabel('Contraseña', { exact: true }).fill('recuperada123456')
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    await page.waitForURL('**/catalogo')
    await page.goto('/perfil')
    await page.getByLabel('Contraseña actual').fill('recuperada123456')
    await page.getByLabel('Nueva contraseña', { exact: true }).fill('definitiva123456')
    await page.getByRole('button', { name: 'Cambiar contraseña y cerrar sesión' }).click()
    await page.waitForURL('**/ingresar')
    await page.getByLabel('Correo', { exact: true }).fill(email)
    await page.getByLabel('Contraseña', { exact: true }).fill('definitiva123456')
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    await page.waitForURL('**/catalogo')
    await page.goto('/perfil')
    const staffPage = await page.context().newPage()
    await staffPage.goto(`/administracion/clientes/${customer.customerId}`)
    await staffPage.getByRole('button', { name: 'Desactivar cuenta', exact: true }).click()
    await expect(staffPage.getByRole('button', { name: 'Activar cuenta', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Perfil', exact: true })).toHaveCount(0, { timeout: 20_000 })
    await expect.poll(() => page.evaluate(() => localStorage.getItem('sgo-customer-session'))).toBeNull()
    await staffPage.close()
  } finally {
    await request.put(`/api/customers/${customer.customerId}/active`, { headers, data: { active: false } })
  }
})

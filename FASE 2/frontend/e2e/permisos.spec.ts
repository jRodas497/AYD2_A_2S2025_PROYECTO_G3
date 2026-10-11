import { expect, test, type Page, type APIRequestContext } from '@playwright/test'

async function adminToken(request: APIRequestContext) {
  const response = await request.post('/api/auth/login', { data: { username: 'admin', password: 'admin123' } })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).token as string
}
async function login(page: Page, username = 'admin', password = 'admin123') {
  await page.goto('/administracion/login')
  await page.getByLabel('Usuario', { exact: true }).fill(username)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}

test('visitante ve la tienda pública y ninguna sección privada ni datos de clientes', async ({ page, request }) => {
  const customerReads: string[] = []
  page.on('request', r => { if (/\/api\/(customers|users)(\?|$)/.test(r.url())) customerReads.push(r.url()) })
  await page.goto('/catalogo')
  const nav = page.locator('aside')
  await expect(nav.getByRole('link', { name: 'Catálogo', exact: true })).toBeVisible()
  for (const name of ['Clientes', 'Usuarios y roles', 'Configuración', 'Mis órdenes', 'Mi crédito', 'Perfil']) {
    await expect(nav.getByRole('link', { name, exact: true })).toHaveCount(0)
  }
  for (const path of ['clientes', 'usuarios', 'configuracion', 'reportes', 'erp']) {
    await page.goto(`/administracion/${path}`)
    await expect(page).toHaveURL(/\/administracion\/login$/)
  }
  for (const path of ['perfil', 'mis-ordenes', 'credito', 'checkout', 'ordenes/1']) {
    await page.goto(`/${path}`)
    await expect(page).toHaveURL(/\/ingresar$/)
  }
  expect(customerReads).toHaveLength(0)
  expect((await request.get('/api/customers')).status()).toBe(401)
})

test('cliente autenticado ve su cuenta y no accede al personal', async ({ page, request }) => {
  const result = await request.post('/api/customers/register', { data: { fullName: 'QA menú cliente', email: `menu-${crypto.randomUUID()}@example.com`, password: 'prueba123456' } }).then(r => r.json())
  await page.goto('/catalogo')
  await page.evaluate(session => localStorage.setItem('sgo-customer-session', JSON.stringify(session)), { id: String(result.customerId), nombre: result.fullName, email: result.email, telefono: '', direccion: '', token: result.token })
  await page.reload()
  await expect(page.locator('aside').getByRole('link', { name: 'Mi crédito', exact: true })).toBeVisible()
  await expect(page.locator('aside').getByRole('link', { name: 'Clientes', exact: true })).toHaveCount(0)
  await page.goto('/administracion/usuarios')
  await expect(page).toHaveURL(/\/administracion\/login$/)
  expect((await request.get('/api/users', { headers: { Authorization: `Bearer ${result.token}` } })).status()).toBe(403)
})

for (const role of ['ADMIN', 'FINANCE', 'LOGISTICS', 'CALL_CENTER_AGENT', 'STORE_MANAGER', 'STORE_EMPLOYEE']) {
  test(`menú, rutas y acciones corresponden al rol ${role}`, async ({ page, request }) => {
    const admin = await adminToken(request)
    const headers = { Authorization: `Bearer ${admin}` }
    const username = `qa-ui-${role.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}`
    const worker = await request.post('/api/users', { headers, data: { username, fullName: 'QA roles UI', password: 'prueba123456', roles: [role] } }).then(r => r.json())
    try {
      await login(page, username, 'prueba123456')
      const nav = page.locator('aside')
      await expect(nav.getByRole('link', { name: 'Órdenes', exact: true })).toBeVisible()
      await expect(nav.getByRole('link', { name: 'Mis órdenes', exact: true })).toHaveCount(0)
      if (role === 'ADMIN') {
        await expect(nav.getByRole('link', { name: 'Usuarios y roles', exact: true })).toBeVisible()
        await page.goto('/administracion/usuarios')
        await expect(page.getByRole('heading', { name: 'Usuarios y roles' })).toBeVisible()
      } else {
        await expect(nav.getByRole('link', { name: 'Usuarios y roles', exact: true })).toHaveCount(0)
        await expect(nav.getByRole('link', { name: 'Configuración', exact: true })).toHaveCount(0)
        await page.goto('/administracion/usuarios')
        await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Crear usuario', exact: true })).toHaveCount(0)
      }
      if (role === 'LOGISTICS') {
        await expect(nav.getByRole('link', { name: 'Clientes', exact: true })).toHaveCount(0)
        await page.goto('/administracion/integraciones')
        await expect(page.getByRole('heading', { name: 'Integraciones', exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Generar lote ahora' })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toHaveCount(0)
        await page.goto('/administracion/clientes')
        await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible()
      }
      if (role === 'FINANCE' || role === 'CALL_CENTER_AGENT') {
        await page.goto('/administracion/inventario')
        const product = await request.get('/api/products/1').then(r => r.json())
        await page.getByPlaceholder('Buscar producto por nombre…').fill(product.name)
        await page.getByRole('button', { name: 'Buscar', exact: true }).click()
        await page.locator('button').filter({ hasText: product.name }).first().click()
        await expect(page.getByText(/\d+ disponibles$/)).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Registrar movimiento' })).toHaveCount(0)
      }
      if (role !== 'ADMIN' && role !== 'FINANCE') {
        await page.goto('/administracion/reportes')
        await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible()
      }
      await page.getByRole('button', { name: `${username} · Cerrar sesión`, exact: true }).click()
      await expect(page).toHaveURL(/\/administracion\/login$/)
      await expect(nav.getByRole('link', { name: 'Órdenes', exact: true })).toHaveCount(0)
    } finally {
      await request.put(`/api/users/${worker.id}/active`, { headers, data: { active: false } })
    }
  })
}

test('roles alterados en localStorage se verifican con el servidor antes de abrir usuarios', async ({ page, request }) => {
  const headers = { Authorization: `Bearer ${await adminToken(request)}` }
  const username = `qa-forged-${crypto.randomUUID().slice(0, 8)}`
  const worker = await request.post('/api/users', { headers, data: { username, fullName: 'QA roles alterados', password: 'prueba123456', roles: ['LOGISTICS'] } }).then(r => r.json())
  try {
    const result = await request.post('/api/auth/login', { data: { username, password: 'prueba123456' } }).then(r => r.json())
    await page.goto('/catalogo')
    await page.evaluate(session => localStorage.setItem('sgo-admin-auth', JSON.stringify(session)), { ...result, roles: ['ADMIN'] })
    await page.goto('/administracion/usuarios')
    await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible()
    await expect(page.locator('aside').getByRole('link', { name: 'Usuarios y roles', exact: true })).toHaveCount(0)
    expect((await request.get('/api/users', { headers: { Authorization: `Bearer ${result.token}` } })).status()).toBe(403)
  } finally { await request.put(`/api/users/${worker.id}/active`, { headers, data: { active: false } }) }
})

test('ADMIN crea y edita personal, actualiza roles en otra sesión y revoca acceso al cambiar contraseña o deshabilitar', async ({ page, request, browser }) => {
  const headers = { Authorization: `Bearer ${await adminToken(request)}` }
  const username = `qa-management-${crypto.randomUUID().slice(0, 8)}`
  const context = await browser.newContext()
  const workerPage = await context.newPage()
  let workerId: number | undefined
  try {
    await login(page)
    await page.getByRole('link', { name: 'Usuarios y roles', exact: true }).first().click()
    await page.getByLabel('Usuario', { exact: true }).fill(username)
    await page.getByLabel('Nombre completo', { exact: true }).fill('QA personal creado')
    await page.getByLabel('Contraseña inicial').fill('prueba123456')
    await page.getByRole('button', { name: 'Crear usuario', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Usuario creado.')
    workerId = (await request.get('/api/users', { headers }).then(r => r.json())).find((u: { username: string }) => u.username === username).id
    await login(workerPage, username, 'prueba123456')
    const row = page.getByTestId(`staff-${username}`)
    await row.getByRole('button', { name: 'Editar usuario', exact: true }).click()
    await page.getByLabel('Nombre completo', { exact: true }).fill('QA personal actualizado')
    await page.getByLabel('Personal de tienda', { exact: true }).uncheck()
    await page.getByLabel('Finanzas', { exact: true }).check()
    await page.getByRole('button', { name: 'Guardar usuario', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Usuario y roles actualizados.')
    await workerPage.evaluate('window.dispatchEvent(new Event("focus"))')
    await expect(workerPage.locator('aside').getByRole('link', { name: 'Reportes', exact: true })).toBeVisible()
    await expect(workerPage.locator('aside').getByRole('link', { name: 'Configuración', exact: true })).toHaveCount(0)
    await row.getByRole('button', { name: 'Restablecer contraseña', exact: true }).click()
    await page.getByLabel('Nueva contraseña').fill('nueva123456')
    await page.locator('form').filter({ has: page.getByLabel('Nueva contraseña') }).getByRole('button', { name: 'Restablecer contraseña', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Las sesiones anteriores fueron revocadas')
    await workerPage.evaluate('window.dispatchEvent(new Event("focus"))')
    await expect(workerPage).toHaveURL(/\/administracion\/login$/)
    expect((await request.post('/api/auth/login', { data: { username, password: 'prueba123456' } })).status()).toBe(401)
    await login(workerPage, username, 'nueva123456')
    await row.getByRole('button', { name: 'Deshabilitar', exact: true }).click()
    await expect(row.getByText('Deshabilitado', { exact: true })).toBeVisible()
    await workerPage.evaluate('window.dispatchEvent(new Event("focus"))')
    await expect(workerPage).toHaveURL(/\/administracion\/login$/)
    await row.getByRole('button', { name: 'Activar', exact: true }).click()
    await expect(row.getByText('Activo', { exact: true })).toBeVisible()
    await login(workerPage, username, 'nueva123456')
  } finally {
    await context.close()
    if (workerId !== undefined) await request.put(`/api/users/${workerId}/active`, { headers, data: { active: false } })
  }
})

import { expect, test } from '@playwright/test'

async function iniciarSesion(page: import('@playwright/test').Page) {
  await page.goto('/administracion/login')
  await page.getByLabel('Usuario').fill('admin')
  await page.getByLabel('Contraseña').fill('admin123')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  // Login exitoso redirige de inmediato a Configuración; no se queda en /login mostrando la sesión.
  await page.waitForURL('**/administracion/configuracion')
}

test('cada pantalla del backoffice carga datos reales sin sesión necesaria para solo leer', async ({ page }) => {
  await page.goto('/administracion/dashboard')
  await expect(page.getByRole('heading', { name: 'Resumen general' })).toBeVisible()
  await expect(page.getByText('Cargando panel…')).toHaveCount(0, { timeout: 10_000 })

  await page.goto('/administracion/reportes')
  await expect(page.getByRole('heading', { name: 'Reportes y métricas' })).toBeVisible()

  await page.goto('/administracion/ordenes')
  await expect(page.getByRole('heading', { name: 'Órdenes' })).toBeVisible()

  await page.goto('/administracion/clientes')
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible()

  await page.goto('/administracion/auditoria')
  await expect(page.getByRole('heading', { name: 'Auditoría' })).toBeVisible()

  await page.goto('/administracion/inventario')
  await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible()

  await page.goto('/administracion/reservas')
  await expect(page.getByRole('heading', { name: 'Reservas de stock' })).toBeVisible()

  await page.goto('/administracion/logistica')
  await expect(page.getByRole('heading', { name: 'Logística' })).toBeVisible()

  await page.goto('/administracion/seguimiento')
  await expect(page.getByRole('heading', { name: 'Seguimiento de envíos' })).toBeVisible()

  await page.goto('/administracion/integraciones')
  await expect(page.getByRole('heading', { name: 'Integraciones' })).toBeVisible()
  await expect(page.getByText('PAYKLIK')).toBeVisible({ timeout: 10_000 })

  await page.goto('/administracion/notificaciones')
  await expect(page.getByRole('heading', { name: 'Notificaciones' })).toBeVisible()

  await page.goto('/administracion/facturas')
  await expect(page.getByRole('heading', { name: 'Facturas' })).toBeVisible()

  await page.goto('/administracion/configuracion')
  await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible()
  await expect(page.getByText('reservation.ttl_minutes')).toBeVisible({ timeout: 10_000 })
})

test('el personal inicia sesión y puede procesar una incidencia real', async ({ page }) => {
  await iniciarSesion(page)

  await page.goto('/administracion/incidencias')
  await page.getByRole('combobox').selectOption('REGISTERED')

  const primeraFila = page.locator('div.bg-white.border.border-linea.rounded.divide-y > div').first()
  const hayIncidenciasRegistradas = await primeraFila.isVisible().catch(() => false)
  if (!hayIncidenciasRegistradas) {
    test.skip(true, 'no hay incidencias REGISTERED en los datos de prueba de esta corrida')
  }

  await primeraFila.getByRole('button', { name: 'Marcar en proceso' }).click()
  await expect(page.getByText('Incidencia actualizada.')).toBeVisible()
})

test('configuración exige ADMIN para editar un parámetro', async ({ page }) => {
  await page.goto('/administracion/configuracion')
  await expect(page.getByText('reservation.ttl_minutes')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0)

  await iniciarSesion(page)
  await page.goto('/administracion/configuracion')
  await expect(page.getByRole('button', { name: 'Editar' }).first()).toBeVisible({ timeout: 10_000 })
})

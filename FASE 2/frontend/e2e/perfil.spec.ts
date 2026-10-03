import { expect, test } from '@playwright/test'

test('el perfil se guarda contra el backend real y sobrevive a una recarga', async ({ page }) => {
  await page.goto('/perfil')
  await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible()

  const correo = `e2e-${Date.now()}@example.com`
  await page.getByLabel('Nombre').fill('Cliente de prueba E2E')
  await page.getByLabel('Teléfono').fill('50255500000')
  await page.getByLabel('Correo').fill(correo)
  await page.getByLabel('Dirección').fill('Zona 9, Ciudad de Guatemala')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Tus datos se actualizaron.')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Nombre')).toHaveValue('Cliente de prueba E2E')
  await expect(page.getByLabel('Correo')).toHaveValue(correo)
  await expect(page.getByLabel('Dirección')).toHaveValue('Zona 9, Ciudad de Guatemala')
})

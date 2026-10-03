import { expect, test } from '@playwright/test'

test('el carrito permite subir, bajar y quitar un producto contra el backend real', async ({ page }) => {
  await page.goto('/catalogo')
  await page.locator('a[href^="/productos/"]').first().click()
  const nombreProducto = await page.locator('h1').innerText()
  await page.getByRole('button', { name: 'Agregar al carrito' }).click()
  await expect(page.getByText(`${nombreProducto} (1) se agregó al carrito`)).toBeVisible()

  await page.goto('/carrito')
  await expect(page.getByText(nombreProducto)).toBeVisible()
  const cantidad = page.locator('span.w-8.text-center')
  await expect(cantidad).toHaveText('1')

  await page.getByRole('button', { name: `Agregar una unidad más de ${nombreProducto}` }).click()
  await expect(cantidad).toHaveText('2')

  await page.getByRole('button', { name: `Quitar una unidad de ${nombreProducto}` }).click()
  await expect(cantidad).toHaveText('1')

  await page.getByRole('button', { name: `Quitar ${nombreProducto} del carrito` }).click()
  await expect(page.getByText('Tu carrito está vacío.')).toBeVisible()
})

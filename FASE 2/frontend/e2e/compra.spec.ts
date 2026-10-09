import { expect, test } from '@playwright/test'
import { registrarCliente } from './helpers/cliente.js'

/**
 * El flujo principal del enunciado, de punta a punta, contra el backend y la base reales:
 * catálogo -> carrito -> checkout -> cobro -> factura. Cada paso espera el resultado real del
 * backend (outbox, SAT simulada) en vez de forzar el estado desde el frontend.
 */
test('compra completa: catálogo, carrito, checkout, pago y factura', async ({ page }) => {
  await registrarCliente(page)
  await page.goto('/catalogo')
  await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible()

  // El primer producto disponible del catálogo (los 12 de la migración siempre tienen existencia).
  await page.locator('a[href^="/productos/"]').first().click()
  await expect(page.getByRole('button', { name: 'Agregar al carrito' })).toBeVisible()
  const nombreProducto = await page.locator('h1').innerText()
  await page.getByRole('button', { name: 'Agregar al carrito' }).click()
  await expect(page.getByText(`${nombreProducto} (1) se agregó al carrito`)).toBeVisible()

  await page.goto('/carrito')
  await expect(page.getByText(nombreProducto)).toBeVisible()

  await page.goto('/checkout')
  await page.getByPlaceholder('Zona 10, Ciudad de Guatemala').fill('Zona 1, Ciudad de Guatemala')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(page).toHaveURL(/\/ordenes\/\d+$/)
  await expect(page.getByText('Pendiente de pago')).toBeVisible()

  await page.getByRole('link', { name: 'Pagar ahora' }).click()
  await expect(page).toHaveURL(/\/ordenes\/\d+\/pago$/)

  await page.getByPlaceholder('0000 0000 0000 0000').fill('4111111111111111')
  await page.getByLabel('CVV').fill('123')
  await page.getByRole('button', { name: /^Pagar Q/ }).click()

  // El cobro aprobado manda de vuelta al detalle de la orden; de ahí el outbox factura y despacha
  // solo, sondeado por la propia pantalla cada 2 segundos.
  await expect(page).toHaveURL(/\/ordenes\/\d+$/, { timeout: 15_000 })
  await expect(page.getByText('Pagada').or(page.getByText('Factura generada'))).toBeVisible({ timeout: 15_000 })

  await expect(page.getByText('Factura generada').or(page.getByText('En despacho'))).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Factura electrónica')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('link', { name: 'Ver XML enviado a la SAT' })).toBeVisible()
})

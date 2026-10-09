import { expect, test } from '@playwright/test'
import { registrarCliente } from './helpers/cliente.js'

/**
 * Cerrar sesión no debe dejar a quien compraba sin forma de volver a entrar: el botón de la
 * barra lateral manda a /ingresar, el link de la barra superior siempre está visible mientras no
 * haya sesión, y las pantallas que exigen cliente (carrito, checkout, mis órdenes, perfil,
 * notificaciones) redirigen solas a /ingresar en vez de quedar rotas o en blanco.
 */
test('cerrar sesión vuelve a /ingresar y las pantallas que exigen cliente redirigen ahí', async ({ page }) => {
  await registrarCliente(page, 'Cliente Cierra Sesión')

  await page.goto('/mis-ordenes')
  await expect(page.getByRole('heading', { name: 'Mis órdenes' })).toBeVisible()

  await page.getByRole('button', { name: /Cerrar sesión/ }).click()
  await expect(page).toHaveURL(/\/ingresar$/)

  // El link de "Iniciar sesión" queda visible en la barra superior en cualquier pantalla pública
  // (distinto del de personal, "Iniciar sesión de personal").
  await page.goto('/catalogo')
  const linkIngresar = page.getByRole('link', { name: 'Iniciar sesión', exact: true })
  await expect(linkIngresar).toBeVisible()
  await linkIngresar.click()
  await expect(page).toHaveURL(/\/ingresar$/)

  // Sin sesión, una pantalla que exige cliente redirige sola en vez de quedarse rota.
  await page.goto('/mis-ordenes')
  await expect(page).toHaveURL(/\/ingresar$/)
  await page.goto('/perfil')
  await expect(page).toHaveURL(/\/ingresar$/)
})

import { expect, type Page } from '@playwright/test'

/**
 * Registra y deja logueado a un cliente nuevo para la prueba (correo único por corrida, nunca
 * una de las 5 cuentas de demo sembradas por la migración): carrito, checkout, perfil y
 * notificaciones ahora exigen sesión de cliente, así que cada prueba que los toque necesita la
 * suya — usar una cuenta de demo compartiría carrito/historial entre corridas paralelas o
 * repetidas y volvería las pruebas no deterministas.
 */
export async function registrarCliente(page: Page, nombre = 'Cliente de prueba E2E'): Promise<string> {
  const correo = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  await page.goto('/ingresar')
  await page.getByRole('button', { name: '¿No tienes cuenta? Crear una' }).click()
  await page.getByLabel('Nombre').fill(nombre)
  await page.getByLabel('Correo').fill(correo)
  await page.getByLabel('Contraseña').fill('cliente123456')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.waitForURL('**/catalogo')
  await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible()
  return correo
}

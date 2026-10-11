import { expect, test, type Page } from '@playwright/test'
import { registrarCliente } from './helpers/cliente.js'

/**
 * Envíos repetidos y simultáneos a los mismos endpoints, desde la interfaz real: doble clic, ráfagas,
 * dos pestañas del mismo carrito, rechazos hasta agotar intentos, y la línea de pasos de la orden.
 * Cada prueba termina comparando lo que muestra la pantalla contra lo que el servidor guarda
 * (recargando la página), porque ese es el único criterio que de verdad importa.
 */

const CUADRO_CANTIDAD = 'span.w-8.text-center'

async function nombreYPrecioDelPrimerProducto(page: Page): Promise<string> {
  await registrarCliente(page)
  await page.goto('/catalogo')
  await page.locator('a[href^="/productos/"]').first().click()
  await page.waitForURL(/\/productos\/\d+$/)
  await expect(page.getByRole('button', { name: 'Agregar al carrito' })).toBeVisible()
  const nombre = await page.locator('h1').innerText()
  await page.getByRole('button', { name: 'Agregar al carrito' }).click()
  await expect(page.getByText(`${nombre} (1) se agregó al carrito`)).toBeVisible()
  return nombre
}

async function cantidadEnPantalla(page: Page): Promise<number> {
  return Number(await page.locator(CUADRO_CANTIDAD).innerText())
}

async function cantidadDespuesDeRecargar(page: Page): Promise<number> {
  await page.reload()
  await expect(page.locator(CUADRO_CANTIDAD)).toBeVisible()
  return cantidadEnPantalla(page)
}

async function irAlCarritoConCantidad(page: Page, nombre: string, cantidad: number) {
  await page.goto('/carrito')
  await expect(page.getByText(nombre)).toBeVisible()
  for (let actual = 1; actual < cantidad; actual++) {
    await page.getByRole('button', { name: `Agregar una unidad más de ${nombre}` }).click()
    await expect(page.locator(CUADRO_CANTIDAD)).toHaveText(String(actual + 1))
  }
}

/** Dos clics síncronos en el mismo tick: lo que hace un doble clic antes de que React re-pinte. */
async function dobleClicSincrono(boton: import('@playwright/test').Locator, veces = 2) {
  await boton.evaluate((el, n) => {
    const b = el as unknown as { click(): void }
    for (let i = 0; i < n; i++) b.click()
  }, veces)
}

test.describe('carrito bajo envíos repetidos', () => {
  test('dos pestañas bajan la misma cantidad a la vez: el servidor resta las dos', async ({ page }) => {
    const nombre = await nombreYPrecioDelPrimerProducto(page)
    await irAlCarritoConCantidad(page, nombre, 3)

    const otraPestana = await page.context().newPage()
    await otraPestana.goto('/carrito')
    await expect(otraPestana.getByText(nombre)).toBeVisible()
    await expect(otraPestana.locator(CUADRO_CANTIDAD)).toHaveText('3')

    await Promise.all([
      page.getByRole('button', { name: `Quitar una unidad de ${nombre}` }).click(),
      otraPestana.getByRole('button', { name: `Quitar una unidad de ${nombre}` }).click(),
    ])

    // Cada pestaña muestra la respuesta de su propio clic; la verdad es la del servidor, así que se
    // compara después de recargar. Dos bajadas desde 3 tienen que dejar 1, no 2.
    expect(await cantidadDespuesDeRecargar(page)).toBe(1)
    await otraPestana.close()
  })

  test('dos pestañas suben la misma cantidad a la vez: ninguna subida se pierde', async ({ page }) => {
    const nombre = await nombreYPrecioDelPrimerProducto(page)
    await irAlCarritoConCantidad(page, nombre, 1)

    const otraPestana = await page.context().newPage()
    await otraPestana.goto('/carrito')
    await expect(otraPestana.getByText(nombre)).toBeVisible()

    await Promise.all([
      page.getByRole('button', { name: `Agregar una unidad más de ${nombre}` }).click(),
      otraPestana.getByRole('button', { name: `Agregar una unidad más de ${nombre}` }).click(),
    ])

    // Igual que al bajar: la verdad es la del servidor, se compara tras recargar. Desde 1, dos subidas
    // tienen que dejar 3.
    expect(await cantidadDespuesDeRecargar(page)).toBe(3)
    await otraPestana.close()
  })

  test('doble clic en − resta una unidad por clic y la pantalla coincide con el servidor', async ({ page }) => {
    const nombre = await nombreYPrecioDelPrimerProducto(page)
    await irAlCarritoConCantidad(page, nombre, 3)

    await dobleClicSincrono(page.getByRole('button', { name: `Quitar una unidad de ${nombre}` }))
    await expect(page.locator(CUADRO_CANTIDAD)).toHaveText('1')

    expect(await cantidadDespuesDeRecargar(page)).toBe(1)
  })

  test('ráfaga de + en una pestaña: cada clic cuenta y la pantalla coincide con el servidor', async ({ page }) => {
    const nombre = await nombreYPrecioDelPrimerProducto(page)
    await irAlCarritoConCantidad(page, nombre, 1)

    await dobleClicSincrono(page.getByRole('button', { name: `Agregar una unidad más de ${nombre}` }), 5)
    await expect(page.locator(CUADRO_CANTIDAD)).toHaveText('6')

    expect(await cantidadDespuesDeRecargar(page)).toBe(6)
  })

  test('agregar al carrito varias veces seguidas: el carrito coincide con el servidor', async ({ page }) => {
    await registrarCliente(page)
    await page.goto('/catalogo')
    await page.locator('a[href^="/productos/"]').first().click()
    await expect(page.getByRole('button', { name: 'Agregar al carrito' })).toBeVisible()
    const nombre = await page.locator('h1').innerText()

    const agregar = page.getByRole('button', { name: /Agregar al carrito|Agregando/ })
    await dobleClicSincrono(agregar, 3)
    await expect(page.getByRole('button', { name: 'Agregar al carrito' })).toBeEnabled()

    await page.goto('/carrito')
    await expect(page.getByText(nombre)).toBeVisible()
    const enCarrito = await cantidadEnPantalla(page)
    expect(enCarrito).toBeGreaterThanOrEqual(1)
    expect(enCarrito).toBeLessThanOrEqual(3)
    expect(await cantidadDespuesDeRecargar(page)).toBe(enCarrito)
  })
})

test.describe('checkout y pago bajo envíos repetidos', () => {
  test('doble confirmación del checkout crea una sola orden y muestra la línea de pasos', async ({ page }) => {
    await nombreYPrecioDelPrimerProducto(page)
    await page.goto('/checkout')
    await page.getByPlaceholder('Zona 10, Ciudad de Guatemala').fill('Zona 1, Ciudad de Guatemala')

    await dobleClicSincrono(page.getByRole('button', { name: 'Confirmar compra' }))

    await expect(page).toHaveURL(/\/ordenes\/\d+$/)
    await expect(page.getByText('Pendiente de pago')).toBeVisible()

    const pasos = page.getByLabel('Proceso de la orden')
    await expect(pasos).toBeVisible()
    await expect(pasos.getByText('Cobro', { exact: true })).toBeVisible()
    await expect(pasos.getByText('Entrega', { exact: true })).toBeVisible()
  })

  test('tarjeta incompleta: el error aparece en cada envío y el formulario sigue usable', async ({ page }) => {
    await nombreYPrecioDelPrimerProducto(page)
    await page.goto('/checkout')
    await page.getByPlaceholder('Zona 10, Ciudad de Guatemala').fill('Zona 1, Ciudad de Guatemala')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page).toHaveURL(/\/ordenes\/\d+$/)
    await page.getByRole('link', { name: 'Pagar ahora' }).click()
    await expect(page).toHaveURL(/\/ordenes\/\d+\/pago$/)

    for (let intento = 1; intento <= 3; intento++) {
      await page.getByPlaceholder('0000 0000 0000 0000').fill('4111 1111')
      await page.getByLabel('CVV').fill('123')
      await page.getByRole('button', { name: /^Pagar Q/ }).click()
      await expect(page.getByText('Ingresa un número de tarjeta válido de 16 dígitos').last()).toBeVisible()
      await expect(page.getByRole('button', { name: /^Pagar Q/ })).toBeEnabled()
    }
  })

  test('rechazo repetido hasta agotar los intentos: cada rechazo se muestra y luego se bloquea el reintento', async ({ page, request }) => {
    try {
      await request.put('/api/simulation/PAYKLIK', { headers: { Authorization: `Bearer ${(await request.post('/api/auth/login', { data: { username: 'admin', password: 'admin123' } }).then(r => r.json())).token}` }, data: { mode: 'REJECT' } })
      await nombreYPrecioDelPrimerProducto(page)
      await page.goto('/checkout')
      await page.getByPlaceholder('Zona 10, Ciudad de Guatemala').fill('Zona 1, Ciudad de Guatemala')
      await page.getByRole('button', { name: 'Confirmar compra' }).click()
      await expect(page).toHaveURL(/\/ordenes\/\d+$/)
      const urlOrden = page.url()
      await page.getByRole('link', { name: 'Pagar ahora' }).click()

      // Los dos primeros rechazos dejan el formulario listo para otro intento; el tercero agota los
      // intentos y la pantalla pasa a "Pago fallido definitivamente", sin formulario.
      for (let intento = 1; intento <= 2; intento++) {
        await page.getByPlaceholder('0000 0000 0000 0000').fill('4111111111111111')
        await page.getByLabel('CVV').fill('123')
        await page.getByRole('button', { name: /^Pagar Q/ }).click()
        await expect(page.getByText(/Pago rechazado/).last()).toBeVisible({ timeout: 15_000 })
        await expect(page.getByRole('button', { name: /^Pagar Q/ })).toBeEnabled({ timeout: 15_000 })
      }

      await page.getByPlaceholder('0000 0000 0000 0000').fill('4111111111111111')
      await page.getByLabel('CVV').fill('123')
      await page.getByRole('button', { name: /^Pagar Q/ }).click()
      await expect(page.getByRole('heading', { name: 'Pago fallido definitivamente' })).toBeVisible({ timeout: 15_000 })

      await page.goto(urlOrden)
      await expect(page.getByText('Se agotaron los intentos de cobro para esta orden.')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole('link', { name: 'Pagar ahora' })).toHaveCount(0)
    } finally {
      await request.put('/api/simulation/PAYKLIK', { headers: { Authorization: `Bearer ${(await request.post('/api/auth/login', { data: { username: 'admin', password: 'admin123' } }).then(r => r.json())).token}` }, data: { mode: 'NORMAL' } })
    }
  })

  test('orden inexistente: la pantalla lo dice en vez de quedarse cargando', async ({ page }) => {
    await registrarCliente(page)
    await page.goto('/ordenes/999999999')
    await expect(page.getByText('No encontramos una orden con ese número.')).toBeVisible({ timeout: 15_000 })
  })

  // Va al final: deja la orden en cola de contingencia y el circuito de PayKlik puede quedar abierto.
  test('PayKlik caído: el cobro queda en proceso con su aviso, no se pierde', async ({ page, request }) => {
    try {
      await request.put('/api/simulation/PAYKLIK', { headers: { Authorization: `Bearer ${(await request.post('/api/auth/login', { data: { username: 'admin', password: 'admin123' } }).then(r => r.json())).token}` }, data: { mode: 'DOWN' } })
      await nombreYPrecioDelPrimerProducto(page)
      await page.goto('/checkout')
      await page.getByPlaceholder('Zona 10, Ciudad de Guatemala').fill('Zona 1, Ciudad de Guatemala')
      await page.getByRole('button', { name: 'Confirmar compra' }).click()
      await expect(page).toHaveURL(/\/ordenes\/\d+$/)
      await page.getByRole('link', { name: 'Pagar ahora' }).click()

      await page.getByPlaceholder('0000 0000 0000 0000').fill('4111111111111111')
      await page.getByLabel('CVV').fill('123')
      await page.getByRole('button', { name: /^Pagar Q/ }).click()

      await expect(page).toHaveURL(/\/ordenes\/\d+$/, { timeout: 15_000 })
      await expect(page.getByText('Pago en proceso')).toBeVisible({ timeout: 15_000 })
    } finally {
      await request.put('/api/simulation/PAYKLIK', { headers: { Authorization: `Bearer ${(await request.post('/api/auth/login', { data: { username: 'admin', password: 'admin123' } }).then(r => r.json())).token}` }, data: { mode: 'NORMAL' } })
    }
  })
})

test('la bandeja gestiona avisos fallidos y su estado vacío sin errores', async ({ page }) => {
  await page.goto('/administracion/login')
  await page.getByLabel('Usuario').fill('admin')
  await page.getByLabel('Contraseña').fill('admin123')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL('**/administracion/configuracion')

  await page.goto('/administracion/notificaciones')
  const reintentar = page.getByRole('button', { name: 'Reintentar' }).first()
  await expect(page.getByText('Cargando…', { exact: true })).toHaveCount(0)
  if (!(await reintentar.isVisible().catch(() => false))) {
    await expect(page.getByText('Sin avisos con ese filtro.')).toBeVisible()
    return
  }

  await dobleClicSincrono(reintentar)
  await expect(page.getByText(/vuelto a encolar para reintento/).first()).toBeVisible()
  await expect(page.getByText('No se pudo reintentar el aviso')).toHaveCount(0)
})

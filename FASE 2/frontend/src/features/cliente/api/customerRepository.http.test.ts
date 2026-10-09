import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpCustomerRepository } from './customerRepository.http'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const BACKEND_CLIENTE = {
  id: 7,
  fullName: 'Cliente de prueba 7',
  email: 'cliente7@example.com',
  phone: '50200000007',
  taxId: 'CF',
  address: 'Zona 7',
  createdAt: '2026-09-22T04:03:01Z',
}

describe('httpCustomerRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getCustomer() mapea fullName/phone/email/address del backend', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(BACKEND_CLIENTE))
    const cliente = await httpCustomerRepository.getCustomer('7')
    expect(cliente).toEqual({
      id: '7',
      nombre: 'Cliente de prueba 7',
      telefono: '50200000007',
      email: 'cliente7@example.com',
      direccion: 'Zona 7',
    })
  })

  it('getCustomer() devuelve null en 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ message: 'no existe' }, 404))
    const cliente = await httpCustomerRepository.getCustomer('999')
    expect(cliente).toBeNull()
  })

  it('createCustomer() manda fullName/phone/email/address y devuelve el cliente creado', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(BACKEND_CLIENTE, 201))
    const cliente = await httpCustomerRepository.createCustomer({ nombre: 'Cliente de prueba 7', telefono: '50200000007' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/customers',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ fullName: 'Cliente de prueba 7', phone: '50200000007', email: null, address: '' }),
      }),
    )
    expect(cliente.nombre).toBe('Cliente de prueba 7')
  })

  it('createCustomer() manda null (no cadena vacía) cuando no hay correo, porque email es unique en la base', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ ...BACKEND_CLIENTE, email: null }, 201))
    await httpCustomerRepository.createCustomer({ nombre: 'Cliente invitado' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/customers',
      expect.objectContaining({
        body: JSON.stringify({ fullName: 'Cliente invitado', phone: '', email: null, address: '' }),
      }),
    )
  })

  it('updateCustomer() manda el registro completo para no borrar email/direccion que no cambiaron', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(BACKEND_CLIENTE))
    await httpCustomerRepository.updateCustomer('7', {
      nombre: 'Cliente de prueba 7',
      telefono: '50200000007',
      email: 'cliente7@example.com',
      direccion: 'Zona 7',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/customers/7',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          fullName: 'Cliente de prueba 7',
          phone: '50200000007',
          email: 'cliente7@example.com',
          address: 'Zona 7',
        }),
      }),
    )
  })

  it('updateCustomer() devuelve null en 404 en vez de lanzar', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ message: 'no existe' }, 404))
    const resultado = await httpCustomerRepository.updateCustomer('999', { nombre: 'X', telefono: '123' })
    expect(resultado).toBeNull()
  })

  it('login() manda email/password y mapea la sesión con su token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        token: 'token-123',
        customerId: 101,
        fullName: 'María López',
        email: 'maria@example.com',
        phone: '50201110001',
        address: 'Zona 10',
      }),
    )
    const sesion = await httpCustomerRepository.login({ email: 'maria@example.com', password: 'cliente123' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/customers/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'maria@example.com', password: 'cliente123' }),
      }),
    )
    expect(sesion).toEqual({
      id: '101',
      nombre: 'María López',
      telefono: '50201110001',
      email: 'maria@example.com',
      direccion: 'Zona 10',
      token: 'token-123',
    })
  })

  it('login() propaga el mensaje de error en credenciales incorrectas', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ message: 'correo o contraseña incorrectos' }, 401))
    await expect(httpCustomerRepository.login({ email: 'maria@example.com', password: 'mala' })).rejects.toThrow(
      'correo o contraseña incorrectos',
    )
  })

  it('register() manda los datos de la cuenta nueva y devuelve la sesión', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        {
          token: 'token-nuevo',
          customerId: 200,
          fullName: 'Nueva Cliente',
          email: 'nueva@example.com',
          phone: '',
          address: '',
        },
        201,
      ),
    )
    const sesion = await httpCustomerRepository.register({
      nombre: 'Nueva Cliente',
      email: 'nueva@example.com',
      password: 'secreta123',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/customers/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Nueva Cliente',
          email: 'nueva@example.com',
          password: 'secreta123',
          phone: '',
          address: '',
        }),
      }),
    )
    expect(sesion.id).toBe('200')
    expect(sesion.token).toBe('token-nuevo')
  })
})

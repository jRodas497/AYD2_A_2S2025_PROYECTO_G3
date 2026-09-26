import { describe, expect, it } from 'vitest'
import { NotFoundError, manejarRespuesta } from './httpErrors'

function respuesta(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('manejarRespuesta', () => {
  it('devuelve el cuerpo parseado cuando la respuesta es 2xx', async () => {
    const resultado = await manejarRespuesta<{ ok: boolean }>(respuesta({ ok: true }, 200))
    expect(resultado).toEqual({ ok: true })
  })

  it('lanza NotFoundError en 404', async () => {
    await expect(manejarRespuesta(respuesta({ message: 'no existe' }, 404))).rejects.toBeInstanceOf(NotFoundError)
  })

  it('lanza un Error con el mensaje del backend en otros códigos de error', async () => {
    await expect(manejarRespuesta(respuesta({ message: 'stock insuficiente' }, 409))).rejects.toThrow(
      'stock insuficiente',
    )
  })

  it('usa un mensaje genérico si el cuerpo de error no trae message', async () => {
    await expect(manejarRespuesta(respuesta({}, 500))).rejects.toThrow('Error del servidor (500)')
  })
})

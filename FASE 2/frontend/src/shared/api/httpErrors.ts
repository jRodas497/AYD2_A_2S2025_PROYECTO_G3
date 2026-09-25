export class NotFoundError extends Error {}

async function extraerMensajeError(response: Response): Promise<string> {
  const cuerpo = await response.json().catch(() => null)
  return cuerpo?.message ?? `Error del servidor (${response.status})`
}

export async function manejarRespuesta<T>(response: Response): Promise<T> {
  if (response.status === 404) {
    throw new NotFoundError('recurso no encontrado')
  }
  if (!response.ok) {
    throw new Error(await extraerMensajeError(response))
  }
  return response.json() as Promise<T>
}

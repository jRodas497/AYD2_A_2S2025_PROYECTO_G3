/** Authenticated same-origin requests for both store customers and backoffice staff. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
  const key = window.location.pathname.startsWith('/administracion') ? 'sgo-admin-auth' : 'sgo-customer-session'
  let token: string | undefined
  if (path.startsWith('/api/') && !new Headers(init?.headers).has('Authorization')) {
    try { token = JSON.parse(localStorage.getItem(key) ?? 'null')?.token } catch { /* malformed saved session */ }
  }
  let options = init
  if (token) {
    const original = init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init?.headers ?? {}
    options = { ...init, headers: { ...original, Authorization: `Bearer ${token}` } }
  }
  const requestToken = token ?? new Headers(init?.headers).get('Authorization')?.replace(/^Bearer /, '')
  const response = options ? await globalThis.fetch(input, options) : await globalThis.fetch(input)
  if (requestToken && response.status === 401 && !path.includes('/login') && !path.includes('/register')) {
    let current: string | undefined
    try { current = JSON.parse(localStorage.getItem(key) ?? 'null')?.token } catch { /* malformed saved session */ }
    if (current === requestToken) window.dispatchEvent(new CustomEvent('sgo-session-expired', { detail: key }))
  }
  return response
}

export async function downloadFile(url: string, name: string): Promise<void> {
  const response = await apiFetch(url)
  if (!response.ok) throw new Error('No se pudo descargar el archivo')
  const objectUrl = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = objectUrl; link.download = name; link.click()
  URL.revokeObjectURL(objectUrl)
}

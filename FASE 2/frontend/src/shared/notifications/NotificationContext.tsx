import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export type NotificationTone = 'ok' | 'alerta' | 'falla' | 'info'

interface Notificacion {
  id: number
  mensaje: string
  tono: NotificationTone
}

interface NotificationContextValue {
  notificar: (mensaje: string, tono?: NotificationTone) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

const DURACION_MS = 4000

const TONE_STYLES: Record<NotificationTone, string> = {
  ok: 'bg-green-50 border-green-400 text-green-900',
  alerta: 'bg-orange-50 border-orange-400 text-orange-900',
  falla: 'bg-red-50 border-red-400 text-red-900',
  info: 'bg-blue-50 border-blue-400 text-blue-900',
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const contador = useRef(0)

  const cerrar = useCallback((id: number) => {
    setNotificaciones((actual) => actual.filter((n) => n.id !== id))
  }, [])

  const notificar = useCallback(
    (mensaje: string, tono: NotificationTone = 'info') => {
      const id = contador.current++
      setNotificaciones((actual) => [...actual, { id, mensaje, tono }])
      setTimeout(() => cerrar(id), DURACION_MS)
    },
    [cerrar],
  )

  return (
    <NotificationContext.Provider value={{ notificar }}>
      {children}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {notificaciones.map((n) => (
          <div
            key={n.id}
            className={`rounded shadow-lg border ${TONE_STYLES[n.tono]} px-4 py-3 text-sm flex items-start justify-between gap-3`}
          >
            <span>{n.mensaje}</span>
            <button
              type="button"
              onClick={() => cerrar(n.id)}
              className="opacity-60 hover:opacity-100 leading-none"
              aria-label="Cerrar notificación"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

export function useNotify(): NotificationContextValue {
  const value = useContext(NotificationContext)
  if (!value) throw new Error('useNotify debe usarse dentro de <NotificationProvider>')
  return value
}

import { useState } from 'react'
import { Button } from '../../../shared/components/Button'
import { useCustomer } from '../../../shared/context/CustomerContext'
import { useNotify } from '../../../shared/notifications/NotificationContext'

export function PerfilPage() {
  const { customer, actualizarPerfil } = useCustomer()
  const { notificar } = useNotify()
  const [form, setForm] = useState({
    nombre: customer.nombre,
    telefono: customer.telefono,
    email: customer.email,
    direccion: customer.direccion,
  })
  const [guardando, setGuardando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    const resultado = await actualizarPerfil(form)
    setGuardando(false)
    if (resultado.ok) {
      notificar('Tus datos se actualizaron.', 'ok')
    } else {
      notificar(resultado.motivo ?? 'No se pudo guardar tu información', 'falla')
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold text-ink mb-1">Perfil</h1>
      <p className="text-sm text-gray-500 mb-6">
        Estos datos se usan para identificarte entre canales y para avisarte sobre tus órdenes.
      </p>

      <form onSubmit={handleSubmit} className="bg-white border border-linea rounded p-4 space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nombre</label>
          <input
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
            className="w-full border border-linea rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
          <input
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            className="w-full border border-linea rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Correo</label>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            type="email"
            className="w-full border border-linea rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Dirección</label>
          <input
            value={form.direccion}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            className="w-full border border-linea rounded px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </div>
  )
}

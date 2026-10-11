import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '../../../shared/components/Button'
import { useCustomer } from '../../../shared/context/CustomerContext'
import { useNotify } from '../../../shared/notifications/NotificationContext'
import { apiFetch } from '../../../shared/api/apiFetch'
import { manejarRespuesta } from '../../../shared/api/httpErrors'

export function PerfilPage() {
  const { customer, actualizarPerfil, logout } = useCustomer()
  const [password,setPassword]=useState('')
  const [currentPassword,setCurrentPassword]=useState('')
  const [changing,setChanging]=useState(false)
  const { notificar } = useNotify()
  const [form, setForm] = useState({
    nombre: customer?.nombre ?? '',
    telefono: customer?.telefono ?? '',
    email: customer?.email ?? '',
    direccion: customer?.direccion ?? '',
  })
  const [guardando, setGuardando] = useState(false)

  if (!customer) return <Navigate to="/ingresar" replace />

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
          <label htmlFor="perfil-nombre" className="block text-xs text-gray-500 mb-1">Nombre</label>
          <input
            id="perfil-nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
            className="w-full border border-linea rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="perfil-telefono" className="block text-xs text-gray-500 mb-1">Teléfono</label>
          <input
            id="perfil-telefono"
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            className="w-full border border-linea rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="perfil-email" className="block text-xs text-gray-500 mb-1">Correo</label>
          <input
            id="perfil-email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            type="email"
            className="w-full border border-linea rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="perfil-direccion" className="block text-xs text-gray-500 mb-1">Dirección</label>
          <input
            id="perfil-direccion"
            value={form.direccion}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            className="w-full border border-linea rounded px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
      <form className="bg-white border rounded p-4 mt-4 space-y-3" onSubmit={async e=>{
        e.preventDefault();if(changing)return;setChanging(true)
        try{await manejarRespuesta(await apiFetch(`/api/customers/${customer.id}/password`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,password})}));setPassword('');setCurrentPassword('');logout();notificar('Contraseña actualizada. Inicia sesión de nuevo.','ok')}
        catch(e){notificar(e instanceof Error?e.message:'No se pudo cambiar la contraseña','falla')}finally{setChanging(false)}
      }}>
        <h2 className="font-semibold">Cambiar contraseña</h2>
        <label className="block">Contraseña actual<input className="border rounded p-2 block w-full" type="password" autoComplete="current-password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label>
        <label className="block">Nueva contraseña<input className="border rounded p-2 block w-full" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <Button type="submit" disabled={changing}>Cambiar contraseña y cerrar sesión</Button>
      </form>
    </div>
  )
}

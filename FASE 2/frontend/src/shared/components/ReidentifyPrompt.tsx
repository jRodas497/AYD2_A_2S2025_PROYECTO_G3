import { useState } from 'react'
import { useCustomer } from '../context/CustomerContext'
import { Button } from './Button'

export function ReidentifyPrompt() {
  const { customer, needsReidentification, identify } = useCustomer()
  const [nombre, setNombre] = useState(customer.nombre)
  const [telefono, setTelefono] = useState(customer.telefono)

  if (!needsReidentification) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    identify({ nombre, telefono })
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-ink mb-1">Confirma que eres tú</h2>
        <p className="text-sm text-gray-500 mb-4">
          No reconocemos tu sesión en este canal. Identifícate para recuperar tu carrito e historial.
        </p>

        <label className="block text-xs text-gray-500 mb-1">Nombre</label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          className="w-full border border-linea rounded px-3 py-2 text-sm mb-3"
        />

        <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          required
          className="w-full border border-linea rounded px-3 py-2 text-sm mb-4"
        />

        <Button type="submit" className="w-full">
          Continuar
        </Button>
      </form>
    </div>
  )
}

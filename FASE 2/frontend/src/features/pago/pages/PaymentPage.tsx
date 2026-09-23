import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BackLink } from '../../../shared/components/BackLink'
import { Button } from '../../../shared/components/Button'
import { Pill } from '../../../shared/components/Pill'
import { useNotify } from '../../../shared/notifications/NotificationContext'
import { mockOrderRepository } from '../../orden/api/orderRepository.mock'
import { mockPaymentRepository } from '../api/paymentRepository.mock'
import type { Order } from '../../orden/types'
import type { MetodoPago } from '../types'

const OPCIONES_METODO: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'tarjeta', etiqueta: 'Tarjeta de crédito/débito' },
  { valor: 'transferencia', etiqueta: 'Transferencia bancaria' },
  { valor: 'billetera', etiqueta: 'Billetera digital' },
]

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

export function PaymentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { notificar } = useNotify()
  const [orden, setOrden] = useState<Order | null>(null)
  const [cargando, setCargando] = useState(true)
  const [metodo, setMetodo] = useState<MetodoPago>('tarjeta')
  const [numeroTarjeta, setNumeroTarjeta] = useState('')
  const [cvv, setCvv] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [rechazoMotivo, setRechazoMotivo] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    mockOrderRepository.getOrder(id).then((resultado) => {
      setOrden(resultado)
      setCargando(false)
    })
  }, [id])

  if (cargando) return <p className="text-sm text-gray-400">Cargando…</p>
  if (!orden) return <p className="text-sm text-falla">No encontramos una orden con ese número.</p>

  if (orden.estado === 'pagada') {
    return (
      <div>
        <BackLink to={`/ordenes/${orden.id}`} label="Volver a la orden" />
        <p className="text-sm text-ok">Esta orden ya está pagada.</p>
      </div>
    )
  }

  if (orden.estado === 'pago_fallido') {
    return (
      <div>
        <BackLink to={`/ordenes/${orden.id}`} label="Volver a la orden" />
        <h1 className="text-2xl font-semibold text-ink mb-2">Pago fallido definitivamente</h1>
        <p className="text-sm text-gray-500">
          Se agotaron los intentos de cobro para esta orden. Te notificaremos para que puedas reintentar más
          tarde.
        </p>
      </div>
    )
  }

  async function handlePagar(e: React.FormEvent) {
    e.preventDefault()
    if (!orden) return
    setEnviando(true)
    setRechazoMotivo(null)

    // Nunca se envía ni persiste el número completo de tarjeta — solo los últimos 4 dígitos.
    const ultimosDigitos = numeroTarjeta.replace(/\D/g, '').slice(-4)
    setNumeroTarjeta('')
    setCvv('')

    const intento = await mockPaymentRepository.charge(
      orden.id,
      metodo,
      metodo === 'tarjeta' ? { ultimosDigitos } : undefined,
    )

    if (intento.resultado === 'aprobado') {
      notificar('Pago aprobado. Tu orden fue confirmada.', 'ok')
      navigate(`/ordenes/${orden.id}`)
      return
    }

    if (intento.resultado === 'en_proceso') {
      notificar('Tu pago quedó en proceso. Te avisaremos cuando se confirme.', 'info')
      navigate(`/ordenes/${orden.id}`)
      return
    }

    // Rechazado: releer la orden, porque el repositorio ya pudo haberla marcado pago_fallido.
    const actualizada = await mockOrderRepository.getOrder(orden.id)
    setOrden(actualizada)
    const motivo = intento.motivo ?? 'El cobro fue rechazado'
    setRechazoMotivo(motivo)
    notificar(`Pago rechazado: ${motivo}`, 'falla')
    setEnviando(false)
  }

  return (
    <div>
      <BackLink to={`/ordenes/${orden.id}`} label="Volver a la orden" />
      <h1 className="text-2xl font-semibold text-ink mb-6">Pagar orden {orden.id}</h1>

      {rechazoMotivo && (
        <div className="border border-falla bg-red-50 rounded p-3 text-sm text-falla mb-4">
          <span className="flex items-center gap-2 font-medium mb-1">
            <Pill tone="falla">Rechazado</Pill>
          </span>
          {rechazoMotivo}. Puedes intentar con otro método de pago.
        </div>
      )}

      <form onSubmit={handlePagar}>
        <h2 className="text-sm font-medium text-ink mb-2">Método de pago</h2>
        <div className="space-y-2 mb-4">
          {OPCIONES_METODO.map((opcion) => (
            <label
              key={opcion.valor}
              className={`flex items-center gap-3 border rounded p-3 cursor-pointer bg-white ${
                metodo === opcion.valor ? 'border-brand border-2' : 'border-linea'
              }`}
            >
              <input
                type="radio"
                name="metodo"
                value={opcion.valor}
                checked={metodo === opcion.valor}
                onChange={() => setMetodo(opcion.valor)}
              />
              <span className="text-sm text-ink">{opcion.etiqueta}</span>
            </label>
          ))}
        </div>

        {metodo === 'tarjeta' && (
          <div className="bg-white border border-linea rounded p-4 mb-4 space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Número de tarjeta</label>
              <input
                value={numeroTarjeta}
                onChange={(e) => setNumeroTarjeta(e.target.value)}
                inputMode="numeric"
                placeholder="0000 0000 0000 0000"
                required
                className="w-full border border-linea rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs text-gray-500 mb-1">CVV</label>
              <input
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                inputMode="numeric"
                maxLength={4}
                required
                className="w-full border border-linea rounded px-3 py-2 text-sm"
              />
            </div>
            <p className="text-[11px] text-gray-400">
              Solo los últimos 4 dígitos se usan para procesar el cobro; el número completo nunca se guarda.
            </p>
          </div>
        )}

        <Button type="submit" disabled={enviando}>
          {enviando ? 'Procesando…' : `Pagar ${formatQ(orden.total)}`}
        </Button>
      </form>
    </div>
  )
}

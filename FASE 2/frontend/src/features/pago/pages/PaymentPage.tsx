import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BackLink } from '../../../shared/components/BackLink'
import { Button } from '../../../shared/components/Button'
import { Pill } from '../../../shared/components/Pill'
import { useNotify } from '../../../shared/notifications/NotificationContext'
import { httpOrderRepository } from '../../orden/api/orderRepository.http'
import { httpPaymentRepository } from '../api/paymentRepository.http'
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
  const [intentosFallidos, setIntentosFallidos] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metodo, setMetodo] = useState<MetodoPago>('tarjeta')
  const [numeroTarjeta, setNumeroTarjeta] = useState('')
  const [cvv, setCvv] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [rechazoMotivo, setRechazoMotivo] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([httpOrderRepository.getOrder(id), httpPaymentRepository.countIntentosFallidos(id)])
      .then(([resultadoOrden, fallidos]) => {
        setOrden(resultadoOrden)
        setIntentosFallidos(fallidos)
        setCargando(false)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'No se pudo cargar la información de pago')
        setCargando(false)
      })
  }, [id])

  if (cargando) return <p className="text-sm text-gray-400">Cargando…</p>
  if (error) return <p className="text-sm text-falla">{error}</p>
  if (!orden) return <p className="text-sm text-falla">No encontramos una orden con ese número.</p>

  if (orden.estado === 'pagada' || orden.estado === 'facturada' || orden.estado === 'en_despacho' || orden.estado === 'entregada') {
    return (
      <div>
        <BackLink to={`/ordenes/${orden.id}`} label="Volver a la orden" />
        <p className="text-sm text-ok">Esta orden ya está pagada.</p>
      </div>
    )
  }

  if (orden.estado === 'cancelada' || orden.estado === 'devuelta') {
    return (
      <div>
        <BackLink to={`/ordenes/${orden.id}`} label="Volver a la orden" />
        <p className="text-sm text-falla">Esta orden ya no admite pagos.</p>
      </div>
    )
  }

  if (orden.estado === 'pago_en_proceso') {
    return (
      <div>
        <BackLink to={`/ordenes/${orden.id}`} label="Volver a la orden" />
        <p className="text-sm text-gray-400">Tu pago se está confirmando. Consulta el estado de la orden para ver el resultado.</p>
      </div>
    )
  }

  if (intentosFallidos >= httpPaymentRepository.maxIntentosFallidos) {
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

    const ultimosDigitos = numeroTarjeta.replace(/\D/g, '').slice(-4)

    if (metodo === 'tarjeta' && ultimosDigitos.length !== 4) {
      notificar('Ingresa un número de tarjeta válido', 'falla')
      setEnviando(false)
      return
    }

    setNumeroTarjeta('')
    setCvv('')

    let intento
    try {
      intento = await httpPaymentRepository.charge(
        orden.id,
        metodo,
        metodo === 'tarjeta' ? { ultimosDigitos } : undefined,
      )
    } catch (err) {
      notificar(err instanceof Error ? err.message : 'No se pudo procesar el pago', 'falla')
      setEnviando(false)
      return
    }

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

    try {
      const fallidosActualizados = await httpPaymentRepository.countIntentosFallidos(orden.id)
      setIntentosFallidos(fallidosActualizados)
    } catch {
      // Si no se puede confirmar el conteo real de rechazos, no se bloquea el reintento — se
      // mantiene el conteo local ya conocido en vez de dejar la pantalla colgada.
    }
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

import { useCustomer } from '../../../shared/context/CustomerContext'
import { apiFetch } from '../../../shared/api/apiFetch'
import { manejarRespuesta } from '../../../shared/api/httpErrors'
import type { CreditAccount } from '../../credito/CreditPage'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { BackLink } from '../../../shared/components/BackLink'
import { Button } from '../../../shared/components/Button'
import { Pill } from '../../../shared/components/Pill'
import { useNotify } from '../../../shared/notifications/NotificationContext'
import { httpOrderRepository } from '../../orden/api/orderRepository.http'
import { httpPaymentRepository } from '../api/paymentRepository.http'
import type { Order } from '../../orden/types'
import type { MetodoPago } from '../types'

const LONGITUD_TARJETA = 16

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
  const basePath = useLocation().pathname.startsWith('/administracion') ? '/administracion' : ''
  const { customer } = useCustomer()
  const [credit, setCredit] = useState<CreditAccount | null>(null)
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

  useEffect(() => {
    const creditCustomer = basePath ? orden?.customerId : customer?.id
    if (creditCustomer) apiFetch(`/api/customers/${creditCustomer}/credit`).then(r => manejarRespuesta<CreditAccount>(r)).then(result=>{
      setCredit(result)
      if(orden?.paymentPreference==='CREDIT'&&result.eligible&&Number(result.available)>=orden.total)setMetodo('credito')
    }).catch(() => setCredit(null))
  }, [customer?.id, orden?.customerId, orden?.paymentPreference, orden?.total, basePath])

  if (cargando) return <p className="text-sm text-gray-400">Cargando…</p>
  if (error) return <p className="text-sm text-falla">{error}</p>
  if (!orden) return <p className="text-sm text-falla">No encontramos una orden con ese número.</p>

  if (orden.estado === 'pagada' || orden.estado === 'facturada' || orden.estado === 'en_despacho' || orden.estado === 'entregada') {
    return (
      <div>
        <BackLink to={`${basePath}/ordenes/${orden.id}`} label="Volver a la orden" />
        <p className="text-sm text-ok">Esta orden ya está pagada.</p>
      </div>
    )
  }

  if (orden.estado === 'cancelada' || orden.estado === 'devuelta') {
    return (
      <div>
        <BackLink to={`${basePath}/ordenes/${orden.id}`} label="Volver a la orden" />
        <p className="text-sm text-falla">Esta orden ya no admite pagos.</p>
      </div>
    )
  }

  if (orden.estado === 'pago_en_proceso') {
    return (
      <div>
        <BackLink to={`${basePath}/ordenes/${orden.id}`} label="Volver a la orden" />
        <p className="text-sm text-gray-400">Tu pago se está confirmando. Consulta el estado de la orden para ver el resultado.</p>
      </div>
    )
  }

  if (intentosFallidos >= httpPaymentRepository.maxIntentosFallidos) {
    return (
      <div>
        <BackLink to={`${basePath}/ordenes/${orden.id}`} label="Volver a la orden" />
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

    const digitosTarjeta = numeroTarjeta.replace(/\D/g, '')

    if (metodo === 'tarjeta' && digitosTarjeta.length !== LONGITUD_TARJETA) {
      notificar(`Ingresa un número de tarjeta válido de ${LONGITUD_TARJETA} dígitos`, 'falla')
      setEnviando(false)
      return
    }

    const ultimosDigitos = digitosTarjeta.slice(-4)

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
      if(metodo==='credito'){
        setRechazoMotivo(err instanceof Error?err.message:'El crédito no pudo aprobarse. Puedes continuar con PayKlik.')
        setMetodo('tarjeta')
        try{setCredit(await manejarRespuesta<CreditAccount>(await apiFetch(`/api/customers/${orden.customerId}/credit`)))}catch{setCredit(null)}
      }
      setEnviando(false)
      return
    }

    if (intento.resultado === 'aprobado') {
      notificar('Pago aprobado. Tu orden fue confirmada.', 'ok')
      navigate(`${basePath}/ordenes/${orden.id}`)
      return
    }

    if (intento.resultado === 'en_proceso') {
      notificar('Tu pago quedó en proceso. Te avisaremos cuando se confirme.', 'info')
      navigate(`${basePath}/ordenes/${orden.id}`)
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
      <BackLink to={`${basePath}/ordenes/${orden.id}`} label="Volver a la orden" />
      <h1 className="text-2xl font-semibold text-ink mb-6">Pagar orden {orden.id}</h1>

      {rechazoMotivo && (
        <div className="border border-falla bg-red-50 rounded p-3 text-sm text-falla mb-4">
          <span className="flex items-center gap-2 font-medium mb-1">
            <Pill tone="falla">Rechazado</Pill>
          </span>
          {rechazoMotivo}. Puedes intentar con otro método de pago.
        </div>
      )}

      {credit && <p className="text-sm mb-4">Crédito: {credit.reason}. Disponible: Q {Number(credit.available).toFixed(2)}</p>}
      <form onSubmit={handlePagar}>
        <h2 className="text-sm font-medium text-ink mb-2">Método de pago</h2>
        <div className="space-y-2 mb-4">
          {[...OPCIONES_METODO, ...(credit?.eligible && Number(credit.available) >= orden.total ? [{ valor: 'credito' as MetodoPago, etiqueta: `Crédito MegaStore · ${credit.termDays} días` }] : [])].map((opcion) => (
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
              <label htmlFor="pago-numero-tarjeta" className="block text-xs text-gray-500 mb-1">Número de tarjeta</label>
              <input
                id="pago-numero-tarjeta"
                value={numeroTarjeta}
                onChange={(e) => setNumeroTarjeta(e.target.value)}
                inputMode="numeric"
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                required
                className="w-full border border-linea rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="w-24">
              <label htmlFor="pago-cvv" className="block text-xs text-gray-500 mb-1">CVV</label>
              <input
                id="pago-cvv"
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

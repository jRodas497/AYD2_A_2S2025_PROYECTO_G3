import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Pill } from '../../../shared/components/Pill'
import { BackLink } from '../../../shared/components/BackLink'
import { Button } from '../../../shared/components/Button'
import { useNotify } from '../../../shared/notifications/NotificationContext'
import { httpOrderRepository } from '../api/orderRepository.http'
import { httpInvoiceRepository, type Invoice } from '../api/invoiceRepository.http'
import { httpPaymentRepository } from '../../pago/api/paymentRepository.http'
import { ESTADOS_TERMINALES, ETIQUETA_ESTADO } from '../estadoLabels'
import type { Order } from '../types'

const ESTADOS_CON_FACTURA: Order['estado'][] = ['facturada', 'en_despacho', 'entregada', 'devuelta']

function formatFechaFactura(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const MENSAJE_TRANSICION: Partial<Record<Order['estado'], { texto: string; tono: 'ok' | 'falla' | 'info' }>> = {
  pagada: { texto: 'Tu pago fue confirmado.', tono: 'ok' },
  pago_fallido: { texto: 'El pago no se pudo confirmar.', tono: 'falla' },
  facturada: { texto: 'Se generó la factura de tu orden.', tono: 'info' },
  en_despacho: { texto: 'Tu orden está en despacho.', tono: 'info' },
  entregada: { texto: '¡Tu orden fue entregada!', tono: 'ok' },
  cancelada: { texto: 'La orden fue cancelada.', tono: 'falla' },
  devuelta: { texto: 'La orden fue registrada como devuelta.', tono: 'falla' },
}

const INTERVALO_SONDEO_MS = 2000

function formatQ(valor: number): string {
  return `Q ${valor.toFixed(2)}`
}

export function OrderStatusPage() {
  const { id } = useParams<{ id: string }>()
  const [orden, setOrden] = useState<Order | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intentosFallidos, setIntentosFallidos] = useState(0)
  const [factura, setFactura] = useState<Invoice | null>(null)
  const { notificar } = useNotify()
  const estadoAnteriorRef = useRef<Order['estado'] | null>(null)
  const tieneOrdenCargadaRef = useRef(false)

  useEffect(() => {
    if (!id) return
    let cancelado = false
    let intervalo: ReturnType<typeof setInterval> | undefined

    async function consultar() {
      try {
        const resultado = await httpOrderRepository.getOrder(id!)
        if (cancelado) return

        if (resultado) {
          const anterior = estadoAnteriorRef.current
          if (anterior && anterior !== resultado.estado) {
            const transicion = MENSAJE_TRANSICION[resultado.estado]
            if (transicion) notificar(transicion.texto, transicion.tono)
          }
          estadoAnteriorRef.current = resultado.estado

          let fallidos = 0
          if (resultado.estado === 'pago_fallido') {
            try {
              fallidos = await httpPaymentRepository.countIntentosFallidos(resultado.id)
            } catch {
              // Si no se puede confirmar el conteo real, no se trata como fallo definitivo —
              // se sigue ofreciendo reintentar en vez de dejar la pantalla colgada.
            }
          }
          if (cancelado) return
          setIntentosFallidos(fallidos)

          const esFalloDefinitivo = resultado.estado === 'pago_fallido' && fallidos >= httpPaymentRepository.maxIntentosFallidos
          if ((ESTADOS_TERMINALES.includes(resultado.estado) || esFalloDefinitivo) && intervalo) {
            clearInterval(intervalo)
          }
        } else if (intervalo) {
          // La orden no existe (404) — no tiene sentido seguir sondeando para siempre.
          clearInterval(intervalo)
        }

        tieneOrdenCargadaRef.current = resultado !== null
        setOrden(resultado)
        setError(null)
        setCargando(false)
      } catch (e) {
        if (cancelado) return
        setCargando(false)
        // Un fallo puntual de red no descarta lo último que sí se cargó bien — solo se muestra
        // como error de pantalla completa si nunca se logró cargar la orden.
        if (!tieneOrdenCargadaRef.current) {
          setError(e instanceof Error ? e.message : 'No se pudo consultar la orden')
          if (intervalo) clearInterval(intervalo)
        }
      }
    }

    consultar()

    // Mientras el pago está en proceso (o la orden sigue avanzando), se sondea sin bloquear la UI
    // — el backend real resuelve el flujo de forma asíncrona (cobro, factura, despacho, guía).
    // El sondeo se corta apenas se llega a un estado terminal, a un fallo de pago definitivo, o a
    // que la orden deje de existir.
    intervalo = setInterval(() => {
      if (!cancelado) consultar()
    }, INTERVALO_SONDEO_MS)

    return () => {
      cancelado = true
      if (intervalo) clearInterval(intervalo)
    }
  }, [id, notificar])

  useEffect(() => {
    if (!id || !orden || factura || !ESTADOS_CON_FACTURA.includes(orden.estado)) return
    httpInvoiceRepository
      .ofOrder(id)
      .then(setFactura)
      .catch(() => {
        // Si la factura todavía no se puede consultar, la pantalla no se cae por eso.
      })
  }, [id, orden, factura])

  if (cargando) return <p className="text-sm text-gray-400">Cargando orden…</p>
  if (error) return <p className="text-sm text-falla">{error}</p>
  if (!orden) return <p className="text-sm text-falla">No encontramos una orden con ese número.</p>

  const estado = ETIQUETA_ESTADO[orden.estado]

  return (
    <div>
      <BackLink to="/catalogo" label="Seguir comprando" />
      <h1 className="text-2xl font-semibold text-ink mb-1">Orden {orden.id}</h1>
      <Pill tone={estado.tono}>{estado.texto}</Pill>

      <div className="bg-white border border-linea rounded p-4 mt-4 mb-4">
        {orden.items.length > 0 ? (
          <div className="divide-y divide-linea">
            {orden.items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <div className="text-sm">{item.nombre}</div>
                  <div className="text-xs text-gray-400">{item.sku}</div>
                </div>
                <div className="text-sm text-gray-500 w-16">{item.cantidad}</div>
                <div className="text-sm w-24 text-right">{formatQ(item.precioUnitario * item.cantidad)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No tenemos el detalle de productos de esta orden en este navegador.</p>
        )}
        <div className="flex justify-between font-bold border-t border-linea mt-3 pt-3 text-sm">
          <span>Total</span>
          <span>{formatQ(orden.total)}</span>
        </div>
      </div>

      {orden.direccionEntrega && <p className="text-sm text-gray-500 mb-1">Entrega: {orden.direccionEntrega}</p>}
      {orden.trackingNumber && <p className="text-sm text-gray-500 mb-4">Guía de envío: {orden.trackingNumber}</p>}

      {factura && (
        <div className="bg-white border border-linea rounded p-4 mb-4 text-sm">
          <h2 className="font-medium text-ink mb-2">Factura electrónica</h2>
          <dl className="grid grid-cols-2 gap-1 text-xs text-gray-500 mb-2">
            <dt>Autorización (CUI)</dt>
            <dd className="text-ink">{factura.cui}</dd>
            <dt>Serie</dt>
            <dd className="text-ink">{factura.series}</dd>
            <dt>Emitida</dt>
            <dd className="text-ink">{formatFechaFactura(factura.generatedAt)}</dd>
          </dl>
          <a
            href={httpInvoiceRepository.xmlUrl(orden.id)}
            target="_blank"
            rel="noreferrer"
            className="text-brand hover:underline text-xs"
          >
            Ver XML enviado a la SAT
          </a>
        </div>
      )}

      {orden.estado === 'pago_fallido' && intentosFallidos >= httpPaymentRepository.maxIntentosFallidos && (
        <p className="text-sm text-falla">
          Se agotaron los intentos de cobro para esta orden. Te notificaremos para que puedas reintentar más tarde.
        </p>
      )}

      {(orden.estado === 'pendiente_pago' ||
        (orden.estado === 'pago_fallido' && intentosFallidos < httpPaymentRepository.maxIntentosFallidos)) && (
        <>
          {orden.estado === 'pago_fallido' && <p className="text-sm text-falla mb-2">El pago no se pudo confirmar.</p>}
          <Link to={`/ordenes/${orden.id}/pago`}>
            <Button>Pagar ahora</Button>
          </Link>
        </>
      )}

      {orden.estado === 'pago_en_proceso' && (
        <p className="text-sm text-gray-400">
          Estamos confirmando tu pago. Esta página se actualiza sola cuando tengamos el resultado.
        </p>
      )}
    </div>
  )
}

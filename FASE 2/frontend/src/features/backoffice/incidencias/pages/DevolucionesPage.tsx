import { IncidentInbox } from './IncidentInbox'

export function DevolucionesPage() {
  return (
    <IncidentInbox
      tipoFijo="RETURN"
      titulo="Devoluciones"
      descripcion="Solo las incidencias de tipo devolución. Al resolverse, la orden pasa a DEVUELTA."
    />
  )
}

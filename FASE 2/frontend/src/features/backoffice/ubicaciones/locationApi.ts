import { apiFetch } from '../../../shared/api/apiFetch'
import { manejarRespuesta } from '../../../shared/api/httpErrors'
export interface Location { id: number; code: string; name: string; type_id: number; type?: string; address: string; active?: boolean }
export interface Transfer {
 id: number; source_id: number; destination_id: number; source_code: string; destination_code: string; order_id: number | null;
 status: 'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED'; reason: string; carrier_name: string | null; transport_reference: string | null; last_error: string | null; driver_name?: string | null; vehicle_plate?: string | null;
 items?: { id: number; product_id: number; product_name: string; sku: string; quantity: number }[];
 events?: { status: string; detail: string; actor: string; created_at: string }[];
}
export const TRANSFER_LABEL = { PENDING: 'Pendiente de salida', IN_TRANSIT: 'En tránsito', RECEIVED: 'Recibido', CANCELLED: 'Cancelado' }
export const LOCATION_LABEL: Record<number, string> = { 1: 'Centro de distribución', 2: 'Tienda', 3: 'Bodega' }
export async function locationRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
 return manejarRespuesta<T>(await apiFetch(path, { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }))
}

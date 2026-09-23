type Tone = 'ok' | 'alerta' | 'falla' | 'info' | 'neutro'

const TONE_STYLES: Record<Tone, string> = {
  ok: 'bg-green-50 text-green-800 border-green-300',
  alerta: 'bg-orange-50 text-orange-800 border-orange-300',
  falla: 'bg-red-50 text-red-800 border-red-300',
  info: 'bg-blue-50 text-blue-800 border-blue-300',
  neutro: 'bg-gray-100 text-gray-700 border-gray-300',
}

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-block text-xs px-2 py-1 rounded-full border whitespace-nowrap ${TONE_STYLES[tone]}`}>
      {children}
    </span>
  )
}

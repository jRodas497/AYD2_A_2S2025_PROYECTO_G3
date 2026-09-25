export function BackofficePlaceholderPage({ titulo }: { titulo: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-2">{titulo}</h1>
      <p className="text-sm text-gray-500">Módulo de administración pendiente de implementación.</p>
    </div>
  )
}

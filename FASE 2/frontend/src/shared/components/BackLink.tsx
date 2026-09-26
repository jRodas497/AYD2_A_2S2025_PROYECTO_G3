import { Link } from 'react-router-dom'

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm text-brand hover:underline mb-4">
      <span aria-hidden="true">←</span> {label}
    </Link>
  )
}

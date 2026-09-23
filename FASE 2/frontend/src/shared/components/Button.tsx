import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

export function Button({ variant = 'primary', className = '', ...rest }: ButtonProps) {
  const base = 'px-6 py-2 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed'
  const styles =
    variant === 'primary'
      ? 'bg-brand text-white hover:bg-brand-dark'
      : 'bg-white text-brand border border-brand hover:bg-crema'
  return <button className={`${base} ${styles} ${className}`} {...rest} />
}

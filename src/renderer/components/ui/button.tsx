import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type ButtonVariant = 'default' | 'secondary' | 'danger' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({
  variant = 'default',
  className = '',
  children,
  ...props
}: PropsWithChildren<ButtonProps>) {
  const base =
    variant === 'secondary'
      ? 'secondary-button'
      : variant === 'danger'
        ? 'secondary-button danger-button'
        : variant === 'icon'
          ? 'icon-button'
          : 'primary-button'

  return (
    <button className={`${base} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}

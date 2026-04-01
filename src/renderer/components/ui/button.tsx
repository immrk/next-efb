import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'icon'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClassNames: Record<ButtonVariant, string> = {
  default: 'button button-default',
  secondary: 'button button-secondary',
  outline: 'button button-outline',
  ghost: 'button button-ghost',
  destructive: 'button button-destructive',
  icon: 'button button-icon'
}

const sizeClassNames: Record<ButtonSize, string> = {
  default: '',
  sm: 'button-sm',
  lg: 'button-lg',
  icon: 'button-icon-size'
}

export function Button({
  variant = 'default',
  size = 'default',
  className = '',
  children,
  type = 'button',
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      type={type}
      className={`${variantClassNames[variant]} ${sizeClassNames[size]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}

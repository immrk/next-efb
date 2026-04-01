import type { HTMLAttributes, PropsWithChildren } from 'react'

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClassNames: Record<BadgeVariant, string> = {
  default: 'badge badge-default',
  secondary: 'badge badge-secondary',
  outline: 'badge badge-outline',
  destructive: 'badge badge-destructive'
}

export function Badge({
  variant = 'default',
  className = '',
  children,
  ...props
}: PropsWithChildren<BadgeProps>) {
  return (
    <span className={`${variantClassNames[variant]} ${className}`.trim()} {...props}>
      {children}
    </span>
  )
}

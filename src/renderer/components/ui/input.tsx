import type { InputHTMLAttributes } from 'react'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return <input className={`text-input ${className}`.trim()} {...rest} />
}

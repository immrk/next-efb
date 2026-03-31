import type { TextareaHTMLAttributes } from 'react'

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props
  return <textarea className={`text-input ${className}`.trim()} {...rest} />
}

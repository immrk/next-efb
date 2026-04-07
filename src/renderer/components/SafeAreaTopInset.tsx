interface SafeAreaTopInsetProps {
  className?: string
}

export function SafeAreaTopInset({ className = '' }: SafeAreaTopInsetProps) {
  return <div className={`safe-area-top-inset ${className}`.trim()} aria-hidden="true" />
}

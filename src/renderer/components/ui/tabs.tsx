import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { createContext, forwardRef, useContext } from 'react'

type TabsContextValue = {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext(componentName: string): TabsContextValue {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error(`${componentName} must be used within Tabs`)
  }

  return context
}

interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  value: string
  onValueChange: (value: string) => void
}

export function Tabs({ className = '', value, onValueChange, children, ...props }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={`tabs ${className}`.trim()} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

interface TabsListProps extends HTMLAttributes<HTMLDivElement> {}

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(({ className = '', ...props }, ref) => {
  return <div ref={ref} role="tablist" className={`tabs-list ${className}`.trim()} {...props} />
})
TabsList.displayName = 'TabsList'

interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className = '', value, children, disabled, ...props }, ref) => {
    const context = useTabsContext('TabsTrigger')
    const selected = context.value === value

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={selected}
        aria-controls={`tabs-content-${value}`}
        className={`tabs-trigger ${selected ? 'active' : ''} ${className}`.trim()}
        data-state={selected ? 'active' : 'inactive'}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            context.onValueChange(value)
          }
        }}
        {...props}
      >
        {children}
      </button>
    )
  }
)
TabsTrigger.displayName = 'TabsTrigger'

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string
  children: ReactNode
}

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className = '', value, children, ...props }, ref) => {
    const context = useTabsContext('TabsContent')
    if (context.value !== value) {
      return null
    }

    return (
      <div
        ref={ref}
        id={`tabs-content-${value}`}
        role="tabpanel"
        className={`tabs-content ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TabsContent.displayName = 'TabsContent'

import * as React from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from './button'
import { Input } from './input'

export interface MultiSelectOption {
  value: string
  label: string
  description?: string | null
  searchText?: string
}

export function MultiSelect({
  label,
  options,
  value,
  open,
  onOpenChange,
  onValueChange,
  placeholder,
  searchPlaceholder,
  selectAllLabel,
  clearVisibleLabel,
  selectionSummary,
  emptyMessage,
  noResultsMessage,
  disabled = false,
  className
}: {
  label: string
  options: MultiSelectOption[]
  value: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onValueChange: (value: string[]) => void
  placeholder: string
  searchPlaceholder: string
  selectAllLabel: string
  clearVisibleLabel: string
  selectionSummary: string
  emptyMessage: string
  noResultsMessage: string
  disabled?: boolean
  className?: string
}) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const labelId = React.useId()
  const listboxId = React.useId()
  const [search, setSearch] = React.useState('')
  const selectedValues = React.useMemo(() => new Set(value), [value])
  const selectedOptions = React.useMemo(
    () => options.filter((option) => selectedValues.has(option.value)),
    [options, selectedValues]
  )
  const filteredOptions = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return options
    return options.filter((option) =>
      `${option.label} ${option.description ?? ''} ${option.searchText ?? ''}`
        .toLocaleLowerCase()
        .includes(query)
    )
  }, [options, search])
  const allFilteredSelected =
    filteredOptions.length > 0 &&
    filteredOptions.every((option) => selectedValues.has(option.value))

  React.useEffect(() => {
    if (!open) {
      setSearch('')
      return
    }

    searchRef.current?.focus()

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onOpenChange(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onOpenChange, open])

  const toggleOption = (optionValue: string) => {
    if (selectedValues.has(optionValue)) {
      onValueChange(value.filter((currentValue) => currentValue !== optionValue))
      return
    }
    onValueChange([...value, optionValue])
  }

  const toggleAllFiltered = () => {
    const filteredValues = new Set(filteredOptions.map((option) => option.value))
    if (allFilteredSelected) {
      onValueChange(value.filter((currentValue) => !filteredValues.has(currentValue)))
      return
    }
    onValueChange(Array.from(new Set([...value, ...filteredValues])))
  }

  const visibleChips = selectedOptions.slice(0, 2)
  const hiddenChipCount = Math.max(0, selectedOptions.length - visibleChips.length)

  return (
    <div
      ref={rootRef}
      className={cn('multi-select', open && 'is-open', className)}
    >
      <span id={labelId} className="multi-select-label">
        {label}
      </span>

      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-labelledby={labelId}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="multi-select-trigger"
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        <span className="multi-select-trigger-value">
          {visibleChips.length > 0 ? (
            <>
              {visibleChips.map((option) => (
                <span key={option.value} className="multi-select-chip" title={option.label}>
                  {option.label}
                </span>
              ))}
              {hiddenChipCount > 0 ? (
                <span className="multi-select-chip multi-select-chip-overflow">
                  +{hiddenChipCount}
                </span>
              ) : null}
            </>
          ) : (
            <span className="multi-select-placeholder">{placeholder}</span>
          )}
        </span>

        <span className="multi-select-trigger-meta">
          {selectedOptions.length > 0 ? (
            <span className="multi-select-count">
              {selectedOptions.length}/{options.length}
            </span>
          ) : null}
          <ChevronDown className="multi-select-chevron" />
        </span>
      </Button>

      {open ? (
        <div className="multi-select-panel">
          <div className="multi-select-toolbar">
            <div className="multi-select-search">
              <Search aria-hidden="true" />
              <Input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="multi-select-bulk-action"
              onClick={toggleAllFiltered}
              disabled={filteredOptions.length === 0}
            >
              {allFilteredSelected ? clearVisibleLabel : selectAllLabel}
            </Button>
          </div>

          <div className="multi-select-panel-summary">
            {selectionSummary}
          </div>

          <div
            id={listboxId}
            className="multi-select-options"
            role="listbox"
            aria-multiselectable="true"
            aria-labelledby={labelId}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const selected = selectedValues.has(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className="multi-select-option"
                    onClick={() => toggleOption(option.value)}
                  >
                    <span className="multi-select-option-check" aria-hidden="true">
                      <Check />
                    </span>
                    <span className="multi-select-option-copy">
                      <strong>{option.label}</strong>
                      {option.description ? <small>{option.description}</small> : null}
                    </span>
                  </button>
                )
              })
            ) : (
              <div className="multi-select-empty">
                {options.length > 0 ? noResultsMessage : emptyMessage}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

import type { ReactNode } from 'react'
import { FileText, Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { Input } from './ui/input'

interface LibraryImportToolbarProps {
  namespace: 'charts' | 'checklists'
  searchValue: string
  onSearchValueChange: (value: string) => void
  showImportPanel: boolean
  onShowImportPanelChange: (value: boolean) => void
  closable?: boolean
  onClose?: () => void
  onImportFile?: () => void
  importFileDisabled?: boolean
  importUrlValue?: string
  importUrlPending?: boolean
  importUrlDisabled?: boolean
  onImportUrlValueChange?: (value: string) => void
  onImportFromUrl?: () => void
  importMetadata?: ReactNode
}

export function LibraryImportToolbar({
  namespace,
  searchValue,
  onSearchValueChange,
  showImportPanel,
  onShowImportPanelChange,
  closable = false,
  onClose,
  onImportFile,
  importFileDisabled = false,
  importUrlValue = '',
  importUrlPending = false,
  importUrlDisabled = false,
  onImportUrlValueChange,
  onImportFromUrl,
  importMetadata
}: LibraryImportToolbarProps) {
  const { t } = useTranslation()

  return (
    <>
      <header className="chart-picker-head">
        <Input
          className="chart-picker-search"
          placeholder={t(`${namespace}.searchPlaceholder`)}
          value={searchValue}
          onChange={(event) => onSearchValueChange(event.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          enterKeyHint="search"
          spellCheck={false}
        />
        {onImportFromUrl ? (
          <Button
            type="button"
            variant={showImportPanel ? 'default' : 'outline'}
            size="icon"
            className="chart-picker-link-toggle"
            onClick={() => onShowImportPanelChange(!showImportPanel)}
            aria-label={t(`${namespace}.add`)}
          >
            <Plus className="size-4" />
          </Button>
        ) : null}
        {closable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="chart-picker-close"
            onClick={onClose}
            aria-label={t(`${namespace}.closePicker`)}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </header>

      {showImportPanel && onImportFromUrl ? (
        <div className="chart-import-url-bar">
          {importMetadata}
          {onImportFile ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="chart-import-file-button"
              disabled={importFileDisabled}
              onClick={onImportFile}
              aria-label={t(`${namespace}.importAction`)}
              title={t(`${namespace}.importAction`)}
            >
              <FileText className="size-4" />
            </Button>
          ) : null}
          <Input
            className="chart-import-url-input"
            placeholder={t(`${namespace}.importUrlPlaceholder`)}
            value={importUrlValue}
            onChange={(event) => onImportUrlValueChange?.(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !importUrlPending &&
                !importUrlDisabled &&
                importUrlValue.trim()
              ) {
                event.preventDefault()
                onImportFromUrl()
              }
            }}
          />
          <Button
            type="button"
            variant="default"
            className="chart-import-url-submit"
            disabled={importUrlPending || importUrlDisabled || !importUrlValue.trim()}
            onClick={onImportFromUrl}
          >
            {importUrlPending
              ? t(`${namespace}.importUrlPending`)
              : t(`${namespace}.importUrlAction`)}
          </Button>
        </div>
      ) : null}
    </>
  )
}

import type { ReactNode } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from './ui/button'

interface LibraryWorkspaceProps {
  library: ReactNode
  preview: ReactNode
  className?: string
  libraryCollapsed?: boolean
  onLibraryCollapsedChange?: (collapsed: boolean) => void
  collapseLibraryLabel?: string
  expandLibraryLabel?: string
}

export function LibraryWorkspace({
  library,
  preview,
  className = '',
  libraryCollapsed = false,
  onLibraryCollapsedChange,
  collapseLibraryLabel = 'Collapse sidebar',
  expandLibraryLabel = 'Expand sidebar'
}: LibraryWorkspaceProps) {
  const collapsible = Boolean(onLibraryCollapsedChange)

  return (
    <section className={`library-workspace ${className}`.trim()}>
      {collapsible ? (
        <div
          className={`library-sidebar-shell ${
            libraryCollapsed ? 'is-collapsed' : ''
          }`}
        >
          <div className="library-sidebar-content">
            {libraryCollapsed ? null : library}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="library-sidebar-toggle"
            onClick={() => onLibraryCollapsedChange?.(!libraryCollapsed)}
            aria-label={
              libraryCollapsed ? expandLibraryLabel : collapseLibraryLabel
            }
            title={libraryCollapsed ? expandLibraryLabel : collapseLibraryLabel}
          >
            {libraryCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
        </div>
      ) : (
        library
      )}
      <section className="chart-preview-pane">
        {preview}
      </section>
    </section>
  )
}

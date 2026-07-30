import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { ChevronDown, FileCheck2, Pencil, SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ChecklistRecord } from '@shared/checklist-types'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { LibraryImportToolbar } from './LibraryImportToolbar'

interface ChecklistLibraryDrawerProps {
  checklists: ChecklistRecord[]
  selectedChecklistId: string | null
  importUrlValue: string
  importUrlPending: boolean
  onSelect: (checklistId: string) => void
  onEdit: (checklistId: string) => void
  onImportUrlValueChange: (value: string) => void
  onImport: () => void
  onImportFromUrl: () => void
}

interface ChecklistGroup {
  aircraftModel: string
  checklists: ChecklistRecord[]
}

function groupChecklistsByAircraftModel(checklists: ChecklistRecord[]): ChecklistGroup[] {
  const groups = new Map<string, ChecklistRecord[]>()

  checklists.forEach((checklist) => {
    const aircraftModel = checklist.aircraftModel.trim() || 'UNSPEC'
    const group = groups.get(aircraftModel) ?? []
    group.push(checklist)
    groups.set(aircraftModel, group)
  })

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([aircraftModel, items]) => ({
      aircraftModel,
      checklists: [...items].sort((left, right) => left.title.localeCompare(right.title))
    }))
}

export function ChecklistLibraryDrawer({
  checklists,
  selectedChecklistId,
  importUrlValue,
  importUrlPending,
  onSelect,
  onEdit,
  onImportUrlValueChange,
  onImport,
  onImportFromUrl
}: ChecklistLibraryDrawerProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [showImportPanel, setShowImportPanel] = useState(false)
  const [collapsedModels, setCollapsedModels] = useState<Set<string>>(() => new Set())
  const normalizedSearch = search.trim().toLowerCase()

  const filteredChecklists = useMemo(() => {
    if (!normalizedSearch) return checklists
    return checklists.filter((checklist) =>
      `${checklist.title} ${checklist.aircraftModel} ${checklist.fileFormat}`
        .toLowerCase()
        .includes(normalizedSearch)
    )
  }, [checklists, normalizedSearch])

  const groups = useMemo(
    () => groupChecklistsByAircraftModel(filteredChecklists),
    [filteredChecklists]
  )

  const toggleCollapsedKey = (
    setter: Dispatch<SetStateAction<Set<string>>>,
    key: string
  ) => {
    setter((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <section className="chart-picker-drawer chart-picker-drawer-docked">
      <LibraryImportToolbar
        namespace="checklists"
        searchValue={search}
        onSearchValueChange={setSearch}
        showImportPanel={showImportPanel}
        onShowImportPanelChange={setShowImportPanel}
        onImportFile={onImport}
        importUrlValue={importUrlValue}
        importUrlPending={importUrlPending}
        onImportUrlValueChange={onImportUrlValueChange}
        onImportFromUrl={onImportFromUrl}
      />

      <div
        className={`chart-picker-body ${groups.length === 0 ? 'is-empty' : ''}`}
        aria-live="polite"
      >
        {groups.length > 0 ? (
          <div className="chart-picker-list">
            {groups.map((group) => {
              const expanded = normalizedSearch.length > 0 || !collapsedModels.has(group.aircraftModel)

              return (
                <section
                  key={group.aircraftModel}
                  className={`chart-airport-group ${expanded ? 'is-open' : ''}`}
                >
                  <button
                    type="button"
                    className="chart-airport-head"
                    aria-expanded={expanded}
                    onClick={() => toggleCollapsedKey(setCollapsedModels, group.aircraftModel)}
                  >
                    <span className="collapse-chevron" aria-hidden="true">
                      <ChevronDown />
                    </span>
                    <span className="chart-airport-code">{group.aircraftModel}</span>
                    <Badge variant="outline" className="chart-group-count">
                      {group.checklists.length}
                    </Badge>
                  </button>

                  {expanded ? (
                    <div className="chart-candidate-list">
                      {group.checklists.map((checklist) => (
                        <article
                          key={checklist.id}
                          className={`chart-candidate-item ${
                            selectedChecklistId === checklist.id ? 'selected' : ''
                          }`}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            className="chart-candidate-main"
                            onClick={() => onSelect(checklist.id)}
                          >
                            <strong>{checklist.title}</strong>
                            <span>{checklist.fileFormat.toUpperCase()}</span>
                          </Button>
                          <div className="chart-candidate-actions">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="chart-action-button"
                              onClick={() => onEdit(checklist.id)}
                              aria-label={t('checklists.editAria', {
                                title: checklist.title
                              })}
                              title={t('checklists.editAria', {
                                title: checklist.title
                              })}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        ) : (
          <div className="chart-picker-empty" role="status">
            {checklists.length === 0 ? (
              <FileCheck2 aria-hidden="true" />
            ) : (
              <SearchX aria-hidden="true" />
            )}
            <strong>
              {checklists.length === 0
                ? t('checklists.emptyTitle')
                : t('checklists.searchEmpty')}
            </strong>
            {checklists.length === 0 ? (
              <span>{t('checklists.emptyDescription')}</span>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}

import { useState, useRef, useEffect } from 'react'
import type {
  OpenSearchFilter,
  SavedSearchItemGetResult,
  NewSavedSearchRequest,
  EditSavedSearchRequest,
  ClickHouseFilter,
  FilterOperator,
} from '@/types/api'
import SaveSearchModal from './SaveSearchModal'
import BrowseSearchesModal from './BrowseSearchesModal'

// ─── Conversion helpers ───────────────────────────────────────────────────────

export function savedSearchToAppState(item: SavedSearchItemGetResult): {
  filters: OpenSearchFilter[]
  pinnedFields: string[]
  timeRangePeriod?: string
} {
  const filters: OpenSearchFilter[] = (item.filters?.fieldFilters ?? []).map(f => ({
    attributeName: f.attributeName,
    filterOperator: f.filterOperator as FilterOperator,
    attributeValue: f.attributeValue,
  }))

  const pinnedFields = item.layout?.visibilityFields ?? []
  const timeRangePeriod = item.layout?.timeRangePeriod

  return { filters, pinnedFields, timeRangePeriod }
}

export { filtersToClickHouse } from './SaveSearchModal'

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconBookmark({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  )
}

function IconChevron({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function IconSave({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  )
}

function IconFolder({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  dark: boolean
  currentUserSub: string
  activeSearchName: string | null
  currentFilters: OpenSearchFilter[]
  currentPinnedFields: string[]
  currentLuceneQuery: string
  availableTags: string[]
  onSave: (data: NewSavedSearchRequest) => Promise<void>
  onUpdate: (id: string, version: number, data: EditSavedSearchRequest) => Promise<void>
  onDelete: (id: string, version: number) => Promise<void>
  onApply: (item: SavedSearchItemGetResult) => void
  onFetchSearches: (params: { name?: string; tags?: string[]; needFilters: boolean }) => Promise<SavedSearchItemGetResult[]>
  onLoadTags: () => Promise<string[]>
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SavedSearchesPanel({
  dark,
  currentUserSub,
  activeSearchName,
  currentFilters,
  currentPinnedFields,
  currentLuceneQuery,
  availableTags,
  onSave,
  onUpdate,
  onDelete,
  onApply,
  onFetchSearches,
  onLoadTags,
}: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [browseModalOpen, setBrowseModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<SavedSearchItemGetResult | undefined>(undefined)
  const popoverRef = useRef<HTMLDivElement>(null)
  const tagsLoadStarted = useRef(false)

  // Загружаем теги фоново при монтировании — чтобы к моменту открытия модала они уже были готовы
  useEffect(() => {
    if (tagsLoadStarted.current || availableTags.length > 0) return
    tagsLoadStarted.current = true
    onLoadTags()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!popoverOpen) return
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [popoverOpen])

  function openBrowse() {
    setPopoverOpen(false)
    setBrowseModalOpen(true)
  }

  function openSave() {
    setPopoverOpen(false)
    setEditItem(undefined)
    setSaveModalOpen(true)
  }

  function handleEdit(item: SavedSearchItemGetResult) {
    setBrowseModalOpen(false)
    setEditItem(item)
    setSaveModalOpen(true)
  }

  // ── Styles ───────────────────────────────────────────────────────────────────

  const triggerCls = [
    'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer select-none flex-shrink-0',
    activeSearchName
      ? 'text-blue-400'
      : dark
        ? 'text-slate-400 hover:text-white hover:bg-slate-700'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
  ].join(' ')

  const popoverCls = [
    'absolute right-0 top-full mt-1 w-52 rounded-lg shadow-xl border z-50 overflow-hidden py-1',
    dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200',
  ].join(' ')

  const popoverItemCls = [
    'flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors cursor-pointer text-left',
    dark ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-50',
  ].join(' ')

  const dividerCls = ['my-1 border-t', dark ? 'border-slate-700' : 'border-gray-100'].join(' ')

  return (
    <>
      <div className="relative flex-shrink-0" ref={popoverRef}>
        <button
          onClick={() => setPopoverOpen(o => !o)}
          className={triggerCls}
        >
          <IconBookmark cls="w-3.5 h-3.5 flex-shrink-0" />
          <span>{activeSearchName ?? 'Поиски'}</span>
          <IconChevron cls={['w-3 h-3 transition-transform', popoverOpen ? 'rotate-180' : ''].join(' ')} />
        </button>

        {popoverOpen && (
          <div className={popoverCls}>
            <button className={popoverItemCls} onClick={openSave}>
              <IconSave cls="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
              Сохранить поиск
            </button>
            <div className={dividerCls} />
            <button className={popoverItemCls} onClick={openBrowse}>
              <IconFolder cls="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
              Открыть поиск
            </button>
          </div>
        )}
      </div>

      {saveModalOpen && (
        <SaveSearchModal
          dark={dark}
          mode={editItem ? 'edit' : 'create'}
          editItem={editItem}
          currentFilters={currentFilters}
          currentPinnedFields={currentPinnedFields}
          currentLuceneQuery={currentLuceneQuery}
          availableTags={availableTags}
          onSave={onSave}
          onUpdate={onUpdate}
          onClose={() => { setSaveModalOpen(false); setEditItem(undefined) }}
        />
      )}

      {browseModalOpen && (
        <BrowseSearchesModal
          dark={dark}
          currentUserSub={currentUserSub}
          onApply={onApply}
          onDelete={onDelete}
          onEdit={handleEdit}
          onFetchSearches={onFetchSearches}
          onClose={() => setBrowseModalOpen(false)}
        />
      )}
    </>
  )
}

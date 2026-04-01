import { useState, useRef, useEffect } from 'react'
import type { OpenSearchFilter, SavedSearchItemGetResult, SavedSearchFilter, FilterOperator } from '@/types/api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function buildSavedSearchFilters(
  filters: OpenSearchFilter[],
  pinnedFields: string[],
): SavedSearchFilter[] {
  const result: SavedSearchFilter[] = filters.map(f => ({
    attributeName: f.attributeName,
    attributeValue: f.attributeValue ?? [],
    filterOperator: f.filterOperator,
    attributeVisibility: pinnedFields.includes(f.attributeName),
  }))
  const filterNames = new Set(filters.map(f => f.attributeName))
  for (const field of pinnedFields) {
    if (!filterNames.has(field)) {
      result.push({ attributeName: field, attributeValue: [], attributeVisibility: true })
    }
  }
  return result
}

export function parseSavedSearchFilters(items: SavedSearchFilter[]): {
  filters: OpenSearchFilter[]
  pinnedFields: string[]
} {
  const filters: OpenSearchFilter[] = []
  const pinnedFields: string[] = []
  for (const f of items) {
    const hasFilter = f.filterOperator &&
      (f.attributeValue.length > 0 ||
        f.filterOperator === 'EXIST' ||
        f.filterOperator === 'DOES NOT EXIST')
    if (hasFilter) {
      filters.push({
        attributeName: f.attributeName,
        attributeValue: f.attributeValue,
        filterOperator: f.filterOperator as FilterOperator,
      })
    }
    if (f.attributeVisibility) pinnedFields.push(f.attributeName)
  }
  return { filters, pinnedFields }
}

function getSearchSubtitle(item: SavedSearchItemGetResult): string {
  const filterCount = item.filters.filter(f =>
    f.filterOperator && (f.attributeValue.length > 0 ||
      f.filterOperator === 'EXIST' || f.filterOperator === 'DOES NOT EXIST'),
  ).length
  const colCount = item.filters.filter(f => f.attributeVisibility).length
  const parts: string[] = []
  if (filterCount > 0) parts.push(`${filterCount} фильтр${filterCount > 1 ? 'а' : ''}`)
  if (colCount > 0) parts.push(`${colCount} кол.`)
  return parts.join(' · ') || 'без фильтров'
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IconBookmark({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  )
}

function IconLock({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="5" y="11" width="14" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  )
}

function IconUsers({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87M16 7a4 4 0 11-8 0 4 4 0 018 0zM22 20v-2a4 4 0 00-3-3.87" />
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

function IconX({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  dark: boolean
  activeSearchName: string | null
  currentFilters: OpenSearchFilter[]
  currentPinnedFields: string[]
  savedSearches: SavedSearchItemGetResult[]
  isLoading: boolean
  onLoad: (filters: OpenSearchFilter[], pinnedFields: string[]) => void
  onSave: (name: string, onlyMy: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SavedSearchesPanel({
  dark,
  activeSearchName,
  savedSearches,
  onLoad,
  onSave,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [onlyMy, setOnlyMy] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleSave() {
    const name = nameInput.trim()
    if (!name || name.length < 3) return
    setIsSaving(true)
    try {
      await onSave(name, onlyMy)
      setNameInput('')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await onDelete(id)
    } finally {
      setDeletingId(null)
    }
  }

  function handleLoad(item: SavedSearchItemGetResult) {
    const { filters, pinnedFields } = parseSavedSearchFilters(item.filters)
    onLoad(filters, pinnedFields)
    setOpen(false)
  }

  const mySearches = savedSearches.filter(s => s.onlyMy)
  const projectSearches = savedSearches.filter(s => !s.onlyMy)

  // ── Styles ───────────────────────────────────────────────────────────────────

  const triggerCls = [
    'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer select-none flex-shrink-0',
    activeSearchName
      ? 'text-blue-400'
      : dark
        ? 'text-slate-400 hover:text-white hover:bg-slate-700'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
  ].join(' ')

  const dropdownCls = [
    'absolute right-0 top-full mt-1 w-80 rounded-lg shadow-xl border z-50 overflow-hidden',
    dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200',
  ].join(' ')

  const inputCls = [
    'flex-1 min-w-0 text-xs px-2 py-1.5 rounded-l border outline-none transition-colors',
    dark
      ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-400',
  ].join(' ')

  const saveBtnCls = [
    'px-3 py-1.5 text-xs font-medium rounded-r border transition-colors cursor-pointer',
    'bg-blue-600 text-white border-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' ')

  const sectionLabelCls = [
    'px-3 py-1.5 text-xs font-semibold',
    dark ? 'text-slate-400 bg-slate-700/40' : 'text-gray-500 bg-gray-50',
  ].join(' ')

  const itemCls = [
    'group flex items-start gap-2 w-full text-left px-3 py-2 cursor-pointer transition-colors',
    dark ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-50',
  ].join(' ')

  const dividerCls = dark ? 'border-slate-700' : 'border-gray-100'

  const radioLabelCls = [
    'text-xs cursor-pointer',
    dark ? 'text-slate-400' : 'text-gray-500',
  ].join(' ')

  return (
    <div className="relative flex-shrink-0" ref={panelRef}>
      {/* Trigger button */}
      <button onClick={() => setOpen(o => !o)} className={triggerCls}>
        <IconBookmark cls="w-3.5 h-3.5 flex-shrink-0" />
        <span>{activeSearchName ?? 'Поиски'}</span>
        <IconChevron cls={['w-3 h-3 transition-transform', open ? 'rotate-180' : ''].join(' ')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className={dropdownCls}>
          {/* Save form */}
          <div className="p-3 border-b" style={{ borderColor: dark ? '#334155' : '#e5e7eb' }}>
            <div className="flex items-stretch">
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="Название поиска..."
                maxLength={500}
                className={inputCls}
              />
              <button
                onClick={handleSave}
                disabled={isSaving || nameInput.trim().length < 3}
                className={saveBtnCls}
              >
                {isSaving ? '...' : 'Сохранить'}
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <label className={radioLabelCls}>
                <input
                  type="radio"
                  name="search-visibility"
                  checked={onlyMy}
                  onChange={() => setOnlyMy(true)}
                  className="mr-1"
                />
                Личный
              </label>
              <label className={radioLabelCls}>
                <input
                  type="radio"
                  name="search-visibility"
                  checked={!onlyMy}
                  onChange={() => setOnlyMy(false)}
                  className="mr-1"
                />
                Проектный
              </label>
            </div>
          </div>

          {/* Lists */}
          <div className="max-h-72 overflow-y-auto">
            {savedSearches.length === 0 ? (
              <p className={['px-3 py-4 text-xs text-center', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')}>
                Нет сохранённых поисков
              </p>
            ) : (
              <>
                {mySearches.length > 0 && (
                  <>
                    <div className={sectionLabelCls}>Мои</div>
                    {mySearches.map(item => (
                      <SearchItem
                        key={item.id}
                        item={item}
                        dark={dark}
                        itemCls={itemCls}
                        dividerCls={dividerCls}
                        isDeleting={deletingId === item.id}
                        onLoad={handleLoad}
                        onDelete={handleDelete}
                      />
                    ))}
                  </>
                )}
                {projectSearches.length > 0 && (
                  <>
                    <div className={[sectionLabelCls, mySearches.length > 0 ? `border-t ${dividerCls}` : ''].join(' ')}>
                      Проектные
                    </div>
                    {projectSearches.map(item => (
                      <SearchItem
                        key={item.id}
                        item={item}
                        dark={dark}
                        itemCls={itemCls}
                        dividerCls={dividerCls}
                        isDeleting={deletingId === item.id}
                        onLoad={handleLoad}
                        onDelete={handleDelete}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SearchItem subcomponent ──────────────────────────────────────────────────

interface SearchItemProps {
  item: SavedSearchItemGetResult
  dark: boolean
  itemCls: string
  dividerCls: string
  isDeleting: boolean
  onLoad: (item: SavedSearchItemGetResult) => void
  onDelete: (e: React.MouseEvent, id: string) => void
}

function SearchItem({ item, dark, itemCls, isDeleting, onLoad, onDelete }: SearchItemProps) {
  return (
    <button className={itemCls} onClick={() => onLoad(item)}>
      {item.onlyMy
        ? <IconLock cls={['w-3.5 h-3.5 flex-shrink-0 mt-0.5', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')} />
        : <IconUsers cls={['w-3.5 h-3.5 flex-shrink-0 mt-0.5', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')} />
      }
      <div className="flex-1 min-w-0">
        <div className="truncate text-xs font-medium">{item.name}</div>
        <div className={['text-xs truncate mt-0.5', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')}>
          {getSearchSubtitle(item)}
        </div>
      </div>
      {item.delete && (
        <button
          onClick={e => onDelete(e, item.id)}
          disabled={isDeleting}
          className={[
            'opacity-0 group-hover:opacity-100 flex-shrink-0 p-0.5 rounded transition-all',
            dark ? 'text-slate-500 hover:text-red-400 hover:bg-slate-600' : 'text-gray-400 hover:text-red-500 hover:bg-gray-100',
            'disabled:opacity-50',
          ].join(' ')}
          title="Удалить"
        >
          <IconX cls="w-3.5 h-3.5" />
        </button>
      )}
    </button>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import type { SavedSearchItemGetResult } from '@/types/api'

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconX({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function IconEdit({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function IconTrash({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function IconSearch({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deduplicateById(items: SavedSearchItemGetResult[]): SavedSearchItemGetResult[] {
  const seen = new Set<string>()
  return items.filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function getSearchSummary(item: SavedSearchItemGetResult): string {
  const filterCount = item.filters?.fieldFilters?.length ?? 0
  const parts: string[] = []
  if (filterCount > 0) parts.push(`${filterCount} фильтр${filterCount > 1 ? 'а' : ''}`)
  if (item.layout?.timeRangePeriod) parts.push(item.layout.timeRangePeriod)
  if (item.layout?.visibilityFields?.length) {
    const cols = item.layout.visibilityFields
    const hint = cols.slice(0, 3).join(', ') + (cols.length > 3 ? ` +${cols.length - 3}` : '')
    parts.push(hint)
  }
  return parts.join(' · ') || 'без фильтров'
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  dark: boolean
  onApply: (item: SavedSearchItemGetResult) => void
  onDelete: (id: string, version: number) => Promise<void>
  onEdit: (item: SavedSearchItemGetResult) => void
  onFetchSearches: (params: { needFilters: boolean; name?: string; tags?: string[] }) => Promise<SavedSearchItemGetResult[]>
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BrowseSearchesModal({
  dark,
  onApply,
  onDelete,
  onEdit,
  onFetchSearches,
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<'private' | 'public'>('private')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // baseItems — полный список, загружается один раз при открытии.
  // Никогда не перезаписывается результатами поискового рефетча.
  const baseItems = useRef<SavedSearchItemGetResult[]>([])
  // extraItems — дополнительные результаты серверного поиска (могут содержать записи, не вошедшие в базовый список)
  const [extraItems, setExtraItems] = useState<SavedSearchItemGetResult[]>([])
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastServerQuery = useRef('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Начальная загрузка
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    onFetchSearches({ needFilters: false })
      .then(items => {
        if (cancelled) return
        baseItems.current = items
        setIsLoading(false)
      })
      .catch(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  // onFetchSearches намеренно исключён из зависимостей — загружаем только при монтировании
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Серверный рефетч когда клиентский поиск ничего не нашёл
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    if (searchQuery.length === 0) {
      // Поиск сброшен — очищаем extra результаты
      setExtraItems([])
      lastServerQuery.current = ''
      return
    }

    const q = searchQuery.toLowerCase()
    const clientMatch = baseItems.current.some(item =>
      item.name.toLowerCase().includes(q) ||
      item.tags?.some(t => t.toLowerCase().includes(q)),
    )

    if (!clientMatch && searchQuery.length >= 3 && searchQuery !== lastServerQuery.current) {
      searchTimerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return
        setIsSearching(true)
        try {
          const results = await onFetchSearches({ needFilters: false, name: searchQuery })
          if (!mountedRef.current) return
          lastServerQuery.current = searchQuery
          // Добавляем в extra только те, которых нет в базовом списке
          const baseIds = new Set(baseItems.current.map(i => i.id))
          const newExtra = results.filter(i => !baseIds.has(i.id))
          setExtraItems(newExtra)
        } finally {
          if (mountedRef.current) setIsSearching(false)
        }
      }, 400)
    }

    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [searchQuery, onFetchSearches])

  // Итоговый список: baseItems + extraItems (без дублей), отфильтрованный по вкладке и поиску
  const allItems = searchQuery.length === 0
    ? baseItems.current
    : deduplicateById([...baseItems.current, ...extraItems])

  const filtered = allItems.filter(item => {
    if (activeTab === 'private' && !!item.isPublic) return false
    if (activeTab === 'public' && !item.isPublic) return false
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return item.name.toLowerCase().includes(q) ||
      item.tags?.some(t => t.toLowerCase().includes(q))
  })

  const privateCount = baseItems.current.filter(s => !s.isPublic).length
  const publicCount = baseItems.current.filter(s => !!s.isPublic).length

  async function handleDelete(e: React.MouseEvent, item: SavedSearchItemGetResult) {
    e.stopPropagation()
    setDeletingId(item.id)
    try {
      await onDelete(item.id, item.version)
      baseItems.current = baseItems.current.filter(s => s.id !== item.id)
      setExtraItems(prev => prev.filter(s => s.id !== item.id))
    } finally {
      setDeletingId(null)
    }
  }

  function handleEdit(e: React.MouseEvent, item: SavedSearchItemGetResult) {
    e.stopPropagation()
    onEdit(item)
  }

  // ── Styles ───────────────────────────────────────────────────────────────────

  const overlay = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50'
  const modal = [
    'relative w-[520px] max-w-[calc(100vw-2rem)] max-h-[80vh] flex flex-col rounded-xl shadow-2xl',
    dark ? 'bg-slate-800 text-slate-100' : 'bg-white text-gray-900',
  ].join(' ')
  const header = [
    'flex items-center justify-between px-5 py-4 border-b flex-shrink-0',
    dark ? 'border-slate-700' : 'border-gray-200',
  ].join(' ')
  const segBase = 'flex rounded-lg overflow-hidden border text-xs font-medium'
  const segBorder = dark ? 'border-slate-600' : 'border-gray-300'
  const segActive = 'bg-blue-600 text-white'
  const segInactive = dark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  const searchInputCls = [
    'flex-1 text-sm outline-none bg-transparent',
    dark ? 'text-slate-200 placeholder-slate-500' : 'text-gray-800 placeholder-gray-400',
  ].join(' ')
  const searchBarCls = [
    'flex items-center gap-2 mx-5 my-3 px-3 py-2 rounded-lg border',
    dark ? 'bg-slate-900 border-slate-600' : 'bg-gray-50 border-gray-200',
  ].join(' ')
  const itemCls = [
    'group w-full text-left px-5 py-3 border-b cursor-pointer transition-colors flex items-start gap-3',
    dark ? 'border-slate-700 hover:bg-slate-700/60' : 'border-gray-100 hover:bg-gray-50',
  ].join(' ')
  const chipCls = [
    'inline-flex items-center px-2 py-0.5 rounded text-xs',
    dark ? 'bg-slate-600 text-slate-300' : 'bg-blue-100 text-blue-700',
  ].join(' ')
  const actionBtnCls = (color: string) => [
    'opacity-0 group-hover:opacity-100 flex-shrink-0 p-1.5 rounded transition-all cursor-pointer',
    dark
      ? `text-slate-500 hover:text-${color}-400 hover:bg-slate-600`
      : `text-gray-400 hover:text-${color}-500 hover:bg-gray-100`,
  ].join(' ')
  const emptyTextCls = ['px-5 py-8 text-center text-sm', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')

  const showLoading = isLoading || isSearching

  return (
    <div className={overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={modal}>
        {/* Header */}
        <div className={header}>
          <span className="text-sm font-semibold">Сохранённые поиски</span>
          <button onClick={onClose} className={[
            'p-1 rounded transition-colors cursor-pointer',
            dark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
          ].join(' ')}>
            <IconX cls="w-4 h-4" />
          </button>
        </div>

        {/* Tabs + Search */}
        <div className="flex-shrink-0">
          <div className="flex justify-center pt-3 px-5">
            <div className={`${segBase} ${segBorder}`}>
              <button
                onClick={() => setActiveTab('private')}
                className={`px-5 py-1.5 cursor-pointer transition-colors ${activeTab === 'private' ? segActive : segInactive}`}
              >
                Личные{privateCount > 0 ? ` (${privateCount})` : ''}
              </button>
              <button
                onClick={() => setActiveTab('public')}
                className={`px-5 py-1.5 cursor-pointer transition-colors ${activeTab === 'public' ? segActive : segInactive}`}
              >
                Общие{publicCount > 0 ? ` (${publicCount})` : ''}
              </button>
            </div>
          </div>
          <div className={searchBarCls}>
            <IconSearch cls={['w-4 h-4 flex-shrink-0', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени или тегу..."
              className={searchInputCls}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={['cursor-pointer', dark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'].join(' ')}
              >
                <IconX cls="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {showLoading ? (
            <div className={emptyTextCls}>Загрузка...</div>
          ) : filtered.length === 0 ? (
            <div className={emptyTextCls}>
              {searchQuery ? 'Ничего не найдено' : 'Нет сохранённых поисков'}
            </div>
          ) : (
            filtered.map(item => (
              <button key={item.id} className={itemCls} onClick={() => { onApply(item); onClose() }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{item.name}</span>
                    {item.tags?.map(tag => (
                      <span key={tag} className={chipCls}>{tag}</span>
                    ))}
                  </div>
                  <div className={['text-xs mt-0.5', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')}>
                    {getSearchSummary(item)}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {item.share && (
                    <button
                      onClick={e => handleEdit(e, item)}
                      className={actionBtnCls('blue')}
                      title="Редактировать"
                    >
                      <IconEdit cls="w-3.5 h-3.5" />
                    </button>
                  )}
                  {item.delete && (
                    <button
                      onClick={e => handleDelete(e, item)}
                      disabled={deletingId === item.id}
                      className={[actionBtnCls('red'), 'disabled:opacity-50'].join(' ')}
                      title="Удалить"
                    >
                      <IconTrash cls="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

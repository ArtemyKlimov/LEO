import { useState, useRef, useEffect, useCallback } from 'react'
import type {
  OpenSearchFilter,
  SavedSearchItemGetResult,
  NewSavedSearchRequest,
  EditSavedSearchRequest,
  ClickHouseFilter,
  FilterOperator,
} from '@/types/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_RANGE_OPTIONS = [
  { label: 'Не сохранять', value: '' },
  { label: '15 мин', value: '15m' },
  { label: '30 мин', value: '30m' },
  { label: '1 час', value: '1h' },
  { label: '3 часа', value: '3h' },
  { label: '6 часов', value: '6h' },
  { label: '12 часов', value: '12h' },
  { label: '24 часа', value: '24h' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function filtersToClickHouse(filters: OpenSearchFilter[]): ClickHouseFilter[] {
  return filters
    .filter(f => f.filterOperator && (
      (f.attributeValue && f.attributeValue.length > 0) ||
      f.filterOperator === 'EXIST' ||
      f.filterOperator === 'DOES NOT EXIST'
    ))
    .map(f => ({
      filterOperator: f.filterOperator as FilterOperator,
      attributeName: f.attributeName,
      attributeValue: f.attributeValue ?? [],
    }))
}

function buildColumnHint(pinnedFields: string[]): string {
  if (pinnedFields.length === 0) return 'нет столбцов'
  const shown = pinnedFields.slice(0, 3).join(', ')
  const extra = pinnedFields.length > 3 ? ` +${pinnedFields.length - 3} ещё` : ''
  return shown + extra
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconX({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

// ─── HighlightMatch ───────────────────────────────────────────────────────────

function HighlightMatch({ text, query, dark }: { text: string; query: string; dark: boolean }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span className={['font-semibold', dark ? 'text-blue-400' : 'text-blue-600'].join(' ')}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  dark: boolean
  mode: 'create' | 'edit'
  editItem?: SavedSearchItemGetResult
  currentFilters: OpenSearchFilter[]
  currentPinnedFields: string[]
  currentLuceneQuery: string
  availableTags: string[]
  onSave: (data: NewSavedSearchRequest) => Promise<void>
  onUpdate: (id: string, version: number, data: EditSavedSearchRequest) => Promise<void>
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SaveSearchModal({
  dark,
  mode,
  editItem,
  currentFilters,
  currentPinnedFields,
  currentLuceneQuery,
  availableTags,
  onSave,
  onUpdate,
  onClose,
}: Props) {
  const isEdit = mode === 'edit' && editItem != null

  const [name, setName] = useState(isEdit ? editItem!.name : '')
  const [description, setDescription] = useState(isEdit ? (editItem!.description ?? '') : '')
  const [isPublic, setIsPublic] = useState(isEdit ? editItem!.isPublic : false)
  const [tags, setTags] = useState<string[]>(isEdit ? (editItem!.tags ?? []) : [])
  const [tagInput, setTagInput] = useState('')
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [tagFocused, setTagFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [needProjectCode, setNeedProjectCode] = useState(isEdit ? editItem!.needProjectCode : false)
  const [saveColumns, setSaveColumns] = useState(isEdit ? !!(editItem!.layout?.visibilityFields?.length) : false)
  const [timeRangePeriod, setTimeRangePeriod] = useState(isEdit ? (editItem!.layout?.timeRangePeriod ?? '') : '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tagInputRef = useRef<HTMLInputElement>(null)
  const tagDropdownRef = useRef<HTMLDivElement>(null)
  const dropdownListRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Reset activeIndex when suggestions change
  useEffect(() => { setActiveIndex(-1) }, [tagInput])

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !dropdownListRef.current) return
    const item = dropdownListRef.current.children[activeIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const filteredTagSuggestions = tagInput.length >= 1
    ? availableTags.filter(t =>
        t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t),
      )
    : []

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim().replace(/[, ]+$/, '')
    if (trimmed.length >= 2 && trimmed.length <= 50 && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed])
    }
    setTagInput('')
    setTagDropdownOpen(false)
    setActiveIndex(-1)
    tagInputRef.current?.focus()
  }, [tags])

  function removeTag(tag: string) {
    setTags(prev => prev.filter(t => t !== tag))
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === ',' || e.key === ' ') {
      if (tagInput.trim().length >= 2) {
        e.preventDefault()
        addTag(tagInput)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setTagDropdownOpen(true)
      setActiveIndex(i => Math.min(i + 1, filteredTagSuggestions.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
      return
    }
    if (e.key === 'Escape') {
      setTagDropdownOpen(false)
      setActiveIndex(-1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && filteredTagSuggestions[activeIndex]) {
        addTag(filteredTagSuggestions[activeIndex])
      } else if (tagInput.trim()) {
        addTag(tagInput)
      }
      return
    }
    if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags(prev => prev.slice(0, -1))
    }
  }

  async function handleSubmit() {
    const trimmedName = name.trim()
    if (trimmedName.length < 3) {
      setError('Название должно содержать минимум 3 символа')
      return
    }
    // Flush any pending tag input before saving
    const finalTags = [...tags]
    if (tagInput.trim().length >= 2 && !tags.includes(tagInput.trim())) {
      finalTags.push(tagInput.trim())
    }

    setIsSaving(true)
    setError(null)
    try {
      const fieldFilters = filtersToClickHouse(currentFilters)
      const filtersPayload = (fieldFilters.length > 0 || currentLuceneQuery)
        ? { luceneQuery: currentLuceneQuery || undefined, fieldFilters: fieldFilters.length > 0 ? fieldFilters : undefined }
        : undefined

      const layoutPayload = (saveColumns || timeRangePeriod)
        ? {
            visibilityFields: saveColumns ? currentPinnedFields : undefined,
            timeRangePeriod: timeRangePeriod || undefined,
          }
        : undefined

      const descriptionVal = description.trim() || undefined

      if (isEdit) {
        const data: EditSavedSearchRequest = {
          name: trimmedName,
          description: descriptionVal,
          tags: finalTags.length > 0 ? finalTags : undefined,
          needProjectCode,
          filters: filtersPayload,
          layout: layoutPayload,
        }
        await onUpdate(editItem!.id, editItem!.version, data)
      } else {
        const data: NewSavedSearchRequest = {
          name: trimmedName,
          description: descriptionVal,
          tags: finalTags.length > 0 ? finalTags : undefined,
          isPublic,
          needProjectCode,
          filters: filtersPayload,
          layout: layoutPayload,
        }
        await onSave(data)
      }
      onClose()
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('422')) {
          setError('Поиск был изменён другим пользователем. Обновите список и попробуйте снова.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Произошла ошибка')
      }
    } finally {
      setIsSaving(false)
    }
  }

  // ── Styles ───────────────────────────────────────────────────────────────────

  const overlay = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50'
  const modal = [
    'relative w-[460px] max-w-[calc(100vw-2rem)] rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto',
    dark ? 'bg-slate-800 text-slate-100' : 'bg-white text-gray-900',
  ].join(' ')
  const header = [
    'flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10',
    dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200',
  ].join(' ')
  const body = 'px-5 py-4 space-y-4'
  const footer = [
    'flex justify-end gap-3 px-5 py-4 border-t sticky bottom-0',
    dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200',
  ].join(' ')

  const labelCls = ['block text-xs font-medium mb-1', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')
  const inputCls = [
    'w-full text-sm px-3 py-2 rounded-lg border outline-none transition-colors',
    dark
      ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-400',
  ].join(' ')
  const textareaCls = [
    'w-full text-sm px-3 py-2 rounded-lg border outline-none transition-colors resize-none',
    dark
      ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-400',
  ].join(' ')
  const segBase = 'flex rounded-lg overflow-hidden border text-xs font-medium'
  const segBorder = dark ? 'border-slate-600' : 'border-gray-300'
  const segActive = 'bg-blue-600 text-white'
  const segInactive = dark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'

  const chipCls = [
    'flex items-center gap-1 px-2 py-0.5 rounded text-xs flex-shrink-0',
    dark ? 'bg-slate-600 text-slate-200' : 'bg-blue-100 text-blue-800',
  ].join(' ')

  const tagInputCls = [
    'flex-1 min-w-[80px] text-xs outline-none bg-transparent',
    dark ? 'text-slate-200 placeholder-slate-500' : 'text-gray-800 placeholder-gray-400',
  ].join(' ')

  const tagContainerCls = [
    'flex flex-wrap gap-1.5 items-center min-h-[34px] px-2 py-1.5 rounded-lg border cursor-text transition-colors',
    dark
      ? `bg-slate-900 ${tagFocused ? 'border-blue-500' : 'border-slate-600'}`
      : `bg-white ${tagFocused ? 'border-blue-400' : 'border-gray-300'}`,
  ].join(' ')

  const checkboxRowCls = 'flex items-start gap-2'
  const checkboxLabelCls = ['text-sm cursor-pointer', dark ? 'text-slate-300' : 'text-gray-700'].join(' ')
  const checkboxHintCls = ['text-xs mt-0.5', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')

  const selectCls = [
    'w-full text-sm px-3 py-2 rounded-lg border outline-none transition-colors cursor-pointer',
    dark
      ? 'bg-slate-900 border-slate-600 text-white focus:border-blue-500'
      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-400',
  ].join(' ')

  const btnCancel = [
    'px-4 py-2 text-sm rounded-lg border transition-colors cursor-pointer',
    dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50',
  ].join(' ')

  const btnSave = [
    'px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer',
    'bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' ')

  const dropdownCls = [
    'absolute top-full left-0 right-0 mt-1 max-h-44 overflow-y-auto rounded-lg border shadow-lg z-20',
    dark ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200',
  ].join(' ')

  function dropdownItemCls(active: boolean) {
    return [
      'w-full text-left px-3 py-1.5 text-xs cursor-pointer transition-colors',
      active
        ? dark ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-900'
        : dark ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-50',
    ].join(' ')
  }

  return (
    <div className={overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={modal}>
        {/* Header */}
        <div className={header}>
          <span className="text-sm font-semibold">
            {isEdit ? 'Редактировать поиск' : 'Сохранить поиск'}
          </span>
          <button onClick={onClose} className={[
            'p-1 rounded transition-colors cursor-pointer',
            dark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
          ].join(' ')}>
            <IconX cls="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className={body}>
          {/* Name */}
          <div>
            <label className={labelCls}>Название *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Введите название поиска..."
              minLength={3}
              maxLength={500}
              autoFocus
              className={inputCls}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Краткое описание поиска..."
              rows={2}
              maxLength={500}
              className={textareaCls}
            />
          </div>

          {/* Visibility (only for create) */}
          {!isEdit && (
            <div>
              <label className={labelCls}>Видимость</label>
              <div className={`${segBase} ${segBorder} w-fit`}>
                <button
                  onClick={() => setIsPublic(false)}
                  className={`px-4 py-1.5 cursor-pointer transition-colors ${!isPublic ? segActive : segInactive}`}
                >
                  Личный
                </button>
                <button
                  onClick={() => setIsPublic(true)}
                  className={`px-4 py-1.5 cursor-pointer transition-colors ${isPublic ? segActive : segInactive}`}
                >
                  Общий
                </button>
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="relative" ref={tagDropdownRef}>
            <label className={labelCls}>
              Теги
              <span className={['ml-1 font-normal', dark ? 'text-slate-600' : 'text-gray-400'].join(' ')}>
                — разделять пробелом или запятой
              </span>
            </label>
            <div
              className={tagContainerCls}
              onClick={() => tagInputRef.current?.focus()}
            >
              {tags.map(tag => (
                <span key={tag} className={chipCls}>
                  {tag}
                  <button
                    onMouseDown={e => { e.preventDefault(); removeTag(tag) }}
                    className="hover:opacity-70 cursor-pointer leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={e => {
                  setTagInput(e.target.value)
                  setTagDropdownOpen(e.target.value.length >= 1)
                }}
                onKeyDown={handleTagKeyDown}
                onFocus={() => {
                  setTagFocused(true)
                  if (tagInput.length >= 1) setTagDropdownOpen(true)
                }}
                onBlur={() => setTagFocused(false)}
                placeholder={tags.length === 0 ? 'Введите тег...' : ''}
                className={tagInputCls}
              />
            </div>

            {tagDropdownOpen && filteredTagSuggestions.length > 0 && (
              <div className={dropdownCls} ref={dropdownListRef}>
                {filteredTagSuggestions.map((t, i) => (
                  <button
                    key={t}
                    className={dropdownItemCls(i === activeIndex)}
                    onMouseDown={e => { e.preventDefault(); addTag(t) }}
                  >
                    <HighlightMatch text={t} query={tagInput} dark={dark} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* needProjectCode */}
          <div className={checkboxRowCls}>
            <input
              type="checkbox"
              id="save-project-code"
              checked={needProjectCode}
              onChange={e => setNeedProjectCode(e.target.checked)}
              className="mt-0.5 cursor-pointer accent-blue-600"
            />
            <label htmlFor="save-project-code" className={checkboxLabelCls}>
              Сохранить фильтр выбранных систем
            </label>
          </div>

          {/* Save columns */}
          <div>
            <div className={checkboxRowCls}>
              <input
                type="checkbox"
                id="save-columns"
                checked={saveColumns}
                onChange={e => setSaveColumns(e.target.checked)}
                className="mt-0.5 cursor-pointer accent-blue-600"
              />
              <label htmlFor="save-columns" className={checkboxLabelCls}>
                Сохранить набор столбцов для отображения
              </label>
            </div>
            {saveColumns && (
              <div className={`ml-5 mt-1 ${checkboxHintCls}`}>
                {buildColumnHint(currentPinnedFields)}
              </div>
            )}
          </div>

          {/* Time range period */}
          <div>
            <label className={labelCls}>Временной диапазон</label>
            <select
              value={timeRangePeriod}
              onChange={e => setTimeRangePeriod(e.target.value)}
              className={selectCls}
            >
              {TIME_RANGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="text-xs text-red-500 bg-red-500/10 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={footer}>
          <button onClick={onClose} className={btnCancel}>Отмена</button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || name.trim().length < 3}
            className={btnSave}
          >
            {isSaving ? 'Сохраняю...' : isEdit ? 'Обновить' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState, useRef, useCallback, type KeyboardEvent } from 'react'
import type { Field, FieldValuesBucket, FilterOperator, OpenSearchFilter } from '@/types/api'
import DateTimePicker from './DateTimePicker'

// ─── Operator definitions ─────────────────────────────────────────────────────

interface OperatorDef {
  value: FilterOperator
  label: string
  symbol: string
}

const DEFAULT_OPERATORS: OperatorDef[] = [
  { value: 'IS',             label: 'IS',             symbol: '=' },
  { value: 'IS NOT',         label: 'IS NOT',         symbol: '≠' },
  { value: 'IS ONE OF',      label: 'IS ONE OF',      symbol: '∈' },
  { value: 'IS NOT ONE OF',  label: 'IS NOT ONE OF',  symbol: '∉' },
  { value: 'EXIST',          label: 'EXIST',          symbol: '∃' },
  { value: 'DOES NOT EXIST', label: 'DOES NOT EXIST', symbol: '∄' },
]

// Для longText — текстовый поиск, без мультизначений
const LONGTEXT_OPERATORS: OperatorDef[] = [
  { value: 'CONTAINS',       label: 'CONTAINS',       symbol: '~' },
  { value: 'NOT CONTAINS',   label: 'NOT CONTAINS',   symbol: '≁' },
  { value: 'EXIST',          label: 'EXIST',          symbol: '∃' },
  { value: 'DOES NOT EXIST', label: 'DOES NOT EXIST', symbol: '∄' },
]

// Для datetime и int — операторы сравнения
const COMPARISON_OPERATORS: OperatorDef[] = [
  { value: '>',              label: 'GREATER THAN',          symbol: '>' },
  { value: '<',              label: 'LESS THAN',             symbol: '<' },
  { value: '>=',             label: 'GREATER OR EQUAL',      symbol: '≥' },
  { value: '<=',             label: 'LESS OR EQUAL',         symbol: '≤' },
  { value: '==',             label: 'EQUALS',                symbol: '=' },
  { value: 'EXIST',          label: 'EXIST',                 symbol: '∃' },
  { value: 'DOES NOT EXIST', label: 'DOES NOT EXIST',        symbol: '∄' },
]

function getOperatorsForField(field?: Field): OperatorDef[] {
  if (field?.controlType === 'longText') return LONGTEXT_OPERATORS
  if (field?.controlType === 'datetime' || field?.controlType === 'int') return COMPARISON_OPERATORS
  return DEFAULT_OPERATORS
}

const NO_VALUE_OPERATORS = new Set<FilterOperator>(['EXIST', 'DOES NOT EXIST'])
const MULTI_VALUE_OPERATORS = new Set<FilterOperator>(['IS ONE OF', 'IS NOT ONE OF'])
// Для этих controlType подсказки не запрашиваются
const NO_SUGGESTIONS_TYPES = new Set(['longText', 'id', 'datetime', 'int'])

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  dark: boolean
  fields: Field[]
  onAdd: (filter: OpenSearchFilter) => void
  onFetchFieldValues?: (fieldName: string, searchText?: string) => Promise<FieldValuesBucket[]>
}

// ─── FilterBuilder ────────────────────────────────────────────────────────────

export default function FilterBuilder({ dark, fields, onAdd, onFetchFieldValues }: Props) {
  const [open, setOpen] = useState(false)
  const [fieldName, setFieldName] = useState('')
  const [operator, setOperator] = useState<FilterOperator | ''>('')
  const [valueInput, setValueInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const tagInputRef = useRef<HTMLInputElement>(null)
  const valueInputRef = useRef<HTMLInputElement>(null)

  // Suggestions state
  const [suggestions, setSuggestions] = useState<FieldValuesBucket[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  // Search-by-text state (triggered when 3+ chars typed with no top-N matches)
  const [searchResults, setSearchResults] = useState<FieldValuesBucket[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchMode, setSearchMode] = useState(false)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedField = fields.find(f => f.name === fieldName)
  const availableOperators = getOperatorsForField(selectedField)

  const noValue    = operator !== '' && NO_VALUE_OPERATORS.has(operator as FilterOperator)
  const multiValue = operator !== '' && MULTI_VALUE_OPERATORS.has(operator as FilterOperator)
  const hasValue   = operator !== '' && !noValue

  const isValid = fieldName.trim() !== '' && operator !== '' && (
    noValue ||
    (multiValue ? tags.length > 0 : valueInput.trim() !== '')
  )

  // Client-side filter of suggestions
  const filteredSuggestions = suggestions.filter(s =>
    s.value.toLowerCase().includes(valueInput.toLowerCase()),
  )
  const displaySuggestions = searchMode ? searchResults : filteredSuggestions
  const isAnyLoading = suggestionsLoading || searchLoading
  const canSuggest = hasValue && showSuggestions && (isAnyLoading || displaySuggestions.length > 0)

  function resetSearch() {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    setSearchResults([])
    setSearchLoading(false)
    setSearchMode(false)
  }

  function reset() {
    setFieldName('')
    setOperator('')
    setValueInput('')
    setTags([])
    setSuggestions([])
    setShowSuggestions(false)
    setActiveIndex(-1)
    resetSearch()
  }

  function handleOpen() {
    setOpen(true)
  }

  function handleCancel() {
    reset()
    setOpen(false)
  }

  // При смене поля — сбрасываем оператор (разные поля — разные операторы)
  function handleFieldChange(name: string) {
    setFieldName(name)
    setOperator('')
    setValueInput('')
    setTags([])
    setSuggestions([])
    setShowSuggestions(false)
    setActiveIndex(-1)
    resetSearch()
  }

  // При выборе оператора — подгружаем подсказки, если применимо
  async function handleOperatorChange(op: FilterOperator | '') {
    setOperator(op)
    setValueInput('')
    setTags([])
    setActiveIndex(-1)
    resetSearch()

    if (!op || NO_VALUE_OPERATORS.has(op as FilterOperator)) {
      setShowSuggestions(false)
      return
    }

    if (!fieldName || !onFetchFieldValues) return
    const field = fields.find(f => f.name === fieldName)
    if (field?.controlType && NO_SUGGESTIONS_TYPES.has(field.controlType)) return

    // Уже загружены — просто показываем
    if (suggestions.length > 0) {
      setShowSuggestions(true)
      return
    }

    setSuggestionsLoading(true)
    setShowSuggestions(true)
    try {
      const result = await onFetchFieldValues(fieldName)
      setSuggestions(result)
    } catch { /* silent */ }
    finally { setSuggestionsLoading(false) }
  }

  const triggerSearch = useCallback((value: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    if (!onFetchFieldValues || !fieldName) return
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const results = await onFetchFieldValues(fieldName, value)
        setSearchResults(results)
      } catch { /* silent */ }
      finally { setSearchLoading(false) }
    }, 300)
  }, [onFetchFieldValues, fieldName])

  function handleValueInputChange(value: string) {
    setValueInput(value)
    setActiveIndex(-1)
    if (value.length >= 3) {
      const matches = suggestions.filter(s => s.value.toLowerCase().includes(value.toLowerCase()))
      if (matches.length === 0) {
        setSearchMode(true)
        setShowSuggestions(true)
        triggerSearch(value)
        return
      }
    }
    // Back to top-N mode
    if (searchMode) resetSearch()
  }

  function handleAddTag(raw: string) {
    const val = raw.trim()
    if (val && !tags.includes(val)) {
      setTags(prev => [...prev, val])
    }
    setValueInput('')
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      handleAddTag(valueInput)
    } else if (e.key === 'Backspace' && valueInput === '' && tags.length > 0) {
      setTags(prev => prev.slice(0, -1))
    }
  }

  function handleTagInputBlur() {
    if (valueInput.trim()) handleAddTag(valueInput)
  }

  function handleRemoveTag(tag: string) {
    setTags(prev => prev.filter(t => t !== tag))
  }

  function handleSuggestionSelect(value: string) {
    if (multiValue) {
      handleAddTag(value)
      tagInputRef.current?.focus()
    } else {
      setValueInput(value)
      setShowSuggestions(false)
    }
    setActiveIndex(-1)
  }

  function handleValueKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setShowSuggestions(false)
      setActiveIndex(-1)
      return
    }
    if (e.key === 'ArrowDown' && canSuggest) {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, displaySuggestions.length - 1))
      return
    }
    if (e.key === 'ArrowUp' && canSuggest) {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
      return
    }
    if (e.key === 'Enter') {
      if (activeIndex >= 0 && canSuggest) {
        e.preventDefault()
        handleSuggestionSelect(displaySuggestions[activeIndex].value)
      } else {
        handleSubmit()
      }
    }
  }

  function handleSubmit() {
    if (!isValid || !operator) return
    const filter: OpenSearchFilter = {
      attributeName: fieldName,
      filterOperator: operator as FilterOperator,
      attributeValue: noValue
        ? undefined
        : multiValue
          ? tags
          : [valueInput.trim()],
    }
    onAdd(filter)
    reset()
    setOpen(false)
  }

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const wrapCls = dark
    ? 'bg-slate-800/60 border-slate-700'
    : 'bg-blue-50/40 border-gray-200'

  const btnAddOpenCls = dark
    ? 'text-blue-400 hover:text-blue-300 hover:bg-slate-700'
    : 'text-blue-600 hover:text-blue-700 hover:bg-blue-100'

  const selectCls = [
    'text-xs rounded px-2 py-1 border outline-none focus:ring-1',
    dark
      ? 'bg-slate-700 border-slate-600 text-slate-200 focus:ring-blue-500'
      : 'bg-white border-gray-300 text-gray-800 focus:ring-blue-400',
  ].join(' ')

  const inputCls = [
    'text-xs rounded px-2 py-1 border outline-none focus:ring-1 w-full',
    dark
      ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500 focus:ring-blue-500'
      : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:ring-blue-400',
  ].join(' ')

  const tagWrapCls = [
    'flex flex-1 items-center flex-wrap gap-1 rounded px-2 py-1 border min-w-0 min-h-[28px] cursor-text',
    dark
      ? 'bg-slate-700 border-slate-600'
      : 'bg-white border-gray-300',
  ].join(' ')

  const tagCls = [
    'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
    dark
      ? 'bg-blue-800/60 text-blue-300'
      : 'bg-blue-100 text-blue-700',
  ].join(' ')

  const confirmBtnCls = [
    'text-xs px-3 py-1 rounded font-medium transition-colors flex-shrink-0',
    isValid
      ? dark
        ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
        : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
      : dark
        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
        : 'bg-gray-200 text-gray-400 cursor-not-allowed',
  ].join(' ')

  const cancelBtnCls = [
    'text-xs px-2 py-1 rounded transition-colors flex-shrink-0 cursor-pointer',
    dark
      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200',
  ].join(' ')

  return (
    <div className={`border-b flex-shrink-0 ${wrapCls}`}>
      {!open ? (
        /* ── Collapsed: кнопка "+ Добавить фильтр" ── */
        <div className="px-3 py-1.5">
          <button
            onClick={handleOpen}
            className={`inline-flex items-center gap-1 text-xs font-medium transition-colors rounded px-1 py-0.5 cursor-pointer ${btnAddOpenCls}`}
            title="Добавить фильтр"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Добавить фильтр
          </button>
        </div>
      ) : (
        /* ── Expanded: форма ── */
        <div className="px-3 py-2 flex items-start gap-2 flex-wrap">

          {/* Поле — скрываем controlType='hidden' */}
          <select
            value={fieldName}
            onChange={e => handleFieldChange(e.target.value)}
            className={`${selectCls} w-40 flex-shrink-0`}
            aria-label="Поле фильтра"
          >
            <option value="">— поле —</option>
            {fields
              .filter(f => f.controlType !== 'hidden')
              .map(f => (
                <option key={f.name} value={f.name ?? ''}>
                  {f.name ?? ''}
                </option>
              ))
            }
          </select>

          {/* Оператор — набор зависит от controlType поля; по умолчанию не выбран */}
          <select
            value={operator}
            onChange={e => handleOperatorChange(e.target.value as FilterOperator | '')}
            className={`${selectCls} w-44 flex-shrink-0`}
            aria-label="Оператор фильтра"
          >
            <option value="">— оператор —</option>
            {availableOperators.map(op => (
              <option key={op.value} value={op.value}>
                {op.symbol} {op.label}
              </option>
            ))}
          </select>

          {/* Значение — показывается только когда оператор выбран и требует значения */}
          {hasValue && (
            <div className="relative flex-1 min-w-0">
              {multiValue ? (
                /* Tag-input для IS ONE OF / IS NOT ONE OF */
                <div
                  className={tagWrapCls}
                  onClick={() => tagInputRef.current?.focus()}
                >
                  {tags.map(tag => (
                    <span key={tag} className={tagCls}>
                      {tag}
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleRemoveTag(tag) }}
                        className="opacity-60 hover:opacity-100 cursor-pointer leading-none"
                        title={`Удалить "${tag}"`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={valueInput}
                    onChange={e => handleValueInputChange(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={handleTagInputBlur}
                    onFocus={() => (suggestions.length > 0 || searchMode) && setShowSuggestions(true)}
                    placeholder={tags.length === 0 ? 'Значение, Enter — добавить' : ''}
                    className={[
                      'text-xs outline-none bg-transparent flex-1 min-w-[80px]',
                      dark ? 'text-slate-200 placeholder-slate-500' : 'text-gray-800 placeholder-gray-400',
                    ].join(' ')}
                    aria-label="Значение фильтра"
                  />
                </div>
              ) : selectedField?.controlType === 'datetime' ? (
                /* DateTimePicker для datetime полей */
                <DateTimePicker
                  value={valueInput}
                  onChange={v => { setValueInput(v); setActiveIndex(-1) }}
                  dark={dark}
                />
              ) : (
                /* Обычный input */
                <input
                  ref={valueInputRef}
                  type={selectedField?.controlType === 'int' ? 'number' : 'text'}
                  value={valueInput}
                  onChange={e => handleValueInputChange(e.target.value)}
                  onKeyDown={handleValueKeyDown}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder={selectedField?.controlType === 'int' ? 'Число' : 'Значение'}
                  className={inputCls}
                  aria-label="Значение фильтра"
                />
              )}

              {/* Dropdown подсказок */}
              {canSuggest && (
                <div className={[
                  'absolute top-full left-0 right-0 z-50 mt-0.5 rounded-md border overflow-hidden',
                  'max-h-48 overflow-y-auto',
                  dark
                    ? 'bg-slate-800 border-slate-600 shadow-xl shadow-black/40'
                    : 'bg-white border-gray-200 shadow-lg',
                ].join(' ')}>
                  {isAnyLoading ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs">
                      <svg className={['w-3.5 h-3.5 animate-spin flex-shrink-0', dark ? 'text-slate-400' : 'text-gray-400'].join(' ')} viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className={dark ? 'text-slate-400' : 'text-gray-400'}>Загрузка значений...</span>
                    </div>
                  ) : displaySuggestions.map((s, i) => (
                    <button
                      key={s.value}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); handleSuggestionSelect(s.value) }}
                      className={[
                        'w-full flex items-center justify-between px-3 py-1.5 text-xs text-left',
                        i === activeIndex
                          ? dark ? 'bg-slate-600 text-white' : 'bg-gray-100 text-gray-900'
                          : dark ? 'text-slate-200 hover:bg-slate-700' : 'text-gray-800 hover:bg-gray-50',
                        multiValue && tags.includes(s.value) ? 'opacity-40' : '',
                      ].join(' ')}
                    >
                      <span className="truncate">{s.value}</span>
                      <span className={['tabular-nums text-[11px] flex-shrink-0 ml-2', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')}>
                        {s.docCount.toLocaleString('ru-RU')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Кнопки */}
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={confirmBtnCls}
            title="Добавить фильтр"
          >
            Добавить
          </button>

          <button
            onClick={handleCancel}
            className={cancelBtnCls}
            title="Отмена"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

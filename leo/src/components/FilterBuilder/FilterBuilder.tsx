import { useState, useRef, KeyboardEvent } from 'react'
import type { Field, FilterOperator, OpenSearchFilter } from '@/types/api'

// ─── Constants ───────────────────────────────────────────────────────────────

const OPERATORS: { value: FilterOperator; label: string; symbol: string }[] = [
  { value: 'IS',             label: 'IS',             symbol: '=' },
  { value: 'IS NOT',         label: 'IS NOT',         symbol: '≠' },
  { value: 'IS ONE OF',      label: 'IS ONE OF',      symbol: '∈' },
  { value: 'IS NOT ONE OF',  label: 'IS NOT ONE OF',  symbol: '∉' },
  { value: 'EXIST',          label: 'EXIST',          symbol: '∃' },
  { value: 'DOES NOT EXIST', label: 'DOES NOT EXIST', symbol: '∄' },
]

const NO_VALUE_OPERATORS = new Set<FilterOperator>(['EXIST', 'DOES NOT EXIST'])
const MULTI_VALUE_OPERATORS = new Set<FilterOperator>(['IS ONE OF', 'IS NOT ONE OF'])

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  dark: boolean
  fields: Field[]
  onAdd: (filter: OpenSearchFilter) => void
}

// ─── FilterBuilder ────────────────────────────────────────────────────────────

export default function FilterBuilder({ dark, fields, onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [fieldName, setFieldName] = useState('')
  const [operator, setOperator] = useState<FilterOperator>('IS')
  const [valueInput, setValueInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const tagInputRef = useRef<HTMLInputElement>(null)

  const noValue    = NO_VALUE_OPERATORS.has(operator)
  const multiValue = MULTI_VALUE_OPERATORS.has(operator)

  const isValid = fieldName.trim() !== '' && (
    noValue ||
    (multiValue ? tags.length > 0 : valueInput.trim() !== '')
  )

  function reset() {
    setFieldName('')
    setOperator('IS')
    setValueInput('')
    setTags([])
  }

  function handleOpen() {
    setOpen(true)
  }

  function handleCancel() {
    reset()
    setOpen(false)
  }

  function handleOperatorChange(op: FilterOperator) {
    setOperator(op)
    // сбрасываем значение при смене режима
    setValueInput('')
    setTags([])
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

  function handleSubmit() {
    if (!isValid) return
    const filter: OpenSearchFilter = {
      attributeName: fieldName,
      filterOperator: operator,
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
    'text-xs rounded px-2 py-1 border outline-none focus:ring-1 min-w-0',
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

          {/* Поле */}
          <select
            value={fieldName}
            onChange={e => setFieldName(e.target.value)}
            className={`${selectCls} w-40 flex-shrink-0`}
            aria-label="Поле фильтра"
          >
            <option value="">— поле —</option>
            {fields.map(f => (
              <option key={f.name} value={f.name ?? ''}>
                {f.name ?? ''}
              </option>
            ))}
          </select>

          {/* Оператор */}
          <select
            value={operator}
            onChange={e => handleOperatorChange(e.target.value as FilterOperator)}
            className={`${selectCls} w-36 flex-shrink-0`}
            aria-label="Оператор фильтра"
          >
            {OPERATORS.map(op => (
              <option key={op.value} value={op.value}>
                {op.symbol} {op.label}
              </option>
            ))}
          </select>

          {/* Значение */}
          {!noValue && (
            multiValue ? (
              /* Tag-input для IS ONE OF / IS NOT ONE OF */
              <div
                className={`${tagWrapCls} flex-1`}
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
                  onChange={e => setValueInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={handleTagInputBlur}
                  placeholder={tags.length === 0 ? 'Значение, Enter — добавить' : ''}
                  className={[
                    'text-xs outline-none bg-transparent flex-1 min-w-[80px]',
                    dark ? 'text-slate-200 placeholder-slate-500' : 'text-gray-800 placeholder-gray-400',
                  ].join(' ')}
                  aria-label="Значение фильтра"
                />
              </div>
            ) : (
              /* Обычный input */
              <input
                type="text"
                value={valueInput}
                onChange={e => setValueInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                placeholder="Значение"
                className={`${inputCls} flex-1`}
                aria-label="Значение фильтра"
              />
            )
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

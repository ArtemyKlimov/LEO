import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ExportAttributes } from '@/types/api'

// ─── Icons ────────────────────────────────────────────────────────────────────

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
  availableFields: string[]
  onExport: (attrs: ExportAttributes) => Promise<void>
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExportModal({ dark, availableFields, onExport, onClose }: Props) {
  const [fileType, setFileType] = useState<'csv' | 'txt'>('csv')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [sortField, setSortField] = useState<string>('localTime')
  const [limitLines, setLimitLines] = useState<number>(10000)
  const [limitMB, setLimitMB] = useState<number>(10)
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [fieldSearch, setFieldSearch] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose()
  }

  const filteredFields = availableFields.filter(f =>
    f.toLowerCase().includes(fieldSearch.toLowerCase()),
  )

  function toggleField(name: string) {
    setSelectedFields(prev =>
      prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name],
    )
  }

  function selectAll() {
    setSelectedFields(filteredFields)
  }

  function clearAll() {
    setSelectedFields([])
  }

  async function handleSubmit() {
    if (limitLines < 1) { setError('Лимит строк должен быть не менее 1'); return }
    if (limitMB < 1) { setError('Лимит МБ должен быть не менее 1'); return }
    setIsExporting(true)
    setError(null)
    try {
      await onExport({
        fileType,
        sorting: { order: sortOrder, fieldName: sortField || undefined },
        limitLines,
        limitMB,
        exportFields: selectedFields,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка экспорта')
    } finally {
      setIsExporting(false)
    }
  }

  // ── Styles ───────────────────────────────────────────────────────────────────

  const overlay = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50'
  const modal = [
    'relative w-[520px] max-w-[calc(100vw-2rem)] rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto',
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
  const selectCls = [
    'w-full text-sm px-3 py-2 rounded-lg border outline-none transition-colors cursor-pointer',
    dark
      ? 'bg-slate-900 border-slate-600 text-white focus:border-blue-500'
      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-400',
  ].join(' ')
  const segBase = 'flex rounded-lg overflow-hidden border text-xs font-medium'
  const segBorder = dark ? 'border-slate-600' : 'border-gray-300'
  const segActive = 'bg-blue-600 text-white'
  const segInactive = dark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  const btnCancel = [
    'px-4 py-2 text-sm rounded-lg border transition-colors cursor-pointer',
    dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50',
  ].join(' ')
  const btnExport = [
    'px-4 py-2 text-sm rounded-lg font-medium transition-colors cursor-pointer',
    isExporting ? 'opacity-60 cursor-not-allowed' : '',
    'bg-blue-600 hover:bg-blue-700 text-white',
  ].join(' ')
  const fieldListCls = [
    'rounded-lg border overflow-y-auto max-h-44 text-sm',
    dark ? 'bg-slate-900 border-slate-600' : 'bg-gray-50 border-gray-200',
  ].join(' ')
  const fieldItemCls = (checked: boolean) => [
    'flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors',
    checked
      ? dark ? 'bg-blue-600/20' : 'bg-blue-50'
      : dark ? 'hover:bg-slate-700' : 'hover:bg-gray-100',
  ].join(' ')
  const hintCls = ['text-xs mt-1', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')
  const linkBtnCls = ['text-xs cursor-pointer transition-colors', dark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'].join(' ')

  return createPortal(
    <div className={overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={modal}>
        {/* Header */}
        <div className={header}>
          <span className="text-sm font-semibold">Экспорт логов</span>
          <button onClick={onClose} className={['p-1 rounded transition-colors cursor-pointer', dark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'].join(' ')}>
            <IconX cls="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className={body}>
          {/* File type */}
          <div>
            <label className={labelCls}>Формат файла</label>
            <div className={`${segBase} ${segBorder}`}>
              {(['csv', 'txt'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setFileType(fmt)}
                  className={['flex-1 px-4 py-1.5 transition-colors cursor-pointer', fileType === fmt ? segActive : segInactive].join(' ')}
                >
                  .{fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Limits row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Лимит строк</label>
              <input
                type="number"
                min={1}
                value={limitLines}
                onChange={e => setLimitLines(Math.max(1, parseInt(e.target.value) || 1))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Лимит размера (МБ)</label>
              <input
                type="number"
                min={1}
                value={limitMB}
                onChange={e => setLimitMB(Math.max(1, parseInt(e.target.value) || 1))}
                className={inputCls}
              />
            </div>
          </div>

          {/* Sorting row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Порядок сортировки</label>
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')} className={selectCls}>
                <option value="desc">Новые сначала (desc)</option>
                <option value="asc">Старые сначала (asc)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Поле сортировки</label>
              <select value={sortField} onChange={e => setSortField(e.target.value)} className={selectCls}>
                <option value="localTime">localTime (по умолчанию)</option>
                {availableFields.filter(f => f !== 'localTime').map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fields multiselect */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls.replace('mb-1', '')}>Поля для экспорта</label>
              <div className="flex items-center gap-3">
                <button onClick={selectAll} className={linkBtnCls}>Все</button>
                <button onClick={clearAll} className={linkBtnCls}>Снять</button>
              </div>
            </div>
            <input
              type="text"
              placeholder="Поиск полей..."
              value={fieldSearch}
              onChange={e => setFieldSearch(e.target.value)}
              className={[inputCls, 'mb-1.5'].join(' ')}
            />
            {availableFields.length > 0 ? (
              <div className={fieldListCls}>
                {filteredFields.length > 0 ? filteredFields.map(f => (
                  <div key={f} className={fieldItemCls(selectedFields.includes(f))} onClick={() => toggleField(f)}>
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(f)}
                      onChange={() => toggleField(f)}
                      onClick={e => e.stopPropagation()}
                      className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                    />
                    <span className="truncate">{f}</span>
                  </div>
                )) : (
                  <div className={['px-3 py-3 text-xs text-center', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')}>
                    Нет совпадений
                  </div>
                )}
              </div>
            ) : (
              <div className={[fieldListCls, 'px-3 py-3 text-xs text-center', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')}>
                Загрузка полей...
              </div>
            )}
            <p className={hintCls}>
              {selectedFields.length === 0
                ? 'Если поля не выбраны — сервер экспортирует все доступные поля'
                : `Выбрано полей: ${selectedFields.length}`}
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className={footer}>
          <button onClick={onClose} className={btnCancel} disabled={isExporting}>Отмена</button>
          <button onClick={handleSubmit} className={btnExport} disabled={isExporting}>
            {isExporting ? 'Экспортируется...' : 'Экспортировать'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

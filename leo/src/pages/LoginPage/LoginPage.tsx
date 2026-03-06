import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/store/AppContext'
import { getToken } from '@/auth/jwtService'
import { fetchLogs, buildLogRequest, fetchProjectCodes } from '@/api/endpoints'
import { ApiError } from '@/api/client'
import type { UserConfig } from '@/types/config'

const LAST_15_MIN_MS = 15 * 60 * 1000

export default function LoginPage() {
  const { config, theme, setCurrentUser, setTimeRange, setLogData, setLoading, setAvailableProjectCodes, setSelectedProjectCodes } = useApp()
  const navigate = useNavigate()

  const [selected, setSelected] = useState<UserConfig | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const dark = theme === 'dark'

  async function handleLogin() {
    if (!selected || !config) return

    setLoginError(null)
    setIsLoggingIn(true)
    setLoading(true)

    try {
      // ensure token is ready
      await getToken(selected, config)

      // load available project codes (silently ignore errors)
      const codes = await fetchProjectCodes(selected, config).catch(() => [])
      setAvailableProjectCodes(codes)
      setCurrentUser(selected)

      const to = new Date()
      const from = new Date(to.getTime() - LAST_15_MIN_MS)
      setTimeRange({ from, to, label: 'Последние 15 минут' })

      if (codes.length > 5) {
        // слишком много кодов — ждём выбора пользователя
        setSelectedProjectCodes([])
        navigate('/viewer')
      } else {
        setSelectedProjectCodes(codes)
        const projectCodeFilter = codes.length > 0
          ? [{ attributeName: 'projectCode', filterOperator: 'IS ONE OF' as const, attributeValue: codes }]
          : []
        const request = buildLogRequest(from, to, { filters: projectCodeFilter }, config.logging.maxLogsPerPage)
        const response = await fetchLogs(request, selected, config)
        setLogData(response)
        navigate('/viewer')
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setLoginError(`Ошибка API ${err.status}: ${err.message}`)
      } else {
        setLoginError(err instanceof Error ? err.message : 'Неизвестная ошибка')
      }
      setCurrentUser(null)
    } finally {
      setIsLoggingIn(false)
      setLoading(false)
    }
  }

  if (!config) return null

  return (
    <div
      className={[
        'min-h-screen flex flex-col items-center justify-center px-4',
        dark ? 'bg-slate-900' : 'bg-gray-50',
      ].join(' ')}
    >
      {/* Logo */}
      <div className="mb-8 text-center">
        <div
          className={[
            'inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 text-2xl font-black',
            dark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white',
          ].join(' ')}
        >
          LEO
        </div>
        <h1 className={['text-2xl font-bold', dark ? 'text-white' : 'text-gray-900'].join(' ')}>
          Log Explorer Online
        </h1>
        <p className={['text-sm mt-1', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>
          Выберите пользователя для входа
        </p>
      </div>

      {/* Card */}
      <div
        className={[
          'w-full max-w-sm rounded-2xl shadow-lg p-6',
          dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200',
        ].join(' ')}
      >
        {/* User list */}
        <div className="space-y-2 mb-6">
          {config.users.map((user) => {
            const isSelected = selected?.userId === user.userId
            return (
              <button
                key={user.userId}
                onClick={() => setSelected(user)}
                className={[
                  'w-full text-left px-4 py-3 rounded-xl border transition-all duration-150 cursor-pointer',
                  isSelected
                    ? dark
                      ? 'bg-blue-900/50 border-blue-500 ring-1 ring-blue-500'
                      : 'bg-blue-50 border-blue-500 ring-1 ring-blue-500'
                    : dark
                      ? 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300',
                ].join(' ')}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className={[
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : dark
                          ? 'bg-slate-600 text-slate-300'
                          : 'bg-gray-200 text-gray-600',
                    ].join(' ')}
                  >
                    {user.userId[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div
                      className={[
                        'font-medium text-sm truncate',
                        dark ? 'text-white' : 'text-gray-900',
                      ].join(' ')}
                    >
                      {user.userId}
                    </div>
                    {user.role && (
                      <div
                        className={[
                          'text-xs truncate',
                          dark ? 'text-slate-400' : 'text-gray-500',
                        ].join(' ')}
                      >
                        {user.role}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <div className="ml-auto text-blue-500 flex-shrink-0">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Error */}
        {loginError && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            {loginError}
          </div>
        )}

        {/* Login button */}
        <button
          onClick={handleLogin}
          disabled={!selected || isLoggingIn}
          className={[
            'w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-150',
            !selected || isLoggingIn
              ? dark
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white cursor-pointer shadow-sm',
          ].join(' ')}
        >
          {isLoggingIn ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              Загрузка логов...
            </span>
          ) : (
            'Войти'
          )}
        </button>
      </div>
    </div>
  )
}

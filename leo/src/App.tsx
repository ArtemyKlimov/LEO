import { useEffect, useState } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './index.css'
import { loadConfig } from '@/utils/configLoader'
import { useApp } from '@/store/AppContext'
import type { AppConfig } from '@/types/config'
import LoginPage from '@/pages/LoginPage/LoginPage'
import LogViewerPage from '@/pages/LogViewerPage/LogViewerPage'

// ─── Protected route ─────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { currentUser } = useApp()
  return currentUser ? <>{children}</> : <Navigate to="/" replace />
}

// ─── Router ───────────────────────────────────────────────────────────────────

const router = createBrowserRouter([
  { path: '/', element: <LoginPage /> },
  {
    path: '/viewer',
    element: (
      <RequireAuth>
        <LogViewerPage />
      </RequireAuth>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

// ─── App ──────────────────────────────────────────────────────────────────────

function AppInner() {
  const { setConfig, theme } = useApp()
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    loadConfig()
      .then((cfg: AppConfig) => {
        setConfig(cfg)
        setReady(true)
      })
      .catch((err: unknown) => {
        setInitError(err instanceof Error ? err.message : String(err))
      })
  }, [setConfig])

  if (initError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Ошибка загрузки конфигурации</h1>
          <p className="text-red-500 text-sm">{initError}</p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-400 text-sm">Загрузка конфигурации...</p>
      </div>
    )
  }

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <RouterProvider router={router} />
    </div>
  )
}

export default function App() {
  return <AppInner />
}

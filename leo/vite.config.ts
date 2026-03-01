import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import fs from 'fs'
import yaml from 'js-yaml'
import type { Plugin } from 'vite'

// Плагин: отдаёт ../config.yaml (корневой) как /config.yaml в dev-режиме
function serveRootConfig(): Plugin {
  const rootConfig = resolve(__dirname, '../config.yaml')
  return {
    name: 'serve-root-config',
    configureServer(server) {
      server.middlewares.use('/config.yaml', (_req, res) => {
        try {
          const content = fs.readFileSync(rootConfig, 'utf-8')
          res.setHeader('Content-Type', 'text/yaml; charset=utf-8')
          res.end(content)
        } catch {
          res.statusCode = 404
          res.end('config.yaml not found')
        }
      })
    },
  }
}

// Читаем настройки сервера из config.yaml
function readServerConfig(): { frontendPort: number; backendUrl: string } {
  try {
    const configPath = resolve(__dirname, '../config.yaml')
    const raw = fs.readFileSync(configPath, 'utf-8')
    const cfg = yaml.load(raw) as {
      server?: {
        port?: number
        backend?: { protocol?: string; host?: string; port?: number }
      }
    }
    const s = cfg?.server
    const b = s?.backend
    return {
      frontendPort: s?.port ?? 5173,
      backendUrl: b?.host && b?.port
        ? `${b.protocol ?? 'http'}://${b.host}:${b.port}`
        : 'http://localhost:8080',
    }
  } catch {
    return { frontendPort: 5173, backendUrl: 'http://localhost:8080' }
  }
}

const { frontendPort, backendUrl } = readServerConfig()

export default defineConfig({
  plugins: [react(), tailwindcss(), serveRootConfig()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: frontendPort,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
})

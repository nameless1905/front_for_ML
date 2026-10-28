import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.VITE_BACKEND_URL || 'http://localhost:8000'
  const predictPath = env.VITE_PREDICT_PATH || '/generate_open_router'

  return {
    plugins: [vue()],
    server: {
      port: 5173,
      // Проксируем запросы на бэкенд, чтобы не возиться с CORS в разработке.
      proxy: {
        [predictPath]: { target: backend, changeOrigin: true },
        '/api': { target: backend, changeOrigin: true },
      },
    },
  }
})

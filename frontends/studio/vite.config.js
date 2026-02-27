import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    hmr: {
      port: 5174,
      clientPort: 5174,
    },
    proxy: {
      // XIA backend (separate machine — will integrate later)
      '/xia': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        timeout: 60000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[XIA] proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('[XIA] Sending Request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('[XIA] Response:', proxyRes.statusCode, req.url);
          });
        },
      },
      // Console backend — media files (screen images)
      // In monorepo: change target to http://localhost:8000
      '/api/console/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace('/api/console/media', ''),
      },
      // Console backend — API routes
      // In monorepo: change target to http://localhost:8000
      '/api/console': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        timeout: 30000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[CONSOLE] proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('[CONSOLE] Sending Request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('[CONSOLE] Response:', proxyRes.statusCode, req.url);
          });
        },
      },
      // Django media files (creative briefs, uploads)
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      // Studio backend — prefixed routes
      '/api/studio': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        timeout: 30000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[STUDIO] proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('[STUDIO] Sending Request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('[STUDIO] Response:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  }
})

import process from 'node:process'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// A regex key prevents frontend paths such as /apiary from reaching the API proxy.
const proxy = {
  '^/api(?:/|\\?|$)': {
    target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000',
    changeOrigin: true,
  },
}
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],

  server: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app'],
    proxy,
  },

  preview: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app'],
    proxy,
  },
})

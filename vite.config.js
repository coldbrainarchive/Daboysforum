import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-hosting-files',
      closeBundle() {
        const files = ['_redirects', '_headers']
        const distDir = resolve(__dirname, 'dist')

        if (!existsSync(distDir)) {
          mkdirSync(distDir, { recursive: true })
        }

        for (const file of files) {
          const source = resolve(__dirname, 'public', file)
          const target = resolve(distDir, file)

          if (existsSync(source)) {
            copyFileSync(source, target)
          }
        }
      }
    }
  ],
  base: '/',
})

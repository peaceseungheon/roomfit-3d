import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 멀티 페이지: 랜딩·방침은 가벼운 정적 문서, 에디터만 React/three 번들(PRD AC-18-2).
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { index: 'index.html', editor: 'editor.html', privacy: 'privacy.html' },
    },
  },
})

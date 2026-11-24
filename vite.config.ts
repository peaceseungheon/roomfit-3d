import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { manifest } from './src/pwa/manifest.ts'

// 멀티 페이지: 랜딩·방침은 가벼운 정적 문서, 에디터만 React/three 번들(PRD AC-18-2).
// PWA(FR-20): SW 등록은 src/pwa/register.ts가 프로덕션에서만 한다(개발 서버 SW 없음, AC-20-2).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // 설치·활성화 자동. reload 코드는 등록 모듈에 없다(AC-20-4).
      injectRegister: false,
      manifest,
      includeManifestIcons: false,
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png'], // 아이콘 3종만 프리캐시(설치 오프라인 대비)
      workbox: {
        skipWaiting: true, // v2 autoUpdate는 등록 모듈(reload 포함)이 대신하던 활성화를 SW에 직접 지정해야 한다
        clientsClaim: true,
        navigateFallback: null, // 각 HTML 문서 그대로 서빙(AC-20-2)
        globPatterns: ['**/*.{html,js,css}'], // 폰트는 프리캐시하지 않는다
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // 기본 2MiB 초과 시 조용히 누락되므로 여유를 둔다(현재 에디터 번들 약 1.3MB)
        runtimeCaching: [
          {
            // 동일 출처 woff2만, 실제 요청된 파일만 캐시한다. 교차 출처는 어떤 라우트에도 걸리지 않는다.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: { cacheName: 'fonts' },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: { index: 'index.html', editor: 'editor.html', privacy: 'privacy.html' },
    },
  },
})

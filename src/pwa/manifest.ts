// PRD AC-20-1. 색상은 DESIGN.md 값. vite.config.ts와 테스트가 공유한다.
export const manifest = {
  name: 'RoomFit 3D',
  short_name: 'RoomFit',
  start_url: '/editor.html',
  scope: '/',
  display: 'standalone' as const,
  lang: 'ko',
  theme_color: '#0f2a4a',
  background_color: '#eaf0f6',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}

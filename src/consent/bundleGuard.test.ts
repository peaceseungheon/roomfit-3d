// AC-18-2: 에디터 소스 그래프가 광고 로더·광고 도메인을 포함하지 않는다(빌드 산출물 비의존, 소스 텍스트 검사).
import { describe, expect, it } from 'vitest'

const FORBIDDEN = /adLoader|googlesyndication|doubleclick|adsbygoogle|pagead|landing\/page/
const sources = import.meta.glob(
  ['/src/{ui,scene,store,io}/**/*.{ts,tsx}', '/src/main.tsx', '/src/App.tsx', '!/**/*.test.*'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>
const editorHtml = import.meta.glob('/editor.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('에디터 광고 격리', () => {
  it('검사 대상이 비어 있지 않다', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10)
  })
  it('에디터 소스에 광고 로더·광고 도메인이 없다', () => {
    expect(Object.keys(sources).filter((f) => FORBIDDEN.test(sources[f]))).toEqual([])
  })
  it('에디터 HTML 문서에도 광고 스크립트가 없다', () => {
    expect(editorHtml['/editor.html']).toBeTruthy()
    expect(editorHtml['/editor.html']).not.toMatch(FORBIDDEN)
  })
})

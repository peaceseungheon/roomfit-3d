// AC-18-2: 에디터 소스 그래프가 광고 로더·광고 도메인을 포함하지 않는다(빌드 산출물 비의존, 소스 텍스트 검사).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { adInsSpec, loadAds } from '../consent/adLoader'
import SideAd from '../ui/SideAd'

vi.mock('../consent/adLoader', async () => ({ loadAds: vi.fn(), adInsSpec: (await vi.importActual<typeof import('../consent/adLoader')>('../consent/adLoader')).adInsSpec }))

// AC-18-1: 측면 광고 칸 컴포넌트 하나만 adLoader를 쓸 수 있다.
const SIDE_AD = '/src/ui/SideAd.tsx'

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
    expect(Object.keys(sources).filter((f) => f !== SIDE_AD && FORBIDDEN.test(sources[f]))).toEqual([])
  })
  it('에디터 HTML 문서에도 광고 스크립트가 없다', () => {
    expect(editorHtml['/editor.html']).toBeTruthy()
    expect(editorHtml['/editor.html']).not.toMatch(FORBIDDEN)
  })
  it('측면 광고 칸 파일이 존재하고 그 파일만 예외다', () => {
    expect(sources[SIDE_AD]).toMatch(/adLoader/)
  })
  it('고정 크기 단위는 inline-block·크기를 지정하고 format·full-width를 넣지 않는다', () => {
    const fixed = adInsSpec('ca-pub-1', '2', { width: 160, height: 600 })
    expect(fixed).toMatchObject({ display: 'inline-block', width: '160px', height: '600px', data: { adClient: 'ca-pub-1', adSlot: '2' } })
    expect(fixed.data).not.toHaveProperty('adFormat')
    expect(fixed.data).not.toHaveProperty('fullWidthResponsive')
    expect(adInsSpec('ca-pub-1', '2').data).toMatchObject({ adFormat: 'auto', fullWidthResponsive: 'true' })
  })
  it('슬롯이 비어 있으면 칸을 렌더하지 않고 loadAds도 부르지 않는다', () => {
    expect(renderToStaticMarkup(SideAd())).toBe('')
    expect(loadAds).not.toHaveBeenCalled()
  })
})

describe('loadAds 정리·타임아웃', () => {
  it('타임아웃 상수가 양수로 이름 붙어 있다', async () => {
    const { AD_FILL_TIMEOUT_MS } = await vi.importActual<typeof import('../consent/adLoader')>('../consent/adLoader')
    expect(AD_FILL_TIMEOUT_MS).toBeGreaterThan(0)
  })
  it('설정이 비면 즉시 접고 정리 함수는 안전하게 호출된다', async () => {
    const { loadAds: real } = await vi.importActual<typeof import('../consent/adLoader')>('../consent/adLoader')
    const collapse = vi.fn()
    const cleanup = real('', '', {} as HTMLElement, collapse)
    expect(collapse).toHaveBeenCalledTimes(1)
    expect(() => cleanup()).not.toThrow()
  })
})

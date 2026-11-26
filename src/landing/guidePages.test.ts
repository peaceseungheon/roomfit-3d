// FR-21 시범 가이드 페이지(AC-21-4): 정적 HTML을 파일로 읽어 SEO 메타·CTA·치수 표·사이트맵·광고 칸을 검사한다.
import { describe, expect, it } from 'vitest'
import { FURNITURE_CATALOG, findCatalog } from '../store/catalog'
import { findTemplate } from '../store/templates'

const src = import.meta.glob(['/guide/*.html', '/public/sitemap.xml', '/vite.config.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const sitemap = src['/public/sitemap.xml']
const vite = src['/vite.config.ts']
const pages = Object.entries(src)
  .filter(([path]) => path.startsWith('/guide/'))
  .map(([path, html]) => ({ file: path.split('/').pop()!, html }))
  .sort((a, b) => a.file.localeCompare(b.file))
const files = pages.map((p) => p.file)
const one = (html: string, re: RegExp) => re.exec(html)?.[1] ?? ''

describe('시범 가이드 페이지', () => {
  it('5개다', () => expect(files).toEqual(['59-master.html', '59-small.html', '84-living.html', '84-master.html', 'studio.html']))

  it('canonical·title·description·h1이 페이지마다 고유하고 canonical이 파일 경로와 맞다', () => {
    for (const re of [/<title>([^<]+)</, /<meta name="description" content="([^"]+)"/, /<h1>([^<]+)</]) {
      const vals = pages.map((p) => one(p.html, re))
      expect(vals.every(Boolean)).toBe(true)
      expect(new Set(vals).size).toBe(pages.length)
    }
    for (const p of pages) expect(one(p.html, /<link rel="canonical" href="([^"]+)"/)).toBe(`https://d-gong.store/guide/${p.file}`)
  })

  it('CTA의 템플릿 id가 존재하고 사이트맵·vite 입력에 등록돼 있다', () => {
    for (const p of pages) {
      const ids = [...p.html.matchAll(/href="\/editor\.html#t=([\w-]+)"/g)].map((m) => m[1])
      expect(ids.length).toBeGreaterThan(0)
      for (const id of ids) expect(findTemplate(id), `${p.file}: ${id}`).toBeDefined()
      expect(sitemap).toContain(`<loc>https://d-gong.store/guide/${p.file}</loc>`)
      expect(vite).toContain(`'${p.file.replace('.html', '')}'`)
    }
  })

  it('가구 치수 표가 카탈로그와 같고 연결된 템플릿의 가구와 일치한다', () => {
    for (const p of pages) {
      const id = one(p.html, /href="\/editor\.html#t=([\w-]+)"/)
      const tableBody = one(p.html, /<tbody data-dims>(.*?)<\/tbody>/s)
      const rows = [...tableBody.matchAll(/<td>([^<]+)<\/td><td>([^<]+)<\/td>/g)].map((m) => [m[1], m[2]])
      const used = new Set(
        findTemplate(id)!
          .doc()
          .items.filter((i) => i.type === 'FURNITURE')
          .map((i) => findCatalog(i.modelType)!),
      )
      expect(rows.map((r) => r[0]).sort()).toEqual([...used].map((c) => c.name).sort())
      for (const [name, dims] of rows) {
        const c = FURNITURE_CATALOG.find((x) => x.name === name)!
        expect(dims, `${p.file}: ${name}`).toBe(`${c.w} × ${c.d} × ${c.h}`)
      }
    }
  })

  it('광고 칸이 페이지당 1개이고 랜딩과 같은 애드센스 head 스크립트를 1번 싣는다(AC-18-5)', () => {
    for (const p of pages) {
      expect(p.html.match(/data-ad-slot/g)).toHaveLength(1)
      expect(p.html.match(/adsbygoogle\.js\?client=ca-pub-\d+/g)).toHaveLength(1)
      expect(p.html).toContain('/src/landing/page.ts')
      expect(p.html).toContain('id="consent-banner"')
    }
  })

  it('예시임을 밝히고 특정 단지·브랜드를 쓰지 않는다', () => {
    for (const p of pages) {
      expect(p.html).toContain('예시 치수')
      expect(p.html).not.toMatch(/아파트|푸르지오|래미안|자이|힐스테이트|이케아|IKEA/i)
    }
  })
})

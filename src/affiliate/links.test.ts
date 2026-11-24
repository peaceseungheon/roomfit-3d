import { describe, expect, it } from 'vitest'
import { FURNITURE_CATALOG } from '../store/catalog'
import { AFFILIATE_LINKS, affiliateUrl, isHttpUrl, type AffiliateEntry } from './links'

const bed: AffiliateEntry = { a: 120, b: 165, small: 'https://a.example/s', mid: 'https://a.example/m', large: 'https://a.example/l' }

describe('affiliateUrl', () => {
  it('기본 상수는 14종×3구간 모두 쿠팡 파트너스 링크이고 서로 겹치지 않는다', () => {
    expect(Object.keys(AFFILIATE_LINKS)).toHaveLength(14)
    const urls: string[] = []
    for (const c of FURNITURE_CATALOG) {
      const { small, mid, large } = AFFILIATE_LINKS[c.modelType]
      urls.push(small, mid, large)
      expect(affiliateUrl(c.modelType, c.w)).toBe(mid)
    }
    expect(urls).toHaveLength(42)
    for (const u of urls) expect(u).toMatch(/^https:\/\/link\.coupang\.com\/a\/\w+$/)
    expect(new Set(urls).size).toBe(42)
  })
  it('14종 모두 a<b이고 기본 W가 중 구간(a<W<=b)에 속한다', () => {
    for (const c of FURNITURE_CATALOG) {
      const { a, b } = AFFILIATE_LINKS[c.modelType]
      expect(a).toBeLessThan(b)
      expect(c.w).toBeGreaterThan(a)
      expect(c.w).toBeLessThanOrEqual(b)
    }
  })
  it('http(s) URL만 통과한다', () => {
    expect(isHttpUrl('https://a.example/x')).toBe(true)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('')).toBe(false)
    expect(isHttpUrl(undefined)).toBe(false)
  })
  it('경계값: W<=a 소, a<W<=b 중, W>b 대', () => {
    const links = { BED: bed }
    expect(affiliateUrl('BED', 120, links)).toBe(bed.small)
    expect(affiliateUrl('BED', 121, links)).toBe(bed.mid)
    expect(affiliateUrl('BED', 165, links)).toBe(bed.mid)
    expect(affiliateUrl('BED', 166, links)).toBe(bed.large)
  })
  it('해당 구간 URL이 없거나 비정상이면 null이고 다른 구간으로 대체하지 않는다', () => {
    const links = { BED: { ...bed, mid: '', large: 'javascript:x' } }
    expect(affiliateUrl('BED', 140, links)).toBeNull()
    expect(affiliateUrl('BED', 200, links)).toBeNull()
    expect(affiliateUrl('BED', 50, links)).toBe(bed.small)
  })
  it('14종이 아니거나 설정에 없는 종류는 null', () => {
    const links = { CUSTOM: bed, DIMENSION_BOX: bed }
    expect(affiliateUrl('CUSTOM', 100, links)).toBeNull()
    expect(affiliateUrl('DIMENSION_BOX', 100, links)).toBeNull()
    expect(affiliateUrl('CHAIR', 50, links)).toBeNull()
    expect(affiliateUrl('toString', 50, {})).toBeNull()
    expect(affiliateUrl(undefined, 50, links)).toBeNull()
  })
})

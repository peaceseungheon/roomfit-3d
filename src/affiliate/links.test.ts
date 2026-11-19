import { describe, expect, it } from 'vitest'
import { AFFILIATE_LINKS, affiliateUrl, isHttpUrl } from './links'

describe('affiliateUrl', () => {
  it('기본 상수는 비어 있어 아무 종류도 링크가 없다', () => {
    expect(Object.keys(AFFILIATE_LINKS)).toHaveLength(0)
    expect(affiliateUrl('BED_SINGLE')).toBeNull()
  })
  it('http(s) URL만 통과한다', () => {
    expect(isHttpUrl('https://a.example/x')).toBe(true)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('')).toBe(false)
    expect(isHttpUrl(undefined)).toBe(false)
  })
  it('15종 가구 + 유효 URL일 때만 반환한다', () => {
    const links = { BED_SINGLE: 'https://a.example/b', DESK: 'javascript:x', CUSTOM: 'https://a.example/c' }
    expect(affiliateUrl('BED_SINGLE', links)).toBe('https://a.example/b')
    expect(affiliateUrl('DESK', links)).toBeNull()
    expect(affiliateUrl('CUSTOM', links)).toBeNull()
    expect(affiliateUrl('CHAIR', links)).toBeNull()
    expect(affiliateUrl('toString', {})).toBeNull()
  })
})

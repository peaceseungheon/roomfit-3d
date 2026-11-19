import { describe, expect, it } from 'vitest'
import { adScriptUrl } from './adLoader'
import { adsConfigured, consentAction, parseConsent, shouldLoadAds } from './store'

describe('consent', () => {
  it('저장값을 granted/denied/unset으로 해석한다', () => {
    expect(parseConsent('granted')).toBe('granted')
    expect(parseConsent('denied')).toBe('denied')
    expect(parseConsent(null)).toBe('unset')
    expect(parseConsent('yes')).toBe('unset')
  })
  it('설정이 비면 어떤 동의여도 비활성', () => {
    expect(adsConfigured('', '')).toBe(false)
    expect(adsConfigured('ca-pub-123', '')).toBe(false)
    expect(shouldLoadAds('granted', '', '')).toBe(false)
  })
  it('설정 형식이 틀리면 비활성', () => {
    expect(adsConfigured('ca-pub-1&x=2', '456')).toBe(false)
    expect(adsConfigured('ca-pub-123', 'abc')).toBe(false)
  })
  it('granted일 때만 로드', () => {
    expect(shouldLoadAds('granted', 'ca-pub-123', '456')).toBe(true)
    expect(shouldLoadAds('denied', 'ca-pub-123', '456')).toBe(false)
    expect(shouldLoadAds('unset', 'ca-pub-123', '456')).toBe(false)
  })
  it('같은 값 재선택은 apply하지 않는다(중복 로드 방지)', () => {
    expect(consentAction('granted', 'granted')).toBe('none')
    expect(consentAction('unset', 'granted')).toBe('apply')
    expect(consentAction('denied', 'granted')).toBe('apply')
    expect(consentAction('granted', 'denied')).toBe('reload')
    expect(consentAction('denied', 'denied')).toBe('none')
    expect(consentAction('unset', 'denied')).toBe('none')
  })
  it('로더 URL은 공식 형식', () => {
    expect(adScriptUrl('ca-pub-123')).toBe('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-123')
  })
})

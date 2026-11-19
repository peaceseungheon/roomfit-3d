// 동의 상태 저장소(읽기/쓰기만). 에디터 번들도 import하므로 광고 로더·광고 도메인 문자열을 넣지 않는다(AC-18-2).
export type Consent = 'granted' | 'denied' | 'unset'

export const CONSENT_KEY = 'roomfit.adConsent'

export function parseConsent(raw: unknown): Consent {
  return raw === 'granted' || raw === 'denied' ? raw : 'unset'
}

/** AC-18-7: 클라이언트·슬롯이 모두 유효 형식일 때만 광고 관련 UI를 연다. */
export function adsConfigured(client: string, slot: string): boolean {
  return /^ca-pub-\d+$/.test(client) && /^\d+$/.test(slot)
}

/** 설정이 있고 동의가 granted일 때만 광고 로드. */
export function shouldLoadAds(consent: Consent, client: string, slot: string): boolean {
  return adsConfigured(client, slot) && consent === 'granted'
}

export function readConsent(): Consent {
  try {
    return parseConsent(localStorage.getItem(CONSENT_KEY))
  } catch {
    return 'unset'
  }
}

/** 저장 성공 여부를 반환한다(접근 차단 시 false). */
export function writeConsent(value: 'granted' | 'denied'): boolean {
  try {
    localStorage.setItem(CONSENT_KEY, value)
    return true
  } catch {
    return false
  }
}

/** 선택 변경 시 필요한 동작. 같은 값 재선택은 apply 중복(스크립트·push)을 막기 위해 none. */
export function consentAction(prev: Consent, next: 'granted' | 'denied'): 'apply' | 'reload' | 'none' {
  if (prev === next) return 'none'
  return next === 'granted' ? 'apply' : prev === 'granted' ? 'reload' : 'none'
}

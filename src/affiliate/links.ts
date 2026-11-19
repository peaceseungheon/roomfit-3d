import { FURNITURE_CATALOG } from '../store/catalog'

/**
 * FR-17 제휴 링크 설정(코드 상수 한 곳). 운영자가 쿠팡 파트너스 [간편 링크 만들기]로 변환한 URL을
 * 종류(modelType)별로 채운다. 예: BED_SINGLE: 'https://link.coupang.com/...'
 * 비어 있으면 링크·고지 문구가 모두 숨겨진다(AC-17-5). 사용자 데이터는 URL에 담지 않는다.
 */
export const AFFILIATE_LINKS: Readonly<Record<string, string>> = {}

export function isHttpUrl(s: unknown): s is string {
  if (typeof s !== 'string') return false
  try {
    const p = new URL(s).protocol
    return p === 'http:' || p === 'https:'
  } catch {
    return false
  }
}

/** 기본 가구 15종이고 유효한 http(s) URL이 있을 때만 URL, 아니면 null. */
export function affiliateUrl(modelType: string, links: Readonly<Record<string, string>> = AFFILIATE_LINKS): string | null {
  if (!FURNITURE_CATALOG.some((c) => c.modelType === modelType)) return null
  const url = Object.hasOwn(links, modelType) ? links[modelType] : undefined
  return isHttpUrl(url) ? url : null
}

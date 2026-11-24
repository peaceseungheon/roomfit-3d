import { FURNITURE_CATALOG } from '../store/catalog'

/** 종류별 폭(W) 구간 경계와 구간별 URL. 소: W<=a, 중: a<W<=b, 대: W>b (PRD AC-17-8). */
export interface AffiliateEntry {
  a: number
  b: number
  small: string
  mid: string
  large: string
}

const e = (a: number, b: number): AffiliateEntry => ({ a, b, small: '', mid: '', large: '' })

/**
 * FR-17 제휴 링크 설정(코드 상수 한 곳). 경계(a, b)는 PRD AC-17-8 표를 옮긴 값이다.
 * 운영자가 쿠팡 파트너스 [간편 링크 만들기]로 변환한 URL을 small/mid/large에 채운다.
 * 예: BED: { ...e(120, 165), mid: 'https://link.coupang.com/...' }
 * 비어 있는 구간은 링크·고지 문구가 숨겨진다(AC-17-5). 사용자 데이터는 URL에 담지 않는다.
 */
export const AFFILIATE_LINKS: Readonly<Record<string, AffiliateEntry>> = {
  BED: {...e(120, 165), small: 'https://link.coupang.com/a/iWsw3vrcs0', mid: 'https://link.coupang.com/a/iWsAatEers', large: 'https://link.coupang.com/a/iWsCdqvbHg'  },
  DESK: { ...e(100, 140), small: 'https://link.coupang.com/a/iWtcCWS2XQ', mid: 'https://link.coupang.com/a/iWtPXzS668', large: 'https://link.coupang.com/a/iWtQOIBcpo' },
  CHAIR: { ...e(40, 55), small: 'https://link.coupang.com/a/iWtJ8XWlNs', mid: 'https://link.coupang.com/a/iWtP0dn32i', large: 'https://link.coupang.com/a/iWtQQfnfjw' },
  SOFA: { ...e(130, 170), small: 'https://link.coupang.com/a/iWtKawamTk', mid: 'https://link.coupang.com/a/iWtP1xr7am', large: 'https://link.coupang.com/a/iWtQRVGa7M' },
  WARDROBE: { ...e(80, 130), small: 'https://link.coupang.com/a/iWtKbZYWYK', mid: 'https://link.coupang.com/a/iWtP29T8FM', large: 'https://link.coupang.com/a/iWtQTxFxhA' },
  DRAWER: { ...e(60, 100), small: 'https://link.coupang.com/a/iWtKdv0Jpc', mid: 'https://link.coupang.com/a/iWtP47SKU8', large: 'https://link.coupang.com/a/iWtQU4yspw' },
  DINING_TABLE: { ...e(100, 150), small: 'https://link.coupang.com/a/iWtKe88Poy', mid: 'https://link.coupang.com/a/iWtP6nRTjM', large: 'https://link.coupang.com/a/iWtQWHVenY' },
  TV_STAND: { ...e(120, 180), small: 'https://link.coupang.com/a/iWtKgHmQuq', mid: 'https://link.coupang.com/a/iWtP73UwYS', large: 'https://link.coupang.com/a/iWtQYm3M8y' },
  BOOKSHELF: { ...e(60, 100), small: 'https://link.coupang.com/a/iWtKidfaRo', mid: 'https://link.coupang.com/a/iWtP9uXF8K', large: 'https://link.coupang.com/a/iWtQZXqscm' },
  FRIDGE: { ...e(55, 75), small: 'https://link.coupang.com/a/iWtKjNhEXs', mid: 'https://link.coupang.com/a/iWtQbdTTNY', large: 'https://link.coupang.com/a/iWtQ1yCBFs' },
  WASHER: { ...e(55, 65), small: 'https://link.coupang.com/a/iWtKlnSDC0', mid: 'https://link.coupang.com/a/iWtQekH5uT', large: 'https://link.coupang.com/a/iWtQ287pNQ' },
  SIDE_TABLE: { ...e(35, 50), small: 'https://link.coupang.com/a/iWtKmZ9AUS', mid: 'https://link.coupang.com/a/iWtQfOK1ka', large: 'https://link.coupang.com/a/iWtRInEjin' },
  HANGER: { ...e(90, 140), small: 'https://link.coupang.com/a/iWtKoLEcKG', mid: 'https://link.coupang.com/a/iWtQhi2C8y', large: 'https://link.coupang.com/a/iWtQ5RSA7E' },
  SHOE_RACK: { ...e(60, 100), small: 'https://link.coupang.com/a/iWtKqiDEM8', mid: 'https://link.coupang.com/a/iWtQiZu00i', large: 'https://link.coupang.com/a/iWtRbSijMi' },
}

export function isHttpUrl(s: unknown): s is string {
  if (typeof s !== 'string') return false
  try {
    const p = new URL(s).protocol
    return p === 'http:' || p === 'https:'
  } catch {
    return false
  }
}

/** 종류가 가구 14종이고 현재 폭(W)이 속한 구간에 유효한 http(s) URL이 있을 때만 URL, 아니면 null(다른 구간 대체 없음). */
export function affiliateUrl(
  modelType: string | undefined,
  width: number,
  links: Readonly<Record<string, AffiliateEntry>> = AFFILIATE_LINKS,
): string | null {
  if (!modelType || !FURNITURE_CATALOG.some((c) => c.modelType === modelType)) return null
  if (!Object.hasOwn(links, modelType)) return null
  const { a, b, small, mid, large } = links[modelType]
  const url = width <= a ? small : width <= b ? mid : large
  return isHttpUrl(url) ? url : null
}

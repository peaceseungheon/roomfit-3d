import type { Vec3 } from './types'

/** PRD FR-08 가구 14종 + FR-06 고정 요소 4종. 치수는 W×D×H(cm), 저장 size는 [W,H,D]. */
export interface CatalogEntry {
  modelType: string
  name: string
  w: number
  d: number
  h: number
  color: string
}

export const FURNITURE_CATALOG: readonly CatalogEntry[] = [
  { modelType: 'BED', name: '침대', w: 140, d: 200, h: 50, color: '#5c7396' },
  { modelType: 'DESK', name: '책상', w: 120, d: 60, h: 73, color: '#6f9c94' },
  { modelType: 'CHAIR', name: '의자', w: 45, d: 50, h: 85, color: '#4e8a82' },
  { modelType: 'SOFA', name: '소파', w: 150, d: 85, h: 80, color: '#8b7bb5' },
  { modelType: 'WARDROBE', name: '옷장', w: 100, d: 60, h: 200, color: '#b0906e' },
  { modelType: 'DRAWER', name: '서랍장', w: 80, d: 40, h: 100, color: '#c9ae8e' },
  { modelType: 'DINING_TABLE', name: '식탁', w: 120, d: 70, h: 74, color: '#e2a94f' },
  { modelType: 'TV_STAND', name: 'TV장', w: 150, d: 40, h: 50, color: '#3e4f66' },
  { modelType: 'BOOKSHELF', name: '책장', w: 80, d: 30, h: 180, color: '#9a7656' },
  { modelType: 'FRIDGE', name: '냉장고', w: 60, d: 70, h: 180, color: '#a9bccb' },
  { modelType: 'WASHER', name: '세탁기', w: 60, d: 65, h: 85, color: '#cbd6e0' },
  { modelType: 'SIDE_TABLE', name: '협탁', w: 40, d: 40, h: 50, color: '#b58d86' },
  { modelType: 'HANGER', name: '행거', w: 120, d: 45, h: 170, color: '#8aa0b4' },
  { modelType: 'SHOE_RACK', name: '신발장', w: 80, d: 35, h: 100, color: '#85705e' },
]

// 고정 요소: d는 벽 두께 방향 표시값(5), 콘센트 h는 PRD상 폭·높이 없음이므로 렌더용 소형 크기. elevation 기본값은 별도.
export const FIXTURE_CATALOG: readonly CatalogEntry[] = [
  { modelType: 'DOOR_ENTRANCE', name: '현관문', w: 90, d: 5, h: 210, color: '#795548' },
  { modelType: 'DOOR_SINGLE', name: '방문', w: 90, d: 5, h: 210, color: '#795548' },
  { modelType: 'WINDOW', name: '창문', w: 120, d: 5, h: 110, color: '#81d4fa' },
  { modelType: 'OUTLET', name: '콘센트', w: 8, d: 5, h: 8, color: '#eeeeee' },
]

/** 창·콘센트 바닥 위 기본 높이(cm). 문은 0. AC-06-3, AC-06-5 */
export const DEFAULT_ELEVATION: Record<string, number> = { WINDOW: 90, OUTLET: 30 }

export const CATALOG: readonly CatalogEntry[] = [...FURNITURE_CATALOG, ...FIXTURE_CATALOG]

/** PRD FR-09 치수 박스. 카탈로그 14종에는 넣지 않는다(목록·제휴 링크 제외). 저장 modelType은 'DIMENSION_BOX'. */
export const DIMENSION_BOX_TYPE = 'DIMENSION_BOX'
export const DIMENSION_BOX: CatalogEntry = {
  modelType: DIMENSION_BOX_TYPE,
  name: '치수 박스',
  w: 100,
  d: 100,
  h: 100,
  color: '#90caf9',
}
export const isDimensionBox = (it: { modelType: string }): boolean => it.modelType === DIMENSION_BOX_TYPE

export const findCatalog = (modelType: string): CatalogEntry | undefined =>
  CATALOG.find((c) => c.modelType === modelType)

/** 저장 스키마 size 순서 [W,H,D] */
/** 씬 라벨·경고 목록 공용 표시 이름: name ?? 카탈로그명 ?? modelType */
export const itemLabel = (it: { name?: string; modelType: string }): string =>
  it.name ?? (isDimensionBox(it) ? DIMENSION_BOX.name : findCatalog(it.modelType)?.name) ?? it.modelType

export const catalogSize = (c: CatalogEntry): Vec3 => [c.w, c.h, c.d]

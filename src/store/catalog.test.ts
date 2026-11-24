import { describe, expect, it } from 'vitest'
import { CATALOG, FURNITURE_CATALOG, FIXTURE_CATALOG, catalogSize, findCatalog } from './catalog'
import { createSample } from './sample'
import { ITEM_MAX_H, ITEM_MAX_WD } from '../io/validate'

describe('catalog', () => {
  it('가구 14종, 고정 요소 4종, modelType 중복 없음', () => {
    expect(FURNITURE_CATALOG).toHaveLength(14)
    expect(FIXTURE_CATALOG).toHaveLength(4)
    expect(new Set(CATALOG.map((c) => c.modelType)).size).toBe(CATALOG.length)
  })
  it('크기가 양수이고 상한 이내', () => {
    for (const c of CATALOG) {
      expect(c.w > 0 && c.w <= ITEM_MAX_WD).toBe(true)
      expect(c.d > 0 && c.d <= ITEM_MAX_WD).toBe(true)
      expect(c.h > 0 && c.h <= ITEM_MAX_H).toBe(true)
    }
  })
  it('샘플의 modelType·크기가 카탈로그와 일치', () => {
    for (const it of createSample().items) {
      const c = findCatalog(it.modelType)
      expect(c, it.modelType).toBeDefined()
      expect(it.size).toEqual(catalogSize(c!))
    }
  })
})

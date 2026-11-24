import { describe, expect, it } from 'vitest'
import { FURNITURE_CATALOG } from '../store/catalog'
import { dimRows } from './dimTable'

describe('dimRows', () => {
  it('가구 14종을 W × D × H 순서로 만든다', () => {
    const rows = dimRows()
    expect(rows).toHaveLength(14)
    expect(rows).toHaveLength(FURNITURE_CATALOG.length)
    expect(rows[0]).toEqual({ name: '침대', dims: '140 × 200 × 50' })
  })
})

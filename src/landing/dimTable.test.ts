import { describe, expect, it } from 'vitest'
import { FURNITURE_CATALOG } from '../store/catalog'
import { dimRows } from './dimTable'

describe('dimRows', () => {
  it('가구 15종을 W × D × H 순서로 만든다', () => {
    const rows = dimRows()
    expect(rows).toHaveLength(15)
    expect(rows).toHaveLength(FURNITURE_CATALOG.length)
    expect(rows[0]).toEqual({ name: '싱글 침대', dims: '100 × 200 × 45' })
  })
})

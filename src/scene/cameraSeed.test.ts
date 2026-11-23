import { describe, expect, it } from 'vitest'
import { nextEyeSeed } from './cameraSeed'

describe('1인칭 eye 시드', () => {
  it('FIRST_PERSON 진입 시에는 현재 eye를 시드로 쓴다(방 중심에서 시작)', () => {
    expect(nextEyeSeed('FIRST_PERSON', '2D', [500, 200], [0, 0])).toEqual([500, 200])
    expect(nextEyeSeed('FIRST_PERSON', 'QUARTER', [900, 400], [500, 200])).toEqual([900, 400])
  })
  it('1인칭 중 활성 방이 바뀌어 eye가 달라져도 시드는 그대로다(카메라 안 튐)', () => {
    const seed: [number, number] = [500, 200]
    expect(nextEyeSeed('FIRST_PERSON', 'FIRST_PERSON', [900, 400], seed)).toBe(seed)
  })
  it('다른 모드에서는 시드를 바꾸지 않는다', () => {
    const seed: [number, number] = [500, 200]
    expect(nextEyeSeed('QUARTER', 'FIRST_PERSON', [900, 400], seed)).toBe(seed)
    expect(nextEyeSeed('2D', 'QUARTER', [900, 400], seed)).toBe(seed)
  })
})

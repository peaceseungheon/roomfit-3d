import { describe, expect, it } from 'vitest'
import { createSample } from '../store/sample'
import type { Room } from '../store/types'
import { selectWarnings } from './useWarnings'

describe('selectWarnings 캐시', () => {
  it('같은 rooms·items 참조면 같은 배열', () => {
    const { rooms, items } = createSample()
    expect(selectWarnings(rooms, items)).toBe(selectWarnings(rooms, items))
  })
  it('rooms 참조가 바뀌면 재계산', () => {
    const { rooms, items } = createSample()
    const first = selectWarnings(rooms, items)
    const next: Room[] = rooms.map((r) => ({ ...r }))
    expect(selectWarnings(next, items)).not.toBe(first)
  })
})

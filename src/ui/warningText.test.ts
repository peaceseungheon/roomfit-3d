import { describe, expect, it } from 'vitest'
import { reasonsFor } from './warningText'

const nameOf = (id: string) => `N-${id}`

describe('reasonsFor', () => {
  it('양쪽 항목 모두에서 사유가 나온다', () => {
    const ws = [{ itemId: 'a', kind: 'ITEM' as const, otherId: 'b' }]
    expect(reasonsFor(ws, 'a', nameOf)).toEqual(['가구 간섭 (N-b)'])
    expect(reasonsFor(ws, 'b', nameOf)).toEqual(['가구 간섭 (N-a)'])
  })
  it('상대 없는 경고와 자리 없음', () => {
    const ws = [
      { itemId: 'a', kind: 'WALL' as const },
      { itemId: 'd', kind: 'NO_SPACE' as const },
    ]
    expect(reasonsFor(ws, 'a', nameOf)).toEqual(['벽 간섭'])
    expect(reasonsFor(ws, 'd', nameOf)).toEqual(['자리 없음'])
    expect(reasonsFor(ws, 'x', nameOf)).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { createSample } from '../store/sample'
import { CAPTION_MAX_WARNINGS, captionLines } from './captureCaption'

describe('captionLines', () => {
  const { rooms, items } = createSample()
  it('방 치수와 경고 없음 문구', () => {
    expect(captionLines(rooms, items, [])).toEqual(['방 1 400×300cm · 천장 230cm', '경고 없음: 가구 간섭·문 열림 침범이 없습니다'])
  })
  it('경고는 이름으로 나열하고 상한을 넘으면 외 N건', () => {
    const w = Array.from({ length: CAPTION_MAX_WARNINGS + 2 }, () => ({ itemId: 'item_001', kind: 'ITEM' as const, otherId: 'item_002' }))
    const lines = captionLines(rooms, items, w)
    expect(lines).toContain('경고 6건')
    expect(lines).toContain('⚠ 가구 간섭: 침대 ↔ 책상')
    expect(lines.at(-1)).toBe('외 2건')
  })
})

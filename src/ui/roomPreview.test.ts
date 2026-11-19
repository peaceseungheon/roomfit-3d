import { describe, expect, it } from 'vitest'
import type { Item } from '../store/types'
import { countOutsideFurniture, formRoom, initialRoomForm } from './roomForm'

const base = initialRoomForm({ height: 230, points: [[0, 0], [400, 0], [400, 300], [0, 300]] })
const chair = (id: string, x: number, z: number): Item => ({
  id, type: 'FURNITURE', modelType: 'CHAIR', position: [x, 0, z], rotation: [0, 0, 0], size: [40, 80, 40],
})

describe('formRoom / countOutsideFurniture', () => {
  it('유효하지 않은 입력은 null', () => {
    expect(formRoom({ ...base, width: '50' })).toBeNull()
  })
  it('직사각형·ㄱ자 윤곽', () => {
    expect(formRoom(base)?.points).toHaveLength(4)
    expect(formRoom({ ...base, kind: 'L', cutWidth: '100', cutDepth: '100' })?.points).toHaveLength(6)
  })
  it('방을 줄이면 밖으로 나가는 가구만 센다', () => {
    const items = [chair('in', 100, 100), chair('out', 350, 250)]
    expect(countOutsideFurniture(formRoom(base)!, items)).toBe(0)
    expect(countOutsideFurniture(formRoom({ ...base, width: '200', depth: '200' })!, items)).toBe(1)
  })
  it('ㄱ자 잘림 영역 안의 가구도 방 밖', () => {
    const r = formRoom({ ...base, kind: 'L', cutWidth: '150', cutDepth: '120' })!
    expect(countOutsideFurniture(r, [chair('c', 350, 50)])).toBe(1)
  })
})

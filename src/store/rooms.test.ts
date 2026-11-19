import { describe, expect, it } from 'vitest'
import {
  ceilingForItem,
  clampElevations,
  findRoomForItem,
  nextRoomId,
  planShift,
  shiftDocument,
  shiftItems,
  shiftRooms,
  withRoom,
} from './rooms'
import { nearestWallIn } from '../scene/geometry'
import type { Item, Point2, Room } from './types'

const sq = (x: number, z = 0, w = 300, d = 300): Point2[] => [
  [x, z],
  [x + w, z],
  [x + w, z + d],
  [x, z + d],
]
const room = (id: string, x: number, z = 0, height = 240): Room => ({ id, name: `방 ${id}`, height, points: sq(x, z) })
const furn = (id: string, x: number, z: number, extra: Partial<Item> = {}): Item => ({
  id,
  type: 'FURNITURE',
  modelType: 'BOX',
  position: [x, 0, z],
  rotation: [0, 0, 0],
  size: [10, 10, 10],
  ...extra,
})

describe('nextRoomId', () => {
  it('r{n} 최대값 + 1', () => {
    expect(nextRoomId([])).toBe('r1')
    expect(nextRoomId([room('r1', 0)])).toBe('r2')
    expect(nextRoomId([room('r1', 0), room('r5', 400)])).toBe('r6')
  })
})

describe('withRoom', () => {
  it('해당 id만 height·points를 바꾸고 나머지 참조는 유지한다', () => {
    const A = room('r1', 0)
    const B = room('r2', 400)
    const shape = { height: 200, points: sq(400, 0, 200, 200) }
    const next = withRoom([A, B], 'r2', shape)
    expect(next[0]).toBe(A)
    expect(next[1]).toMatchObject({ id: 'r2', name: '방 r2', height: 200, points: shape.points })
  })
  it('없는 id면 입력 배열 그대로', () => {
    const rooms = [room('r1', 0)]
    expect(withRoom(rooms, 'zz', { height: 200, points: sq(0) })).toBe(rooms)
  })
})

describe('planShift / shiftRooms / shiftDocument', () => {
  it('음수 좌표가 있으면 그 절댓값', () => {
    const r: Room = { id: 'r1', name: '방 1', height: 240, points: [[-120, 0], [0, 0], [0, 90], [-120, 90]] }
    expect(planShift([r])).toEqual([120, 0])
    expect(planShift([room('r1', 0)])).toEqual([0, 0])
  })
  it('shiftRooms는 이동 0이면 같은 배열', () => {
    const rooms = [room('r1', 0)]
    expect(shiftRooms(rooms, [0, 0])).toBe(rooms)
    expect(shiftRooms(rooms, [10, 20])[0].points[0]).toEqual([10, 20])
  })
  it('shiftDocument는 모든 방 점과 가구 position x·z를 이동한다', () => {
    const doc = { rooms: [room('r1', -100)], items: [furn('f', 10, 20)] }
    const out = shiftDocument(doc, [100, 5])
    expect(out.rooms[0].points).toEqual([[0, 5], [300, 5], [300, 305], [0, 305]])
    expect(out.items[0].position).toEqual([110, 0, 25])
  })
  it('shiftItems는 이동 0·미지정이면 같은 배열', () => {
    const items = [furn('f', 0, 0)]
    expect(shiftItems(items)).toBe(items)
    expect(shiftItems(items, [0, 0])).toBe(items)
  })
})

describe('findRoomForItem', () => {
  const A = room('r1', 0)
  const B = room('r2', 320)
  it('중심점이 있는 방, 없으면 null', () => {
    expect(findRoomForItem([A, B], furn('a', 150, 150))).toBe(A)
    expect(findRoomForItem([A, B], furn('b', 450, 150))).toBe(B)
    expect(findRoomForItem([A, B], furn('c', -50, 150))).toBeNull()
  })
  it('두 방 경계에 걸친 가구는 중심점 기준 앞 방', () => {
    const wide = furn('w', 299, 150, { size: [100, 10, 100] })
    expect(findRoomForItem([A, B], wide)).toBe(A)
  })
})

describe('ceilingForItem', () => {
  const A = room('r1', 0, 0, 240)
  const B = room('r2', 320, 0, 200)
  it('가구는 소속 방 높이, 소속 없으면 최솟값', () => {
    expect(ceilingForItem([A, B], furn('a', 150, 150))).toBe(240)
    expect(ceilingForItem([A, B], furn('b', 450, 150))).toBe(200)
    expect(ceilingForItem([A, B], furn('out', -50, 150))).toBe(200)
  })
  it('고정 요소는 가장 가까운 벽의 호스트 방 높이', () => {
    const win: Item = { ...furn('w', 470, 0), type: 'FIXTURE', modelType: 'WINDOW' }
    expect(ceilingForItem([A, B], win)).toBe(200)
  })
})

describe('clampElevations', () => {
  const A = room('r1', 0, 0, 240)
  const B = room('r2', 320, 0, 200)
  it('소속 방 천장고로 clamp, 바뀐 게 없으면 같은 배열', () => {
    const items = [furn('a', 150, 150, { elevation: 230 }), furn('b', 450, 150, { elevation: 230 })]
    const clamped = clampElevations(items, [A, B])
    expect(clamped[0]).toBe(items[0])
    expect(clamped[1].elevation).toBe(200)
  })
  it('바뀐 항목이 없으면 같은 배열 참조', () => {
    const items = [furn('a', 150, 150, { elevation: 100 })]
    expect(clampElevations(items, [A, B])).toBe(items)
  })
})

describe('nearestWallIn', () => {
  const A = room('r1', 0, 0, 240)
  const B: Room = { id: 'r2', name: '방 r2', height: 200, points: [[320, 0], [620, 0], [620, 300], [320, 300]] }
  it('가장 가까운 벽의 방, 1cm 이내 동률은 앞 방', () => {
    expect(nearestWallIn([A, B], 310, 150)?.room).toBe(A)
    expect(nearestWallIn([A, B], 305, 150)?.room).toBe(A)
    expect(nearestWallIn([A, B], 315.5, 150)?.room).toBe(B)
    expect(nearestWallIn([A, B], 310, 150)?.roomIndex).toBe(0)
    expect(nearestWallIn([A, B], 315.5, 150)?.roomIndex).toBe(1)
  })
  it('방이 없으면 null', () => {
    expect(nearestWallIn([], 0, 0)).toBeNull()
  })
})

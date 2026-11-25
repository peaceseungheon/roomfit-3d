import { beforeEach, describe, expect, it } from 'vitest'
import { computeWarnings } from '../scene/collision'
import { findRoomForItem } from './rooms'
import { roomMoveCheck, snapRoomMove } from './roomMove'
import { useDocStore } from './useDocStore'
import type { Item, Point2, Room } from './types'

const sq = (x: number, z: number, w = 300, d = 300): Point2[] => [[x, z], [x + w, z], [x + w, z + d], [x, z + d]]
const room = (id: string, x: number, z = 0, w = 300): Room => ({ id, name: id, height: 240, points: sq(x, z, w) })
const desk = (id: string, x: number, z: number): Item => ({
  id, type: 'FURNITURE', modelType: 'DESK', position: [x, 0, z], rotation: [0, 0, 0], size: [100, 75, 50],
})
const win = (id: string, x: number, z: number): Item => ({
  id, type: 'FIXTURE', modelType: 'WINDOW', position: [x, 0, z], rotation: [0, 0, 0], size: [100, 100, 5],
})
const set = (rooms: Room[], items: Item[] = []) => {
  useDocStore.setState({ rooms, items })
  useDocStore.temporal.getState().clear()
}

describe('moveRoom', () => {
  beforeEach(() => set([room('a', 0), room('b', 310)], [desk('d1', 100, 100), desk('d2', 400, 100), win('w1', 0, 150)]))

  it('점·가구·고정 요소를 같이 옮기고 Undo 1단계', () => {
    expect(useDocStore.getState().moveRoom('b', [0, 100])).toBe(true)
    const s = useDocStore.getState()
    expect(s.rooms[1].points[0]).toEqual([310, 100])
    expect(s.items.find((i) => i.id === 'd2')!.position).toEqual([400, 0, 200])
    expect(s.items.find((i) => i.id === 'd1')!.position).toEqual([100, 0, 100])
    expect(useDocStore.temporal.getState().pastStates.length).toBe(1)
    useDocStore.temporal.getState().undo()
    expect(useDocStore.getState().rooms[1].points[0]).toEqual([310, 0])
  })
  it('고정 요소는 호스트 벽의 방과 함께 이동', () => {
    set([room('a', 0), room('b', 310)], [win('w2', 310, 150)])
    useDocStore.getState().moveRoom('b', [0, 50])
    expect(useDocStore.getState().items[0].position).toEqual([310, 0, 200])
  })
  it('겹치면 거부하고 상태 불변', () => {
    const before = useDocStore.getState()
    const r = useDocStore.getState().moveRoom('b', [-100, 0])
    expect(r).toEqual({ ok: false, reason: expect.any(String) })
    expect(useDocStore.getState().rooms).toBe(before.rooms)
    expect(useDocStore.getState().items).toBe(before.items)
    expect(useDocStore.temporal.getState().pastStates.length).toBe(0)
  })
  it('변 접촉은 허용', () => {
    expect(useDocStore.getState().moveRoom('b', [-10, 0])).toBe(true)
  })
  it('10000cm 초과 거부', () => {
    expect(useDocStore.getState().moveRoom('b', [9800, 0])).toMatchObject({ ok: false })
    expect(useDocStore.getState().rooms[1].points[0]).toEqual([310, 0])
  })
  it('음수 좌표는 문서째 정규화하며 Undo 1단계', () => {
    expect(useDocStore.getState().moveRoom('a', [0, -50])).toBe(true)
    const s = useDocStore.getState()
    expect(s.rooms[0].points[0]).toEqual([0, 0])
    expect(s.rooms[1].points[0]).toEqual([310, 50])
    expect(s.items.find((i) => i.id === 'd1')!.position).toEqual([100, 0, 100])
    expect(s.items.find((i) => i.id === 'd2')!.position).toEqual([400, 0, 150])
    expect(useDocStore.temporal.getState().pastStates.length).toBe(1)
  })
  it('이동 전후 소속·경고가 일관', () => {
    set([room('a', 0), room('b', 310)], [desk('d2', 400, 100), desk('d3', 420, 100)])
    const w0 = computeWarnings(useDocStore.getState().rooms, useDocStore.getState().items).map((w) => w.kind)
    expect(w0.length).toBeGreaterThan(0)
    useDocStore.getState().moveRoom('b', [0, 200])
    const { rooms, items } = useDocStore.getState()
    expect(items.map((i) => findRoomForItem(rooms, i)?.id)).toEqual(['b', 'b'])
    expect(computeWarnings(rooms, items).map((w) => w.kind)).toEqual(w0)
  })
})

describe('roomMoveCheck', () => {
  const rooms = [room('a', 0), room('b', 310), room('c', 620)]
  it('겹치는 방 id를 돌려준다', () => {
    expect(roomMoveCheck(rooms, 'b', [-100, 0])).toMatchObject({ ok: false, overlapWith: ['a'] })
    expect(roomMoveCheck(rooms, 'a', [200, 0]).overlapWith).toEqual(['b'])
  })
  it('통과·음수 허용·크기 초과·없는 id', () => {
    expect(roomMoveCheck(rooms, 'b', [0, 400])).toEqual({ ok: true })
    expect(roomMoveCheck(rooms, 'a', [0, -500]).ok).toBe(true)
    expect(roomMoveCheck(rooms, 'c', [9500, 0])).toMatchObject({ ok: false })
    expect(roomMoveCheck(rooms, 'x', [0, 0]).ok).toBe(false)
  })
})

describe('snapRoomMove', () => {
  const rooms = [room('a', 0), room('b', 500, 0)]
  it('변에 붙는다(이웃 바깥 10cm 링)', () => {
    // b 왼쪽 변 x=500 -> 링 x=310. 목표 x delta=-192 -> 격자 -190 -> 링으로 -190
    expect(snapRoomMove(rooms, 'b', [-187, 100])).toEqual([-190, 100])
    expect(snapRoomMove(rooms, 'b', [-196, 100])).toEqual([-190, 100])
    expect(snapRoomMove(rooms, 'b', [-187, 0])).toEqual([-190, -10]) // 꼭짓점 우선: 링 모서리
  })
  it('꼭짓점이 우선하고 붙은 결과는 겹치지 않는다', () => {
    const d = snapRoomMove(rooms, 'b', [-190, 8])
    expect(d).toEqual([-190, 10])
    expect(roomMoveCheck(rooms, 'b', d).ok).toBe(true)
  })
  it('격자 꺼짐은 반올림 없이 반경 밖 무보정', () => {
    expect(snapRoomMove(rooms, 'b', [-50.4, 7.3], { grid: false })).toEqual([-50.4, 7.3])
    expect(snapRoomMove(rooms, 'b', [-50.4, 7.3])).toEqual([-50, 10])
  })
  it('이웃 스냅 끄기', () => {
    expect(snapRoomMove(rooms, 'b', [-187, 0], { neighbor: false })).toEqual([-190, 0])
    expect(snapRoomMove(rooms, 'b', [-184, 0], { neighbor: false, grid: false })).toEqual([-184, 0])
  })
  it('없는 id는 그대로', () => {
    expect(snapRoomMove(rooms, 'x', [3, 4])).toEqual([3, 4])
  })
  it('스냅 결과의 부동소수점 잡음을 소수 둘째 자리로 정리한다', () => {
    const frac = [
      { id: 'a', name: 'a', height: 240, points: sq(0, 3.9, 251.1, 191.7) },
      { id: 'b', name: 'b', height: 240, points: sq(262.5, 40.7, 153.2, 121.8) },
    ]
    expect(snapRoomMove(frac, 'b', [2.1, 86.9])).toEqual([-1.4, 90.3])
  })
})

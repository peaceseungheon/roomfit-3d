import { beforeEach, describe, expect, it } from 'vitest'
import { beginDrag, endDrag } from '../scene/dragSession'
import { deleteRoomMessage, furnitureInRoom } from '../ui/roomForm'
import type { Item, Point2, Room } from './types'
import { useDocStore } from './useDocStore'
import { useTraceStore } from './useTraceStore'
import { useUiStore } from './useUiStore'

const sq = (x: number, z: number, w = 300, d = 300): Point2[] => [[x, z], [x + w, z], [x + w, z + d], [x, z + d]]
const room = (id: string, x: number, kind?: string): Room => ({ id, name: id, height: 240, points: sq(x, 0), ...(kind && { kind }) })
const desk = (id: string, x: number, z: number): Item => ({ id, type: 'FURNITURE', modelType: 'DESK', position: [x, 0, z], rotation: [0, 0, 0], size: [100, 75, 50] })
const win = (id: string, x: number, z: number): Item => ({ id, type: 'FIXTURE', modelType: 'WINDOW', position: [x, 0, z], rotation: [0, 0, 0], size: [100, 100, 5] })
const set = (rooms: Room[], items: Item[] = []) => {
  useDocStore.setState({ rooms, items })
  useDocStore.temporal.getState().clear()
}
const doc = () => useDocStore.getState()
const past = () => useDocStore.temporal.getState().pastStates.length
const t = () => useTraceStore.getState()

beforeEach(() => {
  t().cancel()
  useUiStore.setState({ notice: null })
  set([room('a', 0), room('b', 310, '거실'), room('c', 620)], [desk('d1', 400, 100), win('w1', 310, 150)])
})

describe('updateRoomInfo', () => {
  it('이름·종류를 한 번에 바꾸면 Undo 1단계', () => {
    expect(doc().updateRoomInfo('b', { name: ' 서재 ', kind: '작은방' })).toBe(true)
    expect(doc().rooms[1]).toMatchObject({ name: '서재', kind: '작은방' })
    expect(past()).toBe(1)
    useDocStore.temporal.getState().undo()
    expect(doc().rooms[1]).toMatchObject({ name: 'b', kind: '거실' })
  })
  it('종류만 바꿔도 이름은 유지, 같은 값이면 Undo 단계를 만들지 않는다', () => {
    expect(doc().updateRoomInfo('b', { kind: '  서재 ' })).toBe(true)
    expect(doc().rooms[1]).toMatchObject({ name: 'b', kind: '서재' })
    expect(doc().updateRoomInfo('b', { name: 'b', kind: '서재' })).toBe(true)
    expect(past()).toBe(1)
  })
  it('빈 이름·긴 이름·빈 종류·20자 초과 종류·없는 id는 거부하고 상태 불변', () => {
    const before = doc().rooms
    expect(doc().updateRoomInfo('b', { name: '   ' })).toBe(false)
    expect(doc().updateRoomInfo('b', { name: 'x'.repeat(101) })).toBe(false)
    expect(doc().updateRoomInfo('b', { kind: '  ' })).toBe(false)
    expect(doc().updateRoomInfo('b', { name: 'ok', kind: '가'.repeat(21) })).toBe(false)
    expect(doc().updateRoomInfo('zz', { name: 'ok' })).toBe(false)
    expect(doc().rooms).toBe(before)
    expect(past()).toBe(0)
  })
  it('드래그 중에는 거부', () => {
    beginDrag('d1')
    try {
      expect(doc().updateRoomInfo('b', { name: 'x' })).toBe(false)
    } finally {
      endDrag()
    }
    expect(doc().rooms[1].name).toBe('b')
  })
})

describe('삭제 문구', () => {
  it('가구 수는 소속 방의 FURNITURE만 센다(고정 요소 제외)', () => {
    expect(furnitureInRoom(doc().rooms, doc().items, 'b')).toBe(1)
    expect(furnitureInRoom(doc().rooms, doc().items, 'a')).toBe(0)
  })
  it('가구가 있으면 개수를 알린다', () => {
    expect(deleteRoomMessage('거실', 0)).toBe('「거실」 방을 삭제할까요? 가구는 남습니다')
    expect(deleteRoomMessage('거실', 3)).toContain('가구 3개는 남습니다')
  })
  it('removeRoom은 가구를 남긴다', () => {
    expect(doc().removeRoom('b')).toBe(true)
    expect(doc().items).toHaveLength(2)
  })
})

describe('방 모양 다시 그리기 세션', () => {
  const draw = (a: Point2, b: Point2) => {
    expect(t().setTraceRect(a, b)).toBe(true)
    expect(t().closeTrace()).toBe(true)
  }
  it('이웃·이미지 없이 그 방 하나만(offset null, 빈 캔버스)', () => {
    t().startRedo('b')
    expect(t()).toMatchObject({ active: true, mode: 'redo', redoId: 'b', offset: null, image: null, scale: 1, kind: null })
  })
  it('확정하면 기존 방의 좌상단에 맞춰 제자리에 놓고 Undo 1단계, 이름·종류·가구 불변', () => {
    t().startRedo('b')
    draw([100, 100], [300, 500]) // 200 x 400
    const itemsBefore = doc().items
    expect(t().commitTrace()).toBe(true)
    const b = doc().rooms[1]
    expect(b.points).toEqual(sq(310, 0, 200, 400))
    expect(b).toMatchObject({ name: 'b', kind: '거실', height: 240 })
    expect(doc().items).toBe(itemsBefore)
    expect(past()).toBe(1)
    expect(t().active).toBe(false)
    expect(useUiStore.getState().layoutOpen).toBe(false) // commit이 layoutOpen을 건드리지 않는다
    expect(doc().items.find((i) => i.id === 'd1')!.position).toEqual([400, 0, 100])
  })
  it('겹치면 거부하고 세션·문서 유지, 알림', () => {
    t().startRedo('b')
    draw([0, 0], [400, 300]) // 400 폭 -> 310~710이 c(620~)와 겹침
    const before = doc().rooms
    expect(t().commitTrace()).toBe(false)
    expect(doc().rooms).toBe(before)
    expect(past()).toBe(0)
    expect(t().active).toBe(true)
    expect(useUiStore.getState().notice).toContain('모양을 적용하지 못했습니다')
  })
  it('취소하면 아무것도 바뀌지 않는다', () => {
    const before = doc().rooms
    t().startRedo('b')
    draw([0, 0], [100, 100])
    t().cancel()
    expect(doc().rooms).toBe(before)
    expect(past()).toBe(0)
    expect(t()).toMatchObject({ active: false, mode: 'replace', redoId: null })
  })
  it('없는 방 id는 시작하지 않는다', () => {
    t().startRedo('zz')
    expect(t().active).toBe(false)
  })
})

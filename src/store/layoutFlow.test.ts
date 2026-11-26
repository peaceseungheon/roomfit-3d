import { beforeEach, describe, expect, it } from 'vitest'
import { addRoomBlockedReason } from '../ui/roomForm'
import { OVERLAP_MESSAGE } from '../trace/trace'
import type { Point2, Room } from './types'
import { useDocStore } from './useDocStore'
import { useTraceStore } from './useTraceStore'
import { useUiStore } from './useUiStore'

const sq = (x: number, z = 0, w = 300, d = 300): Point2[] => [[x, z], [x + w, z], [x + w, z + d], [x, z + d]]
const room = (id: string, x: number): Room => ({ id, name: id, height: 240, points: sq(x) })
const t = () => useTraceStore.getState()
const doc = () => useDocStore.getState()
const layoutOpen = () => useUiStore.getState().layoutOpen
const draw = () => {
  expect(t().setTraceRect([0, 0], [200, 200])).toBe(true)
  expect(t().closeTrace()).toBe(true)
}

beforeEach(() => {
  t().cancel()
  useUiStore.setState({ notice: null, layoutOpen: false, activeRoomId: 'b' })
  useDocStore.setState({ rooms: [room('a', 0), room('b', 310)], items: [] })
  useDocStore.temporal.getState().clear()
})

describe('AC-23-3 빈 캔버스 add 종료 시 S-10 자동 이동', () => {
  it('[방 생성](비-next)이면 S-10을 연다', () => {
    t().start('add', '거실')
    draw()
    expect(t().commitTrace()).toBe(true)
    expect(doc().rooms).toHaveLength(3)
    expect(layoutOpen()).toBe(true)
  })
  it('다음 방 따기는 열지 않고, [끝내기]에서 연다', () => {
    t().start('add')
    draw()
    expect(t().commitTrace(240, true, true)).toBe(true)
    expect(layoutOpen()).toBe(false)
    t().cancel()
    expect(layoutOpen()).toBe(true)
  })
  it('확정 없이 취소하면 열지 않는다', () => {
    t().start('add')
    draw()
    t().cancel()
    expect(layoutOpen()).toBe(false)
  })
  it('문서 교체 첫 방은 열지 않는다', () => {
    t().start('replace')
    draw()
    expect(t().commitTrace()).toBe(true)
    expect(doc().rooms).toHaveLength(1)
    expect(layoutOpen()).toBe(false)
  })
  it('이미지 모드 add는 열지 않는다', () => {
    t().start('add')
    useTraceStore.setState({ image: { url: '', name: 'x', width: 500, height: 500 } })
    draw()
    expect(t().commitTrace()).toBe(true)
    expect(layoutOpen()).toBe(false)
  })
  it('redo는 열지 않는다', () => {
    t().startRedo('b')
    draw()
    expect(t().commitTrace()).toBe(true)
    expect(layoutOpen()).toBe(false)
  })
  it('방이 1개면(add 실패 등) openLayout이 열리지 않는다', () => {
    useDocStore.setState({ rooms: [room('a', 0)] })
    useUiStore.getState().openLayout()
    expect(layoutOpen()).toBe(false)
  })
})

describe('AC-04-16 빈 캔버스 add는 닫을 때 놓일 위치로 검사', () => {
  it('활성 방 오른쪽이 다른 방과 겹치면 닫지 못하고 문구를 낸다', () => {
    useUiStore.setState({ activeRoomId: 'a' }) // a 오른쪽 10cm = 310~: b와 겹침
    t().start('add')
    expect(t().setTraceRect([0, 0], [200, 200])).toBe(true)
    expect(t().closeTrace()).toBe(false)
    expect(t().closed).toBe(false)
    expect(t().error?.message).toBe(OVERLAP_MESSAGE)
  })
  it('겹치지 않으면 정상 닫기, pendingRoom은 원점 정규화 모양 그대로', () => {
    useUiStore.setState({ activeRoomId: 'b' })
    t().start('add')
    expect(t().setTraceRect([100, 100], [300, 300])).toBe(true)
    expect(t().closeTrace()).toBe(true)
    expect(t().pendingRoom).toEqual(sq(0, 0, 200, 200).map(([x, z]) => [x, z]))
    expect(t().commitTrace()).toBe(true)
    expect(doc().rooms[2].points[0]).toEqual([620, 0])
  })
  it('집 전체 크기 10000cm 초과도 닫을 때 막는다', () => {
    useDocStore.setState({ rooms: [room('a', 0), room('b', 9500)] })
    useUiStore.setState({ activeRoomId: 'b' })
    t().start('add')
    expect(t().setTraceRect([0, 0], [200, 200])).toBe(true)
    expect(t().closeTrace()).toBe(false)
    expect(t().error?.message).toContain('10000')
  })
})

describe('[+ 방 추가] 차단 사유', () => {
  it('20개면 사유, 아니면 null', () => {
    const many = Array.from({ length: 20 }, (_, i) => room(`r${i}`, i * 310))
    expect(addRoomBlockedReason(many)).toContain('20')
    expect(addRoomBlockedReason(many.slice(1))).toBeNull()
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import type { Room } from '../store/types'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import { moveRoomDoc } from '../store/roomMove'
import { commitMove, layoutBounds, normShift, previewMove, roomAt, roomLabelPos, roomSizeText } from './roomLayout'

const rect = (id: string, x: number, z: number, w: number, d: number): Room => ({ id, name: id, height: 240, points: [[x, z], [x + w, z], [x + w, z + d], [x, z + d]] })
const A = rect('a', 0, 0, 300, 200)
const B = rect('b', 310, 0, 300, 200)

beforeEach(() => {
  useDocStore.setState({ rooms: [A, B], items: [] })
  useUiStore.setState({ notice: null, layoutOpen: true, activeRoomId: 'a' })
})

describe('방 배치 순수 로직', () => {
  it('라벨 위치는 사각형 중심, 치수는 가로×세로', () => {
    expect(roomLabelPos(A.points)).toEqual([150, 100])
    expect(roomSizeText(A.points)).toBe('300×200cm')
  })
  it('L자 방의 라벨은 방 안에 놓인다', () => {
    const L: Room['points'] = [[0, 0], [400, 0], [400, 100], [100, 100], [100, 400], [0, 400]]
    const [x, z] = roomLabelPos(L)
    expect(roomAt([{ ...A, points: L }], [x, z])).not.toBeNull()
  })
  it('누른 방 찾기: 안은 방, 빈 곳은 null', () => {
    expect(roomAt([A, B], [450, 100])?.id).toBe('b')
    expect(roomAt([A, B], [305, 100])).toBeNull()
  })
  it('겹치면 ok=false와 겹친 방, 이웃 스냅은 Shift로 해제', () => {
    const pv = previewMove([A, B], 'b', [400, 100], [300, 100], true, true)
    expect(pv.delta).toEqual([-100, 0])
    expect(pv.ok).toBe(false)
    expect(pv.overlapWith).toEqual(['a'])
    // 오른쪽으로 비켜 놓음: 이웃 링(10cm) 근처 3cm 차이는 스냅으로 붙고, Shift면 격자만
    const snapped = previewMove([A, B], 'b', [400, 100], [403, 100], false, false)
    const free = previewMove([A, B], 'b', [400, 100], [403, 100], true, false)
    expect(free.delta).toEqual([3, 0])
    expect(snapped.delta).toEqual([0, -10]) // 이웃 링 꼭짓점(310,-10)에 달라붙음
  })
  it('놓기: ok면 문서 1회 변경, 위반이면 문서 유지 + 토스트', () => {
    expect(commitMove('b', previewMove([A, B], 'b', [400, 100], [500, 100], true, true))).toBe(true)
    expect(useDocStore.getState().rooms.find((r) => r.id === 'b')!.points[0]).toEqual([410, 0])
    expect(commitMove('b', previewMove(useDocStore.getState().rooms, 'b', [500, 100], [300, 100], true, true))).toBe(false)
    expect(useDocStore.getState().rooms.find((r) => r.id === 'b')!.points[0]).toEqual([410, 0])
    expect(useUiStore.getState().notice).toBe('다른 방과 겹칩니다')
  })
  it('활성 방 선택과 닫기는 ui 스토어 동작', () => {
    useUiStore.getState().setActiveRoomId('b')
    expect(useUiStore.getState().activeRoomId).toBe('b')
    useUiStore.getState().closeLayout()
    expect(useUiStore.getState().layoutOpen).toBe(false)
  })
  it('카메라 범위는 모든 방 + 여백', () => {
    expect(layoutBounds([A, B], 100)).toEqual({ minX: -100, maxX: 710, minZ: -100, maxZ: 300 })
  })
})

describe('normShift', () => {
  it('정규화가 없으면 0, 음수 좌표를 풀면 그 양', () => {
    const doc = { rooms: [A, B], items: [] }
    const r0 = moveRoomDoc(doc, 'b', [0, 100]) as { doc: typeof doc }
    expect(normShift(doc.rooms, r0.doc.rooms, 'b', [0, 100])).toEqual([0, 0])
    const r1 = moveRoomDoc(doc, 'a', [-50, 0]) as { doc: typeof doc }
    expect(normShift(doc.rooms, r1.doc.rooms, 'a', [-50, 0])).toEqual([50, 0])
    const r2 = moveRoomDoc(doc, 'a', [-400, -30]) as { doc: typeof doc }
    expect(normShift(doc.rooms, r2.doc.rooms, 'a', [-400, -30])).toEqual([400, 30])
  })
})

describe('방 배치 열기 가드', () => {
  it('방이 2개 미만이면 열리지 않고, 열린 뒤 1개가 되면 자동으로 닫힌다', () => {
    useDocStore.setState({ rooms: [A] })
    expect(useUiStore.getState().layoutOpen).toBe(false)
    useUiStore.getState().openLayout()
    expect(useUiStore.getState().layoutOpen).toBe(false)
    useDocStore.setState({ rooms: [A, B] })
    useUiStore.getState().openLayout()
    expect(useUiStore.getState().layoutOpen).toBe(true)
    useDocStore.setState({ rooms: [B] })
    expect(useUiStore.getState().layoutOpen).toBe(false)
  })
})

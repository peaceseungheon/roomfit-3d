import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Point2, Room } from './types'
import { createSample } from './sample'
import { docShiftDelta } from './rooms'
import { blankArea, clampArea, ghostRooms } from './traceSession'
import { useDocStore } from './useDocStore'
import { useEditStore } from './useEditStore'
import { serializeDocument } from '../io/persist'
import { parseDocument } from '../io/validate'
import { OVERLAP_MESSAGE } from '../trace/trace'
import { useTraceStore } from './useTraceStore'
import { useUiStore } from './useUiStore'

const t = useTraceStore.getState
const rect = (x0: number, z0: number, x1: number, z1: number): Point2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
const room = (id: string, points: Point2[]): Room => ({ id, name: id, height: 240, points })
const img = { url: 'blob:x', name: 'a.png', width: 100, height: 100 }

beforeEach(() => {
  t().cancel()
  useEditStore.setState({ editing: false, selectedCorner: null, selectedWall: null, draggingCorner: null })
  useDocStore.setState({ ...createSample(), pristine: true })
  useDocStore.temporal.getState().clear()
  useUiStore.setState({ notice: null, snapEnabled: true })
})

describe('세션 시작', () => {
  it('start()는 replace, offset null', () => {
    t().start()
    expect(t().mode).toBe('replace')
    expect(t().offset).toBeNull()
    expect(t().confirmed).toBe(0)
    expect(t().neighborSnap).toBe(true)
    expect(t().free).toBe(false)
  })
  it('blankArea([])는 기본 영역', () => {
    expect(blankArea([])).toEqual({ minX: 0, minZ: 0, maxX: 3000, maxZ: 3000 })
  })
  it('start("add")는 offset [0,0]이고 기존 방 왼쪽까지 그릴 수 있다', () => {
    useDocStore.setState({ rooms: [room('r1', rect(0, 0, 300, 200))], items: [] })
    t().start('add')
    expect(t().offset).toEqual([0, 0])
    expect(t().addTracePoint(-500, 50)).toBe(true)
    expect(t().corners[0]).toEqual([-500, 50])
    const g = ghostRooms(t(), useDocStore.getState().rooms)
    expect(blankArea(g)).toEqual({ minX: -3000, minZ: -3000, maxX: 3300, maxZ: 3200 })
  })
  it('고스트는 doc - offset, offset null이면 없다', () => {
    const rooms = [room('r1', rect(100, 100, 400, 300))]
    expect(ghostRooms({ offset: [100, 100] }, rooms)).toEqual([rect(0, 0, 300, 200)])
    expect(ghostRooms({ offset: null }, rooms)).toEqual([])
  })
  it('clampArea', () => {
    expect(clampArea([-5000, 9000], { minX: -3000, minZ: 0, maxX: 10, maxZ: 3000 })).toEqual([-3000, 3000])
  })
})

describe('setImage와 잠금', () => {
  it('setImage는 mode·confirmed·ortho를 유지하고 add + 이미지면 offset null', () => {
    t().start('add')
    t().setOrtho(false)
    t().setNeighborSnap(false)
    t().setImage(img)
    expect(t().mode).toBe('add')
    expect(t().offset).toBeNull()
    expect(t().ortho).toBe(false)
    expect(t().neighborSnap).toBe(false)
    expect(t().image).toEqual(img)
  })
  it('confirmed > 0이면 setImage·redoBaseline·start·setBaselinePoint는 무시', async () => {
    t().start('add')
    useTraceStore.setState({ confirmed: 1 })
    t().setImage(img)
    expect(t().image).toBeNull()
    t().start()
    expect(t().mode).toBe('add')
    expect(t().confirmed).toBe(1)
    useTraceStore.setState({ image: img, baseline: [[0, 0], [10, 0]], scale: 2 })
    t().setBaselinePoint(0, 5, 5)
    expect(t().scale).toBe(2)
    t().redoBaseline()
    expect(t().scale).toBe(2)
    const spy = vi.spyOn(URL, 'createObjectURL')
    expect(await t().loadImageFile(new File(['x'], 'a.png', { type: 'image/png' }))).toBe(false)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('setCursor는 free를 기록한다', () => {
    t().setCursor(1, 2, true)
    expect(t().free).toBe(true)
    t().setCursor(1, 2)
    expect(t().free).toBe(false)
  })
})

describe('docShiftDelta', () => {
  it('이동량', () => {
    const a = [room('r1', rect(0, 0, 300, 200))]
    expect(docShiftDelta(a, [room('r1', rect(210, 0, 510, 200))])).toEqual([210, 0])
    expect(docShiftDelta(a, a)).toEqual([0, 0])
  })
  it('z 이동량도 계산한다', () => {
    const a = [room('r1', rect(0, 0, 300, 200))]
    expect(docShiftDelta(a, [room('r1', rect(0, 210, 300, 410))])).toEqual([0, 210])
  })
})

// ---- Task 4: 방 확정 경로 ----
const doc = useDocStore.getState
const arm = (pts: Point2[], extra: Partial<ReturnType<typeof t>> = {}) =>
  useTraceStore.setState({ active: true, scale: 1, corners: pts, ...extra })
const closeOk = (pts: Point2[], extra: Partial<ReturnType<typeof t>> = {}) => {
  arm(pts, extra)
  expect(t().closeTrace()).toBe(true)
}

describe('commitTrace replace -> add', () => {
  it('첫 방 replace, 이어 add. Undo는 방당 1단계', () => {
    t().start()
    closeOk(rect(100, 100, 400, 300))
    expect(t().commitTrace(240, true, true)).toBe(true)
    expect(doc().rooms).toHaveLength(1)
    expect(doc().rooms[0].points).toEqual(rect(0, 0, 300, 200))
    expect(t().offset).toEqual([-100, -100])
    expect(t().mode).toBe('add')
    expect(t().active).toBe(true)
    expect(t().corners).toEqual([])
    expect(t().confirmed).toBe(1)
    closeOk(rect(410, 100, 610, 300))
    expect(t().commitTrace(240, true, false)).toBe(true)
    expect(doc().rooms[1].points).toEqual(rect(310, 0, 510, 200))
    expect(useUiStore.getState().activeRoomId).toBe(doc().rooms[1].id)
    expect(t().active).toBe(false)
    expect(useDocStore.temporal.getState().pastStates).toHaveLength(2)
    useDocStore.temporal.getState().undo()
    expect(doc().rooms).toHaveLength(1)
  })
  it('next=true는 이미지·축척·기준선·offset·ortho를 유지한다', () => {
    t().start()
    t().setOrtho(false)
    closeOk(rect(100, 100, 400, 300), { baseline: [[0, 0], [10, 0]], candidate: [[1, 1]], selected: 0, lengthError: 'x', image: img })
    t().commitTrace(250, true, true)
    expect(t().image).toEqual(img)
    expect(t().scale).toBe(1)
    expect(t().baseline).toEqual([[0, 0], [10, 0]])
    expect(t().ortho).toBe(false)
    expect(t().lastHeight).toBe(250)
    expect([t().closed, t().pendingRoom, t().error, t().selected, t().candidate, t().lengthError]).toEqual([false, null, null, null, null, null])
  })
  it('소수 offset에서도 방 간격이 정확하다', () => {
    useUiStore.setState({ snapEnabled: false })
    t().start()
    closeOk(rect(10.4, 10.4, 310.4, 210.4))
    t().commitTrace(240, true, true)
    closeOk(rect(320.4, 10.4, 520.4, 210.4))
    t().commitTrace(240, true, true)
    expect(doc().rooms[1].points).toEqual(rect(310, 0, 510, 200))
  })
  it('확정 결과는 저장 검증을 통과한다', () => {
    t().start()
    closeOk(rect(100, 100, 400, 300))
    t().commitTrace(240, true, true)
    closeOk(rect(410, 100, 610, 300))
    t().commitTrace(240, true, true)
    const d = doc()
    expect(parseDocument(serializeDocument({ rooms: d.rooms, items: d.items })).ok).toBe(true)
  })
})

describe('commitTrace add', () => {
  it('기존 방 왼쪽(음수)에 확정하면 문서가 이동하고 offset이 누적된다', () => {
    useDocStore.setState({ rooms: [room('r1', rect(0, 0, 300, 200))], items: [{ ...createSample().items[0], position: [100, 0, 100] }] })
    t().start('add')
    closeOk(rect(-210, 0, -10, 200))
    expect(t().commitTrace(240, true, true)).toBe(true)
    expect(doc().rooms[0].points).toEqual(rect(210, 0, 510, 200))
    expect(doc().rooms[1].points).toEqual(rect(0, 0, 200, 200))
    expect(doc().items[0].position[0]).toBe(310)
    expect(t().offset).toEqual([210, 0])
    expect(ghostRooms(t(), doc().rooms)[0]).toEqual(rect(0, 0, 300, 200))
    closeOk(rect(310, 0, 510, 200))
    t().commitTrace(240, true, true)
    expect(doc().rooms[2].points).toEqual(rect(520, 0, 720, 200))
    useDocStore.temporal.getState().undo()
    expect(doc().rooms).toHaveLength(2)
    expect(doc().rooms[0].points).toEqual(rect(210, 0, 510, 200))
    expect(doc().items[0].position[0]).toBe(310)
  })
  it('기존 방 위(음수 z)에 확정하면 문서가 z로 이동하고 다음 방이 이어진다', () => {
    useDocStore.setState({ rooms: [room('r1', rect(0, 0, 300, 200))], items: [] })
    t().start('add')
    closeOk(rect(0, -210, 300, -10))
    expect(t().commitTrace(240, true, true)).toBe(true)
    expect(doc().rooms[0].points).toEqual(rect(0, 210, 300, 410))
    expect(doc().rooms[1].points).toEqual(rect(0, 0, 300, 200))
    expect(t().offset).toEqual([0, 210])
    closeOk(rect(310, -210, 510, -10))
    t().commitTrace(240, true, true)
    expect(doc().rooms[2].points).toEqual(rect(310, 0, 510, 200))
    const d = doc()
    expect(parseDocument(serializeDocument({ rooms: d.rooms, items: d.items })).ok).toBe(true)
  })
  it('왼쪽 방 확정 결과도 저장 검증을 통과한다', () => {
    useDocStore.setState({ rooms: [room('r1', rect(0, 0, 300, 200))], items: [] })
    t().start('add')
    closeOk(rect(-210, 0, -10, 200))
    t().commitTrace(240, true, true)
    const d = doc()
    expect(parseDocument(serializeDocument({ rooms: d.rooms, items: d.items })).ok).toBe(true)
  })
  it('add + 이미지 소수 축척에서도 방 간격 10cm가 유지된다', () => {
    useDocStore.setState({ rooms: [room('r1', rect(0, 0, 300, 200))], items: [] })
    useUiStore.setState({ activeRoomId: 'r1', snapEnabled: false })
    t().start('add')
    t().setImage(img)
    closeOk(rect(50, 50, 250, 150), { scale: 0.37 })
    expect(t().commitTrace(240, true, true)).toBe(true)
    closeOk(rect(250 + 10 / 0.37, 50, 450 + 10 / 0.37, 150), { scale: 0.37 })
    expect(t().commitTrace(240, true, true)).toBe(true)
    const maxX = (i: number) => Math.max(...doc().rooms[i].points.map((p) => p[0]))
    const minX = (i: number) => Math.min(...doc().rooms[i].points.map((p) => p[0]))
    expect(minX(1) - maxX(0)).toBe(10)
    expect(Math.abs(minX(2) - maxX(1) - 10)).toBeLessThanOrEqual(1)
    const d = doc()
    expect(parseDocument(serializeDocument({ rooms: d.rooms, items: d.items })).ok).toBe(true)
  })
  it('add에서 집 전체가 10000cm를 넘는 윤곽은 닫히지 않는다', () => {
    useDocStore.setState({ rooms: [room('r1', rect(0, 0, 300, 200))], items: [] })
    t().start('add')
    arm(rect(10000, 0, 10200, 200))
    expect(t().closeTrace()).toBe(false)
    expect(t().error?.message).toBe('집 전체 크기가 10000cm를 넘습니다')
    expect(t().closed).toBe(false)
  })
  it.each([false, true])('add + 이미지 첫 방(반전=%s)은 활성 방 오른쪽에 놓이고 offset이 이어진다', (rev) => {
    useDocStore.setState({ rooms: [room('r1', rect(0, 0, 300, 200))], items: [] })
    useUiStore.setState({ activeRoomId: 'r1' })
    t().start('add')
    t().setImage(img)
    const first = rect(50, 50, 250, 150)
    closeOk(rev ? [...first].reverse() : first, { scale: 1 })
    expect(t().commitTrace(240, true, true)).toBe(true)
    const xs = doc().rooms[1].points.map((p) => p[0])
    const zs = doc().rooms[1].points.map((p) => p[1])
    expect([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]).toEqual([310, 510, 0, 100])
    closeOk(rect(260, 50, 460, 150))
    t().commitTrace(240, true, true)
    expect(doc().rooms[2].points).toEqual(rect(520, 0, 720, 100))
  })
  it('placeRightOf 결과가 겹치면 거부하고 세션을 유지한다', () => {
    useDocStore.setState({ rooms: [room('r1', rect(0, 0, 300, 200)), room('r2', rect(310, 0, 510, 200))], items: [] })
    useUiStore.setState({ activeRoomId: 'r1' })
    t().start('add')
    t().setImage(img)
    closeOk(rect(50, 50, 250, 150), { scale: 1 })
    expect(t().commitTrace(240, true, true)).toBe(false)
    expect(useUiStore.getState().notice).toContain('방을 추가하지 못했습니다')
    expect(doc().rooms).toHaveLength(2)
    expect(t().confirmed).toBe(0)
    expect(t().offset).toBeNull()
    expect(t().closed).toBe(true)
  })
  it('방 20개면 확정 실패 + notice', () => {
    const rooms = Array.from({ length: 20 }, (_, i) => room(`r${i + 1}`, rect(i * 110, 0, i * 110 + 100, 100)))
    useDocStore.setState({ rooms, items: [] })
    t().start('add')
    closeOk(rect(0, 500, 100, 600))
    expect(t().commitTrace(240, true, true)).toBe(false)
    expect(useUiStore.getState().notice).toContain('20')
    expect(t().confirmed).toBe(0)
    expect(doc().rooms).toHaveLength(20)
  })
})

describe('겹침 닫기와 취소', () => {
  it('겹치면 닫히지 않고 overlapWith를 담는다', () => {
    useDocStore.setState({ rooms: [room('r1', rect(0, 0, 300, 200))], items: [] })
    t().start('add')
    arm(rect(100, 100, 400, 300))
    expect(t().closeTrace()).toBe(false)
    expect(t().error?.message).toBe(OVERLAP_MESSAGE)
    expect(t().error?.overlapWith).toEqual([0])
    expect(t().closed).toBe(false)
  })
  it('닫은 뒤 점 삭제로 겹치면 막히고 점이 복원된다', () => {
    useDocStore.setState({ rooms: [room('r1', rect(0, 0, 300, 200))], items: [] })
    t().start('add')
    closeOk([[310, -100], [510, -100], [510, 300], [-100, 300], [-100, 250], [310, 250]])
    const before = t().corners
    expect(t().deleteTracePoint(5)).toBe(false)
    expect(t().corners).toEqual(before)
    expect(t().closed).toBe(true)
    expect(t().error?.message).toBe(OVERLAP_MESSAGE)
    expect(t().error?.overlapWith).toEqual([0])
  })
  it('cancel은 확정된 방을 남긴다', () => {
    t().start()
    closeOk(rect(100, 100, 400, 300))
    t().commitTrace(240, true, true)
    arm([[1, 1], [5, 1]])
    t().cancel()
    expect(doc().rooms).toHaveLength(1)
    expect(t().active).toBe(false)
  })
})

// ---- Task 5: placePoint (이웃 스냅 연결) ----
import { previewPoint } from './useTraceStore'

describe('placePoint 연결', () => {
  const addMode = () => {
    useDocStore.setState({ rooms: [room('r1', rect(0, 0, 300, 200))], items: [] })
    t().start('add')
  }
  it('첫 점은 이웃 링 변에 붙고 free·체크 해제면 격자만', () => {
    addMode()
    expect(t().addTracePoint(322, 104)).toBe(true)
    expect(t().corners[0]).toEqual([310, 100])
    t().cancel(); addMode()
    t().addTracePoint(322, 104, true)
    expect(t().corners[0]).toEqual([320, 100])
    t().cancel(); addMode()
    t().setNeighborSnap(false)
    t().addTracePoint(322, 104)
    expect(t().corners[0]).toEqual([320, 100])
  })
  it('previewPoint는 첫 점과 이후 점 모두 hit을 주고 확정 점과 같다', () => {
    addMode()
    t().setCursor(322, 104)
    const first = previewPoint(t())!
    expect(first.length).toBeNull()
    expect(first.hit?.kind).toBe('edge')
    t().addTracePoint(322, 104)
    expect(t().corners[0]).toEqual(first.point)
    t().setOrtho(false)
    t().setCursor(316, 150)
    const next = previewPoint(t())!
    expect(next.hit?.kind).toBe('edge')
    expect(next.length).not.toBeNull()
    t().addTracePoint(316, 150)
    expect(t().corners[1]).toEqual(next.point)
  })
  it('previewPoint는 닫힘·축척 없음·커서 없음이면 null', () => {
    addMode()
    expect(previewPoint(t())).toBeNull()
    t().setCursor(5, 5)
    expect(previewPoint({ ...t(), closed: true })).toBeNull()
    expect(previewPoint({ ...t(), scale: null })).toBeNull()
  })
  it('moveTracePoint는 직각 보정 없이 이웃·격자 스냅', () => {
    addMode()
    t().addTracePoint(500, 500)
    t().addTracePoint(700, 500)
    t().moveTracePoint(1, 322, 104)
    expect(t().corners[1]).toEqual([310, 100])
    t().moveTracePoint(1, 713, 524, true)
    expect(t().corners[1]).toEqual([710, 520])
  })
  it('replace 첫 방(고스트 없음)은 기존 격자 결과', () => {
    t().start()
    t().addTracePoint(322, 104)
    expect(t().corners[0]).toEqual([320, 100])
  })
  it('빈 캔버스 영역 밖은 blankArea로 clamp', () => {
    addMode()
    t().addTracePoint(9000, -9000)
    expect(t().corners[0]).toEqual([3300, -3000])
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { createSample } from '../store/sample'
import { useDocStore } from '../store/useDocStore'
import { formItems, formRoom, formShift, notchesError, submitRoomForm, type RoomForm } from './roomForm'
import { applyNotches, checkNotchDraft, emptyNotchDraft, type NotchSpec } from './roomNotch'

const rect: [number, number][] = [[0, 0], [400, 0], [400, 300], [0, 300]]
const form = (o: Partial<RoomForm> = {}): RoomForm => ({
  kind: 'rect', width: '400', depth: '300', height: '230', cutWidth: '100', cutDepth: '100', keepItems: true, ...o,
})
const cutTop: NotchSpec = { wall: 0, kind: 'cut', offset: 100, width: 200, depth: 100 }

beforeEach(() => {
  useDocStore.setState({ ...createSample(), pristine: true })
  useDocStore.temporal.getState().clear()
})

describe('checkNotchDraft', () => {
  const d = (o: object) => ({ ...emptyNotchDraft(), width: '200', depth: '100', offset: '100', ...o })
  it('유효하면 벽 번호를 0부터로 바꾼 spec', () => {
    expect(checkNotchDraft(rect, d({ wall: '1' }))).toEqual({ ok: true, spec: cutTop })
  })
  it('필드별 형식 오류', () => {
    const r = checkNotchDraft(rect, d({ wall: '9', offset: '-1', width: '', depth: '1.5' }))
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['depth', 'offset', 'wall', 'width'])
  })
  it('기하 오류는 form 문구', () => {
    const r = checkNotchDraft(rect, d({ depth: '400' }))
    expect(!r.ok && r.errors.form).toBeTruthy()
  })
})

describe('formRoom / submitRoomForm with notches', () => {
  it('applyNotches는 차례로 적용하고 실패하면 거절', () => {
    expect(applyNotches(rect, [cutTop])).toMatchObject({ ok: true })
    expect(applyNotches(rect, [cutTop, { ...cutTop, wall: 0 }]).ok).toBe(false)
  })
  it('미리보기 윤곽에 반영된다', () => {
    expect(formRoom(form({ notches: [cutTop] }))?.points).toHaveLength(8)
    expect(formRoom(form())?.points).toHaveLength(4)
  })
  it('프리셋이 바뀌어 맞지 않으면 null + 문구', () => {
    const f = form({ width: '250', notches: [cutTop] })
    expect(formRoom(f)).toBeNull()
    expect(notchesError(f)).toMatch(/벽/)
    expect(notchesError(form({ notches: [cutTop] }))).toBeNull()
  })
  it('확정은 Undo 1단계, 가구 유지/삭제 규칙 재사용', () => {
    expect(submitRoomForm(form({ notches: [cutTop], keepItems: false }))).toBe(true)
    expect(useDocStore.temporal.getState().pastStates).toHaveLength(1)
    expect(useDocStore.getState().room.points).toHaveLength(8)
    expect(useDocStore.getState().items).toHaveLength(0)
    useDocStore.temporal.getState().undo()
    expect(useDocStore.getState().room.points).toHaveLength(4)
    expect(useDocStore.getState().items).toHaveLength(4)
  })
  it('유효하지 않은 notches로는 확정하지 않는다', () => {
    expect(submitRoomForm(form({ width: '250', notches: [cutTop] }))).toBe(false)
    expect(useDocStore.temporal.getState().pastStates).toHaveLength(0)
  })
})

describe('위/왼쪽 돌출로 방이 옮겨질 때 가구도 같이 옮긴다', () => {
  const bumpTop: NotchSpec = { wall: 0, kind: 'bump', offset: 100, width: 200, depth: 50 }
  it('위쪽 돌출은 (0,+50) 이동, 아래/오른쪽·홈은 이동 없음', () => {
    expect(formShift(form({ notches: [bumpTop] }))).toEqual([0, 50])
    expect(formShift(form({ notches: [cutTop] }))).toEqual([0, 0])
    expect(formShift(form({ notches: [{ ...bumpTop, wall: 2 }] }))).toEqual([0, 0])
    expect(formShift(form())).toEqual([0, 0])
  })
  it('확정 시 keepItems면 position 이동(Undo 1단계), 삭제면 비움', () => {
    const before = useDocStore.getState().items
    expect(submitRoomForm(form({ notches: [bumpTop] }))).toBe(true)
    const after = useDocStore.getState().items
    after.forEach((it, i) => {
      expect(it.position[0]).toBe(before[i].position[0])
      expect(it.position[1]).toBe(before[i].position[1])
      expect(it.position[2]).toBe(before[i].position[2] + 50)
    })
    expect(useDocStore.temporal.getState().pastStates).toHaveLength(1)
    useDocStore.temporal.getState().undo()
    expect(useDocStore.getState().items.map((it) => it.position)).toEqual(before.map((it) => it.position))
  })
  it('이동 없는 확정은 position 불변', () => {
    const before = useDocStore.getState().items.map((it) => it.position)
    expect(submitRoomForm(form({ notches: [cutTop] }))).toBe(true)
    expect(useDocStore.getState().items.map((it) => it.position)).toEqual(before)
  })
  it('방 밖 개수 계산은 이동 후 좌표 기준(formItems)', () => {
    const items = useDocStore.getState().items
    const moved = formItems(form({ notches: [bumpTop] }), items)
    expect(moved[0].position[2]).toBe(items[0].position[2] + 50)
    expect(formItems(form(), items)).toBe(items)
  })
})

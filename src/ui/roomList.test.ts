import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { ROOMS_MAX } from '../io/validate'
import { getActiveRoom } from '../store/activeRoom'
import { placeBeside } from '../store/rooms'
import { createSample } from '../store/sample'
import type { Point2, Room } from '../store/types'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import RoomDialog from './RoomDialog'
import RoomList from './RoomList'
import { ROOM_ADD_GAP, addRoomBlockedReason, needsReplaceConfirm, placeRightOf, submitAddRoomForm, type RoomForm } from './roomForm'

const reset = () => {
  useDocStore.setState({ ...createSample(), pristine: true })
  useDocStore.temporal.getState().clear()
  useUiStore.setState({ activeRoomId: null, notice: null })
}
const form = (o: Partial<RoomForm> = {}): RoomForm => ({
  kind: 'rect', width: '300', depth: '200', height: '240', cutWidth: '150', cutDepth: '120', keepItems: true, ...o,
})
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el)

beforeEach(reset)

describe('placeRightOf', () => {
  it('places a 300×200 room right of the active room with a 10cm gap', () => {
    const active: Room = { id: 'r1', name: '방 1', height: 240, points: [[0, 0], [400, 0], [400, 300], [0, 300]] }
    const points: Point2[] = [[0, 0], [300, 0], [300, 200], [0, 200]]
    expect(ROOM_ADD_GAP).toBe(10)
    expect(placeRightOf(active, points)).toEqual([[410, 0], [710, 0], [710, 200], [410, 200]])
  })
  it('aligns min z with the active room and shifts the ㄱ자 outline by the same amount', () => {
    const active: Room = { id: 'r1', name: '방 1', height: 240, points: [[50, 20], [450, 20], [450, 320], [50, 320]] }
    const l: Point2[] = [[0, 0], [300, 0], [300, 100], [200, 100], [200, 200], [0, 200]]
    expect(placeRightOf(active, l)).toEqual([[460, 20], [760, 20], [760, 120], [660, 120], [660, 220], [460, 220]])
  })
})

describe('placeBeside', () => {
  const active: Room = { id: 'r1', name: '방 1', height: 240, points: [[50, 20], [450, 20], [450, 320], [50, 320]] }
  const pts: Point2[] = [[0, 0], [300, 0], [300, 200], [0, 200]]
  it('left: 10cm gap before min x, top z aligned (negative x is fine)', () => {
    expect(placeBeside(active, pts, 'left')).toEqual([[-260, 20], [40, 20], [40, 220], [-260, 220]])
  })
  it('down: 10cm below max z, left x aligned', () => {
    expect(placeBeside(active, pts, 'down')).toEqual([[50, 330], [350, 330], [350, 530], [50, 530]])
  })
  it('up: 10cm above min z, left x aligned', () => {
    expect(placeBeside(active, pts, 'up')).toEqual([[50, -190], [350, -190], [350, 10], [50, 10]])
  })
})

describe('submitAddRoomForm', () => {
  it('adds on the chosen side and keeps coordinates non-negative by shifting the document', () => {
    const before = useDocStore.getState().rooms[0].points
    expect(submitAddRoomForm(form({ side: 'left' }))).toBe('r2')
    const { rooms } = useDocStore.getState()
    const xs = rooms.flatMap((r) => r.points.map((p) => p[0]))
    const zs = rooms.flatMap((r) => r.points.map((p) => p[1]))
    expect(Math.min(...xs)).toBe(0)
    expect(Math.min(...zs)).toBe(0)
    expect(Math.max(...rooms[1].points.map((p) => p[0]))).toBeLessThan(Math.min(...rooms[0].points.map((p) => p[0])))
    expect(rooms[0].points).not.toEqual(before)
  })
  it('adds the room next to the active one and makes it active', () => {
    const id = submitAddRoomForm(form())
    expect(id).toBe('r2')
    const { rooms } = useDocStore.getState()
    expect(rooms).toHaveLength(2)
    expect(rooms[1].points).toEqual([[410, 0], [710, 0], [710, 200], [410, 200]])
    expect(getActiveRoom().id).toBe('r2')
  })
  it('rejects invalid input without changing the document', () => {
    expect(submitAddRoomForm(form({ width: '3001' }))).toBeNull()
    expect(useDocStore.getState().rooms).toHaveLength(1)
  })
})

describe('room list behavior (store level)', () => {
  it('deleting keeps furniture and falls back to the first room; the last room cannot be deleted', () => {
    const id = submitAddRoomForm(form())!
    expect(useDocStore.getState().removeRoom(id)).toBe(true)
    expect(useDocStore.getState().items).toHaveLength(4)
    expect(getActiveRoom().id).toBe('r1')
    expect(useDocStore.getState().removeRoom('r1')).toBe(false)
  })
  it('rename updates the document (the list renders these rooms)', () => {
    expect(useDocStore.getState().renameRoom('r1', '거실')).toBe(true)
    expect(useDocStore.getState().rooms[0].name).toBe('거실')
    expect(useDocStore.getState().renameRoom('r1', '')).toBe(false)
  })
  it('replaces only with confirmation when 2+ rooms exist', () => {
    expect(needsReplaceConfirm(useDocStore.getState().rooms)).toBe(false)
    submitAddRoomForm(form())
    expect(needsReplaceConfirm(useDocStore.getState().rooms)).toBe(true)
  })
})

describe('RoomList rendering', () => {
  it('collapses to a single row (name + add) for one room', () => {
    const out = html(createElement(RoomList))
    expect(out).toContain('role="list"')
    expect(out).toContain('aria-label="방 목록"')
    expect(out).toContain('aria-current="true"')
    expect(out).toContain('방 추가')
    expect(out).not.toContain('이름 변경')
    expect(out).not.toContain('>삭제<')
  })
  it(`blocks adding at ${ROOMS_MAX} rooms with a reason, allows it below`, () => {
    const rooms: Room[] = Array.from({ length: ROOMS_MAX - 1 }, (_, i) => ({
      id: `r${i + 1}`,
      name: `방 ${i + 1}`,
      height: 240,
      points: [[i * 200, 0], [i * 200 + 100, 0], [i * 200 + 100, 100], [i * 200, 100]],
    }))
    expect(addRoomBlockedReason(rooms)).toBeNull()
    expect(addRoomBlockedReason([...rooms, { ...rooms[0], id: `r${ROOMS_MAX}` }])).toBe(
      `방은 최대 ${ROOMS_MAX}개까지 추가할 수 있습니다`,
    )
  })
})

describe('RoomDialog modes', () => {
  it('add mode hides keep-items and shows the draw button', () => {
    const out = html(createElement(RoomDialog, { mode: 'add', onClose: () => {} }))
    expect(out).toContain('방 추가')
    expect(out).not.toContain('기존 가구')
    expect(out).toContain('그려서 만들기(평면도 배경 선택 가능)')
    expect(out).not.toContain('다음 단계에서')
  })
  it('손대지 않은 샘플이면 기존 가구 선택을 묻지 않는다(AC-01-6)', () => {
    const out = html(createElement(RoomDialog, { onClose: () => {} }))
    expect(out).not.toContain('기존 가구')
  })
  it('replace mode keeps the existing create inputs and buttons', () => {
    useDocStore.setState({ pristine: false })
    const out = html(createElement(RoomDialog, { onClose: () => {} }))
    for (const label of ['방 만들기', '가로', '세로', '천장고', '기존 가구', '그려서 만들기', '취소', '만들기']) {
      expect(out).toContain(label)
    }
  })
})

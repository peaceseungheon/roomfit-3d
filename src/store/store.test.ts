import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { selectRoom, useDocStore } from './useDocStore'
import { useUiStore } from './useUiStore'
import { createSample } from './sample'
import { CORRUPT_BACKUP_KEY, restoreSaved, serializeDocument, startAutoSave, STORAGE_KEY } from '../io/persist'
import type { Item } from './types'

const item = (id: string): Item => ({
  id,
  type: 'FURNITURE',
  modelType: 'BOX',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  size: [10, 10, 10],
})

beforeEach(() => {
  useDocStore.setState({ ...createSample(), pristine: true })
  useDocStore.temporal.getState().clear()
  useUiStore.setState({ selectedId: null, saveStatus: 'idle', restoreFailure: null, activeRoomId: null })
})

describe('useDocStore', () => {
  it('ㄱ자는 우상단이 잘린다', () => {
    useDocStore.getState().createLRoom(400, 300, 230, 100, 80)
    expect(selectRoom(useDocStore.getState()).points).toEqual([
      [0, 0], [300, 0], [300, 80], [400, 80], [400, 300], [0, 300],
    ])
  })
  it('Undo는 50단계까지만', () => {
    for (let i = 0; i < 60; i++) useDocStore.getState().addItem(item(`n${i}`))
    expect(useDocStore.temporal.getState().pastStates.length).toBe(50)
    for (let i = 0; i < 60; i++) useDocStore.temporal.getState().undo()
    expect(useDocStore.getState().items.length).toBe(createSample().items.length + 10)
  })
  it('선택/카메라 변경은 Undo 이력에 안 쌓인다', () => {
    useUiStore.getState().select('x')
    useUiStore.getState().setCameraMode('2D')
    expect(useDocStore.temporal.getState().pastStates.length).toBe(0)
  })
  it('불변 갱신', () => {
    const before = useDocStore.getState().items
    useDocStore.getState().updateItem('item_001', { name: 'new' })
    expect(before.find((i) => i.id === 'item_001')?.name).not.toBe('new')
  })
})

describe('자동 저장', () => {
  const mk = (fail = false) => {
    const setItem = vi.fn(() => {
      if (fail) throw new Error('quota')
    })
    return { setItem }
  }
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('샘플 첫 편집 전에는 쓰지 않고, 편집 후 1초 디바운스로 1회 쓴다', () => {
    const st = mk()
    const stop = startAutoSave(st, 1000)
    useUiStore.getState().select('a')
    vi.advanceTimersByTime(2000)
    expect(st.setItem).not.toHaveBeenCalled()
    useDocStore.getState().addItem(item('a'))
    vi.advanceTimersByTime(500)
    useDocStore.getState().addItem(item('b'))
    vi.advanceTimersByTime(999)
    expect(st.setItem).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(st.setItem).toHaveBeenCalledTimes(1)
    expect(useUiStore.getState().saveStatus).toBe('saved')
    stop()
  })
  it('쓰기 실패 시 failed', () => {
    const stop = startAutoSave(mk(true), 1000)
    useDocStore.getState().removeItem('item_001')
    vi.advanceTimersByTime(1000)
    expect(useUiStore.getState().saveStatus).toBe('failed')
    stop()
  })
})

describe('restoreSaved', () => {
  it('유효한 저장본 복원 + Undo 이력 비움', () => {
    const doc = createSample()
    doc.items = doc.items.slice(0, 1)
    const text = serializeDocument(doc)
    expect(restoreSaved({ getItem: (k) => (k === STORAGE_KEY ? text : null) })).toBe(true)
    expect(useDocStore.getState().items.length).toBe(1)
    expect(useDocStore.temporal.getState().pastStates.length).toBe(0)
  })
  it('깨진 저장본이면 샘플 유지', () => {
    expect(restoreSaved({ getItem: () => '{"x":1}' })).toBe(false)
    expect(useDocStore.getState().items.length).toBe(createSample().items.length)
    expect(useDocStore.getState().pristine).toBe(true)
  })
})

describe('규약 강제와 거부', () => {
  const undoCount = () => useDocStore.temporal.getState().pastStates.length
  it('addItem: y=0 고정, 크기 clamp', () => {
    expect(useDocStore.getState().addItem({ ...item('c'), position: [30, 55, 40], size: [5000, 9999, -3] })).toBe(true)
    const c = useDocStore.getState().items.find((i) => i.id === 'c')!
    expect(c.position).toEqual([30, 0, 40])
    expect(c.size).toEqual([1000, 500, 1])
  })
  it('NaN/Infinity는 거부하고 상태 유지', () => {
    const before = useDocStore.getState().items
    expect(useDocStore.getState().addItem({ ...item('n'), size: [NaN, 10, 10] })).toBe(false)
    expect(useDocStore.getState().updateItem('item_001', { position: [Infinity, 0, 0] })).toBe(false)
    expect(useDocStore.getState().items).toBe(before)
    expect(undoCount()).toBe(0)
  })
  it('updateItem 크기 clamp, 정확한 cm 값은 스냅하지 않는다', () => {
    useDocStore.getState().updateItem('item_001', { position: [123, 7, 45], size: [2000, 10, 10] })
    const it = useDocStore.getState().items.find((i) => i.id === 'item_001')!
    expect(it.position).toEqual([123, 0, 45])
    expect(it.size[0]).toBe(1000)
  })
  it('없는 id 업데이트는 Undo/pristine 변화 없음', () => {
    expect(useDocStore.getState().updateItem('nope', { name: 'x' })).toBe(false)
    expect(undoCount()).toBe(0)
    expect(useDocStore.getState().pristine).toBe(true)
  })
  it('방 입력 범위 밖이면 상태 유지', () => {
    const before = selectRoom(useDocStore.getState())
    expect(useDocStore.getState().createRectRoom(5000, 300, 230)).toBe(false)
    expect(useDocStore.getState().createLRoom(400, 300, 230, 400, 80)).toBe(false)
    expect(selectRoom(useDocStore.getState())).toBe(before)
    expect(undoCount()).toBe(0)
  })
  it('keepItems=false면 가구를 비운다', () => {
    expect(useDocStore.getState().createRectRoom(400, 300, 230, false)).toBe(true)
    expect(useDocStore.getState().items).toEqual([])
  })
  it('loadDocument/resetToSample 후 Undo 가능', () => {
    const orig = useDocStore.getState().items
    useDocStore.getState().loadDocument({ rooms: createSample().rooms, items: [] })
    expect(useDocStore.getState().items).toEqual([])
    useDocStore.temporal.getState().undo()
    expect(useDocStore.getState().items).toBe(orig)
    useDocStore.getState().removeItem('item_001')
    useDocStore.getState().resetToSample()
    useDocStore.temporal.getState().undo()
    expect(useDocStore.getState().items.some((i) => i.id === 'item_001')).toBe(false)
  })
})

describe('rooms 배열 모델', () => {
  const sq = (x: number): [number, number][] => [[x, 0], [x + 300, 0], [x + 300, 300], [x, 300]]
  it('초기 상태는 방 1개(r1)', () => {
    expect(useDocStore.getState().rooms).toHaveLength(1)
    expect(useDocStore.getState().rooms[0].id).toBe('r1')
  })
  it('createRectRoom은 rooms[0]의 id·name을 유지하고 points·height만 바꾼다', () => {
    const before = useDocStore.getState().rooms[0]
    expect(useDocStore.getState().createRectRoom(500, 400, 240)).toBe(true)
    const after = useDocStore.getState().rooms[0]
    expect(after).toEqual({ id: before.id, name: before.name, height: 240, points: [[0, 0], [500, 0], [500, 400], [0, 400]] })
  })
  it('loadDocument 후 undo하면 이전 rooms 참조로 복귀', () => {
    const prev = useDocStore.getState().rooms
    const A = { id: 'a', name: '방 1', height: 230, points: sq(0) }
    const B = { id: 'b', name: '방 2', height: 230, points: sq(300) }
    useDocStore.getState().loadDocument({ rooms: [A, B], items: [] })
    expect(useDocStore.getState().rooms).toEqual([A, B])
    useDocStore.temporal.getState().undo()
    expect(useDocStore.getState().rooms).toBe(prev)
  })
  it('addItem의 천장고 clamp 기준은 rooms[0].height', () => {
    const r0 = useDocStore.getState().rooms[0]
    useDocStore.setState({ rooms: [{ ...r0, height: 200 }] })
    useDocStore.getState().addItem({ ...item('hi'), elevation: 300 })
    expect(useDocStore.getState().items.find((i) => i.id === 'hi')!.elevation).toBe(200)
  })
})

describe('방 CRUD·좌표 불변식', () => {
  const P = (x: number, z = 0, w = 300, d = 300): [number, number][] => [
    [x, z],
    [x + w, z],
    [x + w, z + d],
    [x, z + d],
  ]
  const room = (id: string, points: [number, number][], height = 230) => ({ id, name: `방 ${id}`, height, points })
  const twoRooms = () => [
    room('r1', [[0, 0], [100, 0], [100, 100], [0, 100]], 240),
    room('r2', [[200, 0], [300, 0], [300, 100], [200, 100]], 240),
  ]

  it('addRoom: 오른쪽 방 추가, 기본 이름, 새 id 반환', () => {
    const id = useDocStore.getState().addRoom({ height: 240, points: P(410, 0, 300, 200) })
    expect(id).toBe('r2')
    expect(useDocStore.getState().rooms).toHaveLength(2)
    expect(useDocStore.getState().rooms[1].name).toBe('방 2')
  })
  it('addRoom: 음수 좌표면 문서 전체(방+가구)를 같은 양만큼 옮기고 Undo 1단계', () => {
    useDocStore.getState().loadDocument({
      rooms: [room('r1', [[0, 0], [100, 0], [100, 100], [0, 100]], 240)],
      items: [{ ...item('f'), position: [10, 0, 10] }],
    })
    useDocStore.temporal.getState().clear()
    const beforeRooms = useDocStore.getState().rooms
    const beforeItems = useDocStore.getState().items
    expect(useDocStore.getState().addRoom({ height: 240, points: [[-100, 0], [-10, 0], [-10, 90], [-100, 90]] })).toBe('r2')
    const s = useDocStore.getState()
    expect(s.rooms.find((r) => r.id === 'r1')!.points).toEqual([[100, 0], [200, 0], [200, 100], [100, 100]])
    expect(s.items[0].position).toEqual([110, 0, 10])
    expect(useDocStore.temporal.getState().pastStates.length).toBe(1)
    useDocStore.temporal.getState().undo()
    expect(useDocStore.getState().rooms).toBe(beforeRooms)
    expect(useDocStore.getState().items).toBe(beforeItems)
  })
  it('addRoom: 겹치는 방은 거부하고 상태를 유지한다', () => {
    useDocStore.getState().loadDocument({
      rooms: [room('r1', [[0, 0], [100, 0], [100, 100], [0, 100]], 240)],
      items: [],
    })
    const before = useDocStore.getState().rooms
    expect(useDocStore.getState().addRoom({ height: 240, points: [[0, 0], [100, 0], [100, 90], [0, 90]] })).toBeNull()
    expect(useDocStore.getState().rooms).toBe(before)
  })
  it('addRoom: 방 20개를 넘거나 문서 바운딩 10000을 넘으면 거부', () => {
    const many = Array.from({ length: 20 }, (_, i) => room(`r${i + 1}`, P(i * 310), 230))
    useDocStore.getState().loadDocument({ rooms: many, items: [] })
    expect(useDocStore.getState().addRoom({ height: 230, points: P(9000) })).toBeNull()
    useDocStore.getState().resetToSample()
    expect(useDocStore.getState().addRoom({ height: 240, points: [[9700, 0], [10001, 0], [10001, 100], [9700, 100]] })).toBeNull()
  })
  it('removeRoom: 가구는 유지하고 마지막 방은 거부', () => {
    useDocStore.getState().loadDocument({ rooms: twoRooms(), items: [item('keep')] })
    const items = useDocStore.getState().items
    expect(useDocStore.getState().removeRoom('r2')).toBe(true)
    expect(useDocStore.getState().rooms.map((r) => r.id)).toEqual(['r1'])
    expect(useDocStore.getState().items).toBe(items)
    expect(useDocStore.getState().removeRoom('r1')).toBe(false)
    expect(useDocStore.getState().removeRoom('nope')).toBe(false)
  })
  it('renameRoom: trim 후 1~100자만 허용', () => {
    expect(useDocStore.getState().renameRoom('r1', ' 거실 ')).toBe(true)
    expect(useDocStore.getState().rooms[0].name).toBe('거실')
    expect(useDocStore.getState().renameRoom('r1', '')).toBe(false)
    expect(useDocStore.getState().renameRoom('r1', '   ')).toBe(false)
    expect(useDocStore.getState().renameRoom('r1', 'a'.repeat(101))).toBe(false)
    expect(useDocStore.getState().renameRoom('nope', 'x')).toBe(false)
  })
  it('setRoomGeometry: 소속 가구만 clamp, 소속 없는 가구는 최저 천장고', () => {
    useDocStore.getState().loadDocument({
      rooms: [room('r1', P(0), 240), room('r2', P(400), 240)],
      items: [
        { ...item('inA'), position: [150, 0, 150], elevation: 230 },
        { ...item('inB'), position: [550, 0, 150], elevation: 230 },
        { ...item('out'), position: [1000, 0, 150], elevation: 230 },
      ],
    })
    expect(useDocStore.getState().setRoomGeometry('r2', { height: 200, points: P(400) })).toBe(true)
    const byId = (id: string) => useDocStore.getState().items.find((i) => i.id === id)!
    expect(byId('inB').elevation).toBe(200)
    expect(byId('inA').elevation).toBe(230)
    expect(byId('out').elevation).toBe(200)
  })
  it('setRoomGeometry: 점을 음수로 옮기면 문서 전체 이동 + Undo 1단계', () => {
    useDocStore.getState().loadDocument({ rooms: twoRooms(), items: [{ ...item('f'), position: [50, 0, 50] }] })
    useDocStore.temporal.getState().clear()
    const beforeRooms = useDocStore.getState().rooms
    expect(
      useDocStore.getState().setRoomGeometry('r2', { height: 240, points: [[-100, 0], [-50, 0], [-50, 100], [-100, 100]] }),
    ).toBe(true)
    const s = useDocStore.getState()
    expect(s.rooms.find((r) => r.id === 'r1')!.points).toEqual([[100, 0], [200, 0], [200, 100], [100, 100]])
    expect(s.rooms.find((r) => r.id === 'r2')!.points).toEqual([[0, 0], [50, 0], [50, 100], [0, 100]])
    expect(s.items[0].position).toEqual([150, 0, 50])
    expect(useDocStore.temporal.getState().pastStates.length).toBe(1)
    useDocStore.temporal.getState().undo()
    expect(useDocStore.getState().rooms).toBe(beforeRooms)
  })
  it('createRectRoom은 다중 방 문서에서도 전체 교체한다', () => {
    useDocStore.getState().loadDocument({ rooms: twoRooms(), items: [item('x')] })
    expect(useDocStore.getState().createRectRoom(500, 400, 240)).toBe(true)
    expect(useDocStore.getState().rooms).toHaveLength(1)
    expect(useDocStore.getState().rooms[0]).toMatchObject({ id: 'r1', name: '방 1', height: 240 })
  })
})

describe('활성 방 상태', () => {
  const sq = (x: number): [number, number][] => [[x, 0], [x + 300, 0], [x + 300, 300], [x, 300]]
  const A = { id: 'r1', name: '방 1', height: 230, points: sq(0) }
  const B = { id: 'r2', name: '방 2', height: 230, points: sq(320) }
  it('setActiveRoomId는 Undo 이력에 쌓이지 않는다', () => {
    useDocStore.getState().loadDocument({ rooms: [A, B], items: [] })
    useDocStore.temporal.getState().clear()
    useUiStore.getState().setActiveRoomId('r2')
    expect(useUiStore.getState().activeRoomId).toBe('r2')
    expect(useDocStore.temporal.getState().pastStates.length).toBe(0)
  })
  it('문서 교체로 activeRoomId가 무효해지면 rooms[0].id로 해소된다', () => {
    useDocStore.getState().loadDocument({ rooms: [A, B], items: [] })
    useUiStore.getState().setActiveRoomId('r2')
    useDocStore.getState().loadDocument({ rooms: [A], items: [] })
    expect(useUiStore.getState().activeRoomId).toBe('r1')
  })
})

describe('저장본 손상 처리', () => {
  it('복원 성공 시 pristine=false', () => {
    const text = serializeDocument(createSample())
    restoreSaved({ getItem: () => text })
    expect(useDocStore.getState().pristine).toBe(false)
  })
  it('검증 실패 시 path 포함 오류 노출 + 원문 백업', () => {
    const bad = '{"projectInfo":{"version":"1.0","lastModified":"x"},"room":{"height":230,"points":[]},"items":[]}'
    const store: Record<string, string> = {}
    const ok = restoreSaved({ getItem: () => bad, setItem: (k, v) => void (store[k] = v) })
    expect(ok).toBe(false)
    const f = useUiStore.getState().restoreFailure!
    expect(f.backedUp).toBe(true)
    expect(f.errors.length).toBeGreaterThan(0)
    expect(f.errors.every((e) => e.path && e.message)).toBe(true)
    expect(f.errors.some((e) => e.path.startsWith('room'))).toBe(true)
    expect(store[CORRUPT_BACKUP_KEY]).toBe(bad)
  })
  it('백업 쓰기 실패해도 크래시 없이 backedUp=false', () => {
    const setItem = () => {
      throw new Error('quota')
    }
    expect(restoreSaved({ getItem: () => 'not json', setItem })).toBe(false)
    expect(useUiStore.getState().restoreFailure?.backedUp).toBe(false)
  })
})

describe('flush', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  it('pagehide 시 대기 중 저장을 즉시 쓰고, 해제 후에는 리스너가 없다', () => {
    const target = new EventTarget()
    vi.stubGlobal('window', target)
    const setItem = vi.fn()
    const stop = startAutoSave({ setItem }, 1000)
    target.dispatchEvent(new Event('pagehide'))
    expect(setItem).not.toHaveBeenCalled() // 대기 중 저장 없음
    useDocStore.getState().addItem(item('f'))
    target.dispatchEvent(new Event('pagehide'))
    expect(setItem).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000)
    expect(setItem).toHaveBeenCalledTimes(1) // 타이머 중복 저장 없음
    stop()
    useDocStore.getState().addItem(item('g'))
    target.dispatchEvent(new Event('beforeunload'))
    expect(setItem).toHaveBeenCalledTimes(1)
  })
})

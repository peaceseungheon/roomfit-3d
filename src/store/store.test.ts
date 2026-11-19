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
  useUiStore.setState({ selectedId: null, saveStatus: 'idle', restoreFailure: null })
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

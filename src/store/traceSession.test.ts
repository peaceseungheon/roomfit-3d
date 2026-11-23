import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Point2, Room } from './types'
import { createSample } from './sample'
import { docShiftDelta } from './rooms'
import { blankArea, clampArea, ghostRooms } from './traceSession'
import { useDocStore } from './useDocStore'
import { useEditStore } from './useEditStore'
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
    useTraceStore.setState({ confirmed: 0 })
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
})

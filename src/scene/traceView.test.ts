import { beforeEach, describe, expect, it } from 'vitest'
import type { Point2, Room } from '../store/types'
import { createSample } from '../store/sample'
import { blankArea, ghostRooms } from '../store/traceSession'
import { useDocStore } from '../store/useDocStore'
import { useEditStore } from '../store/useEditStore'
import { cornersCm, previewPoint, useTraceStore } from '../store/useTraceStore'
import { useUiStore } from '../store/useUiStore'
import { applyTraceClick, cameraKey, gridPlacement, traceBounds } from './traceView'

const t = useTraceStore.getState
const rect = (x0: number, z0: number, x1: number, z1: number): Point2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
const room = (id: string, points: Point2[]): Room => ({ id, name: id, height: 240, points })
const base = { minX: 0, maxX: 100, minZ: 0, maxZ: 50 }
const img = { url: 'blob:x', width: 100, height: 50 }

beforeEach(() => {
  t().cancel()
  useEditStore.setState({ editing: false, selectedCorner: null, selectedWall: null, draggingCorner: null })
  useDocStore.setState({ ...createSample(), pristine: true })
  useDocStore.temporal.getState().clear()
  useUiStore.setState({ notice: null, snapEnabled: true })
})

describe('traceBounds', () => {
  it('고스트가 없으면 base 그대로', () => expect(traceBounds(base, [])).toBe(base))
  it('고스트가 안에 있으면 그대로', () => expect(traceBounds(base, [rect(10, 10, 20, 20)])).toEqual(base))
  it('고스트가 밖에 있으면 합집합으로 넓어진다', () =>
    expect(traceBounds(base, [rect(-30, 10, 20, 80)])).toEqual({ minX: -30, maxX: 100, minZ: 0, maxZ: 80 }))
})

describe('cameraKey', () => {
  it('같은 이미지·mode·offset 유무면 같다(방 개수 무관)', () => {
    expect(cameraKey(img, 'add', true)).toBe(cameraKey({ ...img }, 'add', true))
  })
  it('offset null -> 값이면 바뀐다', () => expect(cameraKey(img, 'add', false)).not.toBe(cameraKey(img, 'add', true)))
  it('mode·이미지가 바뀌면 바뀐다', () => {
    expect(cameraKey(null, 'add', true)).not.toBe(cameraKey(null, 'replace', true))
    expect(cameraKey(img, 'add', true)).not.toBe(cameraKey(null, 'add', true))
  })
})

describe('고스트 인덱스와 격자', () => {
  it('error.overlapWith 인덱스는 ghostRooms 인덱스와 같다(doc.rooms 순서)', () => {
    useDocStore.setState({ rooms: [room('a', rect(0, 0, 300, 200)), room('b', rect(1000, 0, 1300, 200))], items: [] })
    t().start('add')
    useTraceStore.setState({ offset: [0, 0] }) // 이웃 윤곽이 보이는 세션
    const ghosts = ghostRooms(t(), useDocStore.getState().rooms)
    for (const p of rect(1100, 50, 1200, 150)) t().addTracePoint(p[0], p[1], true)
    expect(t().closeTrace()).toBe(false)
    const hit = t().error?.overlapWith
    expect(hit).toEqual([1])
    expect(ghosts[hit![0]]).toEqual(useDocStore.getState().rooms[1].points)
  })
  it('gridPlacement: 기본 영역은 현행(중심 1500, 크기 3000)과 같다', () => {
    expect(gridPlacement(blankArea([]))).toEqual({ center: [1500, 1500], size: [3000, 3000] })
  })
  it('gridPlacement: 고스트가 있어도 선이 영역 min에서 시작하고 영역을 덮는다', () => {
    const a = blankArea([rect(-70, 30, 300, 230)])
    const { center, size } = gridPlacement(a)
    expect((center[0] - a.minX) % 500).toBe(0)
    expect((center[1] - a.minZ) % 500).toBe(0)
    expect(center[0] - size[0] / 2).toBeLessThanOrEqual(a.minX)
    expect(center[0] + size[0] / 2).toBeGreaterThanOrEqual(a.maxX)
    expect(center[1] - size[1] / 2).toBeLessThanOrEqual(a.minZ)
    expect(center[1] + size[1] / 2).toBeGreaterThanOrEqual(a.maxZ)
  })
})

describe('클릭 경로의 Shift 전달', () => {
  const place = (shift: boolean) => {
    useDocStore.setState({ rooms: [room('a', rect(0, 0, 300, 200))], items: [] })
    t().start('add')
    useTraceStore.setState({ offset: [0, 0] }) // 이웃 윤곽이 보이는 세션
    t().setCursor(-3, 55, shift)
    const pv = previewPoint({ ...t() })!.point // 미리보기가 보여 준 점
    applyTraceClick([-3, 55], 5, shift)
    return { pv, placed: cornersCm(t())[0] }
  }
  it('Shift 없음: 이웃 변에 붙은 점이 미리보기와 같다', () => {
    const { pv, placed } = place(false)
    expect(placed).toEqual(pv)
    expect(placed[0]).toBe(-10)
  })
  it('Shift: 스냅이 해제된 점이 미리보기와 같다(addTracePoint가 free를 받는다)', () => {
    const { pv, placed } = place(true)
    expect(placed).toEqual(pv)
    expect(placed[0]).toBeCloseTo(0)
    expect(placed[1]).toBe(60)
  })
})

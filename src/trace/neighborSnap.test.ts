import { describe, expect, it } from 'vitest'
import type { Point2 } from '../store/types'
import { drawPoint } from './draw'
import { NEIGHBOR_GAP, placeDrawPoint, SNAP_RADIUS, snapRings } from './neighborSnap'

const ghost: Point2[] = [[0, 0], [300, 0], [300, 200], [0, 200]]
const rings = snapRings([ghost])
const base = { step: 10, rings, neighbor: true }

describe('snapRings', () => {
  it('기본 간격 10cm로 바깥 링을 만든다', () => {
    expect(NEIGHBOR_GAP).toBe(10)
    expect(rings).toEqual([[[-10, -10], [310, -10], [310, 210], [-10, 210]]])
  })
})

describe('placeDrawPoint', () => {
  it('첫 점이 링 꼭짓점 근처면 꼭짓점에 붙는다', () => {
    const r = placeDrawPoint(null, [305, -3], { ...base, ortho: false })
    expect(r.point).toEqual([310, -10])
    expect(r.hit).toMatchObject({ kind: 'vertex', room: 0, vertex: 1 })
  })

  it('변 근처면 변에 투영한다', () => {
    const r = placeDrawPoint(null, [322, 104], { ...base, ortho: false })
    expect(r.point).toEqual([310, 100])
    expect(r.hit).toMatchObject({ kind: 'edge', room: 0 })
  })

  it('반경 밖이면 격자 결과, hit null', () => {
    const r = placeDrawPoint(null, [330, 100], { ...base, ortho: false })
    expect(r).toEqual({ point: [330, 100], hit: null })
  })

  it('직각: 직각선과 변의 교점에 붙는다', () => {
    const r = placeDrawPoint([500, 100], [318, 104], { ...base, ortho: true })
    expect(r.point).toEqual([310, 100])
    expect(r.hit?.kind).toBe('edge')
  })

  it('직각: 꼭짓점은 고정 축을 직전 점 값으로 유지한다', () => {
    const r = placeDrawPoint([500, 205], [320, 207], { ...base, ortho: true })
    expect(r.point).toEqual([310, 205])
    expect(r.hit?.kind).toBe('vertex')
  })

  it('직각: 평행 변은 거부한다', () => {
    const r = placeDrawPoint([400, -5], [350, -8], { ...base, ortho: true })
    expect(r).toEqual({ point: [350, -5], hit: null })
  })

  it('직각: 교점이 선분 밖이면 스냅하지 않는다', () => {
    // 비스듬한 변: 커서는 변 가까이(12.7cm)지만 수평선 z=-3은 변의 연장선과 선분 밖에서 만난다. 꼭짓점은 15.3cm라 제외.
    const slanted: Point2[][] = [[[0, 0], [100, 100], [0, 100]]]
    const r = placeDrawPoint([200, -3], [15, -3], { ...base, ortho: true, rings: slanted })
    expect(r.point).toEqual(drawPoint([200, -3], [15, -3], true, 10))
    expect(r.hit).toBeNull()
  })

  it('neighbor false면 drawPoint와 같다', () => {
    const r = placeDrawPoint(null, [322, 104], { ...base, ortho: false, neighbor: false })
    expect(r).toEqual({ point: drawPoint(null, [322, 104], false, 10), hit: null })
  })

  it('꼭짓점이 변보다 우선한다', () => {
    const r = placeDrawPoint(null, [312, -8], { ...base, ortho: false })
    expect(r.hit?.kind).toBe('vertex')
  })

  it('정확히 15cm는 스냅하고 15.1cm는 하지 않는다', () => {
    expect(SNAP_RADIUS).toBe(15)
    expect(placeDrawPoint(null, [325, 100], { ...base, ortho: false }).hit?.kind).toBe('edge')
    expect(placeDrawPoint(null, [325.1, 100], { ...base, ortho: false }).hit).toBeNull()
  })

  it('빈 rings와 길이 0 변을 안전하게 건너뛴다', () => {
    expect(placeDrawPoint(null, [3, 4], { ...base, ortho: false, rings: [] })).toEqual({ point: [0, 0], hit: null })
    const degenerate: Point2[][] = [[[0, 0], [0, 0], [100, 0]]]
    const r = placeDrawPoint(null, [50, 5], { ...base, ortho: false, rings: degenerate })
    expect(Number.isFinite(r.point[0]) && Number.isFinite(r.point[1])).toBe(true)
  })

  it('여러 방이면 hit.room이 해당 인덱스다', () => {
    const second = snapRings([ghost, ghost.map(([x, z]): Point2 => [x + 1000, z])])
    const r = placeDrawPoint(null, [1322, 104], { ...base, ortho: false, rings: second })
    expect(r.hit).toMatchObject({ kind: 'edge', room: 1 })
    expect(r.point).toEqual([1310, 100])
  })
})

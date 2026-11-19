import { describe, expect, it } from 'vitest'
import type { Point2 } from '../store/types'
import { cornerClickAction, GRID_MIN_PX, gridSteps, HIT_PX, hitPoint, hitRadiusCm, hitSegment, isDragMove, SLOP_PX, traceClickAction } from './handles'

const sq: Point2[] = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
]

describe('hitRadiusCm', () => {
  it('화면 px를 zoom(px/cm)으로 나눈다', () => {
    expect(hitRadiusCm(HIT_PX, 2)).toBe(6)
    expect(hitRadiusCm(12, 0.5)).toBe(24)
  })
  it('잘못된 zoom이면 0', () => {
    expect(hitRadiusCm(12, 0)).toBe(0)
    expect(hitRadiusCm(12, NaN)).toBe(0)
    expect(hitRadiusCm(12, Infinity)).toBe(0)
  })
})

describe('hitPoint', () => {
  it('반경 안 가장 가까운 점', () => {
    expect(hitPoint(sq, [97, 2], 6)).toBe(1)
    expect(hitPoint(sq, [6, 0], 6)).toBe(0) // 경계 포함
  })
  it('반경 밖이거나 점이 없으면 -1', () => {
    expect(hitPoint(sq, [50, 50], 6)).toBe(-1)
    expect(hitPoint([], [0, 0], 6)).toBe(-1)
  })
  it('겹친 후보 중 더 가까운 점', () => {
    expect(hitPoint([[0, 0], [4, 0]], [3, 0], 6)).toBe(1)
  })
})

describe('hitSegment', () => {
  it('선분과의 거리로 판정', () => {
    expect(hitSegment(sq, [50, 3], 6)).toBe(0)
    expect(hitSegment(sq, [103, 50], 6)).toBe(1)
    expect(hitSegment(sq, [50, 50], 6)).toBe(-1)
  })
  it('닫힌 마지막 선분(3->0) 포함, 열린 경우 제외', () => {
    expect(hitSegment(sq, [-2, 50], 6)).toBe(3)
    expect(hitSegment(sq, [-2, 50], 6, false)).toBe(-1)
  })
  it('선분 끝 너머는 끝점 거리', () => {
    expect(hitSegment([[0, 0], [100, 0]], [110, 0], 6, false)).toBe(-1)
  })
  it('점이 2개 미만이면 -1', () => {
    expect(hitSegment([[0, 0]], [0, 0], 6)).toBe(-1)
  })
})

describe('traceClickAction', () => {
  const tri: Point2[] = [
    [0, 0],
    [100, 0],
    [100, 100],
  ]
  it('기준선: 빈 자리 순서대로, 두 점이면 무시', () => {
    expect(traceClickAction('baseline', 0, [], [5, 5], 6)).toEqual({ kind: 'baseline', i: 0 })
    expect(traceClickAction('baseline', 1, [], [5, 5], 6)).toEqual({ kind: 'baseline', i: 1 })
    expect(traceClickAction('baseline', 2, [], [5, 5], 6)).toEqual({ kind: 'none' })
  })
  it('업로드 전에는 아무것도 하지 않는다', () => {
    expect(traceClickAction('upload', 0, [], [5, 5], 6).kind).toBe('none')
  })
  it('닫힌 뒤: 점 위 = 선택(첫 점도 닫기 아님), 선 위 = 삽입, 빈 곳 = 선택 해제', () => {
    expect(traceClickAction('closed', 2, tri, [100, 3], 6)).toEqual({ kind: 'select', i: 1 })
    expect(traceClickAction('closed', 2, tri, [2, 2], 6)).toEqual({ kind: 'select', i: 0 })
    expect(traceClickAction('closed', 2, tri, [50, 2], 6)).toEqual({ kind: 'insert', wall: 0 })
    expect(traceClickAction('closed', 2, tri, [48, 52], 6)).toEqual({ kind: 'insert', wall: 2 }) // 닫는 선(2->0)
    expect(traceClickAction('closed', 2, tri, [80, 40], 6)).toEqual({ kind: 'select', i: null })
  })
  it('첫 점 근처는 3점 이상일 때만 닫기', () => {
    expect(traceClickAction('corners', 2, tri, [3, 3], 6).kind).toBe('close')
    expect(traceClickAction('corners', 2, tri.slice(0, 2), [3, 3], 6).kind).toBe('none')
  })
  it('다른 점 위는 무시, 빈 곳은 추가', () => {
    expect(traceClickAction('corners', 2, tri, [100, 2], 6).kind).toBe('none')
    expect(traceClickAction('corners', 2, tri, [50, 50], 6).kind).toBe('add')
    expect(traceClickAction('corners', 2, [], [50, 50], 6).kind).toBe('add')
  })
})

describe('isDragMove', () => {
  it('SLOP_PX 이하는 클릭, 넘으면 드래그', () => {
    expect(isDragMove(0, 0)).toBe(false)
    expect(isDragMove(SLOP_PX, 0)).toBe(false)
    expect(isDragMove(SLOP_PX, 1)).toBe(true)
    expect(isDragMove(-3, -3)).toBe(true)
  })
})

describe('gridSteps', () => {
  it('10cm 격자가 충분히 넓으면 10/100', () => {
    expect(gridSteps(GRID_MIN_PX / 10)).toEqual({ cell: 10, section: 100 })
    expect(gridSteps(2)).toEqual({ cell: 10, section: 100 })
  })
  it('줌아웃할수록 굵은 격자', () => {
    expect(gridSteps(0.5)).toEqual({ cell: 50, section: 100 })
    expect(gridSteps(0.1)).toEqual({ cell: 100, section: 500 })
    expect(gridSteps(0.001)).toEqual({ cell: 500, section: 1000 })
  })
  it('잘못된 zoom이면 가장 굵은 격자', () => {
    expect(gridSteps(0).cell).toBe(500)
    expect(gridSteps(NaN).cell).toBe(500)
  })
})

describe('cornerClickAction', () => {
  it('점 위 = 점 선택(벽보다 우선)', () => {
    expect(cornerClickAction(sq, 0, [2, 1], 6)).toEqual({ kind: 'corner', i: 0 })
  })
  it('벽 위 첫 클릭 = 벽 선택, 선택한 벽 다시 클릭 = 삽입', () => {
    expect(cornerClickAction(sq, null, [50, 2], 6)).toEqual({ kind: 'wall', i: 0 })
    expect(cornerClickAction(sq, 1, [50, 2], 6)).toEqual({ kind: 'wall', i: 0 })
    expect(cornerClickAction(sq, 0, [50, 2], 6)).toEqual({ kind: 'insert', wall: 0 })
  })
  it('빈 곳 = 선택 해제', () => {
    expect(cornerClickAction(sq, 0, [50, 50], 6)).toEqual({ kind: 'corner', i: null })
  })
})

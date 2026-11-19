import { describe, expect, it } from 'vitest'
import type { Point2 } from '../store/types'
import { HIT_PX, hitPoint, hitRadiusCm, hitSegment, traceClickAction } from './handles'

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
  it('업로드 전·닫힌 뒤에는 아무것도 하지 않는다', () => {
    expect(traceClickAction('upload', 0, [], [5, 5], 6).kind).toBe('none')
    expect(traceClickAction('closed', 2, tri, [50, 50], 6).kind).toBe('none')
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

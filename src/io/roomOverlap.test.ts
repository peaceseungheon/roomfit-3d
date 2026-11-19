import { describe, expect, it } from 'vitest'
import type { Point2 } from '../store/types'
import { roomsOverlap } from './roomOverlap'

const rect = (x0: number, z0: number, x1: number, z1: number): Point2[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
]

// ㄱ자: 오른쪽 아래 [100..200]x[100..200] 이 비어 있는 200x200 방
const L: Point2[] = [
  [0, 0],
  [200, 0],
  [200, 100],
  [100, 100],
  [100, 200],
  [0, 200],
]

describe('roomsOverlap', () => {
  const cases: [string, Point2[], Point2[], boolean][] = [
    ['변을 맞댄 사각형', rect(0, 0, 100, 100), rect(100, 0, 200, 100), false],
    ['꼭짓점 한 점만 닿음', rect(0, 0, 100, 100), rect(100, 100, 200, 200), false],
    ['20cm 떨어짐', rect(0, 0, 100, 100), rect(120, 0, 220, 100), false],
    ['완전히 같은 사각형', rect(0, 0, 100, 100), rect(0, 0, 100, 100), true],
    ['큰 사각형 안의 작은 사각형', rect(0, 0, 300, 300), rect(100, 100, 200, 200), true],
    ['십자 배치', rect(0, 100, 300, 200), rect(100, 0, 200, 300), true],
    ['ㄱ자 홈에 딱 맞음', L, rect(100, 100, 200, 200), false],
    ['ㄱ자 홈을 1cm 침범', L, rect(99, 100, 200, 200), true],
  ]

  it.each(cases)('%s', (_name, a, b, expected) => {
    expect(roomsOverlap(a, b)).toBe(expected)
    expect(roomsOverlap(b, a)).toBe(expected)
  })
})

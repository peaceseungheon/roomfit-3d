import { describe, expect, it } from 'vitest'
import type { Point2, Vec3 } from '../store/types'
import { furnitureDimText, wallDimLabels } from './dimensions'

const item = (ry: number, size: Vec3 = [150, 50, 200]) => ({ size, rotation: [0, ry, 0] as Vec3 })

describe('furnitureDimText', () => {
  it('0/180°는 W × D 그대로', () => {
    expect(furnitureDimText(item(0))).toBe('150 × 200 cm')
    expect(furnitureDimText(item(180))).toBe('150 × 200 cm')
  })
  it('90/270/-90/450°는 가로세로 교환', () => {
    for (const r of [90, 270, -90, 450]) expect(furnitureDimText(item(r))).toBe('200 × 150 cm')
  })
  it('임의 각도는 가까운 90° 배수 기준', () => {
    expect(furnitureDimText(item(30))).toBe('150 × 200 cm')
    expect(furnitureDimText(item(80))).toBe('200 × 150 cm')
  })
  it('소수 치수는 반올림', () => {
    expect(furnitureDimText(item(0, [80.4, 40, 59.5]))).toBe('80 × 60 cm')
  })
})

describe('wallDimLabels', () => {
  const square: Point2[] = [[0, 0], [400, 0], [400, 300], [0, 300]]

  it('변마다 반올림 길이', () => {
    expect(wallDimLabels(square).map((l) => l.text)).toEqual(['400 cm', '300 cm', '400 cm', '300 cm'])
    expect(wallDimLabels([[0, 0], [100.6, 0], [0, 50]])[0].text).toBe('101 cm')
  })
  it('중점에서 바깥쪽으로 띄운다(감김 방향 무관)', () => {
    expect(wallDimLabels(square, 30)[0].at).toEqual([200, -30])
    const rev = wallDimLabels([...square].reverse(), 30) // [0,300]→[400,300]이 첫 변
    expect(rev[0].at).toEqual([200, 330])
  })
  it('길이 0인 변과 퇴화 다각형은 건너뛴다', () => {
    expect(wallDimLabels([[0, 0], [0, 0], [100, 0], [0, 100]])).toHaveLength(3)
    expect(wallDimLabels([[0, 0], [100, 0]])).toEqual([])
  })
})

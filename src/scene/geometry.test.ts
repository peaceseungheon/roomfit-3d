import { describe, expect, it } from 'vitest'
import { createSample } from '../store/sample'
import type { Item, Point2 } from '../store/types'
import { DIMENSION_BOX_TYPE } from '../store/catalog'
import {
  edgeThickness,
  fixtureKind,
  fixtureTransform,
  fixtureTransformIn,
  furnitureMaterialProps,
  furnitureTransform,
  offsetOutward,
  offsetPerEdge,
  pointInPolygon,
  roomBounds,
  roomsBounds,
  signedArea,
  WALL_MERGE_MAX,
  WALL_MIN,
  WALL_THICKNESS,
  wallBand,
} from './geometry'

describe('furnitureMaterialProps', () => {
  it('치수 박스만 반투명·depthWrite 끔, 일반 가구는 불투명', () => {
    expect(furnitureMaterialProps({ modelType: DIMENSION_BOX_TYPE })).toEqual({ transparent: true, opacity: 0.45, depthWrite: false })
    expect(furnitureMaterialProps({ modelType: 'SOFA' })).toEqual({ transparent: false, opacity: 1, depthWrite: true })
  })
})

const rect: Point2[] = [[0, 0], [400, 0], [400, 300], [0, 300]]
const lRoom: Point2[] = [[0, 0], [300, 0], [300, 80], [400, 80], [400, 300], [0, 300]]
const fixture = (modelType: string, x: number, z: number): Item => ({
  id: 'f', type: 'FIXTURE', modelType, position: [x, 0, z], rotation: [0, 0, 0], size: [90, 210, 5],
})
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]))

describe('offsetOutward', () => {
  it('직사각형은 사방으로 t만큼 커진다(감은 방향 무관)', () => {
    const out = offsetOutward(rect, 10)
    expect(out).toEqual([[-10, -10], [410, -10], [410, 310], [-10, 310]])
    const rev = offsetOutward([...rect].reverse(), 10)
    expect(rev).toEqual([[-10, 310], [410, 310], [410, -10], [-10, -10]])
  })
  it('ㄱ자 오목 모서리는 방 밖(잘린 쪽)으로 이동한다', () => {
    const out = offsetOutward(lRoom, 10)
    out.forEach((p, i) => close(p, [[-10, -10], [310, -10], [310, 70], [410, 70], [410, 310], [-10, 310]][i]))
    expect(Math.abs(signedArea(out))).toBeGreaterThan(Math.abs(signedArea(lRoom)))
  })
})

describe('pointInPolygon', () => {
  it('안/밖을 가른다(경계 위 판정은 기존 collision.insidePolygon과 동일)', () => {
    expect(pointInPolygon(rect, 200, 150)).toBe(true)
    expect(pointInPolygon(rect, -1, 150)).toBe(false)
    expect(pointInPolygon(rect, 401, 150)).toBe(false)
    expect(pointInPolygon(lRoom, 350, 20)).toBe(false) // ㄱ자 잘린 쪽
    expect(pointInPolygon(lRoom, 350, 150)).toBe(true)
  })
})

describe('roomBounds', () => {
  it('ㄱ자 외곽 범위', () => {
    expect(roomBounds(lRoom)).toEqual({ minX: 0, maxX: 400, minZ: 0, maxZ: 300 })
  })
})

describe('furnitureTransform', () => {
  it('바닥 중심 → 메시 중심 y=H/2, 도→라디안', () => {
    const bed = createSample().items.find((i) => i.id === 'item_001')!
    const t = furnitureTransform(bed)
    expect(t.position).toEqual([150, 25, 190])
    close(t.rotation, [0, Math.PI / 2, 0])
  })
})

const close9 = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9))
const expectPoints = (got: Point2[], want: number[][]) => {
  expect(got).toHaveLength(want.length)
  got.forEach((p, i) => close9(p, want[i]))
}
const room = (points: Point2[], id = 'r1') => ({ id, name: id, height: 240, points })
const roomAt = (x0: number, z0: number, x1: number, z1: number): Point2[] => [
  [x0, z0], [x1, z0], [x1, z1], [x0, z1],
]

describe('roomsBounds', () => {
  it('모든 방 점의 합집합 경계', () => {
    expect(roomsBounds([room(roomAt(0, 0, 400, 300)), room(roomAt(410, 0, 710, 200), 'r2')]))
      .toEqual({ minX: 0, maxX: 710, minZ: 0, maxZ: 300 })
  })
  it('방이 없으면 0 경계', () => {
    expect(roomsBounds([])).toEqual({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 })
  })
})

describe('edgeThickness', () => {
  const right = (gap: number): Point2[] => roomAt(400 + gap, 0, 800 + gap, 300)
  it('맞닿은 방(간격 0)은 최소 두께, 나머지 변은 최대', () => {
    expect(edgeThickness(rect, [right(0)]))
      .toEqual([WALL_THICKNESS, WALL_MIN, WALL_THICKNESS, WALL_THICKNESS])
  })
  it('간격 절반이 두께가 된다(10→5, 18→9)', () => {
    expect(edgeThickness(rect, [right(10)])[1]).toBeCloseTo(5)
    expect(edgeThickness(rect, [right(18)])[1]).toBeCloseTo(9)
  })
  it('간격 20 이상이면 최대 두께', () => {
    expect(WALL_MERGE_MAX).toBe(20)
    expect(edgeThickness(rect, [right(20)])[1]).toBe(WALL_THICKNESS)
    expect(edgeThickness(rect, [right(30)])[1]).toBe(WALL_THICKNESS)
  })
  it('다른 방이 없으면 모두 최대 두께', () => {
    expect(edgeThickness(rect, [])).toEqual([WALL_THICKNESS, WALL_THICKNESS, WALL_THICKNESS, WALL_THICKNESS])
  })
})

describe('offsetPerEdge', () => {
  it('두께가 모두 10이면 offsetOutward와 좌표가 같다(1e-9)', () => {
    for (const pts of [rect, lRoom]) {
      const out = offsetOutward(pts, WALL_THICKNESS)
      const per = offsetPerEdge(pts, Array(pts.length).fill(WALL_THICKNESS))
      per.forEach((p, i) => close9(p, out[i]))
    }
  })
  it('혼합 두께 [5,10,5,10]은 변별 오프셋 직선의 교점을 쓴다', () => {
    // 위 5, 오른쪽 10, 아래 5, 왼쪽 10
    expectPoints(offsetPerEdge(rect, [5, 10, 5, 10]), [
      [-10, -5], [410, -5], [410, 305], [-10, 305],
    ])
  })
})

const segmentCross = (a: Point2, b: Point2, c: Point2, d: Point2): boolean => {
  const cr = (p: Point2, q: Point2, r: Point2) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  const d1 = cr(a, b, c)
  const d2 = cr(a, b, d)
  const d3 = cr(c, d, a)
  const d4 = cr(c, d, b)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}
const selfIntersects = (pts: Point2[]): boolean => {
  const n = pts.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue
      if (segmentCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true
    }
  }
  return false
}

describe('wallBand', () => {
  it('ㄱ자+이웃 방: 변마다 두께가 다르고 자기 교차가 없다', () => {
    // 이웃은 오른쪽 아래 벽(e3)에서 10cm 떨어져 있다 → 그 변만 5cm
    const band = wallBand(lRoom, [roomAt(410, 80, 810, 300)])
    expectPoints(band, [
      [-10, -10], [310, -10], [310, 70], [405, 70], [405, 310], [-10, 310],
    ])
    expect(Math.abs(signedArea(band))).toBeGreaterThan(Math.abs(signedArea(lRoom)))
    expect(selfIntersects(band)).toBe(false)
  })
})

describe('fixtureTransformIn', () => {
  const A = room(rect)
  const B = room(roomAt(0, 310, 400, 610), 'r2')
  it('방 1개면 fixtureTransform(item, room.points)와 같다', () => {
    const door = createSample().items[0]
    expect(fixtureTransformIn([A], door)).toEqual(fixtureTransform(door, A.points))
  })
  it('이웃 방 벽이 더 가까우면 그 방 기준', () => {
    const outlet = { ...fixture('OUTLET', 200, 700), elevation: 30 }
    expect(fixtureTransformIn([A, B], outlet)).toEqual(fixtureTransform(outlet, B.points))
  })
  it('방이 없으면 원위치·회전 0', () => {
    const t = fixtureTransformIn([], fixture('OUTLET', 55, 77))
    close9([t.position[0], t.position[2]], [55, 77])
    expect(t.rotationY).toBe(0)
  })
})

describe('fixtureTransform', () => {
  it('샘플 문은 x=0 벽에 붙고 벽 방향(z축)으로 선다', () => {
    const door = createSample().items[0]
    const t = fixtureTransform(door, rect)
    close(t.position, [-5, 105, 50])
    // 로컬 x(1,0,0)를 rotationY로 돌린 방향 = (cos, -sin) 이 벽 방향 ±z여야 한다
    close([Math.cos(t.rotationY), -Math.sin(t.rotationY)], [0, -1])
  })
  it('창은 바닥 위 90에서 시작, 가장 가까운 벽(z=300)에 붙는다', () => {
    const t = fixtureTransform({ ...fixture('WINDOW', 200, 280), size: [120, 110, 5] }, rect)
    close(t.position, [200, 145, 305])
  })
  it('벽 끝 밖 좌표는 벽 구간 안으로 clamp', () => {
    const t = fixtureTransform(fixture('OUTLET', 500, -50), rect)
    close([t.position[0], t.position[2]], [400, -5])
  })
  it('종류 판별', () => {
    expect([fixtureKind('DOOR_SINGLE'), fixtureKind('WINDOW'), fixtureKind('OUTLET'), fixtureKind('X')])
      .toEqual(['DOOR', 'WINDOW', 'OUTLET', null])
  })
})

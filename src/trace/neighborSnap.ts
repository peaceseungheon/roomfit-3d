// 이웃 방 스냅(순수). 그리는 점을 이웃 방 바깥 NEIGHBOR_GAP 링의 꼭짓점·변에 붙인다. 길이 cm, 좌표 [x, z].
import { offsetOutward, ROOM_ADD_GAP } from '../scene/geometry'
import type { Point2 } from '../store/types'
import { drawPoint, orthoProject } from './draw'

/** 이웃 스냅 반경(cm). 이 거리 이하(<=)면 붙는다. */
export const SNAP_RADIUS = 15
/** 이웃 방 바깥 링까지의 간격(cm). 공유 벽 두께와 같다. */
export const NEIGHBOR_GAP = ROOM_ADD_GAP

export type NeighborHit =
  | { kind: 'vertex'; point: Point2; room: number; vertex: number }
  | { kind: 'edge'; point: Point2; room: number; edge: [Point2, Point2] }

const EPS = 1e-9

/** 기존 방(문서 좌표 또는 평면 좌표)들의 스냅 링. */
export const snapRings = (ghosts: Point2[][], gap = NEIGHBOR_GAP): Point2[][] => ghosts.map((g) => offsetOutward(g, gap))

/** p에서 선분 a-b까지 가장 가까운 점. 길이 0이면 null. */
function closestOnSegment(p: Point2, a: Point2, b: Point2): Point2 | null {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const len2 = dx * dx + dz * dz
  if (len2 < EPS) return null
  const t = Math.min(Math.max(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2, 0), 1)
  return [a[0] + dx * t, a[1] + dz * t]
}

const dist = (a: Point2, b: Point2) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** 직전 점 prev를 지나는 수평(horizontal)/수직선과 선분 a-b의 교점. 평행이거나 선분 밖이면 null. */
function orthoIntersect(prev: Point2, horizontal: boolean, a: Point2, b: Point2): Point2 | null {
  const axis = horizontal ? 1 : 0
  const d = b[axis] - a[axis]
  if (Math.abs(d) < EPS) return null
  const t = (prev[axis] - a[axis]) / d
  if (t < 0 || t > 1) return null
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/**
 * 점 확정: 직각 보정 -> 격자 스냅(drawPoint) -> 이웃 스냅(꼭짓점 > 변). 이웃에 잡히면 격자 결과를 덮어쓴다.
 * 직각 켜짐이면 고정 축은 직전 점 값을 유지한다. hit은 잡힌 대상, 없으면 null.
 */
export function placeDrawPoint(
  prev: Point2 | null,
  cursor: Point2,
  o: { ortho: boolean; step: number; rings: Point2[][]; neighbor: boolean },
): { point: Point2; hit: NeighborHit | null } {
  const grid = drawPoint(prev, cursor, o.ortho, o.step)
  if (!o.neighbor || o.rings.length === 0) return { point: grid, hit: null }
  const ortho = o.ortho && prev !== null
  const c = ortho ? orthoProject(prev, cursor) : cursor
  const horizontal = ortho && Math.abs(cursor[0] - prev[0]) >= Math.abs(cursor[1] - prev[1])

  let vBest: { room: number; vertex: number; d: number } | null = null
  let eBest: { room: number; edge: [Point2, Point2]; d: number } | null = null
  o.rings.forEach((ring, room) => {
    ring.forEach((v, i) => {
      const d = dist(c, v)
      if (d <= SNAP_RADIUS && (!vBest || d < vBest.d)) vBest = { room, vertex: i, d }
      const b = ring[(i + 1) % ring.length]
      const q = closestOnSegment(c, v, b)
      if (!q) return
      const de = dist(c, q)
      if (de <= SNAP_RADIUS && (!eBest || de < eBest.d)) eBest = { room, edge: [v, b], d: de }
    })
  })

  if (vBest) {
    const { room, vertex } = vBest as { room: number; vertex: number }
    const v = o.rings[room][vertex]
    const point: Point2 = !ortho ? [v[0], v[1]] : horizontal ? [v[0], prev[1]] : [prev[0], v[1]]
    return { point, hit: { kind: 'vertex', point, room, vertex } }
  }
  if (eBest) {
    const { room, edge } = eBest as { room: number; edge: [Point2, Point2] }
    const point = ortho ? orthoIntersect(prev, horizontal, edge[0], edge[1]) : closestOnSegment(grid, edge[0], edge[1])
    if (point && dist(c, point) <= SNAP_RADIUS) return { point, hit: { kind: 'edge', point, room, edge } }
  }
  return { point: grid, hit: null }
}

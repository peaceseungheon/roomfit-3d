// 씬 순수 로직. 1unit=1cm, points는 [x, z], rotation은 도(렌더링 시점에만 라디안).
import { DEFAULT_ELEVATION, isDimensionBox } from '../store/catalog'
import type { Item, Point2, Room, RoomShape, Vec3 } from '../store/types'

/** 벽 두께(cm). 스키마에 없어 씬 상수로 둔다. 벽은 방 points(실내 경계) 바깥쪽으로 두껍다. */
export const WALL_THICKNESS = 10

/** 방 추가 간격(cm). 벽 두께와 같아 두 방의 벽 띠가 하나로 보인다. */
export const ROOM_ADD_GAP = WALL_THICKNESS

/** 방 사이 간격이 이하면 하나의 벽으로 그린다(cm). 벽 두 장 두께. */
export const WALL_MERGE_MAX = 2 * WALL_THICKNESS
/** 벽 렌더 최소 두께(cm). 맞닿은 방(간격 0)에서 양쪽 띠가 사라지지 않게 한다. */
export const WALL_MIN = 0.1

const DEG = Math.PI / 180

/** 신발끈 공식 부호 면적. (x, z) 평면 기준. */
export function signedArea(points: Point2[]): number {
  let s = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, z1] = points[i]
    const [x2, z2] = points[(i + 1) % points.length]
    s += x1 * z2 - x2 * z1
  }
  return s / 2
}

/** 변 a→b의 바깥쪽 단위 법선. sign은 signedArea 부호. */
export function outwardNormal(a: Point2, b: Point2, sign: number): Point2 {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const len = Math.hypot(dx, dz) || 1
  return sign >= 0 ? [dz / len, -dx / len] : [-dz / len, dx / len]
}

/** 실내 경계를 바깥으로 t만큼 마이터 오프셋한 다각형(볼록·오목 모서리 모두, ㄱ자 포함). */
export function offsetOutward(points: Point2[], t: number): Point2[] {
  const n = points.length
  const sign = Math.sign(signedArea(points))
  return points.map((v, i) => {
    const prev = points[(i - 1 + n) % n]
    const next = points[(i + 1) % n]
    const n1 = outwardNormal(prev, v, sign)
    const n2 = outwardNormal(v, next, sign)
    const k = t / (1 + n1[0] * n2[0] + n1[1] * n2[1])
    return [v[0] + (n1[0] + n2[0]) * k, v[1] + (n1[1] + n2[1]) * k]
  })
}

const EPS = 1e-9

/** 변별 오프셋 마이터: 꼭짓점 앞뒤 변의 오프셋 직선이 만나는 점. 두께 배열은 변 인덱스(points[i]→points[i+1]) 기준. */
export function offsetPerEdge(points: Point2[], t: number[]): Point2[] {
  const n = points.length
  const sign = Math.sign(signedArea(points))
  const dirs = points.map((a, i): Point2 => {
    const b = points[(i + 1) % n]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
  })
  const normals = points.map((a, i) => outwardNormal(a, points[(i + 1) % n], sign))
  return points.map((v, i) => {
    const prev = (i - 1 + n) % n
    const [u1, u2] = [dirs[prev], dirs[i]]
    const [n1, n2] = [normals[prev], normals[i]]
    const [d1, d2] = [t[prev], t[i]]
    const denom = u1[0] * u2[1] - u1[1] * u2[0]
    // 일직선(또는 길이 0) 변: 이전 변 오프셋만 적용
    if (Math.abs(denom) < EPS) return [v[0] + n1[0] * d1, v[1] + n1[1] * d1]
    const dx = d2 * n2[0] - d1 * n1[0]
    const dz = d2 * n2[1] - d1 * n1[1]
    const alpha = (dx * u2[1] - dz * u2[0]) / denom
    return [v[0] + alpha * u1[0] + d1 * n1[0], v[1] + alpha * u1[1] + d1 * n1[1]]
  })
}

/** 변 중점에서 바깥 법선 반직선이 다른 방 경계에 닿는 거리. 없으면 null. */
function gapOutward(mid: Point2, dir: Point2, others: readonly Point2[][]): number | null {
  let best = Infinity
  for (const poly of others) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]
      const q = poly[(i + 1) % poly.length]
      const ex = q[0] - p[0]
      const ez = q[1] - p[1]
      const denom = dir[0] * ez - dir[1] * ex
      if (Math.abs(denom) < EPS) continue
      const wx = p[0] - mid[0]
      const wz = p[1] - mid[1]
      const u = (wx * ez - wz * ex) / denom
      const s = (wx * dir[1] - wz * dir[0]) / denom
      if (u >= -EPS && u <= WALL_MERGE_MAX && s >= -EPS && s <= 1 + EPS && u < best) best = u
    }
  }
  return best === Infinity ? null : Math.max(best, 0)
}

/**
 * 변마다 중점 광선으로 이웃 방까지 간격을 재고 절반(최소·최대 clamp)을 두께로 쓴다.
 * ponytail: 변 중점 광선 하나로 변 전체 두께를 정한다. 이웃과 일부만 마주친 변(T자)은
 * 비인접 구간까지 g/2로 얇아질 수 있고, 간격 0은 양쪽 0.1cm 띠(합 0.2cm)가 남는다.
 * 필요해지면 이웃 코너 투영점으로 변을 분할한다.
 */
export function edgeThickness(points: Point2[], others: readonly Point2[][]): number[] {
  const n = points.length
  const sign = Math.sign(signedArea(points))
  return points.map((a, i) => {
    const b = points[(i + 1) % n]
    const mid: Point2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const g = gapOutward(mid, outwardNormal(a, b, sign), others)
    return g === null ? WALL_THICKNESS : Math.min(Math.max(g / 2, WALL_MIN), WALL_THICKNESS)
  })
}

/** 방 하나의 벽 띠 다각형(실내 경계 바깥). */
export function wallBand(points: Point2[], others: readonly Point2[][]): Point2[] {
  return offsetPerEdge(points, edgeThickness(points, others))
}

export interface Bounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export function roomBounds(points: Point2[]): Bounds {
  const xs = points.map((p) => p[0])
  const zs = points.map((p) => p[1])
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
}

/** 모든 방 점의 합집합 경계. 방이 없으면 0 경계. */
export function roomsBounds(rooms: readonly RoomShape[]): Bounds {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const room of rooms) {
    for (const [x, z] of room.points) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    }
  }
  return minX === Infinity ? { minX: 0, maxX: 0, minZ: 0, maxZ: 0 } : { minX, maxX, minZ, maxZ }
}

/** 가구 블록 변환. position은 바닥 중심, 메시 중심은 y=H/2. */
export function furnitureTransform(item: Item): { position: Vec3; rotation: Vec3 } {
  const [x, , z] = item.position
  const [rx, ry, rz] = item.rotation
  return { position: [x, item.size[1] / 2, z], rotation: [rx * DEG, ry * DEG, rz * DEG] }
}

/** 치수 박스는 반투명(AC-08-8/AC-09-5). depthWrite를 끄면 뒤 가구가 가려지지 않는다. 레이캐스트는 머티리얼과 무관하다. */
export const DIMENSION_BOX_OPACITY = 0.45
export function furnitureMaterialProps(item: Pick<Item, 'modelType'>) {
  return isDimensionBox(item)
    ? { transparent: true, opacity: DIMENSION_BOX_OPACITY, depthWrite: false }
    : { transparent: false, opacity: 1, depthWrite: true }
}

export type FixtureKind ='DOOR' | 'WINDOW' | 'OUTLET'

/** modelType 접두어로 종류 판별. 모르는 값은 문으로 취급하지 않고 null. */
export function fixtureKind(modelType: string): FixtureKind | null {
  if (modelType.startsWith('DOOR')) return 'DOOR'
  if (modelType.startsWith('WINDOW')) return 'WINDOW'
  if (modelType.startsWith('OUTLET')) return 'OUTLET'
  return null
}

export interface WallHit {
  /** points[i]→points[i+1] 변 인덱스(edgeThickness·wallBand와 같은 기준) */
  index: number
  /** 벽 시작점과 단위 방향 */
  a: Point2
  dir: Point2
  len: number
  /** 시작점에서 투영점까지 거리(0~len) */
  s: number
  /** 점과 벽 구간 사이 거리 */
  dist: number
  /** 바깥쪽 단위 법선 */
  normal: Point2
}

/** 고정 요소 폭 vs 벽 길이 비교 허용오차(cm). NO_SPACE와 relocateFixtures가 공유 */
export const FIT_EPS = 1e-6

/** (x, z)에서 가장 가까운 벽 구간과 그 위 투영. 길이 0인 변은 건너뛴다. */
export function nearestWall(points: Point2[], x: number, z: number): WallHit | null {
  const sign = Math.sign(signedArea(points))
  let best: WallHit | null = null
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (len === 0) continue
    const dir: Point2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
    const s = Math.min(Math.max((x - a[0]) * dir[0] + (z - a[1]) * dir[1], 0), len)
    const dist = Math.hypot(x - (a[0] + dir[0] * s), z - (a[1] + dir[1] * s))
    if (!best || dist < best.dist) best = { index: i, a, dir, len, s, dist, normal: outwardNormal(a, b, sign) }
  }
  return best
}

/** 반직선 교차(짝수-홀수) 점-다각형 판정. 경계 위 점은 어느 쪽이든 될 수 있으므로 호출부가 EPS만큼 안쪽 점을 넘긴다. */
export function pointInPolygon(points: Point2[], x: number, z: number): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, zi] = points[i]
    const [xj, zj] = points[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

export interface RoomWallHit {
  room: Room
  roomIndex: number
  wall: WallHit
}

/** 모든 방의 변 중 가장 가까운 벽. 거리 차 1cm 이내면 배열 앞쪽 방(결정적 규칙). */
export function nearestWallIn(rooms: readonly Room[], x: number, z: number): RoomWallHit | null {
  let best: RoomWallHit | null = null
  for (let roomIndex = 0; roomIndex < rooms.length; roomIndex++) {
    const room = rooms[roomIndex]
    const wall = nearestWall(room.points, x, z)
    if (wall && (!best || wall.dist < best.wall.dist - 1)) best = { room, roomIndex, wall }
  }
  return best
}

/**
 * 고정 요소를 가장 가까운 벽에 붙인 변환. 저장 rotation 대신 벽 방향을 쓴다(로컬 x = 벽 방향).
 * 위치는 벽 두께 중앙. 높이는 size[1], 바닥 위 높이는 elevation 또는 카탈로그 기본값.
 */
export function fixtureTransform(
  item: Item,
  points: Point2[],
  t = WALL_THICKNESS,
): { position: Vec3; rotationY: number } {
  const kind = fixtureKind(item.modelType) ?? 'DOOR'
  const px = item.position[0]
  const pz = item.position[2]
  const w = nearestWall(points, px, pz)
  const x = w ? w.a[0] + w.dir[0] * w.s : px
  const z = w ? w.a[1] + w.dir[1] * w.s : pz
  const [nx, nz] = w ? w.normal : [0, 0]
  const sill = kind === 'DOOR' ? 0 : (item.elevation ?? DEFAULT_ELEVATION[kind] ?? 0) // 문은 elevation 무시
  return {
    position: [x + (nx * t) / 2, sill + item.size[1] / 2, z + (nz * t) / 2],
    rotationY: w ? Math.atan2(-w.dir[1], w.dir[0]) : 0,
  }
}

/**
 * 여러 방 중 가장 가까운 벽(호스트 방) 기준 고정 요소 변환. 방이 없으면 원위치.
 * 깊이는 호스트 변의 실제 벽 띠 두께(edgeThickness)를 쓴다 — 10cm 간격 이웃 벽(띠 5cm)에서
 * 문이 벽 밖으로 떠 보이지 않게 한다.
 */
export function fixtureTransformIn(
  rooms: readonly Room[],
  item: Item,
): { position: Vec3; rotationY: number } {
  const host = nearestWallIn(rooms, item.position[0], item.position[2])
  if (!host) return fixtureTransform(item, [])
  const others = rooms.filter((r) => r.id !== host.room.id).map((r) => r.points)
  return fixtureTransform(item, host.room.points, edgeThickness(host.room.points, others)[host.wall.index])
}

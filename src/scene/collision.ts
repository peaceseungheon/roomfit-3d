// 간섭 판정 순수 로직(FR-11). 1unit=1cm, 방 좌표 (x, z) = 월드 (x, z).
// 경고만 계산한다. 배치·이동을 막는 데 쓰지 않는다(AC-11-2).
import { Box3, Vector3 } from 'three'
import type { Item, Point2, Room } from '../store/types'
import {
  FIT_EPS,
  WALL_THICKNESS,
  fixtureKind,
  fixtureTransform,
  nearestWall,
  nearestWallIn,
  pointInPolygon,
  type RoomWallHit,
} from './geometry'

export type WarningKind = 'ITEM' | 'DOOR_SWING' | 'WALL' | 'FIXTURE_OVERLAP' | 'NO_SPACE'

/**
 * 경고 1건. 쌍 간섭(ITEM, FIXTURE_OVERLAP)은 쌍마다 1건이며 items 배열에서 앞선 쪽이 itemId.
 * DOOR_SWING: itemId=가구, otherId=문. WALL: otherId 없음.
 * NO_SPACE: 문·창이 가장 가까운 벽보다 넓어 들어갈 자리가 없음(AC-05-4). itemId=고정 요소, otherId 없음.
 */
export interface Warning {
  itemId: string
  kind: WarningKind
  otherId?: string
}

/**
 * 접촉 허용 오차(cm). 면이 딱 맞닿기만 한 경우(벽에 붙인 가구, 나란히 붙인 가구)는 간섭이 아니다.
 * Box3.intersectsBox는 경계가 같아도 참이므로 한쪽 박스를 이만큼 줄여 판정한다.
 * 1cm 스냅에서도 실제 겹침(≥1cm)은 잡힌다.
 */
export const CONTACT_EPS = 0.5

export type DoorDirection = 'LEFT_IN' | 'RIGHT_IN' | 'LEFT_OUT' | 'RIGHT_OUT'
export const DEFAULT_SWING_ANGLE = 90

export interface Swing {
  /** 경첩 위치 [x, z] */
  hinge: Point2
  radius: number
  /** 라디안 */
  angle: number
  /** 닫힌 문 방향(경첩→문 끝)과 열리는 쪽 법선. 부채꼴 = hinge + r(cos t·u + sin t·v), t∈[0, angle] */
  u: Point2
  v: Point2
  outward: boolean
}

const DEG = Math.PI / 180

/**
 * 가구 월드 박스. y는 0~H.
 * 회전은 y축(rotation[1])만 반영하고, 회전된 직사각형을 감싸는 축 정렬 박스(AABB)로 근사한다.
 * 90° 배수가 아니면 실제보다 크게 잡혀 대각선 근처에서 거짓 경고가 날 수 있다.
 */
export function furnitureBox(item: Item, out = new Box3()): Box3 {
  const [w, h, d] = item.size
  const r = item.rotation[1] * DEG
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  const hx = (c * w + s * d) / 2
  const hz = (s * w + c * d) / 2
  const [x, , z] = item.position
  out.min.set(x - hx, 0, z - hz)
  out.max.set(x + hx, h, z + hz)
  return out
}

/**
 * 문 열림 부채꼴. doorSwing이 없으면 LEFT_IN, 반경=문 폭, 90°.
 * 좌/우 기준: 방 안에서 문을 바라볼 때 경첩이 왼쪽이면 LEFT(실내·실외 공통).
 * 벽을 못 찾으면 null.
 */
export function doorSwing(door: Item, points: Point2[]): Swing | null {
  const w = nearestWall(points, door.position[0], door.position[2])
  if (!w) return null
  const dir = (door.doorSwing?.direction ?? 'LEFT_IN') as string
  const outward = dir.endsWith('_OUT')
  const right = dir.startsWith('RIGHT')
  const [nx, nz] = w.normal
  // 실내에서 바깥(+normal)을 바라볼 때 왼쪽 = (nz, -nx)
  const left: Point2 = right ? [-nz, nx] : [nz, -nx]
  const cx = w.a[0] + w.dir[0] * w.s
  const cz = w.a[1] + w.dir[1] * w.s
  const half = door.size[0] / 2
  const radius = door.doorSwing?.radius ?? door.size[0]
  const angle = (door.doorSwing?.angle ?? DEFAULT_SWING_ANGLE) * DEG
  return {
    hinge: [cx + left[0] * half, cz + left[1] * half],
    radius,
    angle,
    u: [-left[0], -left[1]],
    v: outward ? [nx, nz] : [-nx, -nz],
    outward,
  }
}

const at = (s: Swing, t: number): Point2 => [
  s.hinge[0] + s.radius * (Math.cos(t) * s.u[0] + Math.sin(t) * s.v[0]),
  s.hinge[1] + s.radius * (Math.cos(t) * s.u[1] + Math.sin(t) * s.v[1]),
]

/** 렌더링용 부채꼴 다각형 [경첩, 호...]. */
export function swingPolygon(s: Swing, segments = 24): Point2[] {
  const pts: Point2[] = [s.hinge]
  for (let i = 0; i <= segments; i++) pts.push(at(s, (s.angle * i) / segments))
  return pts
}

/** 부채꼴을 감싸는 Box3(AC-11-6). 호의 양 끝과 x·z 극값만 넣으므로 정확한 AABB다. y는 0~height. */
export function swingBox(s: Swing, height: number, out = new Box3()): Box3 {
  const ts = [0, s.angle]
  for (const base of [Math.atan2(s.v[0], s.u[0]), Math.atan2(s.v[1], s.u[1])]) {
    for (const t of [base, base + Math.PI, base - Math.PI, base + 2 * Math.PI]) {
      if (t > 0 && t < s.angle) ts.push(t)
    }
  }
  out.makeEmpty()
  const p = new Vector3()
  out.expandByPoint(p.set(s.hinge[0], 0, s.hinge[1]))
  for (const t of ts) {
    const [x, z] = at(s, t)
    out.expandByPoint(p.set(x, height, z))
  }
  out.min.y = 0
  out.max.y = height
  return out
}

/**
 * 가구 바닥 박스가 방 안에 온전히 있는지(벽 간섭·방 밖, AC-11-5).
 * 박스 네 모서리가 모두 방 안이고 방 꼭짓점이 박스 안에 없으면 안에 있다(ㄱ자·빗변 포함 정확).
 * 벽은 실내 경계 바깥에 있으므로 "방 밖으로 삐져나감" = "벽 침범"이다.
 */
function insideRoom(points: Point2[], b: Box3): boolean {
  const x0 = b.min.x + CONTACT_EPS
  const x1 = b.max.x - CONTACT_EPS
  const z0 = b.min.z + CONTACT_EPS
  const z1 = b.max.z - CONTACT_EPS
  const corners: Point2[] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
  if (!corners.every(([x, z]) => pointInPolygon(points, x, z))) return false
  return !points.some(([x, z]) => x > x0 && x < x1 && z > z0 && z < z1)
}

/** 접촉만 하는 경우를 빼고 겹치는지. */
function overlaps(a: Box3, b: Box3, tmp: Box3): boolean {
  return tmp.copy(a).expandByScalar(-CONTACT_EPS).intersectsBox(b)
}

/** 같은 벽 위 문/창 박스. 호스트 방 벽 방향 길이 = 폭, y = 실제 높이 구간. 벽 키에 roomIndex를 넣어 방이 다르면 분리한다. */
function fixtureBox(item: Item, rooms: Room[]): { box: Box3; wall: string } | null {
  const host = nearestWallIn(rooms, item.position[0], item.position[2])
  if (!host) return null
  const w = host.wall
  const { position } = fixtureTransform(item, host.room.points)
  const half = item.size[0] / 2
  const hx = Math.abs(w.dir[0]) * half + Math.abs(w.normal[0]) * (WALL_THICKNESS / 2)
  const hz = Math.abs(w.dir[1]) * half + Math.abs(w.normal[1]) * (WALL_THICKNESS / 2)
  const hy = item.size[1] / 2
  const box = new Box3(
    new Vector3(position[0] - hx, position[1] - hy, position[2] - hz),
    new Vector3(position[0] + hx, position[1] + hy, position[2] + hz),
  )
  return { box, wall: `${host.roomIndex}|${w.a[0]},${w.a[1]},${w.dir[0]},${w.dir[1]}` }
}

/**
 * 현재 문서의 경고 목록.
 * WALL은 어느 한 방에도 온전히 들어가지 않을 때 1건. ITEM은 방과 무관한 전역 쌍.
 * 문·창·고정 요소는 모든 방 중 가장 가까운 벽(nearestWallIn)을 호스트로 쓴다.
 * ponytail: 쌍 판정 O(n²). 가구 수십 개(50개 ≈ 1.2천 쌍)는 드래그 프레임당 1ms 미만, 수백 개면 공간 분할로.
 */
export function computeWarnings(rooms: Room[], items: Item[]): Warning[] {
  const out: Warning[] = []
  const tmp = new Box3()
  const furniture = items.filter((it) => it.type === 'FURNITURE')
  const boxes = furniture.map((it) => furnitureBox(it))

  furniture.forEach((it, i) => {
    if (!rooms.some((r) => insideRoom(r.points, boxes[i]))) out.push({ itemId: it.id, kind: 'WALL' })
    for (let j = i + 1; j < furniture.length; j++) {
      if (overlaps(boxes[i], boxes[j], tmp)) out.push({ itemId: it.id, kind: 'ITEM', otherId: furniture[j].id })
    }
  })

  const fixtures = items.filter((it) => it.type === 'FIXTURE')
  const hosts = new Map<string, RoomWallHit | null>()
  for (const fx of fixtures) {
    const host = nearestWallIn(rooms, fx.position[0], fx.position[2])
    hosts.set(fx.id, host)
    if (host && host.wall.len < fx.size[0] - FIT_EPS) out.push({ itemId: fx.id, kind: 'NO_SPACE' }) // relocateFixtures의 unfit과 같은 기준
  }
  for (const door of fixtures) {
    if (fixtureKind(door.modelType) !== 'DOOR') continue
    const host = hosts.get(door.id)
    const s = host ? doorSwing(door, host.room.points) : null
    if (!s || s.outward) continue // 실외 부채꼴은 판정 제외(AC-07-3)
    const sb = swingBox(s, door.size[1])
    furniture.forEach((it, i) => {
      if (overlaps(boxes[i], sb, tmp)) out.push({ itemId: it.id, kind: 'DOOR_SWING', otherId: door.id })
    })
  }

  // AC-06-4: 같은 벽 문/창끼리 겹침. 콘센트는 제외.
  const openings = fixtures
    .filter((it) => {
      const k = fixtureKind(it.modelType)
      return k === 'DOOR' || k === 'WINDOW'
    })
    .map((it) => ({ it, fb: fixtureBox(it, rooms) }))
  openings.forEach(({ it, fb }, i) => {
    for (let j = i + 1; j < openings.length; j++) {
      const o = openings[j]
      if (fb && o.fb && fb.wall === o.fb.wall && overlaps(fb.box, o.fb.box, tmp)) {
        out.push({ itemId: it.id, kind: 'FIXTURE_OVERLAP', otherId: o.it.id })
      }
    }
  })
  return out
}

/** 하이라이트 대상 id(경고의 양쪽 모두). */
export function warnedIds(warnings: Warning[]): Set<string> {
  const ids = new Set<string>()
  for (const w of warnings) {
    ids.add(w.itemId)
    if (w.otherId) ids.add(w.otherId)
  }
  return ids
}

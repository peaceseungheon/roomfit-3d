// 평면도 트레이싱·모서리 편집 순수 로직(FR-04, FR-05). 길이 cm, 좌표 [x, z], 이미지 y -> 방 z.
import { ROOM_MAX, validateRoom } from '../io/validate'
import { FIT_EPS, nearestWall, outwardNormal, signedArea } from '../scene/geometry'
import type { Item, Point2 } from '../store/types'

/** 이미지 용량 상한. PRD에 수치가 없어 10MB로 둔다(보고 사항). */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024
/** 디코딩 후 픽셀 수 상한(width*height). 압축률 높은 이미지로 메모리를 소진하는 것을 막는다. PRD에 없는 임의값. */
export const IMAGE_MAX_PIXELS = 30_000_000
/** 벽 길이 입력 하한(cm). PRD에 없는 임의값. */
export const WALL_MIN = 10
/** 트레이싱으로 만든 방의 기본 천장고(wireframes S-04). */
export const TRACE_DEFAULT_HEIGHT = 230

export type Check<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

// ---- AC-04-1 이미지 ----
export function validateImage(f: { type: string; size: number }): string | null {
  if (f.type !== 'image/png' && f.type !== 'image/jpeg') return 'PNG 또는 JPG만 올릴 수 있습니다'
  if (!(f.size > 0)) return '빈 파일입니다'
  if (f.size > IMAGE_MAX_BYTES) return `이미지는 ${IMAGE_MAX_BYTES / 1024 / 1024}MB 이하만 올릴 수 있습니다`
  return null
}

// ---- AC-04-2 축척 ----
/** 이미지 픽셀 두 점 + 실제 길이(cm) -> cm/px. 0·음수·NaN·상한 초과 거부. */
export function computeScale(p1: Point2, p2: Point2, realCm: number): Check<number> {
  if (![...p1, ...p2].every(Number.isFinite)) return fail('기준선 점이 올바르지 않습니다')
  const px = Math.hypot(p2[0] - p1[0], p2[1] - p1[1])
  if (!(px > 0)) return fail('기준선의 두 점이 같습니다')
  if (!Number.isFinite(realCm) || realCm <= 0) return fail('실제 길이는 0보다 큰 숫자여야 합니다')
  if (realCm > ROOM_MAX) return fail(`실제 길이는 ${ROOM_MAX}cm 이하여야 합니다`)
  return { ok: true, value: realCm / px }
}

/** 이미지 픽셀 -> 트레이싱 평면(cm). x->x, y->z. */
export const pxToCm = (p: Point2, scale: number): Point2 => [p[0] * scale, p[1] * scale]
export const cmToPx = (p: Point2, scale: number): Point2 => [p[0] / scale, p[1] / scale]

/** 이미지를 평면에 놓는 사각형(모서리 원점). 5b가 이미지 평면 크기·위치에 쓴다. */
export function imageRect(w: number, h: number, scale: number) {
  return { x: 0, z: 0, width: w * scale, depth: h * scale }
}

// ---- 선분 교차 ----
const cross = (o: Point2, a: Point2, b: Point2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
const onSeg = (a: Point2, b: Point2, p: Point2) =>
  Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1])

/** 두 선분이 한 점이라도 공유하면 true(끝점 접촉 포함). */
export function segmentsTouch(a: Point2, b: Point2, c: Point2, d: Point2): boolean {
  const d1 = cross(a, b, c)
  const d2 = cross(a, b, d)
  const d3 = cross(c, d, a)
  const d4 = cross(c, d, b)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true
  return (d1 === 0 && onSeg(a, b, c)) || (d2 === 0 && onSeg(a, b, d)) || (d3 === 0 && onSeg(c, d, a)) || (d4 === 0 && onSeg(c, d, b))
}

/**
 * 자기 교차하는 선분 쌍 [i, j](선분 i = points[i]->points[i+1]). closed=false면 마지막->처음 선분 제외.
 * 인접 선분은 공유 꼭짓점 접촉만 허용하고, 되접힘(겹침)은 교차로 본다.
 */
export function findIntersections(points: Point2[], closed = true): [number, number][] {
  const n = points.length
  const segs = closed ? n : n - 1
  const out: [number, number][] = []
  for (let i = 0; i < segs; i++) {
    for (let j = i + 1; j < segs; j++) {
      const a = points[i]
      const b = points[(i + 1) % n]
      const c = points[j]
      const d = points[(j + 1) % n]
      const adjacent = j === i + 1 || (closed && i === 0 && j === segs - 1)
      if (adjacent) {
        // 공유점 s, 나머지 끝점 u(i쪽), v(j쪽). 같은 방향 되접힘이면 겹친다.
        const [s, u, v] = j === i + 1 ? [b, a, d] : [a, b, c]
        const o = (u[0] - s[0]) * (v[1] - s[1]) - (u[1] - s[1]) * (v[0] - s[0])
        const dot = (u[0] - s[0]) * (v[0] - s[0]) + (u[1] - s[1]) * (v[1] - s[1])
        if (o === 0 && dot > 0) out.push([i, j])
      } else if (segmentsTouch(a, b, c, d)) out.push([i, j])
    }
  }
  return out
}

const hasDuplicate = (p: Point2[]) => p.some((a, i) => p.some((b, j) => i < j && a[0] === b[0] && a[1] === b[1]))

// ---- AC-04-3/4 닫기, room.points 변환 ----
export const canClose = (n: number) => n >= 3

/** 정규화 규약: signedArea > 0(프리셋과 같은 방향), 최소 좌표가 (0,0), 1cm 반올림. */
export function toRoomPoints(points: Point2[]): Point2[] {
  const minX = Math.min(...points.map((p) => p[0]))
  const minZ = Math.min(...points.map((p) => p[1]))
  const moved = points.map((p): Point2 => [Math.round(p[0] - minX), Math.round(p[1] - minZ)])
  return signedArea(moved) < 0 ? moved.reverse() : moved
}

export interface CloseError {
  message: string
  /** 교차 선분 쌍. 입력 순서가 아니라 closePolygon 내부 정규화(반전될 수 있음) 순서의 인덱스라 화면 점 순서와 다를 수 있다. 화면 표시는 findIntersections를 다시 계산한다. 교차가 원인이 아니면 빈 배열 */
  crossings: [number, number][]
}

/** 방 상한·점 수·교차·퇴화를 검사해 room.points를 만든다. points는 cm. */
export function closePolygon(points: Point2[]): { ok: true; value: Point2[] } | ({ ok: false } & CloseError) {
  const bad = (message: string, crossings: [number, number][] = []) => ({ ok: false as const, message, crossings })
  if (!canClose(points.length)) return bad('점을 3개 이상 찍어야 닫을 수 있습니다')
  if (!points.every((p) => p.every(Number.isFinite))) return bad('점 좌표가 올바르지 않습니다')
  const room = toRoomPoints(points)
  if (hasDuplicate(room)) return bad('겹치는 점이 있습니다')
  const crossings = findIntersections(room)
  if (crossings.length) return bad('선이 서로 교차합니다. 교차한 구간을 고쳐 주세요', crossings)
  if (signedArea(room) === 0) return bad('면적이 없는 도형입니다')
  const errs = validateRoom({ height: TRACE_DEFAULT_HEIGHT, points: room })
  if (errs.length) return bad(errs[0].message)
  return { ok: true, value: room }
}

// ---- FR-05 모서리 편집 ----
const snapTo = (v: number, step: number) => Math.round(v / step) * step

/** 점 i를 (x, z)로 옮긴 새 배열(스냅 step). 범위 밖 인덱스·비유한수는 null. */
export function movePoint(points: Point2[], i: number, x: number, z: number, step = 1): Point2[] | null {
  if (!points[i] || !Number.isFinite(x) || !Number.isFinite(z)) return null
  return points.map((p, k): Point2 => (k === i ? [snapTo(x, step), snapTo(z, step)] : p))
}

/** 편집 결과 검사. 문제 없으면 null, 있으면 사용자 문구(교차·상한·겹침). */
export function editError(points: Point2[]): string | null {
  if (hasDuplicate(points)) return '꼭짓점이 겹칩니다'
  if (findIntersections(points).length) return '벽이 서로 교차해 편집을 취소했습니다'
  const errs = validateRoom({ height: TRACE_DEFAULT_HEIGHT, points })
  return errs.length ? errs[0].message : null
}

/** 벽 i(points[i]->points[i+1])의 길이를 len으로 맞추도록 끝점(i+1)을 벽 방향으로 이동(AC-05-2). */
export function setWallLength(points: Point2[], i: number, len: number): Check<Point2[]> {
  const a = points[i]
  const b = points[(i + 1) % points.length]
  if (!a || !b) return fail('벽을 찾을 수 없습니다')
  if (!Number.isFinite(len) || len < WALL_MIN || len > ROOM_MAX) return fail(`벽 길이는 ${WALL_MIN}~${ROOM_MAX}cm 숫자여야 합니다`)
  const cur = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (cur === 0) return fail('길이가 0인 벽입니다')
  const k = len / cur
  const nb: Point2 = [Math.round((a[0] + (b[0] - a[0]) * k) * 10) / 10, Math.round((a[1] + (b[1] - a[1]) * k) * 10) / 10]
  const idx = (i + 1) % points.length
  return { ok: true, value: points.map((p, j): Point2 => (j === idx ? nb : p)) }
}

/**
 * 모서리 편집 후 고정 요소를 가장 가까운 벽 위로 옮긴다(AC-05-4). 벽보다 폭이 큰 요소는 그대로 두고 unfit에 id를 담는다.
 * 이미 벽 위에 맞게 있으면 같은 객체를 돌려준다.
 */
export function relocateFixtures(points: Point2[], items: Item[]): { items: Item[]; unfit: string[] } {
  const unfit: string[] = []
  const next = items.map((it) => {
    if (it.type !== 'FIXTURE') return it
    const hit = nearestWall(points, it.position[0], it.position[2])
    if (!hit) return it
    const half = it.size[0] / 2
    if (hit.len < it.size[0] - FIT_EPS) {
      unfit.push(it.id)
      return it
    }
    const s = Math.min(Math.max(hit.s, half), hit.len - half)
    const pos: [number, number, number] = [hit.a[0] + hit.dir[0] * s, 0, hit.a[1] + hit.dir[1] * s]
    if (Math.hypot(pos[0] - it.position[0], pos[2] - it.position[2]) < 1e-6) return it
    return { ...it, position: pos }
  })
  return { items: next, unfit }
}

// ---- AC-03-5 홈/돌출 ----
export type NotchKind = 'cut' | 'bump'

/**
 * 벽 wallIndex(points[i]->points[i+1])의 시작점에서 offset만큼 간 곳에 width 구간을 잡고, 안쪽(cut) 또는 바깥쪽(bump)으로
 * depth만큼 민 꼭짓점을 끼운 새 배열을 돌려준다. 홈이 벽 시작/끝에 닿으면 그 꼭짓점을 새 점으로 대체한다(모서리 홈).
 * 결과는 closePolygon으로 검증·정규화한다. shift는 정규화가 방을 옮긴 양(+이면 오른쪽/아래). 입력은 변경하지 않는다.
 */
export function notchWallShifted(
  points: Point2[],
  wallIndex: number,
  offset: number,
  width: number,
  depth: number,
  kind: NotchKind,
): Check<{ points: Point2[]; shift: Point2 }> {
  const a = points[wallIndex]
  const bi = (wallIndex + 1) % points.length
  const b = points[bi]
  if (!Number.isInteger(wallIndex) || !a || !b) return fail('벽을 찾을 수 없습니다')
  if (![offset, width, depth].every(Number.isFinite)) return fail('위치·너비·깊이는 숫자여야 합니다')
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (len === 0) return fail('길이가 0인 벽입니다')
  if (offset < 0 || offset + width > len + 1e-6) return fail(`벽 길이(${Math.round(len)}cm) 안에서 위치+너비를 정해 주세요`)
  if (width < WALL_MIN || depth < WALL_MIN) return fail(`너비와 깊이는 ${WALL_MIN}cm 이상이어야 합니다`)
  const dir: Point2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
  const n = outwardNormal(a, b, signedArea(points))
  const push = kind === 'bump' ? depth : -depth
  const at = (s: number, d: number): Point2 => [
    Math.round(a[0] + dir[0] * s + n[0] * d),
    Math.round(a[1] + dir[1] * s + n[1] * d),
  ]
  const end = offset + width
  const atStart = offset <= 1e-6
  const atEnd = end >= len - 1e-6
  const cut = kind === 'cut'
  const added = [
    ...(!atStart ? [at(offset, 0)] : []),
    at(offset, push),
    at(end, push),
    ...(!atEnd ? [at(end, 0)] : []),
  ]
  const dropA = cut && atStart
  const dropB = cut && atEnd
  const next = points.flatMap((p, i): Point2[] =>
    i === wallIndex ? [...(dropA ? [] : [p]), ...added] : i === bi && dropB ? [] : [p],
  )
  const closed = closePolygon(next)
  if (!closed.ok) return fail(closed.message)
  const shift: Point2 = [-Math.min(...next.map((p) => p[0])), -Math.min(...next.map((p) => p[1]))]
  return { ok: true, value: { points: closed.value, shift } }
}

export function notchWall(
  points: Point2[],
  wallIndex: number,
  offset: number,
  width: number,
  depth: number,
  kind: NotchKind,
): Check<Point2[]> {
  const r = notchWallShifted(points, wallIndex, offset, width, depth, kind)
  return r.ok ? { ok: true, value: r.value.points } : r
}

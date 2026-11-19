// 빈 캔버스 그리기(FR-04 확장)·점 삽입/삭제(FR-05)의 순수 로직. 길이 cm, 좌표 [x, z]. 입력 배열은 변경하지 않는다.
import { ROOM_MAX } from '../io/validate'
import type { Point2 } from '../store/types'
import { editError, WALL_MIN, type Check } from './trace'

/** 빈 캔버스의 그림 영역 한 변(cm). 방 상한과 같다. [임의 가정: 0~상한 정사각형 영역] */
export const BLANK_EXTENT = ROOM_MAX

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
const snapTo = (v: number, step: number) => Math.round(v / step) * step
const round1 = (v: number) => Math.round(v * 10) / 10

/** 직전 점 기준으로 커서를 가까운 축(수평/수직)에 투영한다. 스냅은 하지 않는다. */
export function orthoProject(prev: Point2, cursor: Point2): Point2 {
  return Math.abs(cursor[0] - prev[0]) >= Math.abs(cursor[1] - prev[1]) ? [cursor[0], prev[1]] : [prev[0], cursor[1]]
}

/**
 * 그리는 중 다음 점. 순서: (1) 직각 보정(켜짐) -> (2) 스냅. 직각이면 고정 축은 직전 점 값을 그대로 쓰고 자유 축만 step으로 스냅한다
 * (직전 점이 스냅 격자 밖이어도 선이 정확히 수평·수직). prev가 없으면 스냅만.
 */
export function drawPoint(prev: Point2 | null, cursor: Point2, ortho: boolean, step: number): Point2 {
  if (!prev || !ortho) return [snapTo(cursor[0], step), snapTo(cursor[1], step)]
  const q = orthoProject(prev, cursor)
  return q[1] === prev[1] ? [snapTo(q[0], step), prev[1]] : [prev[0], snapTo(q[1], step)]
}

/** prev에서 toward 쪽 가장 가까운 축의 단위 방향. 같은 위치면 오른쪽(+x). */
export function axisDirection(prev: Point2, toward: Point2): Point2 {
  const dx = toward[0] - prev[0]
  const dz = toward[1] - prev[1]
  if (dx === 0 && dz === 0) return [1, 0]
  return Math.abs(dx) >= Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)]
}

/** 길이(cm) 입력으로 다음 점. ortho면 가까운 축, 아니면 toward 방향 그대로. 길이는 WALL_MIN~방 상한. 0.1cm 반올림. */
export function pointFromLength(prev: Point2, toward: Point2, len: number, ortho: boolean): Check<Point2> {
  if (!Number.isFinite(len) || len < WALL_MIN || len > ROOM_MAX) return fail(`길이는 ${WALL_MIN}~${ROOM_MAX}cm 숫자여야 합니다`)
  let dir: Point2
  if (ortho) dir = axisDirection(prev, toward)
  else {
    const d = Math.hypot(toward[0] - prev[0], toward[1] - prev[1])
    dir = d === 0 ? [1, 0] : [(toward[0] - prev[0]) / d, (toward[1] - prev[1]) / d]
  }
  return { ok: true, value: [round1(prev[0] + dir[0] * len), round1(prev[1] + dir[1] * len)] }
}

/** (x, z)에서 반경 r 안에 있는 가장 가까운 벽 i(points[i]->points[i+1]). 없으면 -1. */
export function wallAt(points: Point2[], x: number, z: number, r: number): number {
  let best = -1
  let bestDist = r
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (len === 0) continue
    const s = Math.min(Math.max(((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / len, 0), len)
    const d = Math.hypot(x - (a[0] + ((b[0] - a[0]) / len) * s), z - (a[1] + ((b[1] - a[1]) / len) * s))
    if (d <= bestDist) {
      best = i
      bestDist = d
    }
  }
  return best
}

/**
 * 벽 wallIndex(points[i]->points[i+1]) 위에서 (x, z)에 가장 가까운 점(벽을 따라 step 스냅, 1cm 반올림)을 그 벽 뒤에 끼운다.
 * 두 끝점에서 WALL_MIN 미만이면 거부. 결과는 editError(교차·상한·겹침)로 검증한다.
 */
export function insertPoint(points: Point2[], wallIndex: number, x: number, z: number, step = 1): Check<Point2[]> {
  const a = points[wallIndex]
  const b = points[(wallIndex + 1) % points.length]
  if (!Number.isInteger(wallIndex) || !a || !b) return fail('벽을 찾을 수 없습니다')
  if (!Number.isFinite(x) || !Number.isFinite(z)) return fail('위치가 올바르지 않습니다')
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (len === 0) return fail('길이가 0인 벽입니다')
  const dx = (b[0] - a[0]) / len
  const dz = (b[1] - a[1]) / len
  const s = snapTo(Math.min(Math.max((x - a[0]) * dx + (z - a[1]) * dz, 0), len), step)
  const p: Point2 = [Math.round(a[0] + dx * s), Math.round(a[1] + dz * s)]
  if (Math.hypot(p[0] - a[0], p[1] - a[1]) < WALL_MIN || Math.hypot(p[0] - b[0], p[1] - b[1]) < WALL_MIN) {
    return fail(`꼭짓점에서 ${WALL_MIN}cm 이상 떨어진 곳을 누르세요`)
  }
  const next = [...points.slice(0, wallIndex + 1), p, ...points.slice(wallIndex + 1)]
  const err = editError(next)
  return err ? fail(err) : { ok: true, value: next }
}

/** 점 i를 지운다. 3점 이하면 거부, 결과는 editError로 검증. */
export function deletePoint(points: Point2[], i: number): Check<Point2[]> {
  if (!Number.isInteger(i) || !points[i]) return fail('점을 찾을 수 없습니다')
  if (points.length <= 3) return fail('꼭짓점은 3개 이상 있어야 합니다')
  const next = points.filter((_, k) => k !== i)
  const err = editError(next)
  return err ? fail(err) : { ok: true, value: next }
}

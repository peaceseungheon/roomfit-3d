// 방 이동(FR-23, AC-23-4). 순수 함수: 미리 보기 스냅·검증, 문서 이동. 길이 cm, 좌표 [x, z].
import { roomsOverlap } from '../io/roomOverlap'
import { nearestWallIn } from '../scene/geometry'
import { placeDrawPoint, snapRings } from '../trace/neighborSnap'
import { findRoomForItem, finalizeDoc, planShift, shiftDocument } from './rooms'
import type { DocData, Item, Point2, Room } from './types'

export const MOVE_GRID = 10

/** 스냅 보정의 부동소수점 잡음 제거(소수 둘째 자리). 격자 꺼짐의 의도된 소수 좌표는 유지된다. */
const round2 = ([x, z]: Point2): Point2 => [Math.round(x * 100) / 100, Math.round(z * 100) / 100]

const moveRoomBy = (r: Room, [dx, dz]: Point2): Room => ({ ...r, points: r.points.map(([x, z]): Point2 => [x + dx, z + dz]) })

/** 방에 속한 가구(바닥 중심점 기준)·고정 요소(호스트 벽의 방). */
const ownerOf = (rooms: readonly Room[], it: Item): Room | null =>
  it.type === 'FURNITURE' ? findRoomForItem(rooms, it) : (nearestWallIn(rooms, it.position[0], it.position[2])?.room ?? null)

/** 방 id를 delta만큼 옮겼을 때 겹치는 방 id와 검증 결과(가구는 보지 않는다). 좌표 불변식의 음수는 문서 이동으로 해소되므로 허용. */
export function roomMoveCheck(
  rooms: readonly Room[],
  id: string,
  delta: Point2,
): { ok: boolean; reason?: string; overlapWith?: string[] } {
  const cur = rooms.find((r) => r.id === id)
  if (!cur || !delta.every(Number.isFinite)) return { ok: false, reason: '이동할 방을 찾을 수 없습니다' }
  const moved = moveRoomBy(cur, delta)
  const overlapWith = rooms.filter((r) => r.id !== id && roomsOverlap(r.points, moved.points)).map((r) => r.id)
  if (overlapWith.length) return { ok: false, reason: '다른 방과 겹칩니다', overlapWith }
  const next = rooms.map((r) => (r.id === id ? moved : r))
  if (!finalizeDoc(next, [])) return { ok: false, reason: '집 전체 크기가 10000cm를 넘습니다' }
  return { ok: true }
}

/** 이동 문서. 가구·고정 요소를 같이 옮기고 음수 좌표는 문서째 평행이동한다. 실패면 사유. */
export function moveRoomDoc(doc: DocData, id: string, delta: Point2): { doc: DocData } | { reason: string } {
  const chk = roomMoveCheck(doc.rooms, id, delta)
  if (!chk.ok) return { reason: chk.reason! }
  const items = doc.items.map((it) =>
    ownerOf(doc.rooms, it)?.id === id ? { ...it, position: [it.position[0] + delta[0], it.position[1], it.position[2] + delta[1]] as Item['position'] } : it,
  )
  const rooms = doc.rooms.map((r) => (r.id === id ? moveRoomBy(r, delta) : r))
  const shifted = shiftDocument({ rooms, items }, planShift(rooms))
  const out = finalizeDoc(shifted.rooms, shifted.items)
  return out ? { doc: out } : { reason: '집 전체 크기가 10000cm를 넘습니다' }
}

/**
 * 드래그 미리 보기용 보정된 delta. 격자(grid, 10cm) -> 이웃 스냅(AC-04-15: 다른 방 바깥 10cm 링의 꼭짓점 > 변, 15cm 이내).
 * 이동 방의 각 꼭짓점을 후보로 꼭짓점 스냅 우선, 같은 종류면 보정이 가장 작은 하나만 적용한다.
 */
export function snapRoomMove(
  rooms: readonly Room[],
  id: string,
  delta: Point2,
  opts: { grid?: boolean; neighbor?: boolean } = {},
): Point2 {
  const cur = rooms.find((r) => r.id === id)
  if (!cur) return delta
  const { grid = true, neighbor = true } = opts
  const d: Point2 = grid ? [Math.round(delta[0] / MOVE_GRID) * MOVE_GRID, Math.round(delta[1] / MOVE_GRID) * MOVE_GRID] : delta
  const others = rooms.filter((r) => r.id !== id)
  if (!neighbor || others.length === 0) return round2(d)
  const rings = snapRings(others.map((r) => r.points))
  let best: { fix: Point2; vertex: boolean; dist: number } | null = null
  for (const [x, z] of cur.points) {
    const c: Point2 = [x + d[0], z + d[1]]
    const { point, hit } = placeDrawPoint(null, c, { ortho: false, step: 1, rings, neighbor: true })
    if (!hit) continue
    const fix: Point2 = [point[0] - c[0], point[1] - c[1]]
    const cand = { fix, vertex: hit.kind === 'vertex', dist: Math.hypot(fix[0], fix[1]) }
    if (!best || (cand.vertex && !best.vertex) || (cand.vertex === best.vertex && cand.dist < best.dist)) best = cand
  }
  return round2(best ? [d[0] + best.fix[0], d[1] + best.fix[1]] : d)
}

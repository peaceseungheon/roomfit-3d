// 다중 방 공용 헬퍼: id·좌표 불변식·소속/천장고 판정. 1unit=1cm, 좌표 [x, z].
import { nearestWallIn, pointInPolygon, ROOM_ADD_GAP } from '../scene/geometry'
import { PLAN_EXTENT_MAX, type DocData, type Item, type Point2, type Room, type RoomShape } from './types'

/** `r(\d+)` 최대값 + 1. 그 외 id는 건너뛴다. */
export function nextRoomId(rooms: readonly Room[]): string {
  let max = 0
  for (const r of rooms) {
    const m = /^r(\d+)$/.exec(r.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `r${max + 1}`
}

/** 해당 id의 height·points만 바꾸고 나머지 참조는 유지. 없는 id면 입력 배열 그대로. */
export const withRoom = (rooms: Room[], id: string, shape: RoomShape): Room[] =>
  rooms.some((r) => r.id === id)
    ? rooms.map((r) => (r.id === id ? { ...r, height: shape.height, points: shape.points } : r))
    : rooms

/** 모든 방 꼭짓점의 min x·min z를 0 이상으로 만드는 평행이동량. 음수가 없으면 [0, 0]. */
export function planShift(rooms: readonly Room[]): [number, number] {
  let minX = 0
  let minZ = 0
  for (const r of rooms)
    for (const [x, z] of r.points) {
      minX = Math.min(minX, x)
      minZ = Math.min(minZ, z)
    }
  return [Math.abs(Math.min(minX, 0)), Math.abs(Math.min(minZ, 0))]
}

/** 모든 방을 평행이동. 이동 0이면 같은 배열. */
export const shiftRooms = (rooms: Room[], s: [number, number]): Room[] =>
  s[0] === 0 && s[1] === 0
    ? rooms
    : rooms.map((r) => ({ ...r, points: r.points.map(([x, z]): Point2 => [x + s[0], z + s[1]]) }))

/** 방이 (dx, dz)만큼 옮겨졌을 때 가구·고정 요소를 같이 옮긴다(홈/돌출 확정). 이동이 없으면 같은 배열. */
export const shiftItems = (items: Item[], shift?: [number, number]): Item[] =>
  !shift || (shift[0] === 0 && shift[1] === 0)
    ? items
    : items.map((it) => ({ ...it, position: [it.position[0] + shift[0], it.position[1], it.position[2] + shift[1]] }))

/** 방과 가구를 같은 양만큼 이동한 새 문서(좌표 불변식 유지). */
export const shiftDocument = (doc: DocData, s: [number, number]): DocData => ({
  rooms: shiftRooms(doc.rooms, s),
  items: shiftItems(doc.items, s),
})

/** 가구 바닥 중심점이 내부에 있는 첫 방. 없으면 null. */
export const findRoomForItem = (rooms: readonly Room[], item: Pick<Item, 'position'>): Room | null =>
  rooms.find((r) => pointInPolygon(r.points, item.position[0], item.position[2])) ?? null

/** 소속 방의 height. 가구는 소속 방, 고정 요소는 가장 가까운 벽의 호스트 방. 둘 다 없으면 모든 방 최솟값. */
export function ceilingForItem(rooms: readonly Room[], item: Item): number {
  const room =
    item.type === 'FURNITURE'
      ? findRoomForItem(rooms, item)
      : (nearestWallIn(rooms, item.position[0], item.position[2])?.room ?? null)
  return room ? room.height : Math.min(...rooms.map((r) => r.height))
}

/** 가구마다 소속 방 천장고로 elevation을 clamp. 바뀐 게 없으면 같은 배열. */
export const clampElevations = (items: Item[], rooms: readonly Room[]): Item[] =>
  items.some((it) => (it.elevation ?? 0) > ceilingForItem(rooms, it))
    ? items.map((it) => {
        const ceil = ceilingForItem(rooms, it)
        return (it.elevation ?? 0) > ceil ? { ...it, elevation: ceil } : it
      })
    : items

/** CRUD 결과 문서를 저장 검증(validate.ts) 규칙에 맞춘다: elevation clamp + 문서 바운딩·가구 좌표 상한. 실패면 null. */
export function finalizeDoc(rooms: Room[], items: Item[]): DocData | null {
  if (rooms.length === 0) return null
  const clamped = clampElevations(items, rooms)
  const pts = rooms.flatMap((r) => r.points)
  for (const axis of [0, 1] as const) {
    const vs = pts.map((p) => p[axis])
    if (Math.max(...vs) - Math.min(...vs) > PLAN_EXTENT_MAX) return null
  }
  if (clamped.some((it) => Math.abs(it.position[0]) > PLAN_EXTENT_MAX || Math.abs(it.position[2]) > PLAN_EXTENT_MAX))
    return null
  return { rooms, items: clamped }
}

/** 방 하나의 height·points를 교체하고 저장 유효성까지 맞춘다. 실패면 null. 평행이동은 호출부 몫. */
export const applyRoomGeometry = (doc: DocData, id: string, shape: RoomShape): DocData | null =>
  finalizeDoc(withRoom(doc.rooms, id, shape), doc.items)

/** 방 확정 전후 문서가 이동한 양(`rooms[0].points[0]` 차이). 기존 방은 이동량만큼만 바뀐다. */
export function docShiftDelta(before: readonly Room[], after: readonly Room[]): Point2 {
  const a = before[0]?.points[0]
  const b = after[0]?.points[0]
  return a && b ? [b[0] - a[0], b[1] - a[1]] : [0, 0]
}

export type AddSide = 'right' | 'left' | 'up' | 'down'

/** 새 방 윤곽을 활성 방 옆(side)에 ROOM_ADD_GAP만큼 띄우고, 나란한 축의 시작(위쪽 z 또는 왼쪽 x)을 맞춘 좌표. 음수 좌표는 addRoom이 문서째 평행이동한다. */
export function placeBeside(active: Room, points: Point2[], side: AddSide): Point2[] {
  const ext = (pts: Point2[], i: 0 | 1) => [Math.min(...pts.map((p) => p[i])), Math.max(...pts.map((p) => p[i]))]
  const [ax0, ax1] = ext(active.points, 0)
  const [az0, az1] = ext(active.points, 1)
  const [nx0, nx1] = ext(points, 0)
  const [nz0, nz1] = ext(points, 1)
  const horizontal = side === 'right' || side === 'left'
  const dx = horizontal ? (side === 'right' ? ax1 + ROOM_ADD_GAP - nx0 : ax0 - ROOM_ADD_GAP - nx1) : ax0 - nx0
  const dz = horizontal ? az0 - nz0 : side === 'down' ? az1 + ROOM_ADD_GAP - nz0 : az0 - ROOM_ADD_GAP - nz1
  return points.map(([x, z]): Point2 => [x + dx, z + dz])
}

/** 새 방 윤곽을 활성 방 오른쪽에 붙인다(이미지 트레이싱 첫 방 등 기본 방향). */
export const placeRightOf = (active: Room, points: Point2[]): Point2[] => placeBeside(active, points, 'right')

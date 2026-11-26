// S-03 방 만들기 폼: 문자열 입력 -> validateRoomInput 연결, 확정은 Undo 1단계(스토어 set 1회).
import { ROOMS_MAX, validateRoomInput, type RoomInput, type RoomInputErrors } from '../io/validate'
import { isDragging } from '../scene/dragSession'
import { computeWarnings } from '../scene/collision'
import { getActiveRoom } from '../store/activeRoom'
import { findRoomForItem, placeBeside, placeRightOf, type AddSide } from '../store/rooms'
import { lPoints, rectPoints, shiftItems, useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import type { Item, Point2, Room, RoomShape } from '../store/types'
import { applyNotches, applyNotchesShifted, type NotchSpec } from './roomNotch'

export interface RoomForm {
  kind: 'rect' | 'L'
  width: string
  depth: string
  height: string
  cutWidth: string
  cutDepth: string
  keepItems: boolean
  /** 사각형/ㄱ자 위에 차례로 적용한 홈·돌출(AC-03-5). 없으면 프리셋 그대로 */
  notches?: NotchSpec[]
  /** 방 추가 시 활성 방 기준 방향. 없으면 오른쪽 */
  side?: AddSide
  /** 방 추가 시 고른 방 종류(FR-23). 없으면 '방 N' 이름 */
  roomKind?: string
}

const num = (s: string): number => (/^-?\d+$/.test(s.trim()) ? Number(s) : NaN)

export const toRoomInput = (f: RoomForm): RoomInput => ({
  kind: f.kind,
  width: num(f.width),
  depth: num(f.depth),
  height: num(f.height),
  cutWidth: num(f.cutWidth),
  cutDepth: num(f.cutDepth),
})

export const roomFormErrors = (f: RoomForm): RoomInputErrors => validateRoomInput(toRoomInput(f))

/** 현재 방 값으로 채운 초기 폼(와이어프레임 "기본: 현재 방 값이 미리 채워짐"). ㄱ자 모양이면 ㄱ자로. */
export function initialRoomForm(room: Room): RoomForm {
  const xs = room.points.map((p) => p[0])
  const zs = room.points.map((p) => p[1])
  const w = Math.round(Math.max(...xs) - Math.min(...xs))
  const d = Math.round(Math.max(...zs) - Math.min(...zs))
  const p = room.points
  const isL = p.length === 6 && p[0][0] === 0 && p[0][1] === 0 && p[1][1] === 0 && p[3][0] === Math.max(...xs)
  const cw = isL ? Math.round(p[3][0] - p[1][0]) : Math.round(w / 3)
  const cd = isL ? Math.round(p[2][1]) : Math.round(d / 3)
  return {
    kind: isL ? 'L' : 'rect',
    width: String(w),
    depth: String(d),
    height: String(Math.round(room.height)),
    cutWidth: String(cw),
    cutDepth: String(cd),
    keepItems: true,
  }
}

/** 검증 통과 시 방을 교체한다(AC-03-4). 드래그 중이거나 검증 실패면 false. */
export function submitRoomForm(f: RoomForm): boolean {
  if (isDragging() || Object.keys(roomFormErrors(f)).length) return false
  const i = toRoomInput(f)
  const { createRectRoom, createLRoom, createPolygonRoom } = useDocStore.getState()
  if (f.notches?.length) {
    const r = formRoom(f)
    return r ? createPolygonRoom(r.points, r.height, f.keepItems, formShift(f)) : false
  }
  return f.kind === 'L'
    ? createLRoom(i.width, i.depth, i.height, i.cutWidth as number, i.cutDepth as number, f.keepItems)
    : createRectRoom(i.width, i.depth, i.height, f.keepItems)
}

export { ROOM_ADD_GAP } from '../scene/geometry'
export { placeRightOf }

/** "방 추가"가 막히는 이유. 추가할 수 있으면 null. */
export const addRoomBlockedReason = (rooms: readonly Room[]): string | null =>
  rooms.length >= ROOMS_MAX ? `방은 최대 ${ROOMS_MAX}개까지 추가할 수 있습니다` : null

/** 방이 2개 이상이면 "새 방 만들기"는 문서 전체 교체 확인을 먼저 거친다(스펙 §5.5 진입점 구분). */
export const needsReplaceConfirm = (rooms: readonly Room[]): boolean => rooms.length >= 2

/** add 모드 확정: 활성 방 옆(f.side, 기본 오른쪽)에 방을 추가하고 새 방을 활성화한다. 실패면 null. */
export function submitAddRoomForm(f: RoomForm): string | null {
  if (isDragging() || Object.keys(roomFormErrors(f)).length) return null
  const room = formRoom(f)
  if (!room) return null
  const id = useDocStore.getState().addRoom({ height: room.height, points: placeBeside(getActiveRoom(), room.points, f.side ?? 'right') }, undefined, f.roomKind)
  if (id) useUiStore.getState().setActiveRoomId(id)
  return id
}

/** 폼 입력이 유효하면 확정 시 만들어질 방 윤곽. 유효하지 않으면 null(미리보기·방 밖 개수 안내용). */
export function formRoom(f: RoomForm): RoomShape | null {
  const base = presetPoints(f)
  if (!base) return null
  const pts = applyNotches(base, f.notches ?? [])
  return pts.ok ? { height: toRoomInput(f).height, points: pts.value } : null
}

/** 홈·돌출 정규화로 방이 옮겨진 양(위/왼쪽 돌출이면 +). 가구는 keepItems일 때 이만큼 같이 옮겨진다. */
export function formShift(f: RoomForm): [number, number] {
  const base = presetPoints(f)
  const r = base ? applyNotchesShifted(base, f.notches ?? []) : null
  return r?.ok ? r.value.shift : [0, 0]
}

/** 확정 시 방 기준 상대 위치가 유지된 가구 목록(방 밖 개수 계산용). */
export const formItems = (f: RoomForm, items: Item[]): Item[] => shiftItems(items, formShift(f))

/** 홈·돌출 적용 전 프리셋 윤곽. 입력이 유효하지 않으면 null. */
export function presetPoints(f: RoomForm): Point2[] | null {
  if (Object.keys(roomFormErrors(f)).length) return null
  const i = toRoomInput(f)
  return f.kind === 'L' ? lPoints(i.width, i.depth, i.cutWidth as number, i.cutDepth as number) : rectPoints(i.width, i.depth)
}

/** 프리셋 값은 유효한데 쌓아 둔 홈·돌출이 더는 맞지 않을 때의 문구(없으면 null). */
export function notchesError(f: RoomForm): string | null {
  const base = presetPoints(f)
  if (!base) return null
  const r = applyNotches(base, f.notches ?? [])
  return r.ok ? null : r.error
}

/** 새 방에서 방 밖(벽 간섭, AC-11-5)이 되는 가구 개수. 고정 요소는 세지 않는다. 미리보기 방 1개 기준으로 센다. */
export function countOutsideFurniture(room: RoomShape, items: Item[]): number {
  const preview: Room = { id: '', name: '', height: room.height, points: room.points }
  return computeWarnings([preview], items.filter((it) => it.type === 'FURNITURE')).filter((w) => w.kind === 'WALL').length
}

/** 방 삭제 시 남는 가구 수(바닥 중심점이 그 방에 속한 FURNITURE, 배열 앞쪽 방 우선). 고정 요소는 세지 않는다. */
export const furnitureInRoom = (rooms: readonly Room[], items: readonly Item[], roomId: string): number =>
  items.filter((it) => it.type === 'FURNITURE' && findRoomForItem(rooms, it)?.id === roomId).length

/** 삭제 확인 문구. 가구가 있으면 개수를 알린다(removeRoom은 가구를 남긴다). */
export const deleteRoomMessage = (name: string, furniture: number): string =>
  `「${name}」 방을 삭제할까요? ${furniture > 0 ? `방 안의 가구 ${furniture}개는 남습니다(방 밖이 되어 경고가 표시됩니다)` : '가구는 남습니다'}`

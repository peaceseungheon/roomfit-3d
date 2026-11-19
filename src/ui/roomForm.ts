// S-03 방 만들기 폼: 문자열 입력 -> validateRoomInput 연결, 확정은 Undo 1단계(스토어 set 1회).
import { validateRoomInput, type RoomInput, type RoomInputErrors } from '../io/validate'
import { isDragging } from '../scene/dragSession'
import { computeWarnings } from '../scene/collision'
import { lPoints, rectPoints, useDocStore } from '../store/useDocStore'
import type { Item, Room } from '../store/types'

export interface RoomForm {
  kind: 'rect' | 'L'
  width: string
  depth: string
  height: string
  cutWidth: string
  cutDepth: string
  keepItems: boolean
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
  const { createRectRoom, createLRoom } = useDocStore.getState()
  return f.kind === 'L'
    ? createLRoom(i.width, i.depth, i.height, i.cutWidth as number, i.cutDepth as number, f.keepItems)
    : createRectRoom(i.width, i.depth, i.height, f.keepItems)
}

/** 폼 입력이 유효하면 확정 시 만들어질 방 윤곽. 유효하지 않으면 null(미리보기·방 밖 개수 안내용). */
export function formRoom(f: RoomForm): Room | null {
  if (Object.keys(roomFormErrors(f)).length) return null
  const i = toRoomInput(f)
  const points = f.kind === 'L' ? lPoints(i.width, i.depth, i.cutWidth as number, i.cutDepth as number) : rectPoints(i.width, i.depth)
  return { height: i.height, points }
}

/** 새 방에서 방 밖(벽 간섭, AC-11-5)이 되는 가구 개수. 고정 요소는 세지 않는다. */
export function countOutsideFurniture(room: Room, items: Item[]): number {
  return computeWarnings(room, items.filter((it) => it.type === 'FURNITURE')).filter((w) => w.kind === 'WALL').length
}

import { create } from 'zustand'
import { temporal } from 'zundo'
import { createSample } from './sample'
import { ITEM_MAX_H, ITEM_MAX_WD, NAME_MAX, PLAN_EXTENT_MAX, ROOMS_MAX, validateRoom, validateRoomInput } from '../io/validate'
import { roomsOverlap } from '../io/roomOverlap'
import { isDragging } from '../scene/dragSession'
import {
  applyRoomGeometry,
  ceilingForItem,
  finalizeDoc,
  nextRoomId,
  planShift,
  shiftDocument,
  shiftItems,
  withRoom,
} from './rooms'
import { DEFAULT_ROOM_ID, defaultRoomName, type DocData, type Item, type Room, type RoomShape } from './types'

export const UNDO_LIMIT = 50

interface DocState extends DocData {
  /** 샘플 그대로이고 사용자가 아직 편집하지 않은 상태(AC-02-2). Undo 비대상. */
  pristine: boolean
  /** 방 목록에 방을 추가한다(기존 문서 보존). 실패하면 null. */
  addRoom: (shape: RoomShape, name?: string) => string | null
  /** 마지막 방이거나 없는 id면 false. 가구는 삭제하지 않는다. */
  removeRoom: (id: string) => boolean
  /** trim 후 1~NAME_MAX 자가 아니거나 없는 id면 false. */
  renameRoom: (id: string, name: string) => boolean
  /** 방 하나의 height·points를 교체한다. 다른 방과 겹치면 false. */
  setRoomGeometry: (id: string, shape: RoomShape) => boolean
  /** 입력이 validateRoomInput 범위를 벗어나면 상태를 바꾸지 않고 false. */
  createRectRoom: (width: number, depth: number, height: number, keepItems?: boolean) => boolean
  /** ㄱ자: 우상단(max x, min z) 모서리를 cutWidth x cutDepth 만큼 잘라낸다(AC-03-2). 범위 밖이면 false. */
  createLRoom: (
    width: number,
    depth: number,
    height: number,
    cutWidth: number,
    cutDepth: number,
    keepItems?: boolean,
  ) => boolean
  /** 트레이싱 다각형으로 문서 전체 교체(Undo 1단계). validateRoom 실패 시 상태 유지 후 false. */
  createPolygonRoom: (points: Room['points'], height: number, keepItems?: boolean, shift?: [number, number]) => boolean
  /** 규약 강제(y=0, 크기 clamp). 숫자가 유한하지 않으면 거부하고 false. 10cm 스냅은 scene 책임. */
  addItem: (item: Item) => boolean
  /** 없는 id이거나 유효하지 않은 값이면 상태를 유지하고 false. */
  updateItem: (id: string, patch: Partial<Omit<Item, 'id'>>) => boolean
  removeItem: (id: string) => void
  resetToSample: () => void
  /** 검증을 통과한 문서 데이터로 교체. Undo 가능(AC-14-4). */
  loadDocument: (doc: DocData) => void
}

/** ㄱ자: 우상단 cw×cd 잘림(AC-03-2). */
export const lPoints = (w: number, d: number, cw: number, cd: number): Room['points'] => [
  [0, 0],
  [w - cw, 0],
  [w - cw, cd],
  [w, cd],
  [w, d],
  [0, d],
]

export const rectPoints = (w: number, d: number): Room['points'] => [
  [0, 0],
  [w, 0],
  [w, d],
  [0, d],
]

// roomForm.ts 등 기존 import 경로 유지용 re-export
export { shiftItems }

const clamp = (v: number, hi: number) => Math.min(Math.max(v, 1), hi)

/** 저장 검증(±PLAN_EXTENT_MAX)과 같은 방 모양인지. 같으면 편집으로 치지 않는다. */
const sameShape = (room: Room, shape: RoomShape): boolean =>
  room.height === shape.height &&
  room.points.length === shape.points.length &&
  room.points.every(([x, z], i) => x === shape.points[i][0] && z === shape.points[i][1])

/** 규약 강제: y=0, 크기 clamp(W,D 1~1000 / H 1~500), 좌표 ±10000. 유한수가 아니거나 범위 밖이면 null. */
export function normalizeItem(it: Item, ceil: number): Item | null {
  const ok = (v: readonly number[]) => v.length === 3 && v.every(Number.isFinite)
  if (!ok(it.position) || !ok(it.rotation) || !ok(it.size)) return null
  if (it.elevation !== undefined && !Number.isFinite(it.elevation)) return null
  if (Math.abs(it.position[0]) > PLAN_EXTENT_MAX || Math.abs(it.position[2]) > PLAN_EXTENT_MAX) return null
  const [w, h, d] = it.size
  return {
    ...it,
    ...(it.elevation !== undefined && { elevation: Math.min(Math.max(it.elevation, 0), ceil) }),
    position: [it.position[0], 0, it.position[2]],
    size: [clamp(w, ITEM_MAX_WD), clamp(h, ITEM_MAX_H), clamp(d, ITEM_MAX_WD)],
  }
}

/** 방 하나로 문서 전체를 교체하는 공통 경로(rect/L/폴리곤). items는 keepItems일 때만 이동·clamp. 실패면 null. */
const replaceWithRoom = (
  shape: RoomShape,
  items: Item[],
  keepItems: boolean,
  shift?: [number, number],
): DocData | null => {
  const room: Room = { id: DEFAULT_ROOM_ID, name: defaultRoomName(1), height: shape.height, points: shape.points }
  return finalizeDoc([room], keepItems ? shiftItems(items, shift) : [])
}

export const useDocStore = create<DocState>()(
  temporal(
    (set, get) => {
      const sample = createSample()
      return {
        ...sample,
        pristine: true,
        addRoom: (shape, name) => {
          if (isDragging()) return null
          const s = get()
          if (s.rooms.length >= ROOMS_MAX || validateRoom(shape).length) return null
          const nm = (name ?? defaultRoomName(s.rooms.length + 1)).trim()
          if (nm.length < 1 || nm.length > NAME_MAX) return null
          if (s.rooms.some((r) => roomsOverlap(r.points, shape.points))) return null
          const rooms: Room[] = [...s.rooms, { id: nextRoomId(s.rooms), name: nm, height: shape.height, points: shape.points }]
          const shifted = shiftDocument({ rooms, items: s.items }, planShift(rooms))
          const doc = finalizeDoc(shifted.rooms, shifted.items)
          if (!doc) return null
          set({ rooms: doc.rooms, items: doc.items, pristine: false })
          return rooms[rooms.length - 1].id
        },
        removeRoom: (id) => {
          if (isDragging()) return false
          const s = get()
          if (s.rooms.length <= 1 || !s.rooms.some((r) => r.id === id)) return false
          // 가구는 남기되, 소속 방 삭제로 fallback 천장고가 낮아질 수 있으니 clamp한다
          const doc = finalizeDoc(s.rooms.filter((r) => r.id !== id), s.items)
          if (!doc) return false
          set({ rooms: doc.rooms, items: doc.items, pristine: false })
          return true
        },
        renameRoom: (id, name) => {
          if (isDragging()) return false
          const nm = name.trim()
          if (nm.length < 1 || nm.length > NAME_MAX) return false
          const s = get()
          const room = s.rooms.find((r) => r.id === id)
          if (!room) return false
          if (room.name === nm) return true
          set({ rooms: s.rooms.map((r) => (r.id === id ? { ...r, name: nm } : r)), pristine: false })
          return true
        },
        setRoomGeometry: (id, shape) => {
          if (isDragging()) return false
          const s = get()
          const cur = s.rooms.find((r) => r.id === id)
          if (!cur || validateRoom(shape).length) return false
          if (sameShape(cur, shape)) return true
          if (s.rooms.some((r) => r.id !== id && roomsOverlap(r.points, shape.points))) return false
          // 좌표 불변식: 새 모양이 음수 좌표를 만들면 문서 전체를 같은 양만큼 옮긴 뒤 적용한다
          const rooms = withRoom(s.rooms, id, shape)
          const shifted = shiftDocument({ rooms, items: s.items }, planShift(rooms))
          const doc = applyRoomGeometry(shifted, id, {
            height: shape.height,
            points: shifted.rooms.find((r) => r.id === id)!.points,
          })
          if (!doc) return false
          set({ rooms: doc.rooms, items: doc.items, pristine: false })
          return true
        },
        createRectRoom: (w, d, height, keepItems = true) => {
          if (Object.keys(validateRoomInput({ kind: 'rect', width: w, depth: d, height })).length) return false
          const doc = replaceWithRoom({ height, points: rectPoints(w, d) }, get().items, keepItems)
          if (!doc) return false
          set({ ...doc, pristine: false })
          return true
        },
        createLRoom: (w, d, height, cw, cd, keepItems = true) => {
          const input = { kind: 'L' as const, width: w, depth: d, height, cutWidth: cw, cutDepth: cd }
          if (Object.keys(validateRoomInput(input)).length) return false
          const doc = replaceWithRoom({ height, points: lPoints(w, d, cw, cd) }, get().items, keepItems)
          if (!doc) return false
          set({ ...doc, pristine: false })
          return true
        },
        createPolygonRoom: (points, height, keepItems = true, shift) => {
          const shape = { height, points }
          if (validateRoom(shape).length) return false
          const doc = replaceWithRoom(shape, get().items, keepItems, shift)
          if (!doc) return false
          set({ ...doc, pristine: false })
          return true
        },
        addItem: (item) => {
          const n = normalizeItem(item, ceilingForItem(get().rooms, item))
          if (!n) return false
          set((s) => ({ items: [...s.items, n], pristine: false }))
          return true
        },
        updateItem: (id, patch) => {
          const cur = get().items.find((it) => it.id === id)
          if (!cur) return false
          const cand = { ...cur, ...patch, id }
          const n = normalizeItem(cand, ceilingForItem(get().rooms, cand))
          if (!n) return false
          set((s) => ({
            items: s.items.map((it) => (it.id === id ? n : it)),
            pristine: false,
          }))
          return true
        },
        removeItem: (id) =>
          set((s) => ({ items: s.items.filter((it) => it.id !== id), pristine: false })),
        // 사용자의 명시적 편집이므로 pristine=false (샘플도 저장본을 덮어쓴다)
        resetToSample: () => set({ ...createSample(), pristine: false }),
        loadDocument: (doc) => set({ rooms: doc.rooms, items: doc.items, pristine: false }),
      }
    },
    {
      limit: UNDO_LIMIT,
      partialize: (s) => ({ rooms: s.rooms, items: s.items }),
      equality: (a, b) => a.rooms === b.rooms && a.items === b.items,
    },
  ),
)

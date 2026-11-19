import { create } from 'zustand'
import { temporal } from 'zundo'
import { createSample } from './sample'
import { ITEM_MAX_H, ITEM_MAX_WD, validateRoom, validateRoomInput } from '../io/validate'
import type { DocData, Item, Room, RoomShape } from './types'

export const UNDO_LIMIT = 50

interface DocState extends DocData {
  /** 샘플 그대로이고 사용자가 아직 편집하지 않은 상태(AC-02-2). Undo 비대상. */
  pristine: boolean
  setRoom: (room: Room) => void
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
  /** 트레이싱 다각형으로 방 교체(Undo 1단계). validateRoom 실패 시 상태 유지 후 false. */
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

/** 천장고가 낮아졌을 때 기존 elevation을 새 천장고로 clamp(AC-03-4). 바뀐 게 없으면 같은 배열. */
const clampElevations = (items: Item[], ceil: number): Item[] =>
  items.some((it) => (it.elevation ?? 0) > ceil)
    ? items.map((it) => ((it.elevation ?? 0) > ceil ? { ...it, elevation: ceil } : it))
    : items

/** 방이 (dx, dz)만큼 옮겨졌을 때 가구·고정 요소를 같이 옮긴다(홈/돌출 확정). 이동이 없으면 같은 배열. */
export const shiftItems = (items: Item[], shift?: [number, number]): Item[] =>
  !shift || (shift[0] === 0 && shift[1] === 0)
    ? items
    : items.map((it) => ({ ...it, position: [it.position[0] + shift[0], it.position[1], it.position[2] + shift[1]] }))

/** 3단계에서 활성 방으로 교체. 지금은 첫 방만 본다. */
export const selectRoom = (s: DocData): Room => s.rooms[0]

/** 첫 방의 height·points만 바꾼 새 rooms 배열(id·name 유지). */
export const withFirstRoom = (rooms: Room[], { height, points }: RoomShape): Room[] => [
  { ...rooms[0], height, points },
  ...rooms.slice(1),
]

const clamp = (v: number, hi: number) => Math.min(Math.max(v, 1), hi)

/** 규약 강제: y=0, 크기 clamp(W,D 1~1000 / H 1~500). 유한수가 아니면 null. */
export function normalizeItem(it: Item, ceil: number): Item | null {
  const ok = (v: readonly number[]) => v.length === 3 && v.every(Number.isFinite)
  if (!ok(it.position) || !ok(it.rotation) || !ok(it.size)) return null
  if (it.elevation !== undefined && !Number.isFinite(it.elevation)) return null
  const [w, h, d] = it.size
  return {
    ...it,
    ...(it.elevation !== undefined && { elevation: Math.min(Math.max(it.elevation, 0), ceil) }),
    position: [it.position[0], 0, it.position[2]],
    size: [clamp(w, ITEM_MAX_WD), clamp(h, ITEM_MAX_H), clamp(d, ITEM_MAX_WD)],
  }
}

export const useDocStore = create<DocState>()(
  temporal(
    (set, get) => {
      const sample = createSample()
      return {
        ...sample,
        pristine: true,
        setRoom: (room) =>
          set((s) => ({ rooms: withFirstRoom(s.rooms, room), items: clampElevations(s.items, room.height), pristine: false })),
        createRectRoom: (w, d, height, keepItems = true) => {
          if (Object.keys(validateRoomInput({ kind: 'rect', width: w, depth: d, height })).length) return false
          set((s) => ({
            rooms: withFirstRoom(s.rooms, { height, points: rectPoints(w, d) }),
            items: keepItems ? clampElevations(s.items, height) : [],
            pristine: false,
          }))
          return true
        },
        createLRoom: (w, d, height, cw, cd, keepItems = true) => {
          const input = { kind: 'L' as const, width: w, depth: d, height, cutWidth: cw, cutDepth: cd }
          if (Object.keys(validateRoomInput(input)).length) return false
          set((s) => ({
            rooms: withFirstRoom(s.rooms, { height, points: lPoints(w, d, cw, cd) }),
            items: keepItems ? clampElevations(s.items, height) : [],
            pristine: false,
          }))
          return true
        },
        createPolygonRoom: (points, height, keepItems = true, shift) => {
          const room = { height, points }
          if (validateRoom(room).length) return false
          set((s) => ({
            rooms: withFirstRoom(s.rooms, room),
            items: keepItems ? clampElevations(shiftItems(s.items, shift), height) : [],
            pristine: false,
          }))
          return true
        },
        addItem: (item) => {
          const n = normalizeItem(item, selectRoom(get()).height)
          if (!n) return false
          set((s) => ({ items: [...s.items, n], pristine: false }))
          return true
        },
        updateItem: (id, patch) => {
          const cur = get().items.find((it) => it.id === id)
          if (!cur) return false
          const n = normalizeItem({ ...cur, ...patch, id }, selectRoom(get()).height)
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

// 모서리 편집(FR-05) 상태와 동작. UI 상태는 Undo 비대상이고, 문서 변경은 항상 Undo 1단계다.
// 드래그 = beginCornerDrag -> moveCorner* -> endCornerDrag. 중간 이동은 zundo를 멈추고 이력 없이 반영하고,
// 끝에서 시작 상태로 되돌린 뒤 resume하고 최종값을 loadDocument 1회로 커밋한다(scene/dragSession.ts와 같은 방식).
// 드래그 중에는 dragLock으로 Undo·삭제·불러오기를 막고, 그래도 외부 변경이 있었으면(rooms·items 참조가 세션이 쓴 값과 다름) 복원·커밋 없이 resume만 한다.
import { create } from 'zustand'
import { roomsOverlap } from '../io/roomOverlap'
import { isDragging } from '../scene/dragSession'
import { snapStep } from '../scene/interaction'
import { deletePoint, insertPoint } from '../trace/draw'
import { editError, movePoint, relocateFixtures, setWallLength as wallLengthPoints } from '../trace/trace'
import { findRoom, getActiveRoom } from './activeRoom'
import { lockDoc, unlockDoc } from './dragLock'
import { applyRoomGeometry, planShift, shiftDocument, withRoom } from './rooms'
import type { DocData, Item, Point2, Room } from './types'
import { useDocStore } from './useDocStore'
import { useUiStore } from './useUiStore'

interface EditState {
  /** 편집 모드(2D 뷰에서 모서리·벽을 잡을 수 있음). 평소 false */
  editing: boolean
  selectedCorner: number | null
  selectedWall: number | null
  /** 드래그 중인 점 */
  draggingCorner: number | null
  setEditing: (on: boolean) => void
  selectCorner: (i: number | null) => void
  /** 벽 i = points[i] -> points[i+1]. 길이 입력 필드가 열린다(AC-05-2) */
  selectWall: (i: number | null) => void
  beginCornerDrag: (i: number) => boolean
  /** 스냅 적용 후 반영. 교차·상한 위반이면 반영하지 않고 false(마지막 유효 위치 유지). 끝에서 취소 처리 */
  moveCorner: (i: number, x: number, z: number) => boolean
  endCornerDrag: () => void
  cancelCornerDrag: () => void
  /** 벽 길이를 맞추도록 끝점 이동. Undo 1단계. 교차·범위 위반이면 원위치 + 토스트(AC-05-3) */
  setWallLength: (i: number, len: number) => boolean
  /** 벽 i 위 (x, z) 근처에 꼭짓점 추가(AC-05-5). Undo 1단계, 고정 요소 재배치(AC-05-4). 실패 시 토스트 + false */
  insertCorner: (wallIndex: number, x: number, z: number) => boolean
  /** 꼭짓점 삭제(3개 미만 불가). Undo 1단계. 실패 시 토스트 + false */
  deleteCorner: (i: number) => boolean
}

interface Session {
  start: DocData
  pristine: boolean
  /** 마지막 시도가 유효했는가 */
  lastOk: boolean
  /** 세션이 마지막으로 쓴 rooms 배열. 외부 변경 감지용 */
  lastRooms: Room[]
  /** 세션 중 items는 바뀌지 않아야 한다 */
  items: Item[]
}
let session: Session | null = null

const untouched = (s: Session): boolean => {
  const d = useDocStore.getState()
  return d.rooms === s.lastRooms && d.items === s.items
}

/** 세션 종료 공통: 잠금 해제 + zundo resume. 문서 복원은 호출자가 한다. */
const closeSession = () => {
  session = null
  unlockDoc('corner')
  useDocStore.temporal.getState().resume()
}

const notice = (m: string) => useUiStore.getState().setNotice(`⚠ ${m}`)

/** 활성 방 points 교체 + 고정 요소 재배치 + 좌표 이동을 문서에 1회 커밋(AC-05-4, Undo 1단계). 위반이면 오류 문구. */
function commitPoints(points: Point2[]): string | null {
  const doc = useDocStore.getState()
  const active = getActiveRoom()
  const err = editError(points)
  if (err) return err
  if (doc.rooms.some((r) => r.id !== active.id && roomsOverlap(r.points, points))) return '다른 방과 겹칩니다'
  const rooms = withRoom(doc.rooms, active.id, { height: active.height, points })
  const re = relocateFixtures(rooms, doc.items)
  // 좌표 불변식: 음수 좌표가 생기면 방·가구를 같은 양만큼 옮긴다(같은 Undo 단계)
  const shifted = shiftDocument({ rooms, items: re.items }, planShift(rooms))
  const shape = shifted.rooms.find((r) => r.id === active.id)
  if (!shape) return '방을 찾을 수 없습니다'
  const next = applyRoomGeometry(shifted, active.id, { height: shape.height, points: shape.points })
  if (!next) return '방 편집 결과가 저장 가능한 범위를 넘습니다'
  useDocStore.getState().loadDocument(next)
  if (re.unfit.length) notice(`${re.unfit.length}개 고정 요소가 들어갈 자리가 없어 그대로 두었습니다`)
  return null
}

/** 다른 방과 내부 면적이 겹치는가. */
const overlapsOther = (rooms: readonly Room[], activeId: string, points: Point2[]): boolean =>
  rooms.some((r) => r.id !== activeId && roomsOverlap(r.points, points))

export const useEditStore = create<EditState>()((set, get) => ({
  editing: false,
  selectedCorner: null,
  selectedWall: null,
  draggingCorner: null,
  setEditing: (editing) => {
    if (!editing) get().cancelCornerDrag()
    set({ editing, ...(editing ? {} : { selectedCorner: null, selectedWall: null }) })
  },
  selectCorner: (selectedCorner) => set({ selectedCorner, selectedWall: null }),
  selectWall: (selectedWall) => set({ selectedWall, selectedCorner: null }),
  beginCornerDrag: (i) => {
    get().cancelCornerDrag()
    const { rooms, items, pristine } = useDocStore.getState()
    const active = getActiveRoom()
    if (isDragging() || !active.points[i]) return false
    useDocStore.temporal.getState().pause()
    session = { start: { rooms, items }, pristine, lastOk: true, lastRooms: rooms, items }
    lockDoc('corner')
    set({ draggingCorner: i, selectedCorner: i, selectedWall: null })
    return true
  },
  moveCorner: (i, x, z) => {
    if (!session || i !== get().draggingCorner) return false
    if (!untouched(session)) {
      get().cancelCornerDrag() // 외부 변경 위에 계속 쓰지 않는다
      return false
    }
    const { rooms } = useDocStore.getState()
    const active = getActiveRoom()
    const pts = movePoint(active.points, i, x, z, snapStep(useUiStore.getState().snapEnabled))
    const ok = pts !== null && editError(pts) === null && !overlapsOther(rooms, active.id, pts)
    session.lastOk = ok
    if (!pts || !ok) return false
    useDocStore.setState({ rooms: withRoom(rooms, active.id, { ...active, points: pts }) }) // pause 상태라 이력에 안 남는다
    session.lastRooms = useDocStore.getState().rooms
    return true
  },
  endCornerDrag: () => {
    const s = session
    const i = get().draggingCorner
    set({ draggingCorner: null })
    if (!s || i === null) return closeSession()
    if (!untouched(s)) return closeSession() // 외부 변경: 복원·커밋 없이 pause만 푼다
    const finalRoom = getActiveRoom()
    useDocStore.setState({ rooms: s.start.rooms, items: s.start.items, pristine: s.pristine })
    closeSession()
    if (!s.lastOk) return notice('벽이 서로 교차하거나 방 크기 상한을 넘어 편집을 취소했습니다') // AC-05-3
    const a = finalRoom.points
    const b = findRoom(s.start.rooms, finalRoom.id).points
    if (a.length === b.length && a.every((p, k) => p[0] === b[k][0] && p[1] === b[k][1])) return // 이동 없음: 이력 없음
    const err = commitPoints(a)
    if (err) notice(err)
  },
  cancelCornerDrag: () => {
    const s = session
    if (!s) return
    set({ draggingCorner: null })
    if (untouched(s)) useDocStore.setState({ rooms: s.start.rooms, items: s.start.items, pristine: s.pristine })
    closeSession()
  },
  setWallLength: (i, len) => {
    if (isDragging() || session) return false
    const r = wallLengthPoints(getActiveRoom().points, i, len)
    const err = r.ok ? commitPoints(r.value) : r.error
    if (err) notice(err)
    return err === null
  },
  insertCorner: (wallIndex, x, z) => {
    if (isDragging() || session) return false
    const r = insertPoint(getActiveRoom().points, wallIndex, x, z, snapStep(useUiStore.getState().snapEnabled))
    const err = r.ok ? commitPoints(r.value) : r.error
    if (err) notice(err)
    else set({ selectedCorner: wallIndex + 1, selectedWall: null })
    return err === null
  },
  deleteCorner: (i) => {
    if (isDragging() || session) return false
    const r = deletePoint(getActiveRoom().points, i)
    const err = r.ok ? commitPoints(r.value) : r.error
    if (err) notice(err)
    else set({ selectedCorner: null, selectedWall: null })
    return err === null
  },
}))

// 방이 바뀌어(Undo·불러오기·교체) 인덱스가 무효가 되면 선택을 푼다.
useDocStore.subscribe((s) => {
  const room = findRoom(s.rooms, useUiStore.getState().activeRoomId)
  if (!room) return
  const e = useEditStore.getState()
  const n = room.points.length
  if ((e.selectedCorner ?? 0) >= n || (e.selectedWall ?? 0) >= n) e.selectCorner(null)
})

// 활성 방이 바뀌면 진행 중인 드래그를 취소하고 편집 선택을 지운다(Undo 비대상 UI 상태만 바뀐다).
useUiStore.subscribe((s, prev) => {
  if (s.activeRoomId === prev.activeRoomId) return
  const e = useEditStore.getState()
  if (e.draggingCorner !== null) e.cancelCornerDrag()
  if (e.selectedCorner !== null || e.selectedWall !== null) e.selectCorner(null)
})

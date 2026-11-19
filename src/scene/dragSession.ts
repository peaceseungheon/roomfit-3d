// 드래그 1회 = Undo 1단계(AC-13-2).
// 시작 때 zundo를 pause하고 중간 이동은 이력 없이 반영한다. 끝날 때 시작 상태로 되돌린 뒤 resume하고
// 최종 위치를 한 번 커밋해 pastStates에 시작 상태 하나만 쌓이게 한다.
// 세션 중 외부 변경(Undo·불러오기·삭제 등)이 감지되면 복원·커밋 없이 resume만 한다(덮어쓰기 방지).
import { isLocked, lockDoc, unlockDoc } from '../store/dragLock'
import { useDocStore } from '../store/useDocStore'
import type { Item, Vec3 } from '../store/types'

interface Session {
  id: string
  items: Item[]
  pristine: boolean
  /** 세션이 마지막으로 쓴 드래그 대상 객체. 외부 변경 감지용. */
  last: Item | undefined
}

let session: Session | null = null

/** 인자 없음 = 문서 변경 가드(가구·모서리 드래그 어느 쪽이든 true). id를 주면 그 항목의 가구 세션인지 본다. */
export const isDragging = (id?: string): boolean => (id === undefined ? isLocked() : session !== null && session.id === id)

/** 현재 items가 "시작 스냅샷 + 세션이 쓴 드래그 대상"과 참조 단위로 같은지. */
const untouched = (s: Session, cur: Item[]): boolean =>
  cur.length === s.items.length && cur.every((it, i) => it === (s.items[i].id === s.id ? s.last : s.items[i]))

/** 외부 변경이 없었으면 시작 상태로 되돌린다. 세션이 쓴 마지막 객체를 돌려주고, 외부 변경이면 undefined. */
const finish = (): { s: Session; last: Item | undefined } | null => {
  const s = session
  session = null
  unlockDoc('item')
  if (!s) return null
  const clean = untouched(s, useDocStore.getState().items)
  if (clean) useDocStore.setState({ items: s.items, pristine: s.pristine }) // pause 상태라 이력에 안 남는다
  useDocStore.temporal.getState().resume()
  return { s, last: clean ? s.last : undefined }
}

/** 없는 id면 false. 진행 중인 세션이 있으면 먼저 취소한다. */
export function beginDrag(id: string): boolean {
  cancelDrag()
  const { items, pristine } = useDocStore.getState()
  const start = items.find((it) => it.id === id)
  if (!start || isLocked('corner')) return false
  useDocStore.temporal.getState().pause()
  session = { id, items, pristine, last: start }
  lockDoc('item')
  return true
}

/** 스토어가 거부하면(updateItem false) 세션을 취소하고 false. */
export function moveDrag(position: Vec3): boolean {
  if (!session) return false
  if (!untouched(session, useDocStore.getState().items)) {
    cancelDrag() // 외부 변경 위에 계속 쓰지 않는다
    return false
  }
  const { id } = session
  if (useDocStore.getState().updateItem(id, { position })) {
    session.last = useDocStore.getState().items.find((it) => it.id === id)
    return true
  }
  cancelDrag()
  return false
}

/** 위치가 바뀌었으면 Undo 1단계로 커밋, 아니면 이력 없이 끝낸다. */
export function endDrag(): void {
  const r = finish()
  if (!r?.last) return
  const { s, last } = r
  const start = s.items.find((it) => it.id === s.id)
  if (start && start.position.every((v, i) => v === last.position[i])) return
  useDocStore.getState().updateItem(s.id, { position: last.position })
}

/** 시작 상태로 되돌리고 이력을 남기지 않는다(pointercancel, 언마운트, 거부). */
export function cancelDrag(): void {
  finish()
}

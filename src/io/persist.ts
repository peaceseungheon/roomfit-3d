import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import type { DocData, DocumentJson } from '../store/types'
import { parseDocument } from './validate'

export const STORAGE_KEY = 'roomfit3d.doc'
export const CORRUPT_BACKUP_KEY = 'roomfit:corrupt-backup'
export const SAVE_DEBOUNCE_MS = 1000

export const serializeDocument = (doc: DocData, now: Date = new Date(), space: number | undefined = 2): string => {
  const out: DocumentJson = {
    projectInfo: { version: '1.3', lastModified: now.toISOString() },
    rooms: doc.rooms,
    items: doc.items,
  }
  return JSON.stringify(out, null, space)
}

/**
 * 시작 시 저장본 복원. 없으면 샘플 유지. Undo 이력은 비운다. 복원했으면 true.
 * 검증 실패 시 손상 원문을 CORRUPT_BACKUP_KEY에 보존하고 useUiStore.restoreFailure에 오류를 남긴다.
 * 호출 순서: restoreSaved() 다음에 startAutoSave() (백업이 끝난 뒤에만 자동 저장이 샘플 상태를 덮어쓴다).
 */
export function restoreSaved(
  storage?: Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'setItem'>>,
): boolean {
  let text: string | null = null
  try {
    // 저장소 접근 차단(SecurityError)은 기본 인자가 아닌 try 안에서 잡는다.
    storage ??= localStorage
    text = storage.getItem(STORAGE_KEY)
  } catch {
    return false
  }
  if (!text) return false
  const r = parseDocument(text)
  if (!r.ok) {
    let backedUp = false
    try {
      if (storage.setItem) {
        storage.setItem(CORRUPT_BACKUP_KEY, text)
        backedUp = true
      }
    } catch {
      // 백업 실패(용량 등)여도 크래시하지 않고 backedUp=false로 알린다.
    }
    useUiStore.getState().setRestoreFailure({ errors: r.errors, backedUp })
    return false
  }
  useDocStore.getState().loadDocument({ rooms: r.value.rooms, items: r.value.items })
  useDocStore.temporal.getState().clear()
  return true
}

/** 문서 변경 시 1초 디바운스 자동 저장 시작. pagehide/beforeunload 때 대기 중 저장을 flush. 해제 함수를 반환한다. */
export function startAutoSave(
  storage?: Pick<Storage, 'setItem'>,
  delayMs = SAVE_DEBOUNCE_MS,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending = false
  const save = () => {
    pending = false
    const { rooms, items } = useDocStore.getState()
    try {
      ;(storage ??= localStorage).setItem(STORAGE_KEY, serializeDocument({ rooms, items }))
      useUiStore.getState().setSaveStatus('saved')
    } catch {
      useUiStore.getState().setSaveStatus('failed') // AC-14-5
    }
  }
  const flush = () => {
    if (!pending) return
    clearTimeout(timer)
    save()
  }
  const unsub = useDocStore.subscribe((s, prev) => {
    if (s.pristine) return // AC-02-2
    if (s.rooms === prev.rooms && s.items === prev.items) return
    clearTimeout(timer)
    pending = true
    timer = setTimeout(save, delayMs)
  })
  const w = typeof window === 'undefined' ? undefined : window
  w?.addEventListener('pagehide', flush)
  w?.addEventListener('beforeunload', flush)
  return () => {
    clearTimeout(timer)
    unsub()
    w?.removeEventListener('pagehide', flush)
    w?.removeEventListener('beforeunload', flush)
  }
}

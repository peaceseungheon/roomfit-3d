import { useEffect } from 'react'
import { useTraceStore } from '../store/useTraceStore'
import { deleteSelected, redo, undo } from './actions'

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

/** Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Delete. 입력 중에는 브라우저 기본 동작에 맡긴다. */
export function useEditorKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useTraceStore.getState().active) return // 트레이싱 중에는 문서 단축키 무시
      if (document.querySelector('[aria-modal="true"]')) return // 모달 중에는 문서 단축키 무시
      if (isTyping(e.target)) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        return e.shiftKey ? redo() : undo()
      }
      if (e.key === 'Delete' && !e.ctrlKey && !e.metaKey && !e.altKey) deleteSelected()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

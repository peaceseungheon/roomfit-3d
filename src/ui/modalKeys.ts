export const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'

interface KeyEvent {
  key: string
  shiftKey: boolean
  stopPropagation: () => void
  preventDefault: () => void
  nativeEvent: { stopPropagation: () => void }
}

/**
 * Modal 키 처리. 모달이 다른 대화상자(TraceScreen) 안에 렌더링되면 React 합성 이벤트가 바깥 onKeyDown으로 버블링되므로
 * nativeEvent뿐 아니라 합성 이벤트도 멈춘다(Esc 한 번에 확인창과 바깥 화면이 같이 닫히는 것을 막는다).
 */
export function modalKeyDown(e: KeyEvent, container: HTMLElement | null, onClose: () => void) {
  e.nativeEvent.stopPropagation() // 에디터 단축키가 문서를 바꾸지 않게
  e.stopPropagation()
  if (e.key === 'Escape') return onClose()
  if (e.key !== 'Tab' || !container) return
  const els = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)]
  if (!els.length) return
  const first = els[0]
  const last = els[els.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

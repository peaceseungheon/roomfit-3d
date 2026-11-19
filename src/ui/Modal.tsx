import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

/** 접근 가능한 모달: aria-modal, 열릴 때 포커스 이동·닫힐 때 복귀, Esc 닫기, Tab 순환. */
export default function Modal({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current
    if (el) (el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus()
    // 트리거가 사라졌으면(메뉴 항목 등) 표시해 둔 안전한 기본 요소로 복귀
    return () => (prev?.isConnected ? prev : document.querySelector<HTMLElement>('[data-modal-fallback]'))?.focus()
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    e.nativeEvent.stopPropagation() // 모달 중에는 Ctrl+Z·Delete 등 에디터 단축키가 문서를 바꾸지 않게
    if (e.key === 'Escape') return onClose()
    if (e.key !== 'Tab' || !ref.current) return
    const els = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
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

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return
        e.preventDefault() // 포커스가 body로 빠지지 않게
        ref.current?.focus()
      }}
    >
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  )
}

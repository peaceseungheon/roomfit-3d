import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { FOCUSABLE, modalKeyDown } from './modalKeys'

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

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => modalKeyDown(e, ref.current, onClose)

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

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

/** 상단 바 팝오버(메뉴·공유) 공용: 바깥 포인터·Esc로 닫고 Esc 시 토글 버튼에 포커스를 돌려준다. */
export function usePopover() {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const wrap = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      setOpen(false)
      toggle.current?.focus()
    }
  }
  return { open, setOpen, menuId, wrap, toggle, onKeyDown }
}

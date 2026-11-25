import { capturePng, copyShareLink } from './shareActions'
import { ShareIcon } from './icons'
import { usePopover } from './usePopover'

/** 상단 바 "공유": 작업의 결과를 내보내는 동작(링크·캡처)을 한 곳에 모은다(AC-14-7, AC-15-1/2). */
export default function ShareButton() {
  const { open, setOpen, menuId, wrap, toggle, onKeyDown } = usePopover()
  const choose = (run: () => void) => () => {
    setOpen(false)
    run()
  }
  return (
    <div className="menu-wrap" ref={wrap} onKeyDown={onKeyDown}>
      <button ref={toggle} data-modal-fallback aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((o) => !o)}>
        <ShareIcon /> 공유
      </button>
      {open && (
        <div id={menuId} className="menu" role="group" aria-label="공유">
          <button onClick={choose(() => void copyShareLink())}>공유 링크 복사</button>
          <button onClick={choose(() => capturePng(true))}>캡처(치수·경고 포함)</button>
          <button onClick={choose(() => capturePng(false))}>캡처(PNG)</button>
        </div>
      )}
    </div>
  )
}

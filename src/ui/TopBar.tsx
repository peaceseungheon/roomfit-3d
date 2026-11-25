import { useEffect, useRef } from 'react'
import { useUiStore, type CameraMode } from '../store/useUiStore'
import { redo, undo, useCanUndoRedo } from './actions'
import MenuButton from './MenuButton'
import ShareButton from './ShareButton'
import { BrandMark, CheckIcon, RedoIcon, UndoIcon, WarnIcon } from './icons'

const MODES: [CameraMode, string][] = [
  ['2D', '2D'],
  ['QUARTER', '3D 쿼터'],
  ['FIRST_PERSON', '1인칭'],
]

export function SnapToggle({ className }: { className?: string }) {
  const snap = useUiStore((s) => s.snapEnabled)
  return (
    <button className={className} aria-pressed={snap} onClick={() => useUiStore.getState().setSnapEnabled(!snap)}>
      스냅 {snap ? <CheckIcon /> : '꺼짐'}
    </button>
  )
}

/** 2D 치수 라벨 토글(AC-12-4). 2D 시점에서만 보인다. */
export function DimensionsToggle() {
  const on = useUiStore((s) => s.showDimensions)
  const is2D = useUiStore((s) => s.cameraMode === '2D')
  if (!is2D) return null
  return (
    <button aria-pressed={on} onClick={() => useUiStore.getState().setShowDimensions(!on)}>
      치수 표시
    </button>
  )
}

function SaveStatus() {
  const s = useUiStore((st) => st.saveStatus)
  if (s === 'failed')
    return (
      <span className="save failed" role="status">
        <WarnIcon /> 저장 실패<span className="wide-only"> (JSON 내보내기 권장)</span>
      </span>
    )
  if (s === 'saved')
    return (
      <span className="save wide-only" role="status">
        저장됨 <CheckIcon />
      </span>
    )
  return null
}

export default function TopBar() {
  const ref = useRef<HTMLElement>(null)
  // 좁은 폭에서 상단 바가 줄바꿈돼도 토스트가 겹치지 않도록 실제 높이를 CSS 변수로 공유
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--topbar-h', `${el.offsetHeight}px`))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const mode = useUiStore((s) => s.cameraMode)
  const { canUndo, canRedo } = useCanUndoRedo()
  return (
    <header ref={ref} className="topbar">
      <a className="brand" href="/" aria-label="랜딩 페이지로 돌아가기"><BrandMark /><strong>RoomFit</strong><small>3D</small></a>
      <div role="group" aria-label="시점 전환" className="seg">
        {MODES.map(([m, label]) => (
          <button key={m} aria-pressed={mode === m} onClick={() => useUiStore.getState().setCameraMode(m)}>
            {label}
          </button>
        ))}
      </div>
      <div className="seg">
        <button aria-label="실행 취소" title="실행 취소 (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <UndoIcon />
        </button>
        <button aria-label="다시 실행" title="다시 실행 (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>
          <RedoIcon />
        </button>
      </div>
      <SnapToggle className="desktop-only" />
      <SaveStatus />
      <ShareButton />
      <MenuButton />
    </header>
  )
}

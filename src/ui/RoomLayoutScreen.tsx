// S-10 방 배치 전체 화면(FR-23). TraceScreen과 같은 dialog 패턴: 열릴 때 포커스 이동, 닫힐 때 복귀, Esc 닫기, Tab 순환.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { findRoom } from '../store/activeRoom'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import RoomDialog from './RoomDialog'
import RoomEditPanel from './RoomEditPanel'
import { addRoomBlockedReason } from './roomForm'
import { FOCUSABLE, modalKeyDown } from './modalKeys'

export const LAYOUT_GUIDE = '방을 끌어서 이어 붙이세요. Shift: 달라붙기 해제'

export default function RoomLayoutScreen({ stage }: { stage?: ReactNode }) {
  const open = useUiStore((s) => s.layoutOpen)
  return open ? <Dialog stage={stage} /> : null
}

function Dialog({ stage }: { stage?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current
    if (el) (el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus()
    return () => (prev?.isConnected ? prev : document.querySelector<HTMLElement>('[data-modal-fallback]'))?.focus()
  }, [])
  const rooms = useDocStore((s) => s.rooms)
  const activeId = findRoom(rooms, useUiStore((s) => s.activeRoomId)).id
  const { closeLayout, setActiveRoomId } = useUiStore.getState()
  const [adding, setAdding] = useState(false)
  const blocked = addRoomBlockedReason(rooms)
  return (
    <>
    <div ref={ref} className="trace-screen" role="dialog" aria-modal="true" aria-label="방 배치" tabIndex={-1} onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => modalKeyDown(e, ref.current, closeLayout)}>
      <header className="trace-head">
        <strong>방 배치</strong>
        <span className="layout-guide">{LAYOUT_GUIDE}</span>
        <button type="button" className="layout-close" onClick={closeLayout}>
          에디터로 →
        </button>
      </header>
      <div className="trace-body">
        <div className="trace-stage layout-stage" data-trace-stage>
          {stage}
        </div>
        <RoomEditPanel key={activeId} />
      </div>
      <div className="layout-chips" role="group" aria-label="방 선택">
        {rooms.map((r) => (
          <button key={r.id} type="button" aria-pressed={r.id === activeId} onClick={() => setActiveRoomId(r.id)}>
            {r.name}
            {r.id === activeId ? ' ✓' : ''}
          </button>
        ))}
        <button type="button" disabled={blocked !== null} title={blocked ?? undefined} onClick={() => setAdding(true)}>
          + 방 추가
        </button>
      </div>
    </div>
    {/* 화면 div 밖에 둔다: 모달 Esc가 React 트리로 번져 S-10까지 닫는 것을 막는다. z-index(20)는 화면(15)보다 위 */}
    {adding && <RoomDialog mode="add" onClose={() => setAdding(false)} />}
    </>
  )
}

// S-04 방 목록: 활성 방 선택·이름 변경·삭제·추가. 방이 1개면 이름 + 추가 버튼 한 줄로 접는다.
import { useState } from 'react'
import { NAME_MAX } from '../io/validate'
import { useActiveRoomId } from '../store/activeRoom'
import type { Room } from '../store/types'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import ConfirmDialog from './ConfirmDialog'
import { addRoomBlockedReason } from './roomForm'
import RoomDialog from './RoomDialog'

const notice = (m: string) => useUiStore.getState().setNotice(m)

export default function RoomList() {
  const rooms = useDocStore((s) => s.rooms)
  const activeId = useActiveRoomId()
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  const [deleting, setDeleting] = useState<Room | null>(null)
  const [adding, setAdding] = useState(false)
  const blocked = addRoomBlockedReason(rooms)
  const single = rooms.length === 1

  const commitRename = () => {
    if (!renaming) return
    if (!useDocStore.getState().renameRoom(renaming.id, renaming.value)) notice(`⚠ 이름은 1~${NAME_MAX}자로 입력해 주세요`)
    setRenaming(null)
  }

  return (
    <>
      <div className="row">
        <ul role="list" aria-label="방 목록" className="room-list">
          {rooms.map((r) => (
            <li key={r.id}>
              {renaming?.id === r.id ? (
                <input
                  aria-label="방 이름"
                  autoFocus
                  maxLength={NAME_MAX}
                  value={renaming.value}
                  onChange={(e) => setRenaming({ id: r.id, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                  }}
                  onBlur={commitRename}
                />
              ) : (
                <button aria-current={r.id === activeId ? 'true' : undefined} onClick={() => useUiStore.getState().setActiveRoomId(r.id)}>
                  {r.name}
                </button>
              )}
              {r.kind && r.kind !== r.name && renaming?.id !== r.id && <span className="hint">{r.kind}</span>}
              {!single && renaming?.id !== r.id && (
                <button onClick={() => setRenaming({ id: r.id, value: r.name })}>이름 변경</button>
              )}
              {!single && <button onClick={() => setDeleting(r)}>삭제</button>}
            </li>
          ))}
        </ul>
        <button disabled={blocked !== null} title={blocked ?? undefined} onClick={() => setAdding(true)}>
          방 추가
        </button>
      </div>
      {blocked && <p className="hint">{blocked}</p>}
      {deleting && (
        <ConfirmDialog
          title="방 삭제"
          confirmLabel="삭제"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            if (!useDocStore.getState().removeRoom(deleting.id)) notice('⚠ 방을 삭제하지 못했습니다')
            setDeleting(null)
          }}
        >
          <p>「{deleting.name}」 방을 삭제할까요? 가구는 남습니다</p>
        </ConfirmDialog>
      )}
      {adding && <RoomDialog mode="add" onClose={() => setAdding(false)} />}
    </>
  )
}

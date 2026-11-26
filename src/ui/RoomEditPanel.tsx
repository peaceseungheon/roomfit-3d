// S-10 선택 방 편집 패널(FR-23, AC-23-5): 요약 + [이름·종류 바꾸기] [모양 다시 그리기] [삭제].
import { useState, type KeyboardEvent } from 'react'
import { NAME_MAX } from '../io/validate'
import { useActiveRoom } from '../store/activeRoom'
import { normalizeKind } from '../store/roomKinds'
import type { Room } from '../store/types'
import { useDocStore } from '../store/useDocStore'
import { useTraceStore } from '../store/useTraceStore'
import { useUiStore } from '../store/useUiStore'
import RoomDeleteConfirm from './RoomDeleteConfirm'
import RoomKindChips from './RoomKindChips'

const size = (r: Room): string => {
  const xs = r.points.map((p) => p[0])
  const zs = r.points.map((p) => p[1])
  return `${Math.round(Math.max(...xs) - Math.min(...xs))} × ${Math.round(Math.max(...zs) - Math.min(...zs))}cm`
}

function InfoForm({ room, onClose }: { room: Room; onClose: () => void }) {
  const rooms = useDocStore((s) => s.rooms)
  const [name, setName] = useState(room.name)
  const [kind, setKind] = useState(room.kind)
  const nm = name.trim()
  const bad = nm.length < 1 || nm.length > NAME_MAX
  const submit = () => {
    if (bad) return
    const k = kind === undefined ? undefined : normalizeKind(kind)
    if (!useDocStore.getState().updateRoomInfo(room.id, { name: nm, ...(k && { kind: k }) })) useUiStore.getState().setNotice('⚠ 이름·종류를 바꾸지 못했습니다')
    onClose()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.stopPropagation() // 폼만 닫고 방 배치 화면은 유지
    onClose()
  }
  return (
    <form
      onKeyDown={onKeyDown}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="field">
        <label htmlFor="room-edit-name">이름</label>
        <input id="room-edit-name" autoFocus maxLength={NAME_MAX} value={name} aria-invalid={bad} onChange={(e) => setName(e.target.value)} />
        {bad && (
          <span role="alert" className="field-error">
            1~{NAME_MAX}자로 입력해 주세요
          </span>
        )}
      </div>
      <RoomKindChips rooms={rooms} value={kind} onChange={setKind} />
      <div className="row">
        <button type="submit" className="primary" disabled={bad}>
          적용
        </button>
        <button type="button" onClick={onClose}>
          취소
        </button>
      </div>
    </form>
  )
}

export default function RoomEditPanel() {
  const room = useActiveRoom()
  const only = useDocStore((s) => s.rooms.length <= 1)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  return (
    <aside className="trace-side" aria-label="선택한 방">
      <h2>{room.name}</h2>
      <p className="hint">
        {room.kind ? `${room.kind} · ` : ''}
        {size(room)}
      </p>
      {editing ? (
        <InfoForm key={room.id} room={room} onClose={() => setEditing(false)} />
      ) : (
        <div className="row">
          <button type="button" onClick={() => setEditing(true)}>
            이름·종류 바꾸기
          </button>
        </div>
      )}
      <div className="row">
        <button type="button" onClick={() => useTraceStore.getState().startRedo(room.id)}>
          모양 다시 그리기
        </button>
        <button type="button" className="quiet-danger" disabled={only} title={only ? '마지막 방은 삭제할 수 없습니다' : undefined} onClick={() => setDeleting(true)}>
          삭제
        </button>
      </div>
      {only && <p className="hint">마지막 방은 삭제할 수 없습니다</p>}
      {deleting && <RoomDeleteConfirm room={room} onClose={() => setDeleting(false)} />}
    </aside>
  )
}

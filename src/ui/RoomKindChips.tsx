import { useState } from 'react'
import { KIND_MAX, kindChips, normalizeKind } from '../store/roomKinds'
import type { Room } from '../store/types'

interface Props {
  rooms: readonly Room[]
  value: string | undefined
  onChange: (kind: string) => void
}

/** FR-23 방 종류 칩: 기본 8개 + 문서에 이미 있는 직접 입력 종류 + [직접 입력]. */
export default function RoomKindChips({ rooms, value, onChange }: Props) {
  const [custom, setCustom] = useState<string | null>(null) // null이면 입력창 닫힘
  const chips = kindChips(rooms)
  const extra = value && !chips.includes(value) ? [value] : [] // 방금 직접 입력한 값도 선택 상태로 보인다
  const commit = () => {
    const k = normalizeKind(custom ?? '')
    if (k) {
      onChange(k)
      setCustom(null)
    }
  }
  return (
    <fieldset className="keep">
      <legend>방 종류</legend>
      <div role="radiogroup" aria-label="방 종류" className="row">
        {[...chips, ...extra].map((k) => (
          <button key={k} type="button" role="radio" aria-checked={value === k} aria-pressed={value === k} onClick={() => onChange(k)}>
            {k}
          </button>
        ))}
        <button type="button" onClick={() => setCustom(custom === null ? '' : null)}>
          직접 입력
        </button>
      </div>
      {custom !== null && (
        <div className="row">
          <input
            aria-label="방 종류 직접 입력"
            autoFocus
            maxLength={KIND_MAX}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              }
            }}
          />
          <button type="button" disabled={normalizeKind(custom) === null} onClick={commit}>
            확인
          </button>
        </div>
      )}
    </fieldset>
  )
}

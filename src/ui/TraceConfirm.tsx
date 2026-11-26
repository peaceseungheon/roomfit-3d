import { useState } from 'react'
import { useDocStore } from '../store/useDocStore'
import { useTraceStore } from '../store/useTraceStore'
import { addRoomBlockedReason } from './roomForm'

/** 닫힌 다각형 확정(천장고·기존 가구·[방 생성]·[방 생성 후 다음 방 따기]). */
export default function TraceConfirm() {
  const rooms = useDocStore((s) => s.rooms)
  const pristine = useDocStore((s) => s.pristine)
  const hasItems = useDocStore((s) => s.items.length > 0 && !s.pristine) // 손대지 않은 샘플 가구는 묻지 않고 비운다
  const mode = useTraceStore((s) => s.mode)
  const confirmed = useTraceStore((s) => s.confirmed)
  const lastHeight = useTraceStore((s) => s.lastHeight)
  const [height, setHeight] = useState(String(lastHeight))
  const [keep, setKeep] = useState(!pristine)
  const h = /^\d+$/.test(height.trim()) ? Number(height) : NaN
  const bad = !(h >= 180 && h <= 400)
  const firstReplace = mode === 'replace' && confirmed === 0 // 문서 전체를 교체하는 첫 방은 방 개수 상한과 무관
  const blocked = firstReplace ? null : addRoomBlockedReason(rooms)
  const disabled = bad || blocked !== null
  const commit = (next: boolean) => useTraceStore.getState().commitTrace(h, keep, next)
  if (mode === 'redo') {
    return (
      <div className="row">
        <button type="button" className="primary" onClick={() => commit(false)}>
          모양 적용
        </button>
      </div>
    )
  }
  return (
    <div>
      <div className="field">
        <label htmlFor="trace-h">천장고</label>
        <input id="trace-h" inputMode="numeric" value={height} aria-invalid={bad} onChange={(e) => setHeight(e.target.value)} />
        <span className="unit">cm</span>
        {bad && (
          <span role="alert" className="field-error">
            180~400 사이 정수
          </span>
        )}
      </div>
      {firstReplace && hasItems && (
        <fieldset className="keep">
          <legend>기존 가구</legend>
          {([true, false] as const).map((k) => (
            <label key={String(k)} className="radio-label">
              <input type="radio" name="trace-keep" checked={keep === k} onChange={() => setKeep(k)} /> {k ? '유지' : '삭제'}
            </label>
          ))}
          <p className="hint">되돌리기(Undo)로 복구할 수 있습니다.</p>
        </fieldset>
      )}
      <div className="row">
        <button type="button" className="primary" disabled={disabled} onClick={() => commit(false)}>
          방 생성
        </button>
        <button type="button" disabled={disabled} onClick={() => commit(true)}>
          방 생성 후 다음 방 따기
        </button>
      </div>
      {blocked && <p className="hint">{blocked}</p>}
    </div>
  )
}

import { useId, useState } from 'react'
import { getActiveRoom, useActiveRoom } from '../store/activeRoom'
import { useEditStore } from '../store/useEditStore'

function LengthForm({ wall, cur }: { wall: number; cur: number }) {
  const id = useId()
  const addMid = () => {
    const pts = getActiveRoom().points
    const a = pts[wall]
    const b = pts[(wall + 1) % pts.length]
    if (a && b) useEditStore.getState().insertCorner(wall, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2) // AC-05-5
  }
  const [v, setV] = useState(String(cur))
  const ok = /^\d+(\.\d+)?$/.test(v.trim())
  const apply = () => ok && useEditStore.getState().setWallLength(wall, Number(v))
  return (
    <section aria-label="벽 길이">
      <h2>벽 {wall + 1} 길이</h2>
      <div className="field">
        <label htmlFor={id}>길이</label>
        <input id={id} inputMode="decimal" value={v} aria-invalid={!ok} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && apply()} />
        <span className="unit">cm</span>
      </div>
      <button type="button" disabled={!ok} onClick={apply}>
        적용
      </button>
      <button type="button" onClick={addMid}>
        가운데에 점 추가
      </button>
      <p className="hint">한쪽 끝점이 이동해 길이가 맞춰집니다. 교차하면 취소됩니다.</p>
    </section>
  )
}

/** 선택한 꼭짓점 삭제(AC-05-5). 꼭짓점이 3개면 비활성. */
function CornerForm({ i, count }: { i: number; count: number }) {
  return (
    <section aria-label="꼭짓점">
      <h2>꼭짓점 {i + 1}</h2>
      <button type="button" disabled={count <= 3} onClick={() => useEditStore.getState().deleteCorner(i)}>
        점 삭제
      </button>
      <p className="hint">{count <= 3 ? '꼭짓점은 3개 이상 있어야 합니다.' : '삭제 결과가 교차하면 취소됩니다. 되돌리기(Undo)로 복구할 수 있습니다.'}</p>
    </section>
  )
}

/** 선택한 벽의 길이(cm) 입력(AC-05-2)·점 추가, 선택한 꼭짓점 삭제(AC-05-5). 벽·길이가 바뀌면 입력값을 새로 채운다(key). */
export default function WallEditor() {
  const wall = useEditStore((s) => s.selectedWall)
  const corner = useEditStore((s) => s.selectedCorner)
  const points = useActiveRoom().points
  if (corner !== null && points[corner]) return <CornerForm i={corner} count={points.length} />
  if (wall === null) return null
  const a = points[wall]
  const b = points[(wall + 1) % points.length]
  if (!a || !b) return null
  const cur = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) * 10) / 10
  return <LengthForm key={`${wall}:${cur}`} wall={wall} cur={cur} />
}

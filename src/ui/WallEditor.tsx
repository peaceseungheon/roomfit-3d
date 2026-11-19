import { useId, useState } from 'react'
import { useDocStore } from '../store/useDocStore'
import { useEditStore } from '../store/useEditStore'

function LengthForm({ wall, cur }: { wall: number; cur: number }) {
  const id = useId()
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
      <p className="hint">한쪽 끝점이 이동해 길이가 맞춰집니다. 교차하면 취소됩니다.</p>
    </section>
  )
}

/** 선택한 벽의 길이(cm) 입력(AC-05-2). 벽이 선택됐을 때만 보인다. 벽·길이가 바뀌면 입력값을 새로 채운다(key). */
export default function WallEditor() {
  const wall = useEditStore((s) => s.selectedWall)
  const points = useDocStore((s) => s.room.points)
  if (wall === null) return null
  const a = points[wall]
  const b = points[(wall + 1) % points.length]
  if (!a || !b) return null
  const cur = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) * 10) / 10
  return <LengthForm key={`${wall}:${cur}`} wall={wall} cur={cur} />
}

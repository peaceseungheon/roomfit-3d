import { useState } from 'react'
import { KIND_LABEL } from './warningText'
import { useWarnings } from '../scene/useWarnings'
import { itemLabel } from '../store/catalog'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'


export default function WarningBadge() {
  const warnings = useWarnings()
  const items = useDocStore((s) => s.items)
  const [open, setOpen] = useState(false)
  const nameOf = (id?: string) => {
    const it = items.find((x) => x.id === id)
    return it ? itemLabel(it) : '이름 없음'
  }

  if (warnings.length === 0) return <div className="badge ok">문제 없음 ✓</div>
  return (
    <div className="warn-wrap">
      <button className="badge warn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        ⚠ 경고 {warnings.length} {open ? '▾' : '▸'}
      </button>
      {open && (
        <ul className="warn-list" aria-label="경고 목록">
          {warnings.map((w, i) => (
            <li key={`${w.itemId}-${w.kind}-${w.otherId ?? i}`}>
              <button onClick={() => useUiStore.getState().select(w.itemId)}>
                ⚠ {nameOf(w.itemId)} · {KIND_LABEL[w.kind]}
                {w.otherId ? ` (${nameOf(w.otherId)})` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

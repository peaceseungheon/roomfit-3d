import { useId, useState } from 'react'
import { parseIntField } from './itemFields'

interface Props {
  label: string
  value: number
  min: number
  max: number
  unit?: string
  /** 스토어가 거부하면 false */
  onCommit: (v: number) => boolean
}

/** 정수 입력. Enter/blur 때 검증하고 틀리면 값을 반영하지 않고 오류를 보인다. */
export default function Field({ label, value, min, max, unit = 'cm', onCommit }: Props) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const commit = () => {
    if (draft === null) return
    const r = parseIntField(draft, min, max)
    if (!r.ok) return setError(r.error)
    if (r.value !== value && !onCommit(r.value)) return setError('반영할 수 없는 값입니다')
    setDraft(null)
    setError(null)
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        inputMode="numeric"
        value={draft ?? String(value)}
        aria-invalid={error !== null}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(null)
            setError(null)
          }
        }}
      />
      <span className="unit">{unit}</span>
      {error && (
        <span id={`${id}-err`} role="alert" className="field-error">
          {error}
        </span>
      )}
    </div>
  )
}

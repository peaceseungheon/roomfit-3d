import { useId } from 'react'

export default function NumField({ label, value, error, unit = 'cm', onChange }: { label: string; value: string; error?: string; unit?: string; onChange: (v: string) => void }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        aria-invalid={error !== undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="unit">{unit}</span>
      {error && (
        <span id={`${id}-err`} className="field-error">
          {error}
        </span>
      )}
    </div>
  )
}

import { useRef, useState } from 'react'
import { NAME_MAX } from '../io/validate'
import { useUiStore } from '../store/useUiStore'
import { DIMENSION_BOX } from '../store/catalog'
import { addDimensionBox } from './actions'
import CategorySelect from './CategorySelect'
import { parseBoxForm, type BoxForm } from './itemFields'

const EMPTY: BoxForm = { w: '', d: '', h: '' }
const LABELS = { w: '가로 W', d: '깊이 D', h: '높이 H' } as const

/** FR-09 치수 박스 생성 폼. 오류가 하나라도 있으면 아무것도 추가하지 않는다(AC-09-4). */
export default function DimensionBoxForm() {
  const [f, setF] = useState<BoxForm>(EMPTY)
  const [name, setName] = useState('')
  const [color, setColor] = useState(DIMENSION_BOX.color)
  const [category, setCategory] = useState<string | undefined>()
  const [errors, setErrors] = useState<Partial<Record<keyof BoxForm, string>>>({})

  const refs = useRef<Partial<Record<keyof BoxForm, HTMLInputElement | null>>>({})

  const submit = () => {
    const r = parseBoxForm(f)
    if (!r.ok) {
      setErrors(r.errors)
      const first = (['w', 'd', 'h'] as const).find((k) => r.errors[k])
      if (first) refs.current[first]?.focus()
      return
    }
    if (!addDimensionBox({ size: r.size, name, color, category })) {
      useUiStore.getState().setNotice('⚠ 치수 박스를 추가하지 못했습니다. 입력은 그대로 유지됩니다.')
      return
    }
    setErrors({})
    setF(EMPTY)
    setName('')
  }

  return (
    <section aria-label="치수 박스">
      <h2>치수 박스</h2>
      <p className="hint">구매 예정 가구 크기를 입력하면 반투명 박스로 배치해 봅니다.</p>
      {(['w', 'd', 'h'] as const).map((k) => (
        <div className="field" key={k}>
          <label htmlFor={`box-${k}`}>{LABELS[k]}</label>
          <input
            id={`box-${k}`}
            ref={(el) => {
              refs.current[k] = el
            }}
            inputMode="numeric"
            value={f[k]}
            aria-invalid={errors[k] !== undefined}
            aria-describedby={errors[k] ? `box-${k}-err` : undefined}
            onChange={(e) => {
              setF({ ...f, [k]: e.target.value })
              if (errors[k]) setErrors(({ [k]: _drop, ...rest }) => rest)
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <span className="unit">cm</span>
          {errors[k] && (
            <span id={`box-${k}-err`} className="field-error">
              {errors[k]}
            </span>
          )}
        </div>
      ))}
      <div className="field">
        <label htmlFor="box-name">이름(선택)</label>
        <input id="box-name" maxLength={NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="box-color">색상</label>
        <input id="box-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <span className="unit">{color}</span>
      </div>
      <CategorySelect id="box-category" value={category} onChange={setCategory} />
      <button className="primary" onClick={submit}>치수 박스 추가</button>
    </section>
  )
}

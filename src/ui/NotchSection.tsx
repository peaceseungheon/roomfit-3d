// S-03 "홈/돌출 추가": 사각형(또는 ㄱ자)에서 벽 하나를 골라 홈(안쪽) 또는 돌출(바깥쪽)을 반복해서 더한다(AC-03-5).
import { useState } from 'react'
import type { Point2 } from '../store/types'
import NumField from './NumField'
import type { RoomForm } from './roomForm'
import { checkNotchDraft, emptyNotchDraft, type NotchDraft, type NotchDraftErrors } from './roomNotch'

interface Props {
  form: RoomForm
  /** 홈·돌출을 적용한 현재 윤곽. 프리셋 입력이 유효하지 않으면 null */
  outline: Point2[] | null
  onChange: (f: RoomForm) => void
}

export default function NotchSection({ form, outline, onChange }: Props) {
  const [draft, setDraft] = useState<NotchDraft>(emptyNotchDraft)
  const [errors, setErrors] = useState<NotchDraftErrors>({})
  const notches = form.notches ?? []
  const set = (k: 'wall' | 'offset' | 'width' | 'depth') => (v: string) => {
    setErrors({})
    setDraft((d) => ({ ...d, [k]: v }))
  }

  const add = () => {
    if (!outline) return
    const r = checkNotchDraft(outline, draft)
    if (!r.ok) return setErrors(r.errors)
    setErrors({})
    onChange({ ...form, notches: [...notches, r.spec] })
    setDraft((d) => ({ ...d, width: '', depth: '' }))
  }
  const reset = (next: typeof notches) => {
    setErrors({})
    onChange({ ...form, notches: next })
  }

  return (
    <fieldset className="keep">
      <legend>홈/돌출 추가</legend>
      <p className="hint">미리보기의 벽 번호를 고르세요. 위치는 벽 시작점에서 잰 거리입니다.</p>
      <NumField label="벽 번호" unit="번" value={draft.wall} error={errors.wall} onChange={set('wall')} />
      <div role="radiogroup" aria-label="종류" className="row">
        {(['cut', 'bump'] as const).map((k) => (
          <label key={k} className="radio-label">
            <input type="radio" name="notch-kind" checked={draft.kind === k} onChange={() => {
                setErrors({})
                setDraft((d) => ({ ...d, kind: k }))
              }} />{' '}
            {k === 'cut' ? '홈(안쪽)' : '돌출(바깥쪽)'}
          </label>
        ))}
      </div>
      <NumField label="위치" value={draft.offset} error={errors.offset} onChange={set('offset')} />
      <NumField label="너비" value={draft.width} error={errors.width} onChange={set('width')} />
      <NumField label="깊이" value={draft.depth} error={errors.depth} onChange={set('depth')} />
      {errors.form && (
        <p role="alert" className="field-error">
          {errors.form}
        </p>
      )}
      <div className="row">
        <button type="button" onClick={add} disabled={!outline}>
          추가
        </button>
        <button type="button" onClick={() => reset(notches.slice(0, -1))} disabled={notches.length === 0}>
          마지막 지우기
        </button>
        <button type="button" onClick={() => reset([])} disabled={notches.length === 0}>
          초기화
        </button>
      </div>
      {notches.length > 0 && <p className="hint">추가한 홈/돌출 {notches.length}개</p>}
    </fieldset>
  )
}

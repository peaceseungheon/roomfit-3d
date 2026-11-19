import { useState } from 'react'
import type { RoomInputErrors } from '../io/validate'
import { getActiveRoom } from '../store/activeRoom'
import { useDocStore } from '../store/useDocStore'
import { useTraceStore } from '../store/useTraceStore'
import { useUiStore } from '../store/useUiStore'
import Modal from './Modal'
import { countOutsideFurniture, formItems, formRoom, initialRoomForm, notchesError, roomFormErrors, submitRoomForm, type RoomForm } from './roomForm'
import RoomPreview from './RoomPreview'
import NumField from './NumField'
import NotchSection from './NotchSection'

type NumKey = 'width' | 'depth' | 'height' | 'cutWidth' | 'cutDepth'

/** S-03 방 만들기. 오류가 하나라도 있으면 "만들기" 비활성(AC-03-3). */
export default function RoomDialog({ onClose }: { onClose: () => void }) {
  const items = useDocStore((s) => s.items)
  const hasItems = items.length > 0
  const [form, setForm] = useState<RoomForm>(() => initialRoomForm(getActiveRoom()))
  const errors: RoomInputErrors = roomFormErrors(form)
  const staleNotches = notchesError(form)
  const invalid = Object.keys(errors).length > 0 || staleNotches !== null
  const next = formRoom(form)
  const outside = next && form.keepItems ? countOutsideFurniture(next, formItems(form, items)) : 0
  const set = (k: NumKey) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault()
    if (invalid) return
    if (submitRoomForm(form)) onClose()
    else useUiStore.getState().setNotice('⚠ 방을 만들지 못했습니다. 잠시 뒤 다시 시도하세요')
  }

  return (
    <Modal title="방 만들기" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div role="radiogroup" aria-label="방 모양" className="row">
          {(['rect', 'L'] as const).map((k) => (
            <label key={k} className="radio-label">
              <input type="radio" name="room-kind" checked={form.kind === k} onChange={() => setForm((f) => ({ ...f, kind: k, notches: [] }))} />{' '}
              {k === 'rect' ? '직사각형' : 'ㄱ자'}
            </label>
          ))}
        </div>
        <NumField label="가로" value={form.width} error={errors.width} onChange={set('width')} />
        <NumField label="세로" value={form.depth} error={errors.depth} onChange={set('depth')} />
        {form.kind === 'L' && (
          <>
            <NumField label="잘림 가로" value={form.cutWidth} error={errors.cutWidth} onChange={set('cutWidth')} />
            <NumField label="잘림 세로" value={form.cutDepth} error={errors.cutDepth} onChange={set('cutDepth')} />
            <p className="hint">잘리는 영역은 우상단 모서리입니다.</p>
          </>
        )}
        <RoomPreview room={next} numbered />
        {staleNotches && (
          <p role="alert" className="field-error">
            {staleNotches} 홈/돌출을 지우거나 값을 고쳐 주세요.
          </p>
        )}
        <NotchSection key={form.kind} form={form} outline={next ? next.points : null} onChange={setForm} />
        <NumField label="천장고" value={form.height} error={errors.height} onChange={set('height')} />
        {hasItems && (
          <fieldset className="keep">
            <legend>기존 가구</legend>
            {([true, false] as const).map((keep) => (
              <label key={String(keep)} className="radio-label">
                <input type="radio" name="keep-items" checked={form.keepItems === keep} onChange={() => setForm((f) => ({ ...f, keepItems: keep }))} />{' '}
                {keep ? '유지' : '삭제'}
              </label>
            ))}
            {outside > 0 && (
              <p role="status" className="field-error">
                ⚠ {outside}개 가구가 방 밖에 놓입니다(경고로 표시)
              </p>
            )}
            <p className="hint">되돌리기(Undo)로 복구할 수 있습니다. 방 밖이 된 가구는 경고로 표시됩니다.</p>
          </fieldset>
        )}
        <div className="row">
          <button
            type="button"
            onClick={() => {
              useTraceStore.getState().start()
              onClose()
            }}
          >
            그려서 만들기(평면도 배경 선택 가능)
          </button>
        </div>
        <div className="row end">
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button type="submit" disabled={invalid}>
            만들기
          </button>
        </div>
      </form>
    </Modal>
  )
}

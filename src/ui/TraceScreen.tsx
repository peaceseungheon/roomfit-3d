import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useDocStore } from '../store/useDocStore'
import { selectCanClose, traceStep, useTraceStore, type TraceStep } from '../store/useTraceStore'
import { TRACE_DEFAULT_HEIGHT } from '../trace/trace'
import ConfirmDialog from './ConfirmDialog'

const STEPS: [TraceStep[], string][] = [
  [['upload'], '① 업로드'],
  [['baseline'], '② 축척'],
  [['corners', 'closed'], '③ 모서리'],
]

const GUIDE: Record<TraceStep, string> = {
  upload: '평면도 이미지(PNG/JPG)를 선택하세요.',
  baseline: '이미지 위에 기준선 두 점을 찍고 실제 길이(cm)를 입력해 [적용]을 누르세요.',
  corners: '모서리를 순서대로 클릭하세요. 첫 점을 다시 누르거나 [닫기]를 누르면 닫힙니다.',
  closed: '다각형이 닫혔습니다. 천장고를 확인하고 [방 생성]을 누르세요.',
}

function Upload() {
  const ref = useRef<HTMLInputElement>(null)
  const pick = async (f: File | undefined) => {
    if (f) await useTraceStore.getState().loadImageFile(f)
    if (ref.current) ref.current.value = ''
  }
  return (
    <div
      className="trace-drop"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        void pick(e.dataTransfer.files[0])
      }}
    >
      <p>이미지를 끌어다 놓거나 선택하세요</p>
      <input ref={ref} type="file" accept="image/png,image/jpeg" aria-label="평면도 이미지" onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  )
}

function BaselineForm() {
  const id = useId()
  const [cm, setCm] = useState('')
  const count = useTraceStore((s) => s.baseline.length)
  const scale = useTraceStore((s) => s.scale)
  const err = useTraceStore((s) => s.baselineError)
  const apply = () => useTraceStore.getState().applyScale(/^\d+(\.\d+)?$/.test(cm.trim()) ? Number(cm) : NaN)
  return (
    <div className="field">
      <label htmlFor={id}>실제 길이</label>
      <input
        id={id}
        inputMode="decimal"
        value={cm}
        aria-invalid={err !== null}
        disabled={count < 2}
        onChange={(e) => setCm(e.target.value)}
        onKeyDown={(e: KeyboardEvent) => e.key === 'Enter' && apply()}
      />
      <span className="unit">cm</span>
      {err && (
        <span role="alert" className="field-error">
          {err}
        </span>
      )}
      <button type="button" disabled={count < 2} onClick={apply}>
        적용
      </button>
      {scale !== null && <span className="hint">축척 설정됨 ({scale.toFixed(3)} cm/px)</span>}
    </div>
  )
}

/** FR-19 윤곽 자동 제안(선택 사항). 이미지는 브라우저 안에서만 처리한다. */
function SuggestPanel() {
  const running = useTraceStore((s) => s.suggest === 'running')
  const hasCandidate = useTraceStore((s) => s.candidate !== null)
  const scaled = useTraceStore((s) => s.scale !== null)
  const hasCorners = useTraceStore((s) => s.corners.length > 0)
  const [ask, setAsk] = useState(false)
  const t = useTraceStore.getState()
  const live = running
    ? '분석 중…'
    : hasCandidate
      ? scaled
        ? '점선 제안 점을 [제안 적용]으로 확정하세요.'
        : '점선 제안 점은 축척을 설정한 뒤 [제안 적용]으로 확정됩니다.'
      : ''
  return (
    <div className="suggest">
      <div className="row">
        {running ? (
          <button type="button" onClick={t.cancelSuggest}>
            취소
          </button>
        ) : (
          <button type="button" onClick={() => void t.requestSuggest()}>
            윤곽 자동 제안
          </button>
        )}
        <button type="button" disabled={!hasCandidate || !scaled} onClick={() => (hasCorners ? setAsk(true) : t.applySuggestion())}>
          제안 적용
        </button>
      </div>
      <p className="hint" aria-live="polite">
        {live}
      </p>
      {ask && (
        <ConfirmDialog
          title="제안 적용"
          confirmLabel="적용"
          onConfirm={() => {
            setAsk(false)
            useTraceStore.getState().applySuggestion()
          }}
          onCancel={() => setAsk(false)}
        >
          <p>이미 찍은 모서리가 제안 점으로 대체됩니다. 계속할까요?</p>
        </ConfirmDialog>
      )}
    </div>
  )
}

function Confirm() {
  const hasItems = useDocStore((s) => s.items.length > 0)
  const [height, setHeight] = useState(String(TRACE_DEFAULT_HEIGHT))
  const [keep, setKeep] = useState(true)
  const h = /^\d+$/.test(height.trim()) ? Number(height) : NaN
  const bad = !(h >= 180 && h <= 400)
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
      {hasItems && (
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
      <button type="button" disabled={bad} onClick={() => useTraceStore.getState().commitTrace(h, keep)}>
        방 생성
      </button>
    </div>
  )
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * S-04 평면도 트레이싱 전체 화면. stage에 2D 캔버스(5b)를 넣는다. 없으면 이미지 미리보기만 보인다.
 * 단계 표시·안내·기준선 길이·닫기·되돌리기·취소·방 생성을 담당한다.
 */
export default function TraceScreen({ stage }: { stage?: ReactNode }) {
  const active = useTraceStore((s) => s.active)
  return active ? <Dialog stage={stage} /> : null
}

function Dialog({ stage }: { stage?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  // 열릴 때 포커스 이동, 닫힐 때 원래 요소로 복귀(Modal과 같은 방식)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current
    if (el) (el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus()
    return () => (prev?.isConnected ? prev : document.querySelector<HTMLElement>('[data-modal-fallback]'))?.focus()
  }, [])
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    e.nativeEvent.stopPropagation() // 에디터 단축키가 문서를 바꾸지 않게
    if (e.key === 'Escape') return useTraceStore.getState().cancel() // 취소 버튼과 같은 동작(PRD에 별도 확인 규정 없음)
    if (e.key !== 'Tab' || !ref.current) return
    const els = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (!els.length) return
    const first = els[0]
    const last = els[els.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  const image = useTraceStore((s) => s.image)
  const step = useTraceStore(traceStep)
  const count = useTraceStore((s) => s.corners.length)
  const canClose = useTraceStore(selectCanClose)
  const error = useTraceStore((s) => s.error)
  const scaled = useTraceStore((s) => s.scale !== null)
  const t = useTraceStore.getState()
  return (
    <div ref={ref} className="trace-screen" role="dialog" aria-modal="true" aria-label="평면도로 방 만들기" tabIndex={-1} onKeyDown={onKeyDown}>
      <header className="trace-head">
        <strong>평면도로 방 만들기</strong>
        <ol className="trace-steps">
          {STEPS.map(([ss, label]) => (
            <li key={label} aria-current={ss.includes(step) ? 'step' : undefined}>
              {label}
            </li>
          ))}
        </ol>
      </header>
      <div className="trace-body">
        <div className="trace-stage" data-trace-stage>
          {stage ?? (image ? <img src={image.url} alt="평면도" /> : null)}
        </div>
        <aside className="trace-side">
          <p>{GUIDE[step]}</p>
          {(!image || step !== 'closed') && <Upload />}
          {image && (
            <>
              {step !== 'closed' && <SuggestPanel />}
              {step !== 'closed' && <BaselineForm />}
              {!scaled && <p className="hint">축척을 설정하기 전에는 모서리를 찍을 수 없습니다.</p>}
              {error && (
                <p role="alert" className="field-error">
                  {error.message}
                </p>
              )}
              <div className="row">
                <button type="button" disabled={count === 0 && step !== 'closed'} onClick={step === 'closed' ? t.reopenTrace : t.undoTracePoint}>
                  {step === 'closed' ? '다시 편집' : '되돌리기'}
                </button>
                {scaled && (
                  <button type="button" onClick={t.redoBaseline}>
                    기준선 다시 찍기
                  </button>
                )}
                <button type="button" disabled={!canClose} onClick={() => t.closeTrace()}>
                  닫기
                </button>
              </div>
              {step === 'closed' && <Confirm />}
            </>
          )}
          <div className="row end">
            <button type="button" onClick={t.cancel}>
              취소
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

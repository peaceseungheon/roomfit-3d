import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useDocStore } from '../store/useDocStore'
import { selectCanClose, selectIsBlank, traceStep, useTraceStore, type TraceStep } from '../store/useTraceStore'
import ConfirmDialog from './ConfirmDialog'
import TraceConfirm from './TraceConfirm'

const STEPS: [TraceStep[], string][] = [
  [['upload'], '① 업로드'],
  [['baseline'], '② 축척'],
  [['corners', 'closed'], '③ 모서리'],
]

/** 빈 캔버스(이미지 없이 그리기)의 단계 표시 */
const BLANK_STEPS: [TraceStep[], string][] = [
  [['corners'], '① 그리기'],
  [['closed'], '② 방 생성'],
]

const BLANK_GUIDE: Record<TraceStep, string> = {
  upload: '',
  baseline: '',
  corners: '격자 위를 클릭해 모서리를 순서대로 찍으세요. 첫 점을 다시 누르거나 [닫기]를 누르면 닫힙니다. 단위는 cm입니다.',
  closed: '다각형이 닫혔습니다. 선 위를 눌러 점을 추가하고, 점을 눌러 선택한 뒤 [점 삭제]할 수 있습니다. 천장고를 확인하고 [방 생성]을 누르세요.',
}

const GUIDE: Record<TraceStep, string> = {
  upload: '평면도 이미지(PNG/JPG)를 선택하세요.',
  baseline: '이미지 위에 기준선 두 점을 찍고 실제 길이(cm)를 입력해 [적용]을 누르세요.',
  corners: '모서리를 순서대로 클릭하세요. 첫 점을 다시 누르거나 [닫기]를 누르면 닫힙니다.',
  closed: '다각형이 닫혔습니다. 선 위를 눌러 점을 추가하고, 점을 눌러 선택한 뒤 [점 삭제]할 수 있습니다. 천장고를 확인하고 [방 생성]을 누르세요.',
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

/** 그리기 보조(FR-04): 직각 보정 토글, 길이 입력으로 다음 점 추가(방향은 마지막 포인터 위치 쪽 축). */
function DrawTools() {
  const id = useId()
  const ortho = useTraceStore((s) => s.ortho)
  const count = useTraceStore((s) => s.corners.length)
  const err = useTraceStore((s) => s.lengthError)
  const ghostOffset = useTraceStore((s) => s.offset !== null)
  const hasRooms = useDocStore((s) => s.rooms.length > 0)
  const hasGhosts = ghostOffset && hasRooms
  const neighborSnap = useTraceStore((s) => s.neighborSnap)
  const [len, setLen] = useState('')
  const add = () => {
    if (useTraceStore.getState().addTracePointByLength(/^\d+(\.\d+)?$/.test(len.trim()) ? Number(len) : NaN)) setLen('')
  }
  return (
    <div className="draw-tools">
      <label className="radio-label">
        <input type="checkbox" checked={ortho} onChange={(e) => useTraceStore.getState().setOrtho(e.target.checked)} /> 수평·수직 고정
      </label>
      {hasGhosts && (
        <>
          <label className="radio-label">
            <input type="checkbox" checked={neighborSnap} onChange={(e) => useTraceStore.getState().setNeighborSnap(e.target.checked)} /> 이웃 방에 붙이기
          </label>
          <p className="hint">Shift를 누르고 있으면 이웃 방 스냅이 꺼집니다</p>
        </>
      )}
      <div className="field">
        <label htmlFor={id}>다음 점까지 길이</label>
        <input
          id={id}
          inputMode="decimal"
          value={len}
          aria-invalid={err !== null}
          aria-describedby={err ? `${id}-err` : undefined}
          disabled={count === 0}
          onChange={(e) => {
            setLen(e.target.value)
            useTraceStore.getState().clearLengthError()
          }}
          onKeyDown={(e: KeyboardEvent) => e.key === 'Enter' && add()}
        />
        <span className="unit">cm</span>
        <button type="button" disabled={count === 0} onClick={add}>
          점 추가
        </button>
        {err && (
          <span id={`${id}-err`} role="alert" className="field-error">
            {err}
          </span>
        )}
      </div>
      <p className="hint">{count === 0 ? '먼저 시작점을 클릭하세요.' : '마우스를 둔 쪽 방향으로 입력한 길이만큼 점이 추가됩니다.'}</p>
    </div>
  )
}

/** 닫힌 뒤 선택한 점 삭제(AC-05-5). */
function DeleteTool() {
  const selected = useTraceStore((s) => s.selected)
  const count = useTraceStore((s) => s.corners.length)
  return (
    <div className="row">
      <button type="button" disabled={selected === null || count <= 3} onClick={() => selected !== null && useTraceStore.getState().deleteTracePoint(selected)}>
        점 삭제
      </button>
      {count <= 3 && <span className="hint">꼭짓점은 3개 이상 있어야 합니다.</span>}
    </div>
  )
}

/** 빈 캔버스에서 배경 이미지를 올리는 선택 항목(올리면 기준선 단계가 필요하다). */
function BackgroundOption() {
  const count = useTraceStore((s) => s.corners.length)
  return (
    <details className="trace-bg">
      <summary>배경 이미지 올리기(선택)</summary>
      <p className="hint">평면도 이미지를 깔고 따라 그릴 수 있습니다. 올리면 기준선으로 축척을 정해야 하며{count > 0 ? ' 지금까지 찍은 점은 지워집니다' : ''}.</p>
      <Upload />
    </details>
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
  const image = useTraceStore((s) => s.image)
  const step = useTraceStore(traceStep)
  const count = useTraceStore((s) => s.corners.length)
  const canClose = useTraceStore(selectCanClose)
  const error = useTraceStore((s) => s.error)
  const scaled = useTraceStore((s) => s.scale !== null)
  const blank = useTraceStore(selectIsBlank)
  const confirmed = useTraceStore((s) => s.confirmed)
  const locked = confirmed > 0 // 첫 방 확정 뒤에는 이미지·축척·기준선을 바꿀 수 없다
  const [askBlank, setAskBlank] = useState(false)
  const [askLeave, setAskLeave] = useState(false)
  const t = useTraceStore.getState()
  // 확정한 방이 있고 진행 중인 방이 있을 때만 확인한다. 방 1개 흐름(confirmed 0)은 즉시 취소.
  const leave = () => (confirmed >= 1 && count >= 3 ? setAskLeave(true) : t.cancel())
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    e.nativeEvent.stopPropagation() // 에디터 단축키가 문서를 바꾸지 않게
    if (e.key === 'Escape') return leave() // 끝내기 버튼과 같은 동작
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
  const steps = blank ? BLANK_STEPS : STEPS
  return (
    <div ref={ref} className="trace-screen" role="dialog" aria-modal="true" aria-label="평면도로 방 만들기" tabIndex={-1} onKeyDown={onKeyDown}>
      <header className="trace-head">
        <strong>평면도로 방 만들기</strong>
        <ol className="trace-steps">
          {steps.map(([ss, label]) => (
            <li key={label} aria-current={ss.includes(step) ? 'step' : undefined}>
              {label}
            </li>
          ))}
        </ol>
        <span aria-live="polite">{confirmed >= 1 ? `방 ${confirmed}개 확정` : ''}</span>
      </header>
      <div className="trace-body">
        <div className="trace-stage" data-trace-stage>
          {stage ?? (image ? <img src={image.url} alt="평면도" /> : null)}
        </div>
        <aside className="trace-side">
          <p>{confirmed >= 1 && step !== 'closed' ? `방 ${confirmed}개 확정. 다음 방의 모서리를 찍거나 [끝내기]를 누르세요.` : (blank ? BLANK_GUIDE : GUIDE)[step]}</p>
          {blank && !locked && step !== 'closed' && <BackgroundOption />}
          {image && !locked && step !== 'closed' && <Upload />}
          {image && (
            <>
              {step !== 'closed' && <SuggestPanel />}
              {!locked && step !== 'closed' && <BaselineForm />}
              {!locked && step !== 'closed' && (
                <button type="button" onClick={() => setAskBlank(true)}>
                  배경 없이 그리기
                </button>
              )}
              {!scaled && <p className="hint">축척을 설정하기 전에는 모서리를 찍을 수 없습니다.</p>}
              {error && (
                <p role="alert" className="field-error">
                  {error.message}
                </p>
              )}
              {step === 'corners' && <DrawTools />}
              <div className="row">
                <button type="button" disabled={count === 0 && step !== 'closed'} onClick={step === 'closed' ? t.reopenTrace : t.undoTracePoint}>
                  {step === 'closed' ? '다시 편집' : '되돌리기'}
                </button>
                {scaled && !locked && (
                  <button type="button" onClick={t.redoBaseline}>
                    기준선 다시 찍기
                  </button>
                )}
                <button type="button" className="primary" disabled={!canClose} onClick={() => t.closeTrace()}>
                  닫기
                </button>
              </div>
              {step === 'closed' && <DeleteTool />}
              {step === 'closed' && <TraceConfirm />}
            </>
          )}
          {blank && (
            <>
              {error && (
                <p role="alert" className="field-error">
                  {error.message}
                </p>
              )}
              {step === 'corners' && <DrawTools />}
              <div className="row">
                <button type="button" disabled={count === 0 && step !== 'closed'} onClick={step === 'closed' ? t.reopenTrace : t.undoTracePoint}>
                  {step === 'closed' ? '다시 편집' : '마지막 점 되돌리기'}
                </button>
                <button type="button" className="primary" disabled={!canClose} onClick={() => t.closeTrace()}>
                  닫기
                </button>
              </div>
              {step === 'closed' && <DeleteTool />}
              {step === 'closed' && <TraceConfirm />}
            </>
          )}
          {askBlank && (
            <ConfirmDialog
              title="배경 없이 그리기"
              confirmLabel="계속"
              onConfirm={() => {
                setAskBlank(false)
                useTraceStore.getState().start()
              }}
              onCancel={() => setAskBlank(false)}
            >
              <p>배경 이미지와 찍은 점이 모두 지워지고 빈 캔버스로 돌아갑니다. 계속할까요?</p>
            </ConfirmDialog>
          )}
          {askLeave && (
            <ConfirmDialog title="끝내기" confirmLabel="끝내기" onConfirm={t.cancel} onCancel={() => setAskLeave(false)}>
              <p>진행 중인 방은 버려집니다. 이미 확정한 방은 유지됩니다. 끝낼까요?</p>
            </ConfirmDialog>
          )}
          <div className="row end">
            <button type="button" onClick={leave}>
              {confirmed >= 1 ? '끝내기' : '취소'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useUiStore } from '../store/useUiStore'
import { WarnIcon } from './icons'

const TOAST_MS = 4000 // 일반 안내
const ALERT_MS = 10000 // 오류·경고는 읽고 대응할 시간을 더 준다

function dismiss() {
  useUiStore.getState().setNotice(null)
  useUiStore.getState().setRestoreFailure(null)
}

/** 토스트가 떠 있는 동안만 마운트된다. 닫히면 언마운트되어 paused가 자연히 초기화된다(mouseleave·blur가 오지 않는 경우 포함). */
function ToastBody({ message, isAlert, seq }: { message: string; isAlert: boolean; seq: number }) {
  // 포인터가 올라가 있거나 포커스가 안에 있는 동안은 타이머를 멈추고, 벗어나면 처음부터 다시 센다(WCAG 2.2.1)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const t = setTimeout(dismiss, isAlert ? ALERT_MS : TOAST_MS)
    return () => clearTimeout(t)
  }, [message, seq, isAlert, paused])

  return (
    <div
      className="toast"
      role={isAlert ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {isAlert && <WarnIcon />}
      <span>{message.replace(/^⚠\s*/, '')}</span>
      {isAlert && (
        <button type="button" aria-label="알림 닫기" onClick={dismiss}>
          닫기
        </button>
      )}
    </div>
  )
}

export default function Toast() {
  const notice = useUiStore((s) => s.notice)
  const seq = useUiStore((s) => s.noticeSeq)
  const failure = useUiStore((s) => s.restoreFailure)
  const first = failure?.errors[0]
  const message =
    notice ??
    (failure
      ? `저장본을 불러오지 못해 샘플로 열었습니다${failure.backedUp ? ' (원본은 백업됨)' : ''}${first ? `: ${first.path} ${first.message}` : ''}`
      : null)

  // 오류·경고(문구가 ⚠로 시작, 저장본 복원 실패 포함)는 alert, 그 외 안내는 status
  const isAlert = notice === null || notice.startsWith('⚠')
  return message ? <ToastBody message={message} isAlert={isAlert} seq={seq} /> : null
}

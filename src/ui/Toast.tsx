import { useEffect } from 'react'
import { useUiStore } from '../store/useUiStore'

const TOAST_MS = 4000

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

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => {
      useUiStore.getState().setNotice(null)
      useUiStore.getState().setRestoreFailure(null)
    }, TOAST_MS)
    return () => clearTimeout(t)
  }, [message, seq])

  return message ? (
    // 오류·경고(문구가 ⚠로 시작, 저장본 복원 실패 포함)는 alert, 그 외 안내는 status
    <div className="toast" role={notice === null || notice.startsWith('⚠') ? 'alert' : 'status'}>
      {message}
    </div>
  ) : null
}

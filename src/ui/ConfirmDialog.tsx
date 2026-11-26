import type { ReactNode } from 'react'
import Modal from './Modal'

interface Props {
  title: string
  children: ReactNode
  confirmLabel?: string
  /** true면 취소 버튼 없이 확인(닫기)만 보인다. 오류 알림용 */
  alertOnly?: boolean
  /** true면 alertOnly여도 role="alert"를 달지 않는다. 오류가 아닌 안내용 */
  info?: boolean
  /** 있으면 취소와 확인 사이에 보조 버튼을 둔다. */
  extraLabel?: string
  onExtra?: () => void
  onConfirm: () => void
  onCancel: () => void
}

/** 공용 확인 대화상자(S-07). 파괴적 동작이므로 기본 포커스는 취소에 둔다. */
export default function ConfirmDialog({ title, children, confirmLabel = '계속', alertOnly, info, extraLabel, onExtra, onConfirm, onCancel }: Props) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div role={alertOnly && !info ? 'alert' : undefined}>{children}</div>
      <div className="row end">
        {!alertOnly && (
          <button data-autofocus onClick={onCancel}>
            취소
          </button>
        )}
        {extraLabel && <button onClick={onExtra}>{extraLabel}</button>}
        <button className="primary" data-autofocus={alertOnly ? '' : undefined} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

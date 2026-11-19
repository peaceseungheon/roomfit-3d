import type { ReactNode } from 'react'
import Modal from './Modal'

interface Props {
  title: string
  children: ReactNode
  confirmLabel?: string
  /** true면 취소 버튼 없이 확인(닫기)만 보인다. 오류 알림용 */
  alertOnly?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** 공용 확인 대화상자(S-07). 파괴적 동작이므로 기본 포커스는 취소에 둔다. */
export default function ConfirmDialog({ title, children, confirmLabel = '계속', alertOnly, onConfirm, onCancel }: Props) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div role={alertOnly ? 'alert' : undefined}>{children}</div>
      <div className="row end">
        {!alertOnly && (
          <button data-autofocus onClick={onCancel}>
            취소
          </button>
        )}
        <button data-autofocus={alertOnly ? '' : undefined} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

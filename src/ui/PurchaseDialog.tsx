import { useDocStore } from '../store/useDocStore'
import { patchItem } from './actions'
import Modal from './Modal'
import PurchaseList from './PurchaseList'

/** 상단 바 "구매 리스트": 현재 문서의 리스트. 체크는 Undo 대상이다. */
export default function PurchaseDialog({ onClose }: { onClose: () => void }) {
  const items = useDocStore((s) => s.items)
  return (
    <Modal title="구매 리스트" onClose={onClose}>
      <PurchaseList items={items} onToggle={(id, purchased) => patchItem(id, { purchased })} />
      <div className="row end">
        <button className="primary" data-autofocus onClick={onClose}>
          닫기
        </button>
      </div>
    </Modal>
  )
}

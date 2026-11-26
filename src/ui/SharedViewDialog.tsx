import type { DocData } from '../store/types'
import Modal from './Modal'
import PurchaseList from './PurchaseList'

interface Props {
  doc: DocData
  onLoad: () => void
  onClose: () => void
}

/** AC-14-8 열람 모드: 문서 스토어·자동 저장본을 건드리지 않고 공유받은 배치를 읽기 전용으로 보인다. */
export default function SharedViewDialog({ doc, onLoad, onClose }: Props) {
  const furniture = doc.items.filter((it) => it.type === 'FURNITURE').length
  return (
    <Modal title="공유받은 배치" onClose={onClose}>
      <p>
        {doc.rooms.map((r) => r.name).join(', ')} · 방 {doc.rooms.length}개 · 가구 {furniture}개
      </p>
      <p className="hint">읽기 전용입니다. 내 작업과 자동 저장본은 바뀌지 않습니다.</p>
      <PurchaseList items={doc.items} />
      <div className="row end">
        <button onClick={onLoad}>내 작업으로 불러오기</button>
        <button className="primary" data-autofocus onClick={onClose}>
          닫기
        </button>
      </div>
    </Modal>
  )
}

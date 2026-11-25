import { useState } from 'react'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import { importDocument } from './actions'
import Modal from './Modal'
import RoomDialog from './RoomDialog'
import { shouldShowStart } from './startFlow'
import TemplateList from './TemplateList'

type View = 'choose' | 'templates' | 'room'

/** S-09 첫 진입 시작 화면: 평면도 만들기 → 예시 배치 → 샘플로 바로 시작. 닫으면(Esc) 샘플 방으로 시작한다. */
export default function StartDialog() {
  const [view, setView] = useState<View | null>(() =>
    shouldShowStart(useDocStore.getState().pristine, useUiStore.getState().restoreFailure !== null, location.hash) ? 'choose' : null,
  )
  const close = () => setView(null)
  if (view === 'room') return <RoomDialog mode="replace" onClose={close} />
  if (view === 'templates')
    return (
      <Modal title="예시 배치로 시작" onClose={close}>
        <TemplateList
          onPick={(doc) => {
            importDocument(doc)
            close()
          }}
        />
        <div className="row end">
          <button onClick={() => setView('choose')}>뒤로</button>
        </div>
      </Modal>
    )
  if (view === 'choose')
    return (
      <Modal title="어떻게 시작할까요?" onClose={close}>
        <ul className="template-list">
          <li>
            <button data-autofocus onClick={() => setView('room')}>
              <strong>내 방 평면도 만들기</strong>
              <span className="hint"> 가로·세로를 입력하거나 평면도 이미지를 따라 그립니다</span>
            </button>
          </li>
          <li>
            <button onClick={() => setView('templates')}>
              <strong>예시 배치로 시작</strong>
              <span className="hint"> 원룸·침실·거실 중 골라 가구 치수만 바꿔 봅니다</span>
            </button>
          </li>
          <li>
            <button onClick={close}>
              <strong>샘플 방으로 바로 시작</strong>
              <span className="hint"> 400×300cm 샘플 방에서 바로 가구를 놓아 봅니다</span>
            </button>
          </li>
        </ul>
      </Modal>
    )
  return null
}

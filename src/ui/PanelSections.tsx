import { useState } from 'react'
import { FIXTURE_CATALOG } from '../store/catalog'
import { useEditStore } from '../store/useEditStore'
import { useUiStore } from '../store/useUiStore'
import { addFixture } from './actions'
import RoomDialog from './RoomDialog'

/** S-05 고정 요소 4종. 벽 클릭 대신 버튼으로 가장 긴 벽 빈 구간 중앙에 추가한다. */
export function FixtureList() {
  return (
    <section aria-label="고정 요소">
      <h2>고정 요소</h2>
      <ul className="catalog">
        {FIXTURE_CATALOG.map((c) => (
          <li key={c.modelType}>
            <button onClick={() => addFixture(c.modelType)}>{c.name}</button>
          </li>
        ))}
      </ul>
      <p className="hint">추가 후 벽을 따라 드래그해 위치를 옮깁니다.</p>
    </section>
  )
}

export function RoomSection() {
  const [open, setOpen] = useState(false)
  const editing = useEditStore((s) => s.editing)
  // 편집 모드는 2D 뷰 전용이라 켤 때 2D로 바꾸고 가구 선택을 푼다(편집 중 가구는 잡히지 않는다).
  const toggleEdit = () => {
    if (!editing) {
      useUiStore.getState().select(null)
      useUiStore.getState().setCameraMode('2D')
    }
    useEditStore.getState().setEditing(!editing)
  }
  return (
    <section aria-label="방">
      <h2>방</h2>
      <button onClick={() => setOpen(true)}>새 방 만들기</button>
      <button aria-pressed={editing} onClick={toggleEdit}>
        {editing ? '모서리 편집 끝내기' : '모서리 편집'}
      </button>
      {editing && <p className="hint">2D 뷰에서 모서리를 끌어 옮기고, 벽을 눌러 길이를 입력합니다.</p>}
      {open && <RoomDialog onClose={() => setOpen(false)} />}
    </section>
  )
}

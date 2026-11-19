// 문서 변경 가드 공용 잠금. 가구 드래그(scene/dragSession)와 모서리 드래그(store/useEditStore)가 이름으로 잠그고 푼다.
// 어느 한쪽이라도 잠겨 있으면 Undo·삭제·불러오기 등 문서 변경 동작을 막는다. 이 모듈은 다른 store/scene을 import하지 않는다(순환 방지).
const held = new Set<string>()

export const lockDoc = (name: string) => void held.add(name)
export const unlockDoc = (name: string) => void held.delete(name)
export const isLocked = (name?: string): boolean => (name === undefined ? held.size > 0 : held.has(name))

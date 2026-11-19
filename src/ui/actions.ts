// 문서 변경 동작. 드래그 중에는 모두 막는다(드래그 세션 보호).
import { useStore } from 'zustand'
import { isDragging } from '../scene/dragSession'
import { findCatalog } from '../store/catalog'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import type { DocData } from '../store/types'
import { makeFixture } from './fixturePlacement'
import { makeDimensionBox, makeDuplicate, makeFromCatalog } from './placement'

const temporal = () => useDocStore.temporal.getState()

export const undo = () => {
  if (!isDragging()) temporal().undo()
}
export const redo = () => {
  if (!isDragging()) temporal().redo()
}

export function useCanUndoRedo() {
  const canUndo = useStore(useDocStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useDocStore.temporal, (s) => s.futureStates.length > 0)
  return { canUndo, canRedo }
}

export function addFromCatalog(modelType: string) {
  const entry = findCatalog(modelType)
  if (!entry || isDragging()) return
  const { room, items, addItem } = useDocStore.getState()
  const item = makeFromCatalog(entry, room, items)
  if (addItem(item)) useUiStore.getState().select(item.id)
}

/** 성공하면 true. 드래그 중이거나 스토어가 거부하면 false. */
export function addDimensionBox(spec: Parameters<typeof makeDimensionBox>[0]): boolean {
  if (isDragging()) return false
  const { room, items, addItem } = useDocStore.getState()
  const item = makeDimensionBox(spec, room, items)
  if (!addItem(item)) return false
  useUiStore.getState().select(item.id)
  return true
}

/** 고정 요소를 가장 긴 벽의 빈 구간 중앙에 추가하고 선택한다(AC-06-1). */
export function addFixture(modelType: string) {
  if (isDragging()) return
  const { room, items, addItem } = useDocStore.getState()
  const item = makeFixture(modelType, room, items)
  if (item && addItem(item)) useUiStore.getState().select(item.id)
}

/** 검증을 통과한 문서로 덮어쓴다. Undo 1단계(AC-14-4). */
export function importDocument(doc: DocData) {
  if (isDragging()) return
  useDocStore.getState().loadDocument(doc)
  useUiStore.getState().select(null)
}

/** 샘플로 되돌린다. Undo 1단계(AC-14-6). */
export function resetToSample() {
  if (isDragging()) return
  useDocStore.getState().resetToSample()
  useUiStore.getState().select(null)
}

export function deleteSelected() {
  const id = useUiStore.getState().selectedId
  if (!id || isDragging()) return
  if (useDocStore.getState().items.some((it) => it.id === id)) useDocStore.getState().removeItem(id)
  useUiStore.getState().select(null)
}

/** 가구만 복제한다. 고정 요소는 벽 위치가 같아 겹치므로 제외. */
export function duplicateSelected() {
  const id = useUiStore.getState().selectedId
  const { items, addItem } = useDocStore.getState()
  const src = items.find((it) => it.id === id)
  if (!src || src.type !== 'FURNITURE' || isDragging()) return
  const copy = makeDuplicate(src, items)
  if (addItem(copy)) useUiStore.getState().select(copy.id)
}

/** 입력 변경. 드래그 중이거나 스토어가 거부하면 false. */
export function patchItem(id: string, patch: Parameters<ReturnType<typeof useDocStore.getState>['updateItem']>[1]) {
  if (isDragging()) return false
  return useDocStore.getState().updateItem(id, patch)
}

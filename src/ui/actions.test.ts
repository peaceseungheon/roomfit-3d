import { beforeEach, describe, expect, it } from 'vitest'
import { createSample } from '../store/sample'
import { selectRoom, useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import type { Item } from '../store/types'
import { deleteSelected } from './actions'

const item = (id: string, extra: Partial<Item> = {}): Item => ({
  id,
  type: 'FIXTURE',
  modelType: 'WINDOW',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  size: [10, 10, 10],
  ...extra,
})

beforeEach(() => {
  useDocStore.setState({ ...createSample(), pristine: true })
  useDocStore.temporal.getState().clear()
  useUiStore.setState({ selectedId: null })
})

describe('elevation 상한', () => {
  it('addItem/updateItem은 0~천장고로 clamp', () => {
    const h = selectRoom(useDocStore.getState()).height
    useDocStore.getState().addItem(item('e1', { elevation: h + 50 }))
    expect(useDocStore.getState().items.find((i) => i.id === 'e1')?.elevation).toBe(h)
    useDocStore.getState().updateItem('e1', { elevation: -5 })
    expect(useDocStore.getState().items.find((i) => i.id === 'e1')?.elevation).toBe(0)
  })
  it('천장고를 낮추면 기존 elevation도 clamp(keepItems)', () => {
    useDocStore.getState().createRectRoom(400, 300, 400, true)
    useDocStore.getState().addItem(item('e1', { elevation: 400 }))
    useDocStore.getState().createRectRoom(400, 300, 250, true)
    expect(useDocStore.getState().items.find((i) => i.id === 'e1')?.elevation).toBe(250)
    useDocStore.getState().addItem(item('e2', { elevation: 240 }))
    const room = selectRoom(useDocStore.getState())
    useDocStore.getState().setRoom({ ...room, height: 200 })
    expect(useDocStore.getState().items.find((i) => i.id === 'e2')?.elevation).toBe(200)
  })
})

describe('선택 정리', () => {
  it('추가 -> Undo -> Delete 해도 Redo가 유지된다', () => {
    useDocStore.getState().addItem(item('n1'))
    useUiStore.getState().select('n1')
    useDocStore.temporal.getState().undo()
    expect(useUiStore.getState().selectedId).toBeNull()
    deleteSelected()
    expect(useDocStore.temporal.getState().futureStates.length).toBe(1)
    useDocStore.temporal.getState().redo()
    expect(useDocStore.getState().items.some((i) => i.id === 'n1')).toBe(true)
  })
  it('없는 id 선택 상태에서 deleteSelected는 문서를 건드리지 않는다', () => {
    useUiStore.setState({ selectedId: 'ghost' })
    const before = useDocStore.getState().items
    deleteSelected()
    expect(useDocStore.getState().items).toBe(before)
  })
})

import { createSample as sampleForSelect } from '../store/sample'
import { useDocStore as docStoreForSelect } from '../store/useDocStore'
import { useUiStore as uiStoreForSelect } from '../store/useUiStore'
import { importDocument as importForSelect, resetToSample as resetForSelect } from './actions'

describe('불러오기/초기화 후 선택 해제', () => {
  it('importDocument, resetToSample 이후 selectedId가 null', () => {
    uiStoreForSelect.getState().select('x')
    importForSelect(sampleForSelect())
    expect(uiStoreForSelect.getState().selectedId).toBeNull()
    uiStoreForSelect.getState().select('x')
    resetForSelect()
    expect(uiStoreForSelect.getState().selectedId).toBeNull()
    expect(docStoreForSelect.getState().items.length).toBeGreaterThan(0)
  })
})

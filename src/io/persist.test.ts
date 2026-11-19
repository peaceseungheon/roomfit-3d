import { beforeEach, describe, expect, it } from 'vitest'
import { restoreSaved, serializeDocument } from './persist'
import { parseDocument } from './validate'
import { createSample } from '../store/sample'
import { useDocStore } from '../store/useDocStore'

/** localStorage 대역. 넘긴 초기값 외에는 null을 돌려준다. */
const fakeStorage = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    dump: () => m,
  }
}

/** 1.0 저장본(room 1개) 텍스트 */
const legacyText = (): string => {
  const { rooms, items } = createSample()
  return JSON.stringify({
    projectInfo: { version: '1.0', lastModified: '2026-11-19T00:00:00.000Z' },
    room: { height: rooms[0].height, points: rooms[0].points },
    items,
  })
}

beforeEach(() => {
  useDocStore.setState({ ...createSample(), pristine: true })
  useDocStore.temporal.getState().clear()
})

describe('serializeDocument', () => {
  it('version 1.1과 rooms를 쓰고 room 키는 쓰지 않는다', () => {
    const out = JSON.parse(serializeDocument(createSample()))
    expect(out.projectInfo.version).toBe('1.1')
    expect(out.rooms).toHaveLength(1)
    expect(out).not.toHaveProperty('room')
  })

  it('직렬화 → parseDocument 왕복 시 rooms·items가 같다', () => {
    const doc = createSample()
    const r = parseDocument(serializeDocument(doc))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.rooms).toEqual(doc.rooms)
      expect(r.value.items).toEqual(doc.items)
    }
  })
})

describe('restoreSaved', () => {
  const KEY = 'roomfit3d.doc'

  it('1.0 저장본을 rooms 1개로 복원하고 true를 돌려준다', () => {
    const r = restoreSaved(fakeStorage({ [KEY]: legacyText() }))
    expect(r).toBe(true)
    const s = useDocStore.getState()
    expect(s.rooms[0].id).toBe('r1')
    expect(s.items).toEqual(createSample().items)
  })

  it('1.0 복원 뒤 저장 문자열의 version은 1.1이다', () => {
    restoreSaved(fakeStorage({ [KEY]: legacyText() }))
    const s = useDocStore.getState()
    const out = JSON.parse(serializeDocument({ rooms: s.rooms, items: s.items }))
    expect(out.projectInfo.version).toBe('1.1')
    expect(out.rooms).toHaveLength(1)
  })

  it('저장본이 없으면 false이고 샘플을 유지한다', () => {
    expect(restoreSaved(fakeStorage())).toBe(false)
    expect(useDocStore.getState().rooms[0].id).toBe('r1')
  })
})

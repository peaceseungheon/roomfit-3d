import { describe, expect, it } from 'vitest'
import { DEFAULT_KINDS, kindChips, normalizeKind, roomNameForKind } from './roomKinds'
import { useDocStore } from './useDocStore'
import { parseDocument } from '../io/validate'
import { serializeDocument } from '../io/persist'

const names = (...n: string[]) => n.map((name) => ({ name }))

describe('roomNameForKind', () => {
  it('같은 이름이 없으면 종류 그대로', () => expect(roomNameForKind('작은방', names('거실'))).toBe('작은방'))
  it('있으면 가장 작은 미사용 번호(>=2)', () => {
    expect(roomNameForKind('작은방', names('작은방'))).toBe('작은방 2')
    expect(roomNameForKind('작은방', names('작은방', '작은방 2'))).toBe('작은방 3')
    expect(roomNameForKind('작은방', names('작은방', '작은방 3'))).toBe('작은방 2')
  })
})

describe('normalizeKind / kindChips', () => {
  it('trim, 빈 값·20자 초과 거부', () => {
    expect(normalizeKind('  서재 ')).toBe('서재')
    expect(normalizeKind('   ')).toBeNull()
    expect(normalizeKind('가'.repeat(21))).toBeNull()
    expect(normalizeKind('가'.repeat(20))).not.toBeNull()
  })
  it('문서의 사용자 kind를 중복 없이 덧붙인다', () => {
    const c = kindChips([{ kind: '서재' }, { kind: '서재' }, { kind: '거실' }, {}])
    expect(c).toEqual([...DEFAULT_KINDS, '서재'])
  })
})

describe('kind 저장·검증', () => {
  const room = { id: 'r1', name: '서재', kind: '서재', height: 230, points: [[0, 0], [300, 0], [300, 300], [0, 300]] }
  const doc = (version: string, r: object) => ({ projectInfo: { version, lastModified: 'x' }, rooms: [r], items: [] })
  it('1.2 kind를 받고 20자 초과는 거부, 1.1은 kind 없이 읽는다', () => {
    expect(parseDocument(JSON.stringify(doc('1.2', room))).ok).toBe(true)
    const bad = parseDocument(JSON.stringify(doc('1.2', { ...room, kind: '가'.repeat(21) })))
    expect(bad.ok).toBe(false)
    const { kind: _k, ...noKind } = room
    expect(parseDocument(JSON.stringify(doc('1.1', noKind))).ok).toBe(true)
  })
  it('내보내기는 1.2이고 kind가 왕복한다', () => {
    const text = serializeDocument({ rooms: [room] as never, items: [] })
    const r = parseDocument(text)
    expect(r.ok && r.value.projectInfo.version).toBe('1.2')
    expect(r.ok && r.value.rooms[0].kind).toBe('서재')
  })
  it('addRoom은 kind와 번호 붙은 이름으로 추가한다', () => {
    const shape = { height: 230, points: [[1000, 0], [1200, 0], [1200, 200], [1000, 200]] as [number, number][] }
    useDocStore.getState().resetToSample()
    useDocStore.getState().addRoom(shape, undefined, '작은방')
    const s2 = { height: 230, points: [[1300, 0], [1500, 0], [1500, 200], [1300, 200]] as [number, number][] }
    useDocStore.getState().addRoom(s2, undefined, '작은방')
    const rs = useDocStore.getState().rooms
    expect(rs.map((r) => r.name).slice(1)).toEqual(['작은방', '작은방 2'])
    expect(rs[2].kind).toBe('작은방')
    useDocStore.getState().createPolygonRoom(shape.points, 230, true, undefined, '안방')
    expect(useDocStore.getState().rooms).toMatchObject([{ name: '안방', kind: '안방' }])
  })
})

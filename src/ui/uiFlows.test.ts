import { beforeEach, describe, expect, it } from 'vitest'
import { processImportText, readImportFile } from '../io/importFile'
import { serializeDocument } from '../io/persist'
import { createSample } from '../store/sample'
import { selectRoom, useDocStore } from '../store/useDocStore'
import { addFixture, importDocument, resetToSample } from './actions'
import { makeFixture } from './fixturePlacement'
import { initialRoomForm, roomFormErrors, submitRoomForm, type RoomForm } from './roomForm'
import { useUiStore } from '../store/useUiStore'

const reset = () => {
  useDocStore.setState({ ...createSample(), pristine: true })
  useDocStore.temporal.getState().clear()
  useUiStore.getState().select(null)
}
const form = (o: Partial<RoomForm> = {}): RoomForm => ({
  kind: 'rect', width: '500', depth: '400', height: '240', cutWidth: '150', cutDepth: '120', keepItems: true, ...o,
})
const past = () => useDocStore.temporal.getState().pastStates.length

beforeEach(reset)

describe('roomForm', () => {
  it('prefills from the current room', () => {
    expect(initialRoomForm(selectRoom(useDocStore.getState()))).toMatchObject({ kind: 'rect', width: '400', depth: '300', height: '230' })
  })
  it('reports field errors for bad input and blocks submit (AC-03-3)', () => {
    expect(Object.keys(roomFormErrors(form({ width: '', depth: '50', height: '1.5' })))).toEqual(['width', 'depth', 'height'])
    expect(roomFormErrors(form({ width: '3001' })).width).toBeDefined()
    expect(submitRoomForm(form({ width: 'abc' }))).toBe(false)
    expect(selectRoom(useDocStore.getState()).points[1][0]).toBe(400)
    expect(past()).toBe(0)
  })
  it('L-room cut must be smaller than the whole', () => {
    expect(roomFormErrors(form({ kind: 'L', cutWidth: '500' })).cutWidth).toBeDefined()
    expect(roomFormErrors(form({ kind: 'L' }))).toEqual({})
  })
  it('confirm is one undo step; keep/delete items (AC-03-4)', () => {
    expect(submitRoomForm(form({ keepItems: false }))).toBe(true)
    expect(past()).toBe(1)
    expect(useDocStore.getState().items).toHaveLength(0)
    useDocStore.temporal.getState().undo()
    expect(useDocStore.getState().items).toHaveLength(4)
    expect(submitRoomForm(form({ kind: 'L' }))).toBe(true)
    expect(selectRoom(useDocStore.getState()).points).toHaveLength(6)
    expect(useDocStore.getState().items).toHaveLength(4)
  })
})

describe('fixtures (AC-06-1,3,5)', () => {
  it('places on the longest wall free gap centre, selected, door gets swing', () => {
    const { rooms, items } = useDocStore.getState()
    const w = makeFixture('WINDOW', rooms, rooms[0], items)!
    // 샘플 가로 400 벽이 가장 길다(동률이면 첫 벽: 위쪽). 중앙 x=200, 창 폭 120
    expect(w.position).toEqual([200, 0, 0])
    expect(w.size[0]).toBe(120)
    expect(w.elevation).toBeUndefined()
    const d = makeFixture('DOOR_ENTRANCE', rooms, rooms[0], items)!
    expect(d.doorSwing).toMatchObject({ radius: 90 })
    expect(makeFixture('BED_QUEEN', rooms, rooms[0], items)).toBeNull()
  })
  it('avoids existing fixtures on the same wall', () => {
    const rooms = useDocStore.getState().rooms
    const room = rooms[0]
    const first = makeFixture('WINDOW', rooms, room, [])!
    const second = makeFixture('WINDOW', rooms, room, [first])!
    expect(Math.abs(second.position[0] - first.position[0])).toBeGreaterThanOrEqual(120)
    expect(second.id).not.toBe(first.id)
  })
  it('addFixture adds and selects; one undo step', () => {
    addFixture('OUTLET')
    const id = useUiStore.getState().selectedId!
    expect(useDocStore.getState().items.some((i) => i.id === id)).toBe(true)
    expect(past()).toBe(1)
  })
})

describe('import / reset (AC-14-3,4,6)', () => {
  it('bad file keeps state and reports field paths', () => {
    const r = processImportText('{"projectInfo":{"version":"2.0","lastModified":"x"},"room":{"height":230,"points":[[0,0],[1,"a"],[2,2]]},"items":[]}')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.lines.join('\n')).toMatch(/projectInfo\.version.*room\.points\[1\]/s)
    expect(processImportText('not json').ok).toBe(false)
  })
  it('oversize or unreadable file becomes an outcome, not a throw', async () => {
    expect((await readImportFile({ size: 6 * 1024 * 1024, text: async () => '' })).ok).toBe(false)
    expect((await readImportFile({ size: 1, text: () => Promise.reject(new Error('x')) })).ok).toBe(false)
  })
  it('valid export round-trips and import is undoable', async () => {
    const { rooms, items } = useDocStore.getState()
    const out = await readImportFile({ size: 1, text: async () => serializeDocument({ rooms, items: items.slice(0, 1) }) })
    expect(out.ok).toBe(true)
    if (out.ok) importDocument(out.doc)
    expect(useDocStore.getState().items).toHaveLength(1)
    useDocStore.temporal.getState().undo()
    expect(useDocStore.getState().items).toHaveLength(4)
  })
  it('reset to sample is undoable', () => {
    useDocStore.getState().removeItem('item_001')
    resetToSample()
    expect(useDocStore.getState().items).toHaveLength(4)
    useDocStore.temporal.getState().undo()
    expect(useDocStore.getState().items).toHaveLength(3)
  })
})

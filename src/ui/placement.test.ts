import { describe, expect, it } from 'vitest'
import { createSample } from '../store/sample'
import { findCatalog, itemLabel } from '../store/catalog'
import { computeWarnings } from '../scene/collision'
import { findFreeSpot, makeDimensionBox, makeDuplicate, makeFromCatalog, nextItemId } from './placement'
import { makeFixture } from './fixturePlacement'
import { affiliateUrl } from '../affiliate/links'
import { validateDocument } from '../io/validate'
import type { Item, Room } from '../store/types'

describe('placement', () => {
  it('nextItemId skips existing', () => {
    expect(nextItemId(createSample().items)).toBe('item_004')
  })
  it('catalog placement lands in a free spot with W,H,D size', () => {
    const { rooms, items } = createSample()
    const desk = makeFromCatalog(findCatalog('DESK')!, rooms, rooms[0], items)
    expect(desk.size).toEqual([120, 73, 60])
    expect(desk.position[1]).toBe(0)
    expect(computeWarnings(rooms, [...items, desk]).length).toBe(0)
  })
  it('sample has zero warnings', () => {
    const { rooms, items } = createSample()
    expect(computeWarnings(rooms, items)).toEqual([])
  })
  it('duplicate has new id and offset', () => {
    const { items } = createSample()
    const d = makeDuplicate(items[1], items)
    expect(d.id).not.toBe(items[1].id)
    expect(d.position).toEqual([items[1].position[0] + 20, 0, items[1].position[2] + 20])
  })
  it('복제본은 구매 체크를 물려받지 않는다', () => {
    const { items } = createSample()
    const src = { ...items[1], purchased: true }
    expect('purchased' in makeDuplicate(src, items)).toBe(false)
  })
})

describe('dimension box (FR-09)', () => {
  it('builds a DIMENSION_BOX furniture in a free spot', () => {
    const { rooms, items } = createSample()
    const box = makeDimensionBox({ size: [60, 40, 50], name: '  ', color: '#90caf9' }, rooms, rooms[0], items)
    expect(box).toMatchObject({ type: 'FURNITURE', modelType: 'DIMENSION_BOX', size: [60, 40, 50], color: '#90caf9' })
    expect(box.name).toBeUndefined()
    expect(computeWarnings(rooms, [...items, box]).length).toBe(0)
  })
  it('keeps trimmed name', () => {
    const { rooms, items } = createSample()
    expect(makeDimensionBox({ size: [10, 10, 10], name: ' 새 침대 ', color: '#fff' }, rooms, rooms[0], items).name).toBe('새 침대')
  })
  it('category is stored only when chosen; kept by duplicate and update; catalog items ignore it for links', () => {
    const { rooms } = createSample()
    const spec = { size: [100, 50, 100] as [number, number, number], color: '#90caf9' }
    expect('category' in makeDimensionBox(spec, rooms, rooms[0], [])).toBe(false)
    const box = makeDimensionBox({ ...spec, category: 'SOFA' }, rooms, rooms[0], [])
    expect(box.category).toBe('SOFA')
    expect(makeDuplicate(box, [box]).category).toBe('SOFA')
    const url = { a: 120, b: 170, small: '', mid: 'https://x.test/sofa', large: '' }
    const links = { SOFA: url }
    expect(affiliateUrl(box.category, 150, links)).toBe(url.mid)
    expect(affiliateUrl(undefined, 150, links)).toBeNull()
  })
  it('label falls back to 치수 박스; no affiliate link; not in catalog', () => {
    expect(itemLabel({ modelType: 'DIMENSION_BOX' })).toBe('치수 박스')
    expect(affiliateUrl('DIMENSION_BOX', 100, { DIMENSION_BOX: { a: 1, b: 2, small: 'https://x.test', mid: 'https://x.test', large: 'https://x.test' } })).toBeNull()
    expect(findCatalog('DIMENSION_BOX')).toBeUndefined()
  })
  it('passes validateDoc roundtrip', () => {
    const { rooms, items } = createSample()
    const box = makeDimensionBox({ size: [150, 50, 200], color: '#90caf9' }, rooms, rooms[0], items)
    const r = validateDocument({ projectInfo: { version: '1.1', lastModified: new Date().toISOString() }, rooms, items: [...items, box] })
    expect(r.ok).toBe(true)
  })
})

const furniture = (id: string, x: number, z: number, w = 100, d = 50): Item => ({
  id, type: 'FURNITURE', modelType: 'DESK', position: [x, 0, z], rotation: [0, 0, 0], size: [w, 75, d],
})
const A: Room = { id: 'r1', name: 'A', height: 240, points: [[0, 0], [300, 0], [300, 300], [0, 300]] }

describe('다중 방 배치', () => {
  it('findFreeSpot는 활성 방 안에서 다른 방 가구와 겹치지 않는 자리를 고른다', () => {
    const B: Room = { id: 'r2', name: 'B', height: 240, points: [[300, 0], [600, 0], [600, 300], [300, 300]] }
    const near: Item = furniture('b1', 310, 150, 100, 50) // B 안, 공유 벽 쪽. A 쪽 후보와 겹칠 수 있다
    const candidate = furniture('c1', 0, 0, 100, 50)
    const spot = findFreeSpot([A, B], A, [near], candidate)
    const trial: Item = { ...candidate, position: spot }
    expect(computeWarnings([A, B], [near, trial]).filter((w) => w.itemId === trial.id || w.otherId === trial.id)).toEqual([])
    expect(spot[0]).toBeLessThan(300) // 활성 방 A 안
    expect(spot[1]).toBe(0)
  })

  it('makeFixture는 활성 방 벽을 쓰고 다른 방 host의 고정 요소 점유를 반영한다', () => {
    const a: Room = { id: 'r1', name: 'A', height: 240, points: [[0, 0], [200, 0], [200, 300], [0, 300]] }
    const b: Room = { id: 'r2', name: 'B', height: 240, points: [[200, 0], [500, 0], [500, 300], [200, 300]] }
    const empty = makeFixture('WINDOW', [a, b], a, [])
    // 가장 긴 벽(오른쪽, x=200) 중앙
    expect(empty?.position).toEqual([200, 0, 150])
    // B 벽 위 고정 요소는 거리 동률로 A host가 되어 A 공유 벽을 점유한다(폭 120 → 140~260)
    const onShared: Item = { id: 'w1', type: 'FIXTURE', modelType: 'WINDOW', position: [200, 0, 200], rotation: [0, 0, 0], size: [120, 100, 5] }
    expect(makeFixture('WINDOW', [a, b], a, [onShared])?.position).toEqual([200, 0, 70])
  })
})

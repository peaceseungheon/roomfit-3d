import { describe, expect, it } from 'vitest'
import { createSample } from '../store/sample'
import { findCatalog, itemLabel } from '../store/catalog'
import { computeWarnings } from '../scene/collision'
import { makeDimensionBox, makeDuplicate, makeFromCatalog, nextItemId } from './placement'
import { affiliateUrl } from '../affiliate/links'
import { validateDocument } from '../io/validate'

describe('placement', () => {
  it('nextItemId skips existing', () => {
    expect(nextItemId(createSample().items)).toBe('item_004')
  })
  it('catalog placement lands in a free spot with W,H,D size', () => {
    const { room, items } = createSample()
    const desk = makeFromCatalog(findCatalog('DESK')!, room, items)
    expect(desk.size).toEqual([120, 73, 60])
    expect(desk.position[1]).toBe(0)
    expect(computeWarnings(room, [...items, desk]).length).toBe(0)
  })
  it('sample has zero warnings', () => {
    const { room, items } = createSample()
    expect(computeWarnings(room, items)).toEqual([])
  })
  it('duplicate has new id and offset', () => {
    const { items } = createSample()
    const d = makeDuplicate(items[1], items)
    expect(d.id).not.toBe(items[1].id)
    expect(d.position).toEqual([items[1].position[0] + 20, 0, items[1].position[2] + 20])
  })
})

describe('dimension box (FR-09)', () => {
  it('builds a DIMENSION_BOX furniture in a free spot', () => {
    const { room, items } = createSample()
    const box = makeDimensionBox({ size: [60, 40, 50], name: '  ', color: '#90caf9' }, room, items)
    expect(box).toMatchObject({ type: 'FURNITURE', modelType: 'DIMENSION_BOX', size: [60, 40, 50], color: '#90caf9' })
    expect(box.name).toBeUndefined()
    expect(computeWarnings(room, [...items, box]).length).toBe(0)
  })
  it('keeps trimmed name', () => {
    const { room, items } = createSample()
    expect(makeDimensionBox({ size: [10, 10, 10], name: ' 새 침대 ', color: '#fff' }, room, items).name).toBe('새 침대')
  })
  it('label falls back to 치수 박스; no affiliate link; not in catalog', () => {
    expect(itemLabel({ modelType: 'DIMENSION_BOX' })).toBe('치수 박스')
    expect(affiliateUrl('DIMENSION_BOX', { DIMENSION_BOX: 'https://x.test' })).toBeNull()
    expect(findCatalog('DIMENSION_BOX')).toBeUndefined()
  })
  it('passes validateDoc roundtrip', () => {
    const { room, items } = createSample()
    const box = makeDimensionBox({ size: [150, 50, 200], color: '#90caf9' }, room, items)
    const r = validateDocument({ projectInfo: { version: '1.0', lastModified: new Date().toISOString() }, room, items: [...items, box] })
    expect(r.ok).toBe(true)
  })
})

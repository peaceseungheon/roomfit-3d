import { describe, expect, it } from 'vitest'
import { composeSwing, fromUiSize, parseBoxForm, parseIntField, parseSwing, toUiSize } from './itemFields'

describe('parseIntField', () => {
  it('accepts integers in range', () => expect(parseIntField(' 120 ', 1, 1000)).toEqual({ ok: true, value: 120 }))
  it.each(['', 'abc', '1.5', '0', '1001', '-3'])('rejects %j', (raw) => {
    expect(parseIntField(raw, 1, 1000).ok).toBe(false)
  })
  it('allows negatives when min is negative', () => expect(parseIntField('-5', -10, 10).ok).toBe(true))
  it('rotation 0~359', () => {
    expect(parseIntField('359', 0, 359).ok).toBe(true)
    expect(parseIntField('360', 0, 359).ok).toBe(false)
  })
})

describe('size conversion', () => {
  it('store [W,H,D] <-> UI W×D×H', () => {
    expect(toUiSize([150, 50, 200])).toEqual({ w: 150, d: 200, h: 50 })
    expect(fromUiSize({ w: 150, d: 200, h: 50 })).toEqual([150, 50, 200])
  })
})

describe('door swing', () => {
  it.each(['LEFT_IN', 'RIGHT_IN', 'LEFT_OUT', 'RIGHT_OUT'])('roundtrips %s', (d) => {
    const { hinge, side } = parseSwing(d)
    expect(composeSwing(hinge, side)).toBe(d)
  })
  it('defaults to LEFT_IN', () => expect(parseSwing(undefined)).toEqual({ hinge: 'LEFT', side: 'IN' }))
})

describe('parseBoxForm (AC-09-4)', () => {
  it('converts W/D/H to size [W,H,D]', () => {
    expect(parseBoxForm({ w: '150', d: '200', h: '50' })).toEqual({ ok: true, size: [150, 50, 200] })
  })
  it('reports per-field errors and no size', () => {
    const r = parseBoxForm({ w: '1001', d: '0', h: '501' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['d', 'h', 'w'])
  })
  it.each(['', '1.5', 'abc'])('rejects %j', (v) => {
    expect(parseBoxForm({ w: v, d: '10', h: '10' }).ok).toBe(false)
  })
  it('accepts max bounds', () => {
    expect(parseBoxForm({ w: '1000', d: '1000', h: '500' }).ok).toBe(true)
  })
})

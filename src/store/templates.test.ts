import { describe, expect, it } from 'vitest'
import { parseDocument } from '../io/validate'
import { serializeDocument } from '../io/persist'
import { computeWarnings } from '../scene/collision'
import { TEMPLATES } from './templates'

describe.each(TEMPLATES)('템플릿 $id', (t) => {
  it('저장 스키마 검증을 통과한다', () => {
    expect(parseDocument(serializeDocument(t.doc())).ok).toBe(true)
  })
  it('간섭 경고가 없다', () => {
    const { rooms, items } = t.doc()
    expect(computeWarnings(rooms, items)).toEqual([])
  })
})

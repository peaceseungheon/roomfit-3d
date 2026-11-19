import { describe, expect, it } from 'vitest'
import { processImportText } from './importFile'
import { serializeDocument } from './persist'
import { createSample } from '../store/sample'

/** 1.0 저장본(room 1개) 텍스트 */
const legacyText = (): string => {
  const { rooms, items } = createSample()
  return JSON.stringify({
    projectInfo: { version: '1.0', lastModified: '2026-11-19T00:00:00.000Z' },
    room: { height: rooms[0].height, points: rooms[0].points },
    items,
  })
}

describe('processImportText', () => {
  it('1.0 파일도 rooms 1개 DocData로 읽는다', () => {
    const r = processImportText(legacyText())
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.doc.rooms).toHaveLength(1)
      expect(r.doc.rooms[0].id).toBe('r1')
      expect(r.doc.items).toEqual(createSample().items)
    }
  })

  it('1.1 파일을 그대로 읽는다', () => {
    const doc = createSample()
    const r = processImportText(serializeDocument(doc))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.doc.rooms).toEqual(doc.rooms)
      expect(r.doc.items).toEqual(doc.items)
    }
  })

  it('방 id가 중복이면 실패하고 경로를 알려 준다', () => {
    const doc = JSON.parse(serializeDocument(createSample()))
    doc.rooms.push({ ...doc.rooms[0] })
    const r = processImportText(JSON.stringify(doc))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.lines.some((l) => l.includes('rooms[1].id'))).toBe(true)
  })

  it('깨진 JSON은 예외 없이 실패 문구를 돌려준다', () => {
    const r = processImportText('{not json')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.lines[0]).toContain('파일을 읽을 수 없습니다')
  })
})

import { describe, expect, it } from 'vitest'
import { parseDocument, validateDocument, validateRoomInput } from './validate'
import { serializeDocument } from './persist'
import { createSample } from '../store/sample'

const valid = () => JSON.parse(serializeDocument(createSample()))
const paths = (v: unknown) => {
  const r = validateDocument(v)
  return r.ok ? [] : r.errors.map((e) => e.path)
}

describe('validateDocument', () => {
  it('샘플 직렬화본은 통과', () => {
    expect(validateDocument(valid()).ok).toBe(true)
  })
  it('버전 불일치', () => {
    const d = valid()
    d.projectInfo.version = '2.0'
    expect(paths(d)).toContain('projectInfo.version')
  })
  it('필수 필드 누락', () => {
    const d = valid()
    delete d.room
    delete d.items[0].size
    expect(paths(d)).toEqual(expect.arrayContaining(['room', 'items[0].size']))
  })
  it('범위 밖: 방 3000 초과, 가구 크기 초과', () => {
    const d = valid()
    d.room.points[1][0] = 3001
    d.items[1].size = [1001, 501, 0]
    expect(paths(d)).toEqual(
      expect.arrayContaining(['room.points', 'items[1].size[0]', 'items[1].size[1]', 'items[1].size[2]']),
    )
  })
  it('잘못된 입력은 예외 없이 오류 반환', () => {
    expect(parseDocument('{not json').ok).toBe(false)
    expect(validateDocument(null).ok).toBe(false)
    expect(validateDocument([]).ok).toBe(false)
  })
})

describe('validateRoomInput', () => {
  const ok = { kind: 'rect', width: 400, depth: 300, height: 230 } as const
  it('정상', () => expect(validateRoomInput(ok)).toEqual({}))
  it('비정수/범위 밖', () => {
    const e = validateRoomInput({ ...ok, width: 99.5, depth: 3001, height: 179 })
    expect(Object.keys(e).sort()).toEqual(['depth', 'height', 'width'])
  })
  it('ㄱ자 잘림 영역', () => {
    expect(validateRoomInput({ ...ok, kind: 'L', cutWidth: 100, cutDepth: 100 })).toEqual({})
    const e = validateRoomInput({ ...ok, kind: 'L', cutWidth: 400, cutDepth: 49 })
    expect(Object.keys(e).sort()).toEqual(['cutDepth', 'cutWidth'])
  })
})

describe('elevation', () => {
  const withElev = (v: unknown) => {
    const d = valid()
    d.items[0].elevation = v
    return paths(d)
  }
  it('유효값 통과, 음수·비수치·천장고 초과 거부', () => {
    expect(withElev(90)).toEqual([])
    expect(withElev(0)).toEqual([])
    expect(withElev(-1)).toContain('items[0].elevation')
    expect(withElev('90')).toContain('items[0].elevation')
    expect(withElev(Infinity)).toContain('items[0].elevation')
    expect(withElev(231)).toContain('items[0].elevation')
  })
})

describe('4-2 QA 보강 검증', () => {
  const mut = (f: (d: any) => void) => {
    const d = valid()
    f(d)
    return paths(d)
  }
  it('name 100자 초과 거부', () => {
    expect(mut((d) => (d.items[0].name = 'a'.repeat(100)))).toEqual([])
    expect(mut((d) => (d.items[0].name = 'a'.repeat(101)))).toContain('items[0].name')
  })
  it('color 형식', () => {
    expect(mut((d) => (d.items[0].color = '#abc'))).toEqual([])
    expect(mut((d) => (d.items[0].color = 'red'))).toContain('items[0].color')
    expect(mut((d) => (d.items[0].color = '#12345'))).toContain('items[0].color')
  })
  it('doorSwing.direction 허용값', () => {
    const swing = (direction: string) => (d: any) => (d.items[0].doorSwing = { direction, radius: 90, angle: 90 })
    expect(mut(swing('RIGHT_OUT'))).toEqual([])
    expect(mut(swing('UP'))).toContain('items[0].doorSwing')
  })
  it('room.points 개수 상한', () => {
    const many = (n: number) => (d: any) => (d.room.points = Array.from({ length: n }, (_, i) => [i % 2, (i >> 1) % 2]))
    expect(mut(many(100))).not.toContain('room.points')
    expect(mut(many(101))).toContain('room.points')
    expect(mut((d) => (d.room.points = [[0, 0], [1, 1]]))).toContain('room.points')
  })
  it('카탈로그 색은 모두 형식 통과', async () => {
    const { CATALOG } = await import('../store/catalog')
    for (const c of CATALOG) expect(c.color).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  })
})

describe('치수 박스 저장→불러오기 왕복', () => {
  it('DIMENSION_BOX의 name·color·size가 보존된다', () => {
    const doc = createSample()
    const box = { ...doc.items[0], id: 'box-1', modelType: 'DIMENSION_BOX', name: '새 소파', color: '#12ab34', size: [180, 80, 90] as [number, number, number] }
    const r = parseDocument(serializeDocument({ ...doc, items: [...doc.items, box] }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.items.find((i) => i.id === 'box-1')).toMatchObject({ modelType: 'DIMENSION_BOX', name: '새 소파', color: '#12ab34', size: [180, 80, 90] })
  })
})

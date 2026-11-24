import { describe, expect, it } from 'vitest'
import { parseDocument, validateDocument, validateRoomInput } from './validate'
import { serializeDocument } from './persist'
import { createSample } from '../store/sample'

const valid = () => JSON.parse(serializeDocument(createSample()))
/** 1.0 저장본(room 1개) */
const valid10 = () => {
  const { rooms, ...rest } = valid()
  const { height, points } = rooms[0]
  return { ...rest, projectInfo: { ...rest.projectInfo, version: '1.0' }, room: { height, points } }
}
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
    const d = valid10()
    delete d.room
    delete d.items[0].size
    expect(paths(d)).toEqual(expect.arrayContaining(['room', 'items[0].size']))
  })
  it('범위 밖: 방 3000 초과, 가구 크기 초과', () => {
    const d = valid10()
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
  const mut = (f: (d: any) => void, base = valid) => {
    const d = base()
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
    expect(mut(many(100), valid10)).not.toContain('room.points')
    expect(mut(many(101), valid10)).toContain('room.points')
    expect(mut((d) => (d.room.points = [[0, 0], [1, 1]]), valid10)).toContain('room.points')
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

describe('치수 박스 category', () => {
  const withCat = (category: unknown) => {
    const d = valid()
    d.items[0] = { ...d.items[0], category }
    return d
  }
  it('카탈로그 14종 modelType이면 통과하고 저장→불러오기에서 보존', () => {
    expect(validateDocument(withCat('SOFA')).ok).toBe(true)
    const r = parseDocument(serializeDocument({ ...createSample(), items: createSample().items.map((i, n) => (n === 1 ? { ...i, category: 'BED' } : i)) }))
    expect(r.ok && r.value.items[1].category).toBe('BED')
  })
  it('모르는 값·문자열이 아닌 값은 경로 오류', () => {
    expect(paths(withCat('BED_QUEEN'))).toContain('items[0].category')
    expect(paths(withCat('DIMENSION_BOX'))).toContain('items[0].category')
    expect(paths(withCat(3))).toContain('items[0].category')
  })
})

describe('다중 방 문서(1.0/1.1)', () => {
  type P = [number, number]
  const sq = (x: number, z: number, w = 300, d = 300): P[] => [[x, z], [x + w, z], [x + w, z + d], [x, z + d]]
  const room = (id: string, points: P[], height = 230) => ({ id, name: `방 ${id}`, height, points })
  const doc11 = (rooms: unknown[], items: unknown[] = []) => ({
    projectInfo: { version: '1.1', lastModified: '2026-11-19T00:00:00.000Z' },
    rooms,
    items,
  })

  it('1.0 문서는 rooms 1개(r1, 방 1)로 정규화된다', () => {
    const s = createSample()
    const input = {
      projectInfo: { version: '1.0', lastModified: '2026-11-19T00:00:00.000Z' },
      room: { height: 230, points: sq(0, 0) },
      items: s.items,
    }
    const r = validateDocument(input)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.rooms).toHaveLength(1)
    expect(r.value.rooms[0]).toEqual({ id: 'r1', name: '방 1', height: 230, points: sq(0, 0) })
    expect(r.value.items).toEqual(s.items)
  })
  it('1.1 방 2개가 변을 맞대면 통과', () => {
    expect(paths(doc11([room('a', sq(0, 0)), room('b', sq(300, 0))]))).toEqual([])
  })
  it('한 점만 닿아도 통과', () => {
    expect(paths(doc11([room('a', sq(0, 0)), room('b', sq(300, 300))]))).toEqual([])
  })
  it('방 개수는 1~20개', () => {
    expect(paths(doc11([]))).toContain('rooms')
    const many = Array.from({ length: 21 }, (_, i) => room(`r${i}`, sq(i * 100, 0, 100, 100)))
    expect(paths(doc11(many))).toContain('rooms')
    expect(paths(doc11(many.slice(0, 20)))).toEqual([])
    expect(paths({ ...doc11([]), rooms: 'x' })).toContain('rooms')
  })
  it('방 id 중복 거부', () => {
    expect(paths(doc11([room('a', sq(0, 0)), room('a', sq(300, 0))]))).toContain('rooms[1].id')
  })
  it('방 이름 1~100자', () => {
    expect(paths(doc11([{ ...room('a', sq(0, 0)), name: '' }]))).toContain('rooms[0].name')
    expect(paths(doc11([room('a', sq(0, 0)), { ...room('b', sq(300, 0)), name: 'a'.repeat(101) }]))).toContain('rooms[1].name')
    expect(paths(doc11([{ ...room('a', sq(0, 0)), name: 'a'.repeat(100) }]))).toEqual([])
  })
  it('방 개별 규칙은 rooms[i] 경로로 보고', () => {
    expect(paths(doc11([room('a', sq(0, 0)), room('b', sq(300, 0, 3001, 100))]))).toContain('rooms[1].points')
    expect(paths(doc11([room('a', sq(0, 0), 100)]))).toContain('rooms[0].height')
    const many = Array.from({ length: 101 }, (_, i): P => [i % 2, (i >> 1) % 2])
    expect(paths(doc11([room('a', many)]))).toContain('rooms[0].points')
  })
  it('내부 면적이 겹치면 rooms[j] 오류', () => {
    expect(paths(doc11([room('a', sq(0, 0)), room('b', sq(0, 0))]))).toContain('rooms[1]')
    expect(paths(doc11([room('a', sq(0, 0)), room('b', sq(100, 100, 50, 50))]))).toContain('rooms[1]')
  })
  it('문서 전체 바운딩 박스 10000 초과 거부', () => {
    expect(paths(doc11([room('a', sq(0, 0, 3000, 100)), room('b', sq(7001, 0, 3000, 100))]))).toContain('rooms')
    expect(paths(doc11([room('a', sq(0, 0, 3000, 100)), room('b', sq(7000, 0, 3000, 100))]))).toEqual([])
  })
  it('먼 방의 가구 위치는 허용', () => {
    const it0 = { ...createSample().items[1], position: [7500, 0, 50] }
    expect(paths(doc11([room('a', sq(0, 0, 3000, 100)), room('b', sq(7000, 0, 3000, 100))], [it0]))).toEqual([])
  })
  it('elevation 상한은 소속 방 천장고, 소속 없으면 최저값', () => {
    const rooms = [room('a', sq(0, 0), 240), room('b', sq(300, 0), 180)]
    // 240 방 벽에 둔 창 elevation 200은 통과해야 한다(최저값 180 기준이면 거부 — 회귀 방지)
    const win = {
      ...createSample().items[0],
      id: 'win', type: 'FIXTURE' as const, modelType: 'WINDOW',
      position: [150, 0, 0] as [number, number, number], size: [120, 110, 5] as [number, number, number], elevation: 200,
    }
    expect(parseDocument(serializeDocument({ rooms, items: [win] })).ok).toBe(true)
    // 소속 없는 가구는 모든 방 최저 천장고 180을 넘으므로 거부
    const loose = { ...createSample().items[1], id: 'loose', position: [5000, 0, 0], elevation: 200 }
    expect(paths(doc11(rooms, [loose]))).toContain('items[0].elevation')
  })
  it('1.1의 room 키는 무시, 1.0에 room이 없으면 오류, 모르는 버전은 거부', () => {
    const d = { ...doc11([room('a', sq(0, 0))]), room: 'garbage' }
    const r = validateDocument(d)
    expect(r.ok).toBe(true)
    if (r.ok) expect('room' in r.value).toBe(false)
    expect(paths({ projectInfo: { version: '1.0', lastModified: 'x' }, items: [] })).toContain('room')
    expect(paths({ ...doc11([room('a', sq(0, 0))]), projectInfo: { version: '0.9', lastModified: 'x' } })).toContain('projectInfo.version')
  })
})

import { describe, expect, it } from 'vitest'
import { createSample } from '../store/sample'
import type { Item, Room } from '../store/types'
import { computeWarnings, doorSwing, furnitureBox, swingBox, warnedIds } from './collision'
import { selectWarnings } from './useWarnings'
import { relocateFixtures } from '../trace/trace'

const room: Room = { id: 'r1', name: '방 1', height: 230, points: [[0, 0], [400, 0], [400, 300], [0, 300]] }
const lshape: Room = { id: 'r1', name: '방 1', height: 230, points: [[0, 0], [400, 0], [400, 150], [200, 150], [200, 300], [0, 300]] }

const box = (id: string, x: number, z: number, w = 100, d = 50, ry = 0): Item => ({
  id, type: 'FURNITURE', modelType: 'DESK', position: [x, 0, z], rotation: [0, ry, 0], size: [w, 75, d],
})
const door = (id: string, x: number, z: number, direction?: string): Item => ({
  id, type: 'FIXTURE', modelType: 'DOOR_SINGLE', position: [x, 0, z], rotation: [0, 0, 0], size: [90, 210, 5],
  ...(direction ? { doorSwing: { direction, radius: 90, angle: 90 } } : {}),
})
const win = (id: string, x: number, z: number): Item => ({
  id, type: 'FIXTURE', modelType: 'WINDOW', position: [x, 0, z], rotation: [0, 0, 0], size: [100, 100, 5],
})
const kinds = (r: Room, items: Item[]) => computeWarnings(r, items).map((w) => `${w.itemId}:${w.kind}:${w.otherId ?? ''}`)

describe('가구↔가구', () => {
  it('겹치면 경고 1건(쌍당)', () => {
    expect(kinds(room, [box('a', 100, 100), box('b', 150, 100)])).toEqual(['a:ITEM:b'])
  })
  it('떨어져 있으면 없음', () => {
    expect(kinds(room, [box('a', 100, 100), box('b', 250, 100)])).toEqual([])
  })
  it('면만 맞닿으면(접촉) 간섭 아님, 1cm 겹치면 간섭', () => {
    expect(kinds(room, [box('a', 100, 100), box('b', 200, 100)])).toEqual([])
    expect(kinds(room, [box('a', 100, 100), box('b', 199, 100)])).toEqual(['a:ITEM:b'])
  })
  it('회전 90°는 폭·깊이가 바뀐 박스', () => {
    // 100x50을 90° 돌리면 x폭 50 → 중심 거리 80이면 겹치지 않음, 0°면 겹침
    expect(kinds(room, [box('a', 100, 100, 100, 50, 90), box('b', 180, 100, 100, 50, 90)])).toEqual([])
    expect(kinds(room, [box('a', 100, 100), box('b', 180, 100)])).toEqual(['a:ITEM:b'])
  })
  it('45° 회전은 외접 AABB로 근사', () => {
    const b = furnitureBox(box('a', 0, 0, 100, 100, 45))
    expect(b.max.x).toBeCloseTo(50 * Math.SQRT2)
    expect(b.max.y).toBe(75)
  })
})

describe('가구↔벽(방 밖 포함)', () => {
  it('벽에 붙이기만 하면 간섭 아님', () => {
    expect(kinds(room, [box('a', 50, 25)])).toEqual([])
  })
  it('벽을 넘으면 WALL', () => {
    expect(kinds(room, [box('a', 40, 25)])).toEqual(['a:WALL:'])
  })
  it('방 밖으로 완전히 나가도 WALL', () => {
    expect(kinds(room, [box('a', 1000, 1000)])).toEqual(['a:WALL:'])
  })
  it('ㄱ자 방 오목 모서리를 덮으면 WALL', () => {
    expect(kinds(lshape, [box('a', 300, 100)])).toEqual([])
    expect(kinds(lshape, [box('a', 150, 120, 200, 200)])).toEqual(['a:WALL:'])
  })
})

describe('문 열림 부채꼴', () => {
  it('doorSwing 없으면 LEFT_IN, 반경=문 폭', () => {
    const s = doorSwing(door('d', 0, 150), room.points)!
    expect(s.radius).toBe(90)
    expect(s.outward).toBe(false)
    const b = swingBox(s, 210)
    // 서쪽 벽(x=0) 문, 실내 쪽(+x)으로 90cm 정사각형
    expect([b.min.x, b.max.x, b.max.z - b.min.z]).toEqual([0, 90, 90].map((v) => expect.closeTo(v)))
  })
  it('LEFT/RIGHT는 경첩이 문 폭만큼 반대편', () => {
    const l = doorSwing(door('d', 0, 150, 'LEFT_IN'), room.points)!
    const r = doorSwing(door('d', 0, 150, 'RIGHT_IN'), room.points)!
    expect(Math.abs(l.hinge[1] - r.hinge[1])).toBeCloseTo(90)
  })
  it('부채꼴 안 가구는 DOOR_SWING, 실외 문은 제외', () => {
    const f = box('a', 60, 150, 60, 60)
    expect(kinds(room, [door('d', 0, 150), f])).toEqual(['a:DOOR_SWING:d'])
    expect(kinds(room, [door('d', 0, 150, 'LEFT_OUT'), f])).toEqual([])
    const out = swingBox(doorSwing(door('d', 0, 150, 'RIGHT_OUT'), room.points)!, 210)
    expect(out.max.x).toBeCloseTo(0) // 방 밖(-x)에 그려짐
  })
  it('부채꼴 밖 가구는 없음', () => {
    expect(kinds(room, [door('d', 0, 150), box('a', 200, 150)])).toEqual([])
  })
})

describe('문/창 겹침(AC-06-4)', () => {
  it('같은 벽에서 겹치면 FIXTURE_OVERLAP', () => {
    expect(kinds(room, [door('d', 100, 0, 'LEFT_OUT'), win('w', 150, 0)])).toEqual(['d:FIXTURE_OVERLAP:w'])
  })
  it('다른 벽이면 없음', () => {
    expect(kinds(room, [door('d', 50, 0, 'LEFT_OUT'), win('w', 0, 60)])).toEqual([])
  })
})

describe('경고 공유', () => {
  it('하이라이트 id는 양쪽 모두', () => {
    expect([...warnedIds(computeWarnings(room, [box('a', 100, 100), box('b', 150, 100)]))]).toEqual(['a', 'b'])
  })
  it('같은 room·items면 캐시 재사용', () => {
    const { rooms: [r], items } = createSample()
    expect(selectWarnings(r, items)).toBe(selectWarnings(r, items))
  })
  it('가구 50개 계산이 빠르다', () => {
    const items = Array.from({ length: 50 }, (_, i) => box(`i${i}`, (i % 10) * 40, Math.floor(i / 10) * 60))
    const t = performance.now()
    for (let k = 0; k < 60; k++) computeWarnings(room, items)
    expect((performance.now() - t) / 60).toBeLessThan(5)
  })
})

describe('고정 요소 자리 없음(AC-05-4)', () => {
  it('가장 가까운 벽보다 폭이 크면 NO_SPACE', () => {
    const tiny: Room = { id: 'r1', name: '방 1', height: 230, points: [[0, 0], [60, 0], [60, 300], [0, 300]] }
    expect(kinds(tiny, [door('d', 30, 0)])).toContain('d:NO_SPACE:')
  })
  it('들어가면 경고 없음', () => {
    expect(kinds(room, [door('d', 200, 0)])).not.toContain('d:NO_SPACE:')
  })
})

describe('NO_SPACE 허용오차', () => {
  const mk = (len: number): Room => ({ id: 'r1', name: '방 1', height: 230, points: [[0, 0], [len, 0], [len, 300], [0, 300]] })
  const fx = (w: number, x: number): Item => ({ id: 'w', type: 'FIXTURE', modelType: 'WINDOW', position: [x, 0, 0], rotation: [0, 0, 0], size: [w, 100, 5] })
  it('폭==벽 길이면 NO_SPACE 없음', () => {
    expect(computeWarnings(mk(300), [fx(300, 150)]).some((w) => w.kind === 'NO_SPACE')).toBe(false)
  })
  it('비정수 벽(299.9999999)에서 폭 300 오탐 없음', () => {
    expect(computeWarnings(mk(300 - 1e-9), [fx(300, 150)]).some((w) => w.kind === 'NO_SPACE')).toBe(false)
  })
  it('실제로 좁으면 NO_SPACE와 relocateFixtures unfit이 일치', () => {
    const r = mk(299), items = [fx(300, 150), fx(299, 100)]
    const ns = computeWarnings(r, items).filter((w) => w.kind === 'NO_SPACE').map((w) => w.itemId)
    expect(relocateFixtures(r.points, items).unfit).toEqual(ns)
    expect(ns).toEqual(['w'])
  })
})

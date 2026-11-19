import { describe, expect, it } from 'vitest'
import { createSample } from '../store/sample'
import type { Item, Point2 } from '../store/types'
import { DIMENSION_BOX_TYPE } from '../store/catalog'
import { fixtureKind, fixtureTransform, furnitureMaterialProps, furnitureTransform, offsetOutward, pointInPolygon, roomBounds, signedArea } from './geometry'

describe('furnitureMaterialProps', () => {
  it('치수 박스만 반투명·depthWrite 끔, 일반 가구는 불투명', () => {
    expect(furnitureMaterialProps({ modelType: DIMENSION_BOX_TYPE })).toEqual({ transparent: true, opacity: 0.45, depthWrite: false })
    expect(furnitureMaterialProps({ modelType: 'SOFA' })).toEqual({ transparent: false, opacity: 1, depthWrite: true })
  })
})

const rect: Point2[] = [[0, 0], [400, 0], [400, 300], [0, 300]]
const lRoom: Point2[] = [[0, 0], [300, 0], [300, 80], [400, 80], [400, 300], [0, 300]]
const fixture = (modelType: string, x: number, z: number): Item => ({
  id: 'f', type: 'FIXTURE', modelType, position: [x, 0, z], rotation: [0, 0, 0], size: [90, 210, 5],
})
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]))

describe('offsetOutward', () => {
  it('직사각형은 사방으로 t만큼 커진다(감은 방향 무관)', () => {
    const out = offsetOutward(rect, 10)
    expect(out).toEqual([[-10, -10], [410, -10], [410, 310], [-10, 310]])
    const rev = offsetOutward([...rect].reverse(), 10)
    expect(rev).toEqual([[-10, 310], [410, 310], [410, -10], [-10, -10]])
  })
  it('ㄱ자 오목 모서리는 방 밖(잘린 쪽)으로 이동한다', () => {
    const out = offsetOutward(lRoom, 10)
    out.forEach((p, i) => close(p, [[-10, -10], [310, -10], [310, 70], [410, 70], [410, 310], [-10, 310]][i]))
    expect(Math.abs(signedArea(out))).toBeGreaterThan(Math.abs(signedArea(lRoom)))
  })
})

describe('pointInPolygon', () => {
  it('안/밖을 가른다(경계 위 판정은 기존 collision.insidePolygon과 동일)', () => {
    expect(pointInPolygon(rect, 200, 150)).toBe(true)
    expect(pointInPolygon(rect, -1, 150)).toBe(false)
    expect(pointInPolygon(rect, 401, 150)).toBe(false)
    expect(pointInPolygon(lRoom, 350, 20)).toBe(false) // ㄱ자 잘린 쪽
    expect(pointInPolygon(lRoom, 350, 150)).toBe(true)
  })
})

describe('roomBounds', () => {
  it('ㄱ자 외곽 범위', () => {
    expect(roomBounds(lRoom)).toEqual({ minX: 0, maxX: 400, minZ: 0, maxZ: 300 })
  })
})

describe('furnitureTransform', () => {
  it('바닥 중심 → 메시 중심 y=H/2, 도→라디안', () => {
    const bed = createSample().items.find((i) => i.id === 'item_001')!
    const t = furnitureTransform(bed)
    expect(t.position).toEqual([150, 25, 190])
    close(t.rotation, [0, Math.PI / 2, 0])
  })
})

describe('fixtureTransform', () => {
  it('샘플 문은 x=0 벽에 붙고 벽 방향(z축)으로 선다', () => {
    const door = createSample().items[0]
    const t = fixtureTransform(door, rect)
    close(t.position, [-5, 105, 50])
    // 로컬 x(1,0,0)를 rotationY로 돌린 방향 = (cos, -sin) 이 벽 방향 ±z여야 한다
    close([Math.cos(t.rotationY), -Math.sin(t.rotationY)], [0, -1])
  })
  it('창은 바닥 위 90에서 시작, 가장 가까운 벽(z=300)에 붙는다', () => {
    const t = fixtureTransform({ ...fixture('WINDOW', 200, 280), size: [120, 110, 5] }, rect)
    close(t.position, [200, 145, 305])
  })
  it('벽 끝 밖 좌표는 벽 구간 안으로 clamp', () => {
    const t = fixtureTransform(fixture('OUTLET', 500, -50), rect)
    close([t.position[0], t.position[2]], [400, -5])
  })
  it('종류 판별', () => {
    expect([fixtureKind('DOOR_SINGLE'), fixtureKind('WINDOW'), fixtureKind('OUTLET'), fixtureKind('X')])
      .toEqual(['DOOR', 'WINDOW', 'OUTLET', null])
  })
})

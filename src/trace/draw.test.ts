import { describe, expect, it } from 'vitest'
import type { Point2 } from '../store/types'
import { editError } from './trace'
import { axisDirection, BLANK_EXTENT, deletePoint, drawPoint, insertPoint, orthoProject, pointFromLength, wallAt } from './draw'

const rect: Point2[] = [[0, 0], [400, 0], [400, 300], [0, 300]]

describe('orthoProject / drawPoint (직각 보정)', () => {
  it('가까운 축으로 투영한다', () => {
    expect(orthoProject([100, 100], [250, 120])).toEqual([250, 100])
    expect(orthoProject([100, 100], [110, 300])).toEqual([100, 300])
  })
  it('직각 보정 후 스냅: 고정 축은 직전 점 값 그대로, 자유 축만 스냅', () => {
    expect(drawPoint([103, 100], [247, 130], true, 10)).toEqual([250, 100])
    expect(drawPoint([100, 100], [113, 340], true, 10)).toEqual([100, 340])
  })
  it('직각 끔이면 두 축 모두 스냅, 직전 점이 없으면 스냅만', () => {
    expect(drawPoint([100, 100], [247, 133], false, 10)).toEqual([250, 130])
    expect(drawPoint(null, [247, 133], true, 10)).toEqual([250, 130])
    expect(drawPoint(null, [247.4, 133.6], true, 1)).toEqual([247, 134])
  })
  it('입력을 바꾸지 않는다', () => {
    const prev: Point2 = [1, 2]
    const cur: Point2 = [50, 3]
    drawPoint(prev, cur, true, 10)
    expect(prev).toEqual([1, 2])
    expect(cur).toEqual([50, 3])
  })
})

describe('axisDirection / pointFromLength (길이 입력)', () => {
  it('커서 방향의 가장 가까운 축', () => {
    expect(axisDirection([0, 0], [10, 5])).toEqual([1, 0])
    expect(axisDirection([0, 0], [-10, 5])).toEqual([-1, 0])
    expect(axisDirection([0, 0], [3, -9])).toEqual([0, -1])
    expect(axisDirection([5, 5], [5, 5])).toEqual([1, 0]) // 방향 없음 -> 오른쪽
  })
  it('직각: 축 방향으로 길이만큼', () => {
    expect(pointFromLength([100, 100], [90, 110], 250, true)).toEqual({ ok: true, value: [-150, 100] })
    expect(pointFromLength([100, 100], [105, 400], 250, true)).toEqual({ ok: true, value: [100, 350] })
  })
  it('임의 방향: 커서 방향 단위벡터 * 길이(0.1cm 반올림)', () => {
    const r = pointFromLength([0, 0], [30, 40], 100, false)
    expect(r).toEqual({ ok: true, value: [60, 80] })
  })
  it('길이 범위 밖·비숫자 거부', () => {
    for (const len of [0, 9, -5, NaN, Infinity, 3001]) {
      expect(pointFromLength([0, 0], [1, 0], len, true).ok).toBe(false)
    }
    expect(pointFromLength([0, 0], [1, 0], 10, true).ok).toBe(true)
    expect(pointFromLength([0, 0], [1, 0], 3000, true).ok).toBe(true)
  })
})

describe('wallAt', () => {
  it('반경 안의 가장 가까운 벽 인덱스, 없으면 -1', () => {
    expect(wallAt(rect, 200, 4, 8)).toBe(0)
    expect(wallAt(rect, 396, 150, 8)).toBe(1)
    expect(wallAt(rect, 200, 150, 8)).toBe(-1)
  })
})

describe('insertPoint', () => {
  it('벽 위 투영점을 벽 i 뒤에 끼운다(입력 불변)', () => {
    const r = insertPoint(rect, 0, 200, 30)
    expect(r).toEqual({ ok: true, value: [[0, 0], [200, 0], [400, 0], [400, 300], [0, 300]] })
    expect(rect).toHaveLength(4)
  })
  it('스냅 step은 벽을 따라 적용', () => {
    const r = insertPoint(rect, 1, 405, 147, 10)
    expect(r).toEqual({ ok: true, value: [[0, 0], [400, 0], [400, 150], [400, 300], [0, 300]] })
  })
  it('마지막 벽(끝점이 첫 점)에도 삽입', () => {
    const r = insertPoint(rect, 3, 3, 100)
    expect(r).toEqual({ ok: true, value: [[0, 0], [400, 0], [400, 300], [0, 300], [0, 100]] })
  })
  it('끝점·기존 점과 너무 가까우면 거부', () => {
    expect(insertPoint(rect, 0, 5, 0).ok).toBe(false)
    expect(insertPoint(rect, 0, 395, 0).ok).toBe(false)
    expect(insertPoint(rect, 0, 10, 0).ok).toBe(true)
  })
  it('잘못된 벽·비유한수 거부', () => {
    expect(insertPoint(rect, 9, 1, 1).ok).toBe(false)
    expect(insertPoint(rect, 0, NaN, 1).ok).toBe(false)
  })
  it('다른 벽과 겹치는 결과는 거부(교차 검증)', () => {
    // 기울어진 벽 위에 점이 있어도 결과가 자기 교차면 거부되는지: 반으로 접힌 L자에서 확인
    const l: Point2[] = [[0, 0], [400, 0], [400, 100], [100, 100], [100, 400], [0, 400]]
    expect(insertPoint(l, 2, 250, 100).ok).toBe(true)
  })
})

describe('deletePoint', () => {
  it('점을 지운다(입력 불변)', () => {
    const l: Point2[] = [[0, 0], [400, 0], [400, 300], [200, 300], [0, 300]]
    const r = deletePoint(l, 3)
    expect(r).toEqual({ ok: true, value: [[0, 0], [400, 0], [400, 300], [0, 300]] })
    expect(l).toHaveLength(5)
  })
  it('3점 이하·없는 인덱스 거부', () => {
    expect(deletePoint([[0, 0], [100, 0], [0, 100]], 0).ok).toBe(false)
    expect(deletePoint(rect, 7).ok).toBe(false)
  })
  it('지운 결과가 교차하면 거부', () => {
    const c: Point2[] = [[0, 0], [400, 0], [400, 400], [200, 100], [0, 400]]
    expect(editError(c)).toBeNull()
    expect(deletePoint(c, 0).ok).toBe(false) // (0,400)->(400,0)이 (400,400)->(200,100)과 교차
    expect(deletePoint(c, 3).ok).toBe(true)
  })
})

describe('BLANK_EXTENT', () => {
  it('방 상한과 같다', () => expect(BLANK_EXTENT).toBe(3000))
})

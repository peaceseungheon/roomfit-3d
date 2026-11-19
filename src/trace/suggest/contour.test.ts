import { describe, expect, it } from 'vitest'
import { signedArea } from '../../scene/geometry'
import type { Point2 } from '../../store/types'
import { findIntersections } from '../trace'
import { isValidOutline, simplifyClosed, suggestOutline, type Pixels } from './contour'

/** 흰 배경 RGBA 이미지에 도형을 그리는 도우미. */
function canvas(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  const px = (x: number, y: number, v: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const o = (y * width + x) * 4
    data[o] = data[o + 1] = data[o + 2] = v
  }
  const rect = (x0: number, y0: number, x1: number, y1: number, v: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px(x, y, v)
  }
  /** 두께 t인 폴리라인 벽(축 정렬 선분만). */
  const wall = (pts: Point2[], t = 6, close = true) => {
    const n = close ? pts.length : pts.length - 1
    for (let i = 0; i < n; i++) {
      const [a, b] = [pts[i], pts[(i + 1) % pts.length]]
      rect(Math.min(a[0], b[0]) - t / 2, Math.min(a[1], b[1]) - t / 2, Math.max(a[0], b[0]) + t / 2, Math.max(a[1], b[1]) + t / 2, 0)
    }
  }
  const img = (): Pixels => ({ data, width, height })
  return { rect, wall, img, px }
}

const bbox = (p: Point2[]) => [Math.min(...p.map((a) => a[0])), Math.min(...p.map((a) => a[1])), Math.max(...p.map((a) => a[0])), Math.max(...p.map((a) => a[1]))]
const near = (a: number, b: number, tol = 6) => Math.abs(a - b) <= tol

describe('suggestOutline', () => {
  it('사각형 방: 모서리 4개, 벽 안쪽 경계', () => {
    const c = canvas(800, 600)
    c.wall([[100, 100], [700, 100], [700, 500], [100, 500]])
    const r = suggestOutline(c.img())!
    expect(r).toHaveLength(4)
    const [x0, y0, x1, y1] = bbox(r)
    expect(near(x0, 103) && near(y0, 103) && near(x1, 697) && near(y1, 497)).toBe(true)
    expect(findIntersections(r)).toEqual([])
  })

  it('ㄱ자(L자) 방: 모서리 6개', () => {
    const c = canvas(800, 600)
    c.wall([[100, 100], [700, 100], [700, 300], [400, 300], [400, 500], [100, 500]])
    const r = suggestOutline(c.img())!
    expect(r).toHaveLength(6)
    expect(Math.abs(signedArea(r))).toBeGreaterThan(0)
  })

  it('선 끊김(문 틈 8px)을 메운다', () => {
    const c = canvas(800, 600)
    c.wall([[100, 100], [700, 100], [700, 500], [100, 500]])
    c.rect(95, 250, 110, 258, 255) // 왼쪽 벽 8px 틈
    const r = suggestOutline(c.img())!
    expect(r).toHaveLength(4)
  })

  it('방 안의 가구(어두운 사각형)가 있어도 바깥 윤곽만 잡는다', () => {
    const c = canvas(800, 600)
    c.wall([[100, 100], [700, 100], [700, 500], [100, 500]])
    c.rect(300, 200, 400, 300, 0)
    expect(suggestOutline(c.img())).toHaveLength(4)
  })

  it('작은 노이즈 점은 무시한다', () => {
    const c = canvas(800, 600)
    c.wall([[100, 100], [700, 100], [700, 500], [100, 500]])
    for (let i = 0; i < 30; i++) c.rect(10 + i * 20, 20, 12 + i * 20, 22, 0) // 방 밖 점
    expect(suggestOutline(c.img())).toHaveLength(4)
  })

  it('원본이 1600px 초과면 축소 계산 후 원본 좌표로 환산', () => {
    const c = canvas(3200, 2400)
    c.wall([[400, 400], [2800, 400], [2800, 2000], [400, 2000]], 24)
    const r = suggestOutline(c.img())!
    expect(r).toHaveLength(4)
    const [x0, y0, x1, y1] = bbox(r)
    expect(near(x0, 412, 30) && near(y0, 412, 30) && near(x1, 2788, 30) && near(y1, 1988, 30)).toBe(true)
    expect(isValidOutline(r, 3200, 2400)).toBe(true)
  })

  it('빈 이미지·벽 없음·열린 선은 null', () => {
    expect(suggestOutline(canvas(400, 300).img())).toBeNull()
    const c = canvas(800, 600)
    c.wall([[100, 100], [700, 100], [700, 500], [100, 500]], 6, false) // 왼쪽이 완전히 열림
    expect(suggestOutline(c.img())).toBeNull()
  })

  it('잘못된 입력(크기 불일치)은 null', () => {
    expect(suggestOutline({ data: new Uint8ClampedArray(4), width: 10, height: 10 })).toBeNull()
  })
})

describe('simplifyClosed / isValidOutline', () => {
  it('계단 노이즈를 모서리로 줄인다', () => {
    const stair: Point2[] = [[0, 0], [50, 0], [100, 0], [100, 50], [100, 100], [50, 100], [0, 100], [0, 50]]
    expect(simplifyClosed(stair, 2)).toHaveLength(4)
  })
  it('범위 밖·점 부족·자기 교차는 거부', () => {
    expect(isValidOutline([[0, 0], [10, 0]], 100, 100)).toBe(false)
    expect(isValidOutline([[0, 0], [200, 0], [0, 50]], 100, 100)).toBe(false)
    expect(isValidOutline([[0, 0], [10, 10], [10, 0], [0, 10]], 100, 100)).toBe(false) // 나비매듭
    expect(isValidOutline([[0, 0], [10, 0], [10, 10]], 100, 100)).toBe(true)
  })
})

import type { Point2 } from '../store/types'

const EPS = 1e-9
const NUDGE = 0.01 // cm. 변 중점에서 안쪽으로 밀어 낼 거리

function signedArea(poly: Point2[]): number {
  return (
    poly.reduce((sum, [x1, z1], i) => {
      const [x2, z2] = poly[(i + 1) % poly.length]
      return sum + (x1 * z2 - x2 * z1)
    }, 0) / 2
  )
}

function onSegment(p: Point2, a: Point2, b: Point2): boolean {
  const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (Math.abs(cross) / len > 1e-6) return false
  const dot = (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])
  return dot >= -1e-6 && dot <= len * len + 1e-6
}

/** 경계 위는 false인 "엄격히 안쪽" 판정 (짝수-홀수 규칙) */
function strictlyInside(p: Point2, poly: Point2[]): boolean {
  let inside = false
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    if (onSegment(p, a, b)) return false
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside
    }
  }
  return inside
}

/** 선분 a→b 위에서 poly의 변·꼭짓점과 만나는 지점의 매개변수 t (0~1) */
function splitParams(a: Point2, b: Point2, poly: Point2[]): number[] {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const len2 = dx * dx + dz * dz
  const ts = [0, 1]
  const clampT = (p: Point2) =>
    Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2))
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i]
    const d = poly[(i + 1) % poly.length]
    const ex = d[0] - c[0]
    const ez = d[1] - c[1]
    const denom = dx * ez - dz * ex
    if (Math.abs(denom) < EPS) {
      ts.push(clampT(c), clampT(d)) // 평행: 끝점 투영(공선 겹침 대비)
      continue
    }
    const t = ((c[0] - a[0]) * ez - (c[1] - a[1]) * ex) / denom
    const u = ((c[0] - a[0]) * dz - (c[1] - a[1]) * dx) / denom
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) ts.push(t)
  }
  return ts.sort((p, q) => p - q)
}

/** a의 경계를 b의 경계로 쪼갠 조각마다, a 안쪽으로 살짝 민 점이 b 안에 있는지 */
function boundaryEntersInterior(a: Point2[], b: Point2[]): boolean {
  const sign = signedArea(a) > 0 ? 1 : -1
  return a.some((p, i) => {
    const q = a[(i + 1) % a.length]
    const len = Math.hypot(q[0] - p[0], q[1] - p[1])
    const nx = (-sign * (q[1] - p[1])) / len
    const nz = (sign * (q[0] - p[0])) / len
    const ts = splitParams(p, q, b)
    return ts.slice(1).some((t1, k) => {
      const t0 = ts[k]
      if (t1 - t0 < EPS) return false
      const tm = (t0 + t1) / 2
      const probe: Point2 = [
        p[0] + (q[0] - p[0]) * tm + nx * NUDGE,
        p[1] + (q[1] - p[1]) * tm + nz * NUDGE,
      ]
      return strictlyInside(probe, a) && strictlyInside(probe, b)
    })
  })
}

/** 두 단순 다각형의 내부 면적이 겹치면 true. 변·꼭짓점 접촉만이면 false. */
export function roomsOverlap(a: Point2[], b: Point2[]): boolean {
  return boundaryEntersInterior(a, b) || boundaryEntersInterior(b, a)
}

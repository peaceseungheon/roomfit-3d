// FR-19 윤곽 자동 제안: 평면도 래스터에서 가장 큰 닫힌 방 윤곽을 찾아 모서리 점(원본 이미지 px)으로 돌려준다.
// 순수 함수(DOM·Worker 무관). 이미지 속 글자는 읽지 않는다(AC-19-6) — 어두운 픽셀로만 본다.
import { signedArea } from '../../scene/geometry'
import type { Point2 } from '../../store/types'
import { findIntersections } from '../trace'

/** 계산용 최대 긴 변(AC-19-4) */
export const MAX_SIDE = 1600
/** 방으로 인정할 최소 면적(이미지 대비). 글자 속 구멍 같은 작은 닫힌 영역을 거른다. PRD에 없는 임의값 */
const MIN_AREA_RATIO = 0.01
/** 벽 픽셀 비율이 이를 넘으면 평면도가 아니라고 본다(사진·반전 이미지). 임의값 */
const MAX_WALL_RATIO = 0.6
/** 선 끊김을 메우는 팽창 반경(긴 변 대비). 1차 -> 실패 시 2차. 임의값 */
const GAP_RATIOS = [0.004, 0.012]
/** Douglas-Peucker 허용 오차(긴 변 대비). 임의값 */
const SIMPLIFY_RATIO = 0.007

export interface Pixels {
  /** RGBA, 길이 width*height*4 */
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

/** RGBA -> 그레이(흰 배경 합성), 긴 변이 MAX_SIDE를 넘으면 면적 평균으로 축소(얇은 선이 사라지지 않게). */
function toGray({ data, width, height }: Pixels): { gray: Uint8Array; w: number; h: number } {
  const k = Math.max(1, Math.max(width, height) / MAX_SIDE)
  const w = Math.max(1, Math.floor(width / k))
  const h = Math.max(1, Math.floor(height / k))
  const gray = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * height) / h)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / h))
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * width) / w)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / w))
      let sum = 0
      for (let j = y0; j < y1; j++) {
        for (let i = x0; i < x1; i++) {
          const o = (j * width + i) * 4
          const a = data[o + 3] / 255
          sum += (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) * a + 255 * (1 - a)
        }
      }
      gray[y * w + x] = Math.round(sum / ((y1 - y0) * (x1 - x0)))
    }
  }
  return { gray, w, h }
}

/** Otsu 임계값. 명암 차가 거의 없으면(빈 이미지) null. */
function otsu(gray: Uint8Array): number | null {
  const hist = new Float64Array(256)
  let lo = 255
  let hi = 0
  for (const g of gray) {
    hist[g]++
    if (g < lo) lo = g
    if (g > hi) hi = g
  }
  if (hi - lo < 40) return null
  const total = gray.length
  let sumAll = 0
  for (let i = 0; i < 256; i++) sumAll += i * hist[i]
  let wB = 0
  let sumB = 0
  let best = -1
  let t = 0
  for (let i = 0; i < 256; i++) {
    wB += hist[i]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += i * hist[i]
    const d = sumB / wB - (sumAll - sumB) / wF
    const v = wB * wF * d * d
    if (v > best) {
      best = v
      t = i
    }
  }
  return t
}

/** 정사각 커널(반경 r) 팽창. 가로·세로 분리 + 누적합 O(n). */
function dilate(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const pass = (src: Uint8Array, len: number, lines: number, stride: number, step: number) => {
    const out = new Uint8Array(src.length)
    const pre = new Int32Array(len + 1)
    for (let l = 0; l < lines; l++) {
      const base = l * stride
      for (let i = 0; i < len; i++) pre[i + 1] = pre[i] + src[base + i * step]
      for (let i = 0; i < len; i++) out[base + i * step] = pre[Math.min(len, i + r + 1)] - pre[Math.max(0, i - r)] > 0 ? 1 : 0
    }
    return out
  }
  return pass(pass(m, w, h, w, 1), h, w, 1, w)
}

/** 벽이 아닌 픽셀의 4연결 성분 중 이미지 가장자리에 닿지 않는(=닫힌) 가장 큰 것. 없으면 null. */
function largestEnclosed(wall: Uint8Array, w: number, h: number): Uint8Array | null {
  const label = new Int32Array(w * h)
  const queue = new Int32Array(w * h)
  let bestId = 0
  let bestSize = 0
  let id = 0
  for (let s = 0; s < w * h; s++) {
    if (wall[s] || label[s]) continue
    id++
    let head = 0
    let tail = 0
    let border = false
    queue[tail++] = s
    label[s] = id
    while (head < tail) {
      const p = queue[head++]
      const x = p % w
      const y = (p - x) / w
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]
      for (const q of nb) {
        if (q >= 0 && !wall[q] && !label[q]) {
          label[q] = id
          queue[tail++] = q
        }
      }
    }
    if (!border && tail > bestSize) {
      bestSize = tail
      bestId = id
    }
  }
  if (bestSize < w * h * MIN_AREA_RATIO) return null
  const out = new Uint8Array(w * h)
  for (let i = 0; i < out.length; i++) out[i] = label[i] === bestId ? 1 : 0
  return out
}

const DX = [1, 0, -1, 0]
const DY = [0, 1, 0, -1]

/** 마스크의 바깥 경계를 픽셀 모서리 격자 위 꼭짓점(방향이 꺾이는 곳)으로 추적한다. 4연결, 안쪽이 진행 방향 오른쪽. */
function traceOuter(m: Uint8Array, w: number, h: number): Point2[] {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1
  const start = m.indexOf(1)
  if (start < 0) return []
  const x0 = start % w
  const y0 = (start - x0) / w
  const out: Point2[] = []
  let x = x0
  let y = y0
  let d = 0
  for (let guard = 4 * w * h + 8; guard > 0; guard--) {
    x += DX[d]
    y += DY[d]
    // 꼭짓점 앞쪽의 오른쪽(R)·왼쪽(L) 픽셀
    const [rx, ry, lx, ly] = [
      [x, y, x, y - 1],
      [x - 1, y, x, y],
      [x - 1, y - 1, x - 1, y],
      [x, y - 1, x - 1, y - 1],
    ][d]
    const R = inside(rx, ry)
    const L = inside(lx, ly)
    const nd = R && L ? (d + 3) % 4 : R ? d : (d + 1) % 4
    if (nd !== d) out.push([x, y])
    d = nd
    if (x === x0 && y === y0 && d === 0) return out
  }
  return []
}

const distToSeg = (p: Point2, a: Point2, b: Point2) => {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const len2 = dx * dx + dz * dz
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz))
}

/** 열린 체인 pts[i..j]의 Douglas-Peucker에서 남길 인덱스 표시. */
function dp(pts: Point2[], i: number, j: number, eps: number, keep: Uint8Array) {
  const stack: [number, number][] = [[i, j]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    let far = -1
    let fd = eps
    for (let k = a + 1; k < b; k++) {
      const d = distToSeg(pts[k], pts[a], pts[b])
      if (d > fd) {
        fd = d
        far = k
      }
    }
    if (far >= 0) {
      keep[far] = 1
      stack.push([a, far], [far, b])
    }
  }
}

/** 닫힌 다각형 단순화: 시작점에서 가장 먼 점으로 쪼개 양쪽에 DP. */
export function simplifyClosed(pts: Point2[], eps: number): Point2[] {
  const n = pts.length
  if (n <= 3) return pts
  let far = 1
  let fd = -1
  for (let k = 1; k < n; k++) {
    const d = Math.hypot(pts[k][0] - pts[0][0], pts[k][1] - pts[0][1])
    if (d > fd) {
      fd = d
      far = k
    }
  }
  const keep = new Uint8Array(n)
  keep[0] = keep[far] = 1
  const ring = [...pts, pts[0]]
  dp(ring, 0, far, eps, keep)
  dp(ring, far, n, eps, keep)
  return pts.filter((_, i) => keep[i])
}

/** AC-19-7: 3점 이상·이미지 범위·면적·중복·자기 교차 없음. */
export function isValidOutline(pts: Point2[], width: number, height: number): boolean {
  if (pts.length < 3) return false
  if (!pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= width && y <= height)) return false
  if (pts.some((a, i) => pts.some((b, j) => i < j && a[0] === b[0] && a[1] === b[1]))) return false
  if (signedArea(pts) === 0) return false
  return findIntersections(pts).length === 0
}

/**
 * 평면도에서 가장 큰 닫힌 윤곽의 모서리를 제안한다. 결과 점은 원본(orig) 이미지 px, 못 찾으면 null.
 * img가 이미 축소돼 있으면 orig로 환산한다(기본: img 크기 = 원본).
 */
export function suggestOutline(img: Pixels, orig: { width: number; height: number } = img): Point2[] | null {
  if (img.width < 1 || img.height < 1 || img.data.length < img.width * img.height * 4) return null
  const { gray, w, h } = toGray(img)
  const t = otsu(gray)
  if (t === null) return null
  const wall = new Uint8Array(w * h)
  let wallCount = 0
  for (let i = 0; i < wall.length; i++) {
    if (gray[i] <= t) {
      wall[i] = 1
      wallCount++
    }
  }
  if (wallCount > w * h * MAX_WALL_RATIO) return null
  const side = Math.max(w, h)
  const sx = orig.width / w
  const sy = orig.height / h
  for (const ratio of GAP_RATIOS) {
    const r = Math.max(1, Math.round(side * ratio))
    const room = largestEnclosed(dilate(wall, w, h, r), w, h)
    if (!room) continue
    // 벽 팽창으로 줄어든 만큼 되돌려 원래 벽의 안쪽 경계에 맞춘다.
    const loop = traceOuter(dilate(room, w, h, r), w, h)
    const poly = simplifyClosed(loop, Math.max(1.5, side * SIMPLIFY_RATIO))
    const pts = poly.map(([x, y]): Point2 => [Math.round(x * sx * 10) / 10, Math.round(y * sy * 10) / 10])
    if (isValidOutline(pts, orig.width, orig.height)) return pts
  }
  return null
}

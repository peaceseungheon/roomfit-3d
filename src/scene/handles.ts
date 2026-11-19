// 2D 평면 핸들 히트 판정 순수 로직(FR-04, FR-05). 좌표 [x, z] cm.
import type { Point2 } from '../store/types'
import type { TraceStep } from '../store/useTraceStore'
import { canClose } from '../trace/trace'

/** 점·선 잡기 반경(화면 px). 첫 점 닫기 판정도 같은 값(지시: 12px). */
export const HIT_PX = 12
/** 이보다 적게 움직이고 떼면 클릭, 넘으면 드래그/카메라 이동. Scene의 CLICK_SLOP_PX와 같은 값. */
export const SLOP_PX = 3

/** 직교 카메라에서 화면 px -> cm. R3F 직교 카메라는 1cm = zoom px. 잘못된 zoom이면 0(아무것도 안 잡힘). */
export const hitRadiusCm = (px: number, zoom: number): number => (zoom > 0 && Number.isFinite(zoom) ? px / zoom : 0)

/** 누른 곳에서 (dx, dy)px 움직였을 때 클릭이 아니라 드래그인가. */
export const isDragMove = (dx: number, dy: number): boolean => Math.hypot(dx, dy) > SLOP_PX

/** 격자 선 사이 최소 화면 간격(px). 이보다 촘촘하면 한 단계 굵은 격자를 쓴다. */
export const GRID_MIN_PX = 8
const GRID_LEVELS = [
  { cell: 10, section: 100 },
  { cell: 50, section: 100 },
  { cell: 100, section: 500 },
  { cell: 500, section: 1000 },
] as const

/** 직교 zoom(px/cm)에 맞는 격자 간격(cm). 10cm 스냅 격자가 GRID_MIN_PX 이상이면 그대로, 아니면 굵게. */
export function gridSteps(zoom: number): { cell: number; section: number } {
  return GRID_LEVELS.find((l) => l.cell * zoom >= GRID_MIN_PX) ?? GRID_LEVELS[GRID_LEVELS.length - 1]
}

/** p에서 r 안의 가장 가까운 점 인덱스. 없으면 -1. */
export function hitPoint(points: Point2[], p: Point2, r: number): number {
  let best = -1
  let bd = Infinity
  points.forEach((q, i) => {
    const d = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (d < bd) {
      bd = d
      best = i
    }
  })
  return bd <= r ? best : -1
}

const segDist = (a: Point2, b: Point2, p: Point2): number => {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const l2 = dx * dx + dz * dz
  const t = l2 === 0 ? 0 : Math.min(Math.max(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2, 0), 1)
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t))
}

/** p에서 r 안의 가장 가까운 선분 i(points[i] -> points[i+1]). closed면 마지막->처음 포함. 없으면 -1. */
export function hitSegment(points: Point2[], p: Point2, r: number, closed = true): number {
  const n = points.length
  const segs = closed ? n : n - 1
  let best = -1
  let bd = Infinity
  for (let i = 0; i < segs; i++) {
    const d = segDist(points[i], points[(i + 1) % n], p)
    if (d < bd) {
      bd = d
      best = i
    }
  }
  return n >= 2 && bd <= r ? best : -1
}

export type TraceAction =
  | { kind: 'baseline'; i: 0 | 1 }
  | { kind: 'close' }
  | { kind: 'add' }
  | { kind: 'select'; i: number | null }
  | { kind: 'insert'; wall: number }
  | { kind: 'none' }

/**
 * 트레이싱 평면 클릭(움직임 없이 뗌) 처리. 기준선 단계는 빈 자리 순서대로 찍고, 두 점이 다 있으면 드래그로만 고친다.
 * 모서리 단계: 첫 점 근처(점 3개 이상) = 닫기, 다른 점 위 = 무시(중복 점 방지), 빈 곳 = 추가. 축척 전은 무시(AC-04-5).
 * 닫힌 뒤(AC-05-5): 점 위 = 선택, 선 위 = 그 자리에 점 삽입, 빈 곳 = 선택 해제. 점이 선보다 우선.
 */
export function traceClickAction(step: TraceStep, baselineLen: number, corners: Point2[], p: Point2, r: number): TraceAction {
  if (step === 'baseline') return baselineLen < 2 ? { kind: 'baseline', i: baselineLen as 0 | 1 } : { kind: 'none' }
  if (step === 'closed') {
    const i = hitPoint(corners, p, r)
    if (i >= 0) return { kind: 'select', i }
    const wall = hitSegment(corners, p, r)
    return wall >= 0 ? { kind: 'insert', wall } : { kind: 'select', i: null }
  }
  if (step !== 'corners') return { kind: 'none' }
  const hit = hitPoint(corners, p, r)
  if (hit === 0 && canClose(corners.length)) return { kind: 'close' }
  return hit >= 0 ? { kind: 'none' } : { kind: 'add' }
}

export type CornerAction = { kind: 'corner'; i: number | null } | { kind: 'wall'; i: number } | { kind: 'insert'; wall: number }

/**
 * S-02 모서리 편집 클릭. 점 위 = 점 선택, 벽 위 = 벽 선택(길이 입력, AC-05-2), 이미 선택한 벽을 다시 누르면 그 자리에 점 삽입(AC-05-5), 빈 곳 = 선택 해제.
 * [임의 가정] 벽 첫 클릭은 선택을 유지해 AC-05-2 길이 입력과 충돌하지 않게 한다.
 */
export function cornerClickAction(points: Point2[], selectedWall: number | null, p: Point2, r: number): CornerAction {
  const c = hitPoint(points, p, r)
  if (c >= 0) return { kind: 'corner', i: c }
  const w = hitSegment(points, p, r)
  if (w < 0) return { kind: 'corner', i: null }
  return w === selectedWall ? { kind: 'insert', wall: w } : { kind: 'wall', i: w }
}

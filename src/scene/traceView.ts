// 트레이싱 캔버스의 순수 보조 로직(카메라 범위·키, 격자 배치)과 클릭 처리. 좌표 [x, z] cm.
import type { Point2 } from '../store/types'
import { cornersCm, traceStep, useTraceStore } from '../store/useTraceStore'
import type { Bounds } from './geometry'
import { traceClickAction } from './handles'

/** 그림 영역(이미지 또는 빈 캔버스) ∪ 고스트 바운딩. 고스트가 없으면 base 그대로. */
export function traceBounds(base: Bounds, ghosts: Point2[][]): Bounds {
  const pts = ghosts.flat()
  if (pts.length === 0) return base
  return {
    minX: Math.min(base.minX, ...pts.map((p) => p[0])),
    maxX: Math.max(base.maxX, ...pts.map((p) => p[0])),
    minZ: Math.min(base.minZ, ...pts.map((p) => p[1])),
    maxZ: Math.max(base.maxZ, ...pts.map((p) => p[1])),
  }
}

/** 카메라 재맞춤 키. 방 개수는 넣지 않는다(확정할 때마다 카메라가 튀지 않게). */
export function cameraKey(image: { url: string; width: number; height: number } | null, mode: 'replace' | 'add', hasOffset: boolean): string {
  return `${image ? `${image.url}:${image.width}:${image.height}` : 'blank'}:${mode}:${hasOffset ? 'o' : '-'}`
}

const GRID_LATTICE = 500 // gridSteps의 가장 굵은 cell. 모든 cell(10·50·100·500)이 이 값의 약수다

/**
 * 격자(drei Grid는 메시 중심 기준으로 선을 긋는다)를 영역 min에서 시작하는 선에 맞춘다.
 * 중심을 min + 500의 배수에 두면 모든 cell 간격의 선이 min에서 시작한다. 크기는 영역을 덮을 만큼(최대 250cm 넘침).
 */
export function gridPlacement(a: Bounds): { center: Point2; size: [number, number] } {
  const axis = (min: number, max: number): [number, number] => {
    const c = min + Math.round((max - min) / 2 / GRID_LATTICE) * GRID_LATTICE
    return [c, 2 * Math.max(c - min, max - c)]
  }
  const [cx, w] = axis(a.minX, a.maxX)
  const [cz, d] = axis(a.minZ, a.maxZ)
  return { center: [cx, cz], size: [w, d] }
}

/** 평면 클릭 한 번의 스토어 반영. 클릭 시점의 shift(이웃 스냅 임시 해제)를 addTracePoint에 넘겨 미리보기(setCursor의 free)와 같은 점이 찍히게 한다. */
export function applyTraceClick(p: Point2, r: number, shift: boolean): void {
  const s = useTraceStore.getState()
  const a = traceClickAction(traceStep(s), s.baseline.length, cornersCm(s), p, r) // 닫기·선택 판정은 원시 점으로
  if (a.kind === 'baseline') s.setBaselinePoint(a.i, p[0], p[1])
  else if (a.kind === 'add') s.addTracePoint(p[0], p[1], shift)
  else if (a.kind === 'close') s.closeTrace()
  else if (a.kind === 'select') s.selectTracePoint(a.i)
  else if (a.kind === 'insert') s.insertTracePoint(a.wall, p[0], p[1]) // 실패 문구는 스토어 error
}

// 2D 뷰 치수 라벨(AC-12-4) 순수 로직. 1unit=1cm.
import type { Item, Point2 } from '../store/types'
import { outwardNormal, signedArea } from './geometry'

/** 벽 라벨을 실내 경계에서 바깥으로 띄우는 거리(cm). 벽 두께(10)보다 커야 벽 위에 겹치지 않는다. */
export const WALL_LABEL_OFFSET = 30

/**
 * 가구 표시용 "가로 × 세로 cm". 2D 화면 가로 = x이므로 y축 회전이 90/270°에 가까우면 W·D를 바꾼다.
 * 임의 각도는 가장 가까운 90° 배수로 본다.
 */
export function furnitureDimText(item: Pick<Item, 'size' | 'rotation'>): string {
  const [w, , d] = item.size
  const quarter = Math.round(item.rotation[1] / 90)
  const swap = Math.abs(quarter % 2) === 1
  const [a, b] = swap ? [d, w] : [w, d]
  return `${Math.round(a)} × ${Math.round(b)} cm`
}

export interface WallDimLabel {
  /** 라벨 위치 [x, z] */
  at: Point2
  text: string
}

/** 각 변 길이 라벨. 변 중점에서 바깥 법선 방향으로 offset만큼 띄운다. 길이 0인 변은 건너뛴다. */
export function wallDimLabels(points: Point2[], offset = WALL_LABEL_OFFSET): WallDimLabel[] {
  if (points.length < 3) return []
  const sign = Math.sign(signedArea(points))
  const out: WallDimLabel[] = []
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (Math.round(len) === 0) return
    const [nx, nz] = outwardNormal(a, b, sign)
    out.push({
      at: [(a[0] + b[0]) / 2 + nx * offset, (a[1] + b[1]) / 2 + nz * offset],
      text: `${Math.round(len)} cm`,
    })
  })
  return out
}

// 트레이싱 세션의 순수 헬퍼: 고스트(기존 방) 좌표, 빈 캔버스 그림 영역. 좌표는 트레이싱 평면 cm, [x, z].
import type { Bounds } from '../scene/geometry'
import { BLANK_EXTENT } from '../trace/draw'
import type { Point2, Room } from './types'

/** 기존 방을 트레이싱 평면 좌표로(doc - offset). offset이 null이면 정렬 전이라 보이지 않는다. */
export function ghostRooms(s: { offset: Point2 | null }, rooms: readonly Room[]): Point2[][] {
  const o = s.offset
  if (!o) return []
  return rooms.map((r) => r.points.map(([x, z]): Point2 => [x - o[0], z - o[1]]))
}

const GRID = 10

/** 빈 캔버스 그림 영역. 고스트가 없으면 [0, 3000]², 있으면 고스트 바운딩 박스를 3000씩 넓히고 10 배수로 바깥 반올림. */
export function blankArea(ghosts: Point2[][]): Bounds {
  const pts = ghosts.flat()
  if (pts.length === 0) return { minX: 0, minZ: 0, maxX: BLANK_EXTENT, maxZ: BLANK_EXTENT }
  const xs = pts.map((p) => p[0])
  const zs = pts.map((p) => p[1])
  return {
    minX: Math.floor((Math.min(...xs) - BLANK_EXTENT) / GRID) * GRID,
    minZ: Math.floor((Math.min(...zs) - BLANK_EXTENT) / GRID) * GRID,
    maxX: Math.ceil((Math.max(...xs) + BLANK_EXTENT) / GRID) * GRID,
    maxZ: Math.ceil((Math.max(...zs) + BLANK_EXTENT) / GRID) * GRID,
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export const clampArea = (p: Point2, a: Bounds): Point2 => [clamp(p[0], a.minX, a.maxX), clamp(p[1], a.minZ, a.maxZ)]

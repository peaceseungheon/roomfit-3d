// S-10 방 배치(FR-23)의 순수 보조 로직. 좌표 [x, z] cm. 문서는 놓을 때만 바꾸고, 끄는 동안은 delta 미리 보기다.
import { roomMoveCheck, snapRoomMove } from '../store/roomMove'
import type { Point2, Room } from '../store/types'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import { roomBounds, pointInPolygon, type Bounds } from './geometry'

/** 방 이름 라벨 위치: 면적 무게중심. 오목한 방이라 밖이면 경계 상자를 20x20으로 훑어 방 안에서 무게중심에 가장 가까운 점. */
export function roomLabelPos(points: Point2[]): Point2 {
  let a = 0
  let cx = 0
  let cz = 0
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, zi] = points[i]
    const [xj, zj] = points[j]
    const f = xj * zi - xi * zj
    a += f
    cx += (xj + xi) * f
    cz += (zj + zi) * f
  }
  const b = roomBounds(points)
  const c: Point2 = a !== 0 ? [cx / (3 * a), cz / (3 * a)] : [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2]
  if (pointInPolygon(points, c[0], c[1])) return c
  let best = c
  let bd = Infinity
  for (let i = 0; i < 20; i++)
    for (let j = 0; j < 20; j++) {
      const x = b.minX + ((i + 0.5) / 20) * (b.maxX - b.minX)
      const z = b.minZ + ((j + 0.5) / 20) * (b.maxZ - b.minZ)
      const d = Math.hypot(x - c[0], z - c[1])
      if (d < bd && pointInPolygon(points, x, z)) [best, bd] = [[x, z], d]
    }
  return best
}

/** 가로×세로 표시(경계 상자 기준, cm). */
export function roomSizeText(points: Point2[]): string {
  const b = roomBounds(points)
  return `${Math.round(b.maxX - b.minX)}×${Math.round(b.maxZ - b.minZ)}cm`
}

/** 누른 지점(cm)이 든 방. 겹침은 금지이므로 하나뿐이다. */
export const roomAt = (rooms: readonly Room[], p: Point2): Room | null => rooms.find((r) => pointInPolygon(r.points, p[0], p[1])) ?? null

export interface MovePreview {
  delta: Point2
  ok: boolean
  /** 겹친 방 id(붉게). 집 크기 초과면 비어 있고 끄는 방만 붉다 */
  overlapWith: string[]
  reason?: string
}

/** 드래그 한 번의 미리 보기: 누른 지점 대비 이동량 -> 스냅(격자·이웃, Shift면 이웃 해제) -> 검증. */
export function previewMove(rooms: readonly Room[], id: string, start: Point2, p: Point2, shift: boolean, grid: boolean): MovePreview {
  const delta = snapRoomMove(rooms, id, [p[0] - start[0], p[1] - start[1]], { grid, neighbor: !shift })
  const chk = roomMoveCheck(rooms, id, delta)
  return { delta, ok: chk.ok, overlapWith: chk.overlapWith ?? [], reason: chk.reason }
}

/** 놓기: 미리 보기가 ok면 문서를 한 번 바꾼다. 위반이면 문서는 그대로(=직전 위치 복귀)이고 사유를 토스트로 알린다. 이동 안 했으면 아무 일도 없다. */
export function commitMove(id: string, pv: MovePreview): boolean {
  const notice = useUiStore.getState().setNotice
  if (!pv.ok) return notice(pv.reason ?? '방을 옮길 수 없습니다'), false
  if (pv.delta[0] === 0 && pv.delta[1] === 0) return true
  const r = useDocStore.getState().moveRoom(id, pv.delta)
  return r === true || (notice(r.reason), false)
}

/** 화면 시작 카메라 범위: 모든 방 + 여백(드래그 여유). */
export function layoutBounds(rooms: readonly Room[], margin = 500): Bounds {
  const pts = rooms.flatMap((r) => r.points)
  const b = pts.length ? roomBounds(pts) : { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }
  return { minX: b.minX - margin, maxX: b.maxX + margin, minZ: b.minZ - margin, maxZ: b.maxZ + margin }
}

/** 방 id를 delta만큼 옮긴 뒤 음수 정규화로 문서 전체가 더 이동한 양. 카메라를 같은 양만 옮겨 시야를 유지한다. */
export function normShift(before: readonly Room[], after: readonly Room[], id: string, delta: Point2): Point2 {
  const a = before.find((r) => r.id === id)?.points[0]
  const b = after.find((r) => r.id === id)?.points[0]
  return a && b ? [b[0] - a[0] - delta[0], b[1] - a[1] - delta[1]] : [0, 0]
}

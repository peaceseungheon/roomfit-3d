// 이동·회전 순수 로직. 1unit=1cm, 월드 (x, z) = 방 좌표 (x, z).
import { Plane, Vector3, type Ray } from 'three'
import type { Item, Point2, Room, Vec3 } from '../store/types'
import { nearestWallIn } from './geometry'

/** 이동 스냅 단위(AC-10-1). 스냅을 끄면(AC-10-2) 1cm. */
export const SNAP_CM = 10

/** 현재 스냅 설정의 이동 단위. */
export const snapStep = (enabled: boolean): number => (enabled ? SNAP_CM : 1)

export const snap = (v: number, step = SNAP_CM): number => Math.round(v / step) * step

const GROUND = new Plane(new Vector3(0, 1, 0), 0)
const hit = new Vector3()

/** 광선과 y=0 바닥의 교점 [x, z]. 평행하거나 바닥을 향하지 않으면 null. */
export function groundPoint(ray: Ray): Point2 | null {
  return ray.intersectPlane(GROUND, hit) ? [hit.x, hit.z] : null
}

/**
 * 모든 방에서 가장 가까운 벽 위로 투영. 벽 시작점부터 거리를 step으로 스냅하고,
 * 폭 width가 벽 구간 안에 들어가게 clamp한다(벽이 폭보다 짧으면 벽 중앙).
 */
export function projectOntoWall(rooms: Room[], x: number, z: number, width: number, step = SNAP_CM): Point2 {
  const host = nearestWallIn(rooms, x, z)
  if (!host) return [x, z]
  const w = host.wall
  const half = width / 2
  const s = w.len < width ? w.len / 2 : Math.min(Math.max(snap(w.s, step), half), w.len - half)
  return [w.a[0] + w.dir[0] * s, w.a[1] + w.dir[1] * s]
}

/** (x, z)로 옮길 때 저장할 position. 가구는 스냅만(방 밖도 허용, AC-11-2), 고정 요소는 벽 위로. y는 항상 0. */
export function moveTarget(item: Item, x: number, z: number, rooms: Room[], step = SNAP_CM): Vec3 {
  if (item.type === 'FIXTURE') {
    const [px, pz] = projectOntoWall(rooms, x, z, item.size[0], step)
    return [px, 0, pz]
  }
  return [snap(x, step), 0, snap(z, step)]
}

/** 90° 단위 회전(AC-08-4). 결과는 0~359 정수 도(AC-10-3). */
export const nextRotation = (deg: number): number => (((Math.round(deg) + 90) % 360) + 360) % 360

export type PressMode = 'drag' | 'select' | 'ignore'

/**
 * 누름 처리 방식(AC-10-4). 터치: 이미 선택된 항목만 드래그, 아니면 선택만(카메라 조작 유지).
 * 마우스·펜: 주 버튼(0)만 선택+드래그, 나머지 버튼은 무시해 카메라 조작으로 넘긴다.
 */
export function pressMode(pointerType: string, button: number, selected: boolean): PressMode {
  if (pointerType === 'touch') return selected ? 'drag' : 'select'
  return button === 0 ? 'drag' : 'ignore'
}

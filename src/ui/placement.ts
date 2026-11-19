// 카탈로그 배치·복제용 순수 로직(AC-08-1, AC-08-4).
import { computeWarnings } from '../scene/collision'
import { roomBounds } from '../scene/geometry'
import { SNAP_CM, snap } from '../scene/interaction'
import { DIMENSION_BOX_TYPE, catalogSize, type CatalogEntry } from '../store/catalog'
import type { Item, Room, Vec3 } from '../store/types'

export const DUPLICATE_OFFSET = 20

export function nextItemId(items: Item[], prefix = 'item'): string {
  const head = `${prefix}_`
  const max = items.reduce((m, it) => {
    const n = it.id.startsWith(head) ? Number(it.id.slice(head.length)) : NaN
    return Number.isInteger(n) ? Math.max(m, n) : m
  }, 0)
  return `${head}${String(max + 1).padStart(3, '0')}`
}

const SEARCH_RADIUS = 200

/** 방 중앙에서 가까운 순으로 10cm 격자를 훑어 간섭 없는 첫 자리. 없으면 중앙. */
export function findFreeSpot(room: Room, items: Item[], candidate: Item): Vec3 {
  const b = roomBounds(room.points)
  const cx = snap((b.minX + b.maxX) / 2)
  const cz = snap((b.minZ + b.maxZ) / 2)
  const offsets: [number, number][] = []
  for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx += SNAP_CM)
    for (let dz = -SEARCH_RADIUS; dz <= SEARCH_RADIUS; dz += SNAP_CM) offsets.push([dx, dz])
  offsets.sort((a, c) => a[0] ** 2 + a[1] ** 2 - (c[0] ** 2 + c[1] ** 2))
  for (const [dx, dz] of offsets) {
    const trial: Item = { ...candidate, position: [cx + dx, 0, cz + dz] }
    const hit = computeWarnings(room, [...items, trial]).some(
      (w) => w.itemId === trial.id || w.otherId === trial.id,
    )
    if (!hit) return trial.position
  }
  return [cx, 0, cz]
}

export function makeFromCatalog(entry: CatalogEntry, room: Room, items: Item[]): Item {
  const base: Item = {
    id: nextItemId(items),
    type: 'FURNITURE',
    modelType: entry.modelType,
    name: entry.name,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    size: catalogSize(entry),
    color: entry.color,
  }
  return { ...base, position: findFreeSpot(room, items, base) }
}

/** 치수 박스(FR-09). 배치는 카탈로그와 같은 빈자리 탐색을 쓴다. name이 비면 생략. */
export function makeDimensionBox(
  spec: { size: Vec3; name?: string; color: string },
  room: Room,
  items: Item[],
): Item {
  const name = spec.name?.trim()
  const base: Item = {
    id: nextItemId(items),
    type: 'FURNITURE',
    modelType: DIMENSION_BOX_TYPE,
    ...(name && { name }),
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    size: spec.size,
    color: spec.color,
  }
  return { ...base, position: findFreeSpot(room, items, base) }
}

export function makeDuplicate(src: Item, items: Item[]): Item {
  return {
    ...src,
    id: nextItemId(items),
    position: [src.position[0] + DUPLICATE_OFFSET, 0, src.position[2] + DUPLICATE_OFFSET],
  }
}

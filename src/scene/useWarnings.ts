import { useDocStore } from '../store/useDocStore'
import type { Item, Room } from '../store/types'
import { computeWarnings, type Warning } from './collision'

// rooms·items 참조가 같으면 다시 계산하지 않는다. 씬과 경고 UI(단계 4)가 같은 결과를 공유한다.
let cache: { rooms: Room[]; items: Item[]; warnings: Warning[] } | null = null

export function selectWarnings(rooms: Room[], items: Item[]): Warning[] {
  if (cache?.rooms !== rooms || cache.items !== items) cache = { rooms, items, warnings: computeWarnings(rooms, items) }
  return cache.warnings
}

/** 현재 문서의 간섭 경고. 드래그 중에도 rooms·items가 바뀔 때마다 갱신된다. */
export function useWarnings(): Warning[] {
  const rooms = useDocStore((s) => s.rooms)
  const items = useDocStore((s) => s.items)
  return selectWarnings(rooms, items)
}

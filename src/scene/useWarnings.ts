import { useDocStore } from '../store/useDocStore'
import type { Item, Room } from '../store/types'
import { computeWarnings, type Warning } from './collision'

// room·items 참조가 같으면 다시 계산하지 않는다. 씬과 경고 UI(단계 4)가 같은 결과를 공유한다.
let cache: { room: Room; items: Item[]; warnings: Warning[] } | null = null

export function selectWarnings(room: Room, items: Item[]): Warning[] {
  if (cache?.room !== room || cache.items !== items) cache = { room, items, warnings: computeWarnings(room, items) }
  return cache.warnings
}

/** 현재 문서의 간섭 경고. 드래그 중에도 items가 바뀔 때마다 갱신된다. */
export function useWarnings(): Warning[] {
  const room = useDocStore((s) => s.room)
  const items = useDocStore((s) => s.items)
  return selectWarnings(room, items)
}

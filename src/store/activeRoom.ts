// 활성 방 해석. activeRoomId는 useUiStore(Undo 비대상)에 있고, 무효하면 rooms[0].
import { useDocStore } from './useDocStore'
import { useUiStore } from './useUiStore'
import type { Room } from './types'

export const findRoom = (rooms: readonly Room[], id: string | null): Room => rooms.find((r) => r.id === id) ?? rooms[0]

export const getActiveRoom = (): Room => findRoom(useDocStore.getState().rooms, useUiStore.getState().activeRoomId)

export const useActiveRoom = (): Room => {
  const rooms = useDocStore((s) => s.rooms)
  const activeRoomId = useUiStore((s) => s.activeRoomId)
  return findRoom(rooms, activeRoomId)
}

export const useActiveRoomId = (): string => {
  const rooms = useDocStore((s) => s.rooms)
  const activeRoomId = useUiStore((s) => s.activeRoomId)
  return findRoom(rooms, activeRoomId).id
}

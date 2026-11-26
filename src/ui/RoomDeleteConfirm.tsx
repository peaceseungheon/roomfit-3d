import type { Room } from '../store/types'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import ConfirmDialog from './ConfirmDialog'
import { deleteRoomMessage, furnitureInRoom } from './roomForm'

/** 방 삭제 확인(S-04 방 목록·S-10 편집 패널 공용). 가구는 남기는 removeRoom 정책을 그대로 따른다. */
export default function RoomDeleteConfirm({ room, onClose }: { room: Room; onClose: () => void }) {
  const furniture = useDocStore((s) => furnitureInRoom(s.rooms, s.items, room.id))
  return (
    <ConfirmDialog
      title="방 삭제"
      confirmLabel="삭제"
      onCancel={onClose}
      onConfirm={() => {
        if (!useDocStore.getState().removeRoom(room.id)) useUiStore.getState().setNotice('⚠ 방을 삭제하지 못했습니다')
        onClose()
      }}
    >
      <p>{deleteRoomMessage(room.name, furniture)}</p>
    </ConfirmDialog>
  )
}

import type { Room } from '../store/types'

/** S-03 미리보기: 입력이 유효할 때 만들어질 방 윤곽(2D). 유효하지 않으면 안내만. */
export default function RoomPreview({ room }: { room: Room | null }) {
  if (!room) return <p className="hint">올바른 값을 입력하면 미리보기가 표시됩니다.</p>
  const xs = room.points.map((p) => p[0])
  const zs = room.points.map((p) => p[1])
  const pad = Math.max(...xs, ...zs) * 0.05
  const w = Math.max(...xs) - Math.min(...xs)
  const d = Math.max(...zs) - Math.min(...zs)
  return (
    <svg
      className="room-preview"
      role="img"
      aria-label={`방 미리보기 ${w}×${d}cm`}
      viewBox={`${Math.min(...xs) - pad} ${Math.min(...zs) - pad} ${w + pad * 2} ${d + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <polygon points={room.points.map((p) => p.join(',')).join(' ')} fill="#fff" stroke="#263238" strokeWidth={Math.max(w, d) / 100} />
    </svg>
  )
}

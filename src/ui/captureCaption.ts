// 판정 카드 캡처(사업성 검토 §5-5)의 주석 문구. 캔버스에 그리는 쪽은 MenuButton의 capturePng.
import { KIND_LABEL } from './warningText'
import type { Warning } from '../scene/collision'
import { itemLabel } from '../store/catalog'
import type { Item, Room } from '../store/types'

export const CAPTION_MAX_WARNINGS = 4

const extent = (room: Room, axis: 0 | 1): number => {
  const v = room.points.map((p) => p[axis])
  return Math.max(...v) - Math.min(...v)
}

/** 방별 한 줄(가로×세로·천장고)과 경고 요약 줄들. */
export function captionLines(rooms: Room[], items: Item[], warnings: Warning[]): string[] {
  const name = (id: string) => {
    const it = items.find((i) => i.id === id)
    return it ? itemLabel(it) : id
  }
  const lines = rooms.map((r) => `${r.name} ${extent(r, 0)}×${extent(r, 1)}cm · 천장 ${r.height}cm`)
  if (!warnings.length) return [...lines, '경고 없음: 가구 간섭·문 열림 침범이 없습니다']
  const shown = warnings.slice(0, CAPTION_MAX_WARNINGS).map((w) => {
    const other = w.otherId ? ` ↔ ${name(w.otherId)}` : ''
    return `⚠ ${KIND_LABEL[w.kind]}: ${name(w.itemId)}${other}`
  })
  const rest = warnings.length - shown.length
  return [...lines, `경고 ${warnings.length}건`, ...shown, ...(rest > 0 ? [`외 ${rest}건`] : [])]
}

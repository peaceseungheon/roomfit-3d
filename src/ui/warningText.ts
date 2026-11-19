// 경고 문구(경고 목록과 선택 항목 패널이 공유). 색에만 의존하지 않도록 사유를 글로 쓴다.
import type { Warning, WarningKind } from '../scene/collision'

export const KIND_LABEL: Record<WarningKind, string> = {
  ITEM: '가구 간섭',
  DOOR_SWING: '문 열림 반경 침범',
  WALL: '벽 간섭',
  FIXTURE_OVERLAP: '고정 요소 겹침',
  NO_SPACE: '자리 없음',
}

/** id 항목에 해당하는 경고 사유 문구. 상대가 있으면 이름을 덧붙인다. */
export function reasonsFor(warnings: Warning[], id: string, nameOf: (id: string) => string): string[] {
  const out: string[] = []
  for (const w of warnings) {
    if (w.itemId !== id && w.otherId !== id) continue
    const other = w.itemId === id ? w.otherId : w.itemId
    out.push(`${KIND_LABEL[w.kind]}${other ? ` (${nameOf(other)})` : ''}`)
  }
  return out
}

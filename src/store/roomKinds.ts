// FR-23 방 종류. 기본 8개 + 사용자 입력(문서의 rooms.kind에만 저장, 별도 목록 없음).
import type { Room } from './types'

export const KIND_MAX = 20
export const DEFAULT_KINDS = ['안방', '거실', '주방', '옷방', '욕실', '작은방', '현관', '베란다'] as const

/** 직접 입력 정규화: trim 후 1~KIND_MAX자면 그 값, 아니면 null(빈 값 거부). */
export const normalizeKind = (s: string): string | null => {
  const t = s.trim()
  return t.length >= 1 && t.length <= KIND_MAX ? t : null
}

/** 칩 줄: 기본 8개 + 문서 rooms에 이미 있는 그 외 kind(중복 제거, 등장 순). */
export const kindChips = (rooms: readonly Pick<Room, 'kind'>[]): string[] => {
  const extra = rooms.flatMap((r) => (r.kind && !(DEFAULT_KINDS as readonly string[]).includes(r.kind) ? [r.kind] : []))
  return [...DEFAULT_KINDS, ...new Set(extra)]
}

/** kind를 기본 이름으로. 같은 이름이 있으면 가장 작은 미사용 번호(≥2)를 붙인다: '작은방', '작은방 2', ... */
export const roomNameForKind = (kind: string, rooms: readonly Pick<Room, 'name'>[]): string => {
  const used = new Set(rooms.map((r) => r.name))
  if (!used.has(kind)) return kind
  let n = 2
  while (used.has(`${kind} ${n}`)) n++
  return `${kind} ${n}`
}

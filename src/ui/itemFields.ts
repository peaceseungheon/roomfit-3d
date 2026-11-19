// UI 필드 파싱·검증과 스토어 size [W,H,D] <-> UI W×D×H 변환(AC-09-3). 변환은 이 파일에서만 한다.
import { ITEM_MAX_H, ITEM_MAX_WD, ROOM_MAX } from '../io/validate'
import type { Vec3 } from '../store/types'

export type FieldResult = { ok: true; value: number } | { ok: false; error: string }

/** 정수 cm 입력 파싱. 빈 값·소수·범위 밖은 오류. */
export function parseIntField(raw: string, min: number, max: number): FieldResult {
  const t = raw.trim()
  if (!/^-?\d+$/.test(t)) return { ok: false, error: '정수를 입력하세요' }
  const v = Number(t)
  if (v < min || v > max) return { ok: false, error: `${min}~${max} 사이로 입력하세요` }
  return { ok: true, value: v }
}

export const SIZE_LIMITS = { w: [1, ITEM_MAX_WD], d: [1, ITEM_MAX_WD], h: [1, ITEM_MAX_H] } as const
export const POSITION_LIMIT = ROOM_MAX // 위치 입력 범위: -3000~3000 (방 상한과 동일)
export const ROTATION_LIMITS = [0, 359] as const // AC-10-3

export interface UiSize {
  w: number
  d: number
  h: number
}

export const toUiSize = (size: Vec3): UiSize => ({ w: size[0], d: size[2], h: size[1] })
export const fromUiSize = (s: UiSize): Vec3 => [s.w, s.h, s.d]

export interface BoxForm {
  w: string
  d: string
  h: string
}
export type BoxFormResult =
  | { ok: true; size: Vec3 }
  | { ok: false; errors: Partial<Record<keyof BoxForm, string>> }

/** 치수 박스 생성 폼(AC-09-1, AC-09-4). 필드별 오류를 모으고, 하나라도 틀리면 반영하지 않는다. */
export function parseBoxForm(f: BoxForm): BoxFormResult {
  const errors: Partial<Record<keyof BoxForm, string>> = {}
  const v = {} as UiSize
  for (const k of ['w', 'd', 'h'] as const) {
    const r = parseIntField(f[k], SIZE_LIMITS[k][0], SIZE_LIMITS[k][1])
    if (r.ok) v[k] = r.value
    else errors[k] = r.error
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, size: fromUiSize(v) }
}

/** 문 여는 방향. direction 문자열 <-> (좌/우, 실내/실외). */
export type Hinge = 'LEFT' | 'RIGHT'
export type Side = 'IN' | 'OUT'

export function parseSwing(direction: string | undefined): { hinge: Hinge; side: Side } {
  const [h, s] = (direction ?? 'LEFT_IN').split('_')
  return { hinge: h === 'RIGHT' ? 'RIGHT' : 'LEFT', side: s === 'OUT' ? 'OUT' : 'IN' }
}

export const composeSwing = (hinge: Hinge, side: Side): string => `${hinge}_${side}`

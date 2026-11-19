// S-03 홈/돌출 입력의 순수 로직: 문자열 초안 -> 검증 -> 사각형(또는 ㄱ자) 윤곽에 차례로 적용(AC-03-5).
import { notchWall, notchWallShifted, type Check, type NotchKind } from '../trace/trace'
import type { Point2 } from '../store/types'

export interface NotchSpec {
  /** 0부터 시작하는 벽 인덱스(화면 표기는 +1) */
  wall: number
  kind: NotchKind
  offset: number
  width: number
  depth: number
}

/** 입력 문자열 초안. wall은 화면 번호(1부터). */
export interface NotchDraft {
  wall: string
  kind: NotchKind
  offset: string
  width: string
  depth: string
}

export type NotchDraftErrors = Partial<Record<'wall' | 'offset' | 'width' | 'depth' | 'form', string>>

export const emptyNotchDraft = (): NotchDraft => ({ wall: '1', kind: 'cut', offset: '0', width: '', depth: '' })

const int = (s: string): number => (/^\d+$/.test(s.trim()) ? Number(s) : NaN)

/** 기존 notches를 base에 차례로 적용한다. 하나라도 실패하면 그 문구를 돌려준다. */
export function applyNotches(base: Point2[], notches: NotchSpec[]): Check<Point2[]> {
  const r = applyNotchesShifted(base, notches)
  return r.ok ? { ok: true, value: r.value.points } : r
}

/** applyNotches + 정규화로 방이 옮겨진 누적량(위/왼쪽 돌출이면 +). 가구를 같이 옮기는 데 쓴다. */
export function applyNotchesShifted(base: Point2[], notches: NotchSpec[]): Check<{ points: Point2[]; shift: Point2 }> {
  let points = base
  let shift: Point2 = [0, 0]
  for (const n of notches) {
    const r = notchWallShifted(points, n.wall, n.offset, n.width, n.depth, n.kind)
    if (!r.ok) return r
    points = r.value.points
    shift = [shift[0] + r.value.shift[0], shift[1] + r.value.shift[1]]
  }
  return { ok: true, value: { points, shift } }
}

/** 초안을 검사한다. 숫자 형식 오류는 필드별, 기하 오류(범위·교차·상한)는 form에 담는다. points는 현재(적용된) 윤곽. */
export function checkNotchDraft(points: Point2[], d: NotchDraft): { ok: true; spec: NotchSpec } | { ok: false; errors: NotchDraftErrors } {
  const errors: NotchDraftErrors = {}
  const wall = int(d.wall)
  const [offset, width, depth] = [int(d.offset), int(d.width), int(d.depth)]
  if (!(wall >= 1 && wall <= points.length)) errors.wall = `1~${points.length} 정수`
  if (Number.isNaN(offset)) errors.offset = '0 이상 정수'
  if (Number.isNaN(width)) errors.width = '정수를 입력하세요'
  if (Number.isNaN(depth)) errors.depth = '정수를 입력하세요'
  if (Object.keys(errors).length) return { ok: false, errors }
  const spec: NotchSpec = { wall: wall - 1, kind: d.kind, offset, width, depth }
  const r = notchWall(points, spec.wall, offset, width, depth, d.kind)
  return r.ok ? { ok: true, spec } : { ok: false, errors: { form: r.error } }
}

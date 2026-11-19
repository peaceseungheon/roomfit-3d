import type { DocumentJson, Point2, Vec3 } from '../store/types'

export const ROOM_MAX = 3000
export const ROOM_MIN = 100
export const CEIL_MIN = 180
export const CEIL_MAX = 400
export const CUT_MIN = 50
export const ITEM_MAX_WD = 1000
export const ITEM_MAX_H = 500
export const NAME_MAX = 100
export const POINTS_MAX = 100
const COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const SWING_DIRS = ['LEFT_IN', 'RIGHT_IN', 'LEFT_OUT', 'RIGHT_OUT']

export interface ValidationError {
  path: string
  message: string
}
export type Result<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] }

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function vec3(v: unknown, path: string, errs: ValidationError[]): v is Vec3 {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) {
    errs.push({ path, message: '숫자 3개 배열이어야 합니다' })
    return false
  }
  return true
}

function checkRoom(room: unknown, errs: ValidationError[]) {
  if (!isObj(room)) {
    errs.push({ path: 'room', message: '필수 필드입니다' })
    return
  }
  const { height, points } = room
  if (!isNum(height) || height < CEIL_MIN || height > CEIL_MAX)
    errs.push({ path: 'room.height', message: `${CEIL_MIN}~${CEIL_MAX}cm 숫자여야 합니다` })
  if (!Array.isArray(points) || points.length < 3 || points.length > POINTS_MAX) {
    errs.push({ path: 'room.points', message: `꼭짓점은 3~${POINTS_MAX}개여야 합니다` })
    return
  }
  let ok = true
  points.forEach((p, i) => {
    if (!Array.isArray(p) || p.length !== 2 || !p.every(isNum)) {
      errs.push({ path: `room.points[${i}]`, message: '[x, z] 숫자 쌍이어야 합니다' })
      ok = false
    }
  })
  if (!ok) return
  const ps = points as Point2[]
  for (const axis of [0, 1] as const) {
    let lo = Infinity
    let hi = -Infinity
    for (const p of ps) {
      lo = Math.min(lo, p[axis])
      hi = Math.max(hi, p[axis])
    }
    if (hi - lo > ROOM_MAX)
      errs.push({ path: 'room.points', message: `${axis === 0 ? '가로' : '세로'}가 ${ROOM_MAX}cm를 넘습니다` })
  }
}

/** 방(height, points)만 검증. 저장 JSON 불러오기와 같은 규칙(점 3~100개, 가로·세로 상한). */
export function validateRoom(room: unknown): ValidationError[] {
  const errs: ValidationError[] = []
  checkRoom(room, errs)
  return errs
}

function checkItem(it: unknown, i: number, errs: ValidationError[], ids: Set<string>, ctxHeight?: number) {
  const p = `items[${i}]`
  if (!isObj(it)) {
    errs.push({ path: p, message: '객체여야 합니다' })
    return
  }
  if (typeof it.id !== 'string' || !it.id) errs.push({ path: `${p}.id`, message: '필수 문자열입니다' })
  else if (ids.has(it.id)) errs.push({ path: `${p}.id`, message: `중복 id: ${it.id}` })
  else ids.add(it.id)
  if (it.type !== 'FURNITURE' && it.type !== 'FIXTURE')
    errs.push({ path: `${p}.type`, message: 'FURNITURE 또는 FIXTURE여야 합니다' })
  if (typeof it.modelType !== 'string' || !it.modelType)
    errs.push({ path: `${p}.modelType`, message: '필수 문자열입니다' })
  if (it.name !== undefined && (typeof it.name !== 'string' || it.name.length > NAME_MAX))
    errs.push({ path: `${p}.name`, message: `${NAME_MAX}자 이하 문자열이어야 합니다` })
  if (it.color !== undefined && (typeof it.color !== 'string' || !COLOR_RE.test(it.color)))
    errs.push({ path: `${p}.color`, message: '#RGB 또는 #RRGGBB 형식이어야 합니다' })
  if (vec3(it.position, `${p}.position`, errs)) {
    if (it.position[1] !== 0) errs.push({ path: `${p}.position[1]`, message: 'y는 0이어야 합니다' })
    for (const a of [0, 2])
      if (Math.abs(it.position[a]) > ROOM_MAX)
        errs.push({ path: `${p}.position[${a}]`, message: `±${ROOM_MAX}cm 범위를 벗어났습니다` })
  }
  vec3(it.rotation, `${p}.rotation`, errs)
  if (vec3(it.size, `${p}.size`, errs)) {
    const [w, h, d] = it.size
    if (!(w > 0 && w <= ITEM_MAX_WD)) errs.push({ path: `${p}.size[0]`, message: `가로는 0 초과 ${ITEM_MAX_WD}cm 이하` })
    if (!(h > 0 && h <= ITEM_MAX_H)) errs.push({ path: `${p}.size[1]`, message: `높이는 0 초과 ${ITEM_MAX_H}cm 이하` })
    if (!(d > 0 && d <= ITEM_MAX_WD)) errs.push({ path: `${p}.size[2]`, message: `깊이는 0 초과 ${ITEM_MAX_WD}cm 이하` })
  }
  if (it.elevation !== undefined) {
    const room = ctxHeight
    if (!isNum(it.elevation) || it.elevation < 0 || (room !== undefined && it.elevation > room))
      errs.push({ path: `${p}.elevation`, message: `0 이상${room !== undefined ? ` ${room}cm(천장고) 이하` : ''} 숫자여야 합니다` })
  }
  if (it.doorSwing !== undefined) {
    const s = it.doorSwing
    if (!isObj(s) || typeof s.direction !== 'string' || !SWING_DIRS.includes(s.direction) || !isNum(s.radius) || s.radius <= 0 || !isNum(s.angle))
      errs.push({ path: `${p}.doorSwing`, message: '{direction:LEFT_IN|RIGHT_IN|LEFT_OUT|RIGHT_OUT, radius>0, angle} 형식이어야 합니다' })
  }
}

/** 불러오기 검증. 예외를 던지지 않고 필드 경로 포함 오류 목록을 반환한다. */
export function validateDocument(input: unknown): Result<DocumentJson> {
  const errs: ValidationError[] = []
  if (!isObj(input)) return { ok: false, errors: [{ path: '$', message: 'JSON 객체가 아닙니다' }] }
  const info = input.projectInfo
  if (!isObj(info)) errs.push({ path: 'projectInfo', message: '필수 필드입니다' })
  else {
    if (info.version !== '1.0')
      errs.push({
        path: 'projectInfo.version',
        message: `지원하지 않는 버전입니다 (필요: "1.0", 입력: ${JSON.stringify(info.version)})`,
      })
    if (typeof info.lastModified !== 'string')
      errs.push({ path: 'projectInfo.lastModified', message: '필수 문자열입니다' })
  }
  checkRoom(input.room, errs)
  if (!Array.isArray(input.items)) errs.push({ path: 'items', message: '배열이어야 합니다' })
  else {
    const ids = new Set<string>()
    const rh = isObj(input.room) && isNum(input.room.height) ? input.room.height : undefined
    input.items.forEach((it, i) => checkItem(it, i, errs, ids, rh))
  }
  return errs.length ? { ok: false, errors: errs } : { ok: true, value: input as unknown as DocumentJson }
}

/** JSON 텍스트 검증. 파싱 실패도 오류 목록으로 반환한다. */
export function parseDocument(text: string): Result<DocumentJson> {
  try {
    return validateDocument(JSON.parse(text))
  } catch {
    return { ok: false, errors: [{ path: '$', message: '올바른 JSON이 아닙니다' }] }
  }
}

// ---- AC-03-3 방 생성 입력 검증 ----
export interface RoomInput {
  kind: 'rect' | 'L'
  width: number
  depth: number
  height: number
  cutWidth?: number
  cutDepth?: number
}
export type RoomInputErrors = Partial<Record<'width' | 'depth' | 'height' | 'cutWidth' | 'cutDepth', string>>

const intIn = (v: unknown, lo: number, hi: number): string | undefined =>
  !Number.isInteger(v)
    ? '정수를 입력하세요'
    : (v as number) < lo || (v as number) > hi
      ? `${lo}~${hi}cm 범위여야 합니다`
      : undefined

/** 빈 객체면 유효. 비어 있지 않으면 "만들기" 비활성화. */
export function validateRoomInput(i: RoomInput): RoomInputErrors {
  const e: RoomInputErrors = {}
  const w = intIn(i.width, ROOM_MIN, ROOM_MAX)
  const d = intIn(i.depth, ROOM_MIN, ROOM_MAX)
  const h = intIn(i.height, CEIL_MIN, CEIL_MAX)
  if (w) e.width = w
  if (d) e.depth = d
  if (h) e.height = h
  if (i.kind === 'L') {
    const cw = intIn(i.cutWidth, CUT_MIN, ROOM_MAX)
    const cd = intIn(i.cutDepth, CUT_MIN, ROOM_MAX)
    if (cw) e.cutWidth = cw
    else if (!w && (i.cutWidth as number) >= i.width) e.cutWidth = '전체 가로보다 작아야 합니다'
    if (cd) e.cutDepth = cd
    else if (!d && (i.cutDepth as number) >= i.depth) e.cutDepth = '전체 세로보다 작아야 합니다'
  }
  return e
}

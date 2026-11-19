// 평면도 트레이싱(S-04) 상태. Undo/Redo 비대상, 저장 JSON에 넣지 않는다(AC-04-6).
// 좌표계: 점은 이미지 픽셀로 저장하고, 화면(트레이싱 평면, cm)에서 들어온 좌표는 displayScale로 나눠 변환한다.
// 빈 캔버스 모드: image=null, scale=1(1cm/px)로 시작해 기준선 단계를 건너뛴다. 이미지를 올리면(setImage) 기존 트레이싱으로 전환된다.
// 이미지는 평면 (0,0)부터 가로 w*displayScale, 세로(=z) h*displayScale cm로 놓는다(trace/trace.ts imageRect).
import { create } from 'zustand'
import { snap, snapStep } from '../scene/interaction'
import { BLANK_EXTENT, deletePoint, drawPoint, insertPoint, pointFromLength } from '../trace/draw'
import { canClose, closePolygon, cmToPx, findIntersections, computeScale, IMAGE_MAX_PIXELS, pxToCm, TRACE_DEFAULT_HEIGHT, validateImage } from '../trace/trace'
import { loadPixels } from '../trace/suggest/pixels'
import { runSuggest, type SuggestHandle } from '../trace/suggest/run'
import type { Point2 } from './types'
import { useDocStore } from './useDocStore'
import { useUiStore } from './useUiStore'

export type TraceStep = 'upload' | 'baseline' | 'corners' | 'closed'

export interface TraceImage {
  url: string // objectURL. cancel/replace/commit에서 revoke
  name: string
  width: number // px
  height: number
}

interface TraceState {
  active: boolean
  image: TraceImage | null
  /** 기준선 두 점(이미지 px). 길이 0~2 */
  baseline: Point2[]
  /** cm/px. 적용 전 null -> 모서리 찍기 비활성(AC-04-5) */
  scale: number | null
  /** 모서리(이미지 px) */
  corners: Point2[]
  closed: boolean
  /** 닫기 성공 시 정규화된 room.points(cm). commit 대기 */
  pendingRoom: Point2[] | null
  /** 오류 문구와 교차 선분 쌍. crossings 인덱스는 정규화 순서라 화면 점 순서와 다를 수 있다(화면은 TraceCanvas가 다시 계산). 필드 오류는 baselineError */
  error: { message: string; crossings: [number, number][] } | null
  baselineError: string | null
  /** FR-19 윤곽 제안 계산 상태 */
  suggest: 'idle' | 'running'
  /** 점선(미확정) 제안 점(이미지 px). Undo 비대상·저장 제외. applySuggestion 전에는 corners가 아니다(AC-19-5) */
  candidate: Point2[] | null
  /** 직각 보정(수평·수직 고정). 기본 켜짐. 직전 점이 있을 때 addTracePoint가 적용한다 */
  ortho: boolean
  /** 마지막 포인터 위치(트레이싱 평면 cm). 미리보기·길이 입력의 방향. Undo 비대상 */
  cursor: Point2 | null
  /** 길이 입력 오류 문구 */
  lengthError: string | null
  /** 닫힌 뒤 선택한 점(corners 인덱스). [점 삭제] 대상. Undo 비대상 */
  selected: number | null

  start: () => void
  cancel: () => void
  setOrtho: (on: boolean) => void
  clearLengthError: () => void
  /** 포인터 위치 갱신(null이면 해제). 마지막 위치는 포인터가 캔버스를 벗어나도 남겨 둔다 */
  setCursor: (x: number, z: number) => void
  /** 직전 점에서 길이(cm)만큼 떨어진 곳에 점 추가. 방향은 dir(cm 위치) > cursor > 오른쪽. 직각이면 가까운 축. 실패 시 lengthError + false */
  addTracePointByLength: (len: number, dir?: Point2) => boolean
  /** 닫힌 뒤 벽 wallIndex(corners[i]->corners[i+1]) 위에 점 추가. 닫힌 상태가 유지되고 pendingRoom을 다시 계산. 실패 시 error + false */
  insertTracePoint: (wallIndex: number, x: number, z: number) => boolean
  /** 닫힌 뒤 점 삭제(3점 미만 불가). 실패 시 error + false */
  deleteTracePoint: (i: number) => boolean
  selectTracePoint: (i: number | null) => void
  /** File 검증 후 objectURL 생성·크기 읽기. 실패면 토스트 + false, 상태 유지(AC-04-1) */
  loadImageFile: (file: File) => Promise<boolean>
  /** 검증·디코딩이 끝난 이미지 등록(테스트·loadImageFile 공용). 이전 URL은 revoke */
  setImage: (img: TraceImage) => void
  /** 기준선 점 i(0|1)를 트레이싱 평면 좌표 (x, z)cm로 찍는다 */
  setBaselinePoint: (i: 0 | 1, x: number, z: number) => void
  /** 실제 길이(cm)로 축척 확정(AC-04-2). 잘못된 값이면 baselineError + false */
  applyScale: (realCm: number) => boolean
  /** 모서리 추가. 축척 전/닫힌 뒤면 false(AC-04-5) */
  addTracePoint: (x: number, z: number) => boolean
  moveTracePoint: (i: number, x: number, z: number) => void
  /** 마지막 점 제거 */
  undoTracePoint: () => void
  /** 닫힌 다각형을 점 삭제 없이 다시 연다 */
  reopenTrace: () => void
  /** 축척 적용 뒤 기준선 단계로 복귀. 모서리는 px로 저장돼 있어 유지되고 새 축척으로 다시 계산된다 */
  redoBaseline: () => void
  /** [윤곽 자동 제안]. 동시에 1개만(AC-19-9). 실패·타임아웃이면 토스트 + 상태 유지(AC-19-7,8) */
  requestSuggest: () => Promise<void>
  /** [취소] 또는 이미지 교체: 계산을 중단하고 결과를 버린다 */
  cancelSuggest: () => void
  /** [적용]: 축척이 설정돼 있을 때만 점선 후보를 모서리로 승격(AC-19-5). 기존 모서리는 대체 */
  applySuggestion: () => boolean
  /** 첫 점 클릭 또는 [닫기]. 실패 시 error 설정 + false(AC-04-3/4) */
  closeTrace: () => boolean
  /** 닫힌 다각형으로 방 교체(Undo 1단계, AC-03-4). 성공하면 트레이싱 종료 */
  commitTrace: (height?: number, keepItems?: boolean) => boolean
}

const initial = {
  active: false,
  image: null,
  baseline: [] as Point2[],
  scale: null,
  corners: [] as Point2[],
  closed: false,
  pendingRoom: null,
  error: null,
  baselineError: null,
  suggest: 'idle' as const,
  candidate: null,
  ortho: true,
  cursor: null as Point2 | null,
  lengthError: null as string | null,
  selected: null as number | null,
}

/** 빈 캔버스 시작 상태: 축척 1(cm=cm)로 확정 */
const blankState = { ...initial, active: true, scale: 1 }

const revoke = (img: TraceImage | null) => {
  if (img) URL.revokeObjectURL(img.url)
}

/** 표시 축척: 축척 확정 전에는 1cm/px. */
export const displayScale = (s: Pick<TraceState, 'scale'>) => s.scale ?? 1

export function traceStep(s: Pick<TraceState, 'image' | 'scale' | 'closed'>): TraceStep {
  if (s.closed) return 'closed'
  if (s.scale !== null) return 'corners'
  return s.image ? 'baseline' : 'upload'
}

/** 빈 캔버스(이미지 없이 그리는 중)인가 */
export const selectIsBlank = (s: Pick<TraceState, 'image' | 'scale'>) => s.image === null && s.scale !== null

const EPS = 1e-6
export const clampBlank = (v: number) => Math.min(Math.max(v, 0), BLANK_EXTENT)

const decode = (url: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve({ width: el.naturalWidth, height: el.naturalHeight })
    el.onerror = () => reject(new Error('decode'))
    el.src = url
  })

/** loadImageFile 요청 번호. start/cancel/새 요청마다 올려 오래된 응답을 버린다. */
let loadSeq = 0

/** 제안 요청 번호·진행 중 핸들. 취소·이미지 교체·종료 시 올려서 늦게 온 결과를 버린다. */
let suggestSeq = 0
let suggestHandle: SuggestHandle | null = null
const abortSuggest = () => {
  suggestSeq++
  suggestHandle?.cancel()
  suggestHandle = null
}

/** 테스트에서 교체할 수 있는 의존성(픽셀 읽기·실행기) */
export const suggestDeps = { loadPixels, runSuggest }

export const SUGGEST_FAIL_NOTICE = '⚠ 윤곽을 읽지 못했습니다. 직접 찍어 보세요'

export const useTraceStore = create<TraceState>()((set, get) => ({
  ...initial,
  start: () => {
    loadSeq++
    abortSuggest()
    revoke(get().image)
    set({ ...blankState })
  },
  cancel: () => {
    loadSeq++
    abortSuggest()
    revoke(get().image)
    set({ ...initial })
  },
  loadImageFile: async (file) => {
    const err = validateImage(file)
    if (err) {
      useUiStore.getState().setNotice(`⚠ ${err}`)
      return false
    }
    const seq = ++loadSeq
    const url = URL.createObjectURL(file)
    try {
      const { width, height } = await decode(url)
      if (seq !== loadSeq || !get().active) {
        URL.revokeObjectURL(url) // 취소됐거나 더 새 요청이 있다
        return false
      }
      if (!(width > 0 && height > 0)) throw new Error('size')
      if (width * height > IMAGE_MAX_PIXELS) {
        URL.revokeObjectURL(url)
        useUiStore.getState().setNotice(`⚠ 이미지가 너무 큽니다(${IMAGE_MAX_PIXELS / 1_000_000}백만 픽셀 이하)`)
        return false
      }
      get().setImage({ url, name: file.name, width, height })
      return true
    } catch {
      URL.revokeObjectURL(url)
      if (seq !== loadSeq) return false
      useUiStore.getState().setNotice('⚠ 이미지를 읽지 못했습니다')
      return false
    }
  },
  setImage: (img) => {
    abortSuggest()
    const prev = get().image
    if (prev && prev.url !== img.url) revoke(prev)
    // 새 이미지는 축척·점이 무의미하므로 처음부터 다시 시작한다.
    set({ ...initial, active: true, image: img, ortho: get().ortho })
  },
  setBaselinePoint: (i, x, z) => {
    const s = get()
    if (!s.image || !Number.isFinite(x) || !Number.isFinite(z)) return
    const px = cmToPx([x, z], displayScale(s))
    const base = i === 0 ? [px, ...s.baseline.slice(1)] : [s.baseline[0] ?? px, px]
    // 기준선을 다시 찍으면 축척을 무효화한다(점 위치와 축척이 어긋나지 않게).
    set({ baseline: base, scale: null, baselineError: null, closed: false, pendingRoom: null, error: null })
  },
  applyScale: (realCm) => {
    const { baseline } = get()
    if (baseline.length < 2) {
      set({ baselineError: '기준선의 두 점을 먼저 찍으세요' })
      return false
    }
    const r = computeScale(baseline[0], baseline[1], realCm)
    if (!r.ok) {
      set({ baselineError: r.error })
      return false
    }
    set({ scale: r.value, baselineError: null })
    return true
  },
  addTracePoint: (x, z) => {
    const s = get()
    if (s.scale === null || s.closed || !Number.isFinite(x) || !Number.isFinite(z)) return false
    const step = snapStep(useUiStore.getState().snapEnabled)
    const last = s.corners[s.corners.length - 1]
    const prev = last ? pxToCm(last, s.scale) : null
    let p = drawPoint(prev, [x, z], s.ortho, step) // 직각 보정 -> 스냅 순서(trace/draw.ts)
    if (selectIsBlank(s)) p = [clampBlank(p[0]), clampBlank(p[1])]
    if (prev && Math.abs(p[0] - prev[0]) < EPS && Math.abs(p[1] - prev[1]) < EPS) {
      set({ error: { message: '직전 점과 같은 위치입니다. 다른 곳을 눌러 주세요', crossings: [] } }) // 길이 0 선분
      return false
    }
    set({ corners: [...s.corners, cmToPx(p, s.scale)], error: null, lengthError: null })
    return true
  },
  setOrtho: (ortho) => set({ ortho, lengthError: null }),
  clearLengthError: () => set({ lengthError: null }),
  selectTracePoint: (i) => set({ selected: i !== null && get().corners[i] ? i : null }),
  setCursor: (x, z) => {
    if (Number.isFinite(x) && Number.isFinite(z)) set({ cursor: [x, z] })
  },
  addTracePointByLength: (len, dir) => {
    const s = get()
    const fail = (m: string) => (set({ lengthError: m }), false)
    if (s.scale === null || s.closed) return false
    const last = s.corners[s.corners.length - 1]
    if (!last) return fail('먼저 시작점을 클릭하세요')
    const prev = pxToCm(last, s.scale)
    const r = pointFromLength(prev, dir ?? s.cursor ?? [prev[0] + 1, prev[1]], len, s.ortho)
    if (!r.ok) return fail(r.error)
    const p = r.value
    if (selectIsBlank(s) && p.some((v) => v < 0 || v > BLANK_EXTENT)) return fail(`그림 영역(0~${BLANK_EXTENT}cm)을 벗어납니다. 방향을 바꿔 보세요`)
    set({ corners: [...s.corners, cmToPx(p, s.scale)], error: null, lengthError: null })
    return true
  },
  insertTracePoint: (wallIndex, x, z) => {
    const s = get()
    if (!s.closed || s.scale === null) return false
    const r = insertPoint(cornersCm(s), wallIndex, x, z, snapStep(useUiStore.getState().snapEnabled))
    if (!r.ok) return (set({ error: { message: r.error, crossings: [] } }), false)
    return reclose(r.value)
  },
  deleteTracePoint: (i) => {
    const s = get()
    if (!s.closed || s.scale === null) return false
    const r = deletePoint(cornersCm(s), i)
    if (!r.ok) return (set({ error: { message: r.error, crossings: [] } }), false)
    return reclose(r.value)
  },
  moveTracePoint: (i, x, z) => {
    const s = get()
    if (s.scale === null || !s.corners[i] || !Number.isFinite(x) || !Number.isFinite(z)) return
    const step = snapStep(useUiStore.getState().snapEnabled)
    const q: Point2 = selectIsBlank(s) ? [clampBlank(snap(x, step)), clampBlank(snap(z, step))] : [snap(x, step), snap(z, step)]
    set({
      corners: s.corners.map((p, k) => (k === i ? cmToPx(q, s.scale!) : p)),
      closed: false,
      pendingRoom: null,
      error: null,
      selected: null,
    })
  },
  undoTracePoint: () => {
    const s = get()
    set({ corners: s.corners.slice(0, -1), closed: false, pendingRoom: null, error: null, selected: null, lengthError: null })
  },
  reopenTrace: () => set({ closed: false, pendingRoom: null, error: null, selected: null }),
  redoBaseline: () => {
    if (!get().image) return // 빈 캔버스는 기준선이 없다
    set({ baseline: [], scale: null, baselineError: null, closed: false, pendingRoom: null, error: null })
  },
  requestSuggest: async () => {
    const s = get()
    if (!s.image || s.suggest === 'running') return
    const { url, width, height } = s.image
    const seq = ++suggestSeq
    set({ suggest: 'running' })
    const stale = () => seq !== suggestSeq
    let result: Point2[] | null = null
    try {
      const pixels = await suggestDeps.loadPixels(url, width, height)
      if (stale()) return
      suggestHandle = suggestDeps.runSuggest({ pixels, orig: { width, height } })
      const h = suggestHandle
      result = await h.promise
      if (suggestHandle === h) suggestHandle = null
    } catch {
      result = null
    }
    if (stale()) return // 취소·이미지 교체: 결과 폐기(AC-19-9)
    if (result) set({ suggest: 'idle', candidate: result })
    else {
      set({ suggest: 'idle' })
      useUiStore.getState().setNotice(SUGGEST_FAIL_NOTICE)
    }
  },
  cancelSuggest: () => {
    abortSuggest()
    set({ suggest: 'idle' })
  },
  applySuggestion: () => {
    const s = get()
    if (s.scale === null || !s.candidate || s.closed) return false
    // 수동 점과 같은 스냅 규칙(px->cm->snap->px). 스냅 때문에 교차가 생기면 원본 후보를 쓴다.
    const step = snapStep(useUiStore.getState().snapEnabled)
    const sc = s.scale
    const snapped = s.candidate.map((p) => {
      const [x, z] = pxToCm(p, sc)
      return cmToPx([snap(x, step), snap(z, step)], sc)
    })
    const ok = findIntersections(snapped).length === 0
    set({ corners: ok ? snapped : s.candidate, candidate: null, error: null, pendingRoom: null })
    return true
  },
  closeTrace: () => {
    const s = get()
    if (s.scale === null || !canClose(s.corners.length)) return false
    const r = closePolygon(s.corners.map((p) => pxToCm(p, s.scale!)))
    if (!r.ok) {
      set({ error: { message: r.message, crossings: r.crossings } })
      return false
    }
    set({ closed: true, pendingRoom: r.value, error: null })
    return true
  },
  commitTrace: (height = TRACE_DEFAULT_HEIGHT, keepItems = true) => {
    const { pendingRoom } = get()
    if (!pendingRoom) return false
    if (!useDocStore.getState().createPolygonRoom(pendingRoom, height, keepItems)) {
      useUiStore.getState().setNotice('⚠ 방을 만들지 못했습니다. 천장고(180~400)와 크기를 확인하세요')
      return false
    }
    get().cancel()
    return true
  },
}))

/** 점 목록(cm)을 닫힌 상태로 다시 확정한다. 닫기 검증에 실패하면 이전 점으로 되돌리고 false */
function reclose(cm: Point2[]): boolean {
  const s = useTraceStore.getState()
  const prev = { corners: s.corners, pendingRoom: s.pendingRoom }
  useTraceStore.setState({ corners: cm.map((p) => cmToPx(p, s.scale!)), selected: null })
  if (useTraceStore.getState().closeTrace()) return true
  useTraceStore.setState({ ...prev, closed: true, selected: s.selected })
  return false
}

/** 다음 점 미리보기(cm): 직각 보정·스냅 적용 후 위치와 직전 점부터의 길이. 점이 없거나 커서가 없으면 null. 훅 셀렉터로 직접 쓰지 말고 useMemo로 감싼다 */
export function previewPoint(s: Pick<TraceState, 'image' | 'corners' | 'scale' | 'cursor' | 'ortho' | 'closed'>): { point: Point2; length: number } | null {
  if (s.closed || s.scale === null || !s.cursor || s.corners.length === 0) return null
  const prev = pxToCm(s.corners[s.corners.length - 1], s.scale)
  const step = snapStep(useUiStore.getState().snapEnabled)
  let point = drawPoint(prev, s.cursor, s.ortho, step)
  if (selectIsBlank(s)) point = [clampBlank(point[0]), clampBlank(point[1])] // addTracePoint와 같은 가장자리 맞춤
  return { point, length: Math.hypot(point[0] - prev[0], point[1] - prev[1]) }
}

/** 닫기 활성 조건(AC-04-3) */
export const selectCanClose = (s: Pick<TraceState, 'corners' | 'scale' | 'closed'>) =>
  s.scale !== null && !s.closed && canClose(s.corners.length)

/** 모서리를 트레이싱 평면 cm로(렌더링용). 축척 전이면 1cm/px */
export const cornersCm = (s: Pick<TraceState, 'corners' | 'scale'>): Point2[] => s.corners.map((p) => pxToCm(p, displayScale(s)))
export const baselineCm = (s: Pick<TraceState, 'baseline' | 'scale'>): Point2[] => s.baseline.map((p) => pxToCm(p, displayScale(s)))

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteSelected, importDocument, undo } from '../ui/actions'
import { nearestWall, signedArea } from '../scene/geometry'
import { createSample } from '../store/sample'
import { useDocStore } from '../store/useDocStore'
import { useEditStore } from '../store/useEditStore'
import { useTraceStore } from '../store/useTraceStore'
import { useUiStore } from '../store/useUiStore'
import type { Item, Point2 } from '../store/types'
import {
  canClose,
  closePolygon,
  computeScale,
  editError,
  findIntersections,
  IMAGE_MAX_BYTES,
  imageRect,
  movePoint,
  pxToCm,
  relocateFixtures,
  segmentsTouch,
  setWallLength,
  validateImage,
} from './trace'

const rect: Point2[] = [[0, 0], [400, 0], [400, 300], [0, 300]]

describe('validateImage', () => {
  it('PNG/JPG만, 용량 상한', () => {
    expect(validateImage({ type: 'image/png', size: 10 })).toBeNull()
    expect(validateImage({ type: 'image/jpeg', size: 10 })).toBeNull()
    expect(validateImage({ type: 'image/gif', size: 10 })).toMatch(/PNG 또는 JPG/)
    expect(validateImage({ type: 'image/png', size: IMAGE_MAX_BYTES + 1 })).toMatch(/MB/)
    expect(validateImage({ type: 'image/png', size: 0 })).not.toBeNull()
  })
})

describe('computeScale / 좌표 변환', () => {
  it('cm/px와 픽셀->cm(y->z)', () => {
    const r = computeScale([0, 0], [100, 0], 200)
    expect(r).toEqual({ ok: true, value: 2 })
    expect(pxToCm([10, 20], 2)).toEqual([20, 40])
    expect(imageRect(100, 50, 2)).toEqual({ x: 0, z: 0, width: 200, depth: 100 })
  })
  it('0·음수·NaN·같은 점·상한 초과 거부', () => {
    for (const cm of [0, -5, NaN, Infinity, 3001]) expect(computeScale([0, 0], [10, 0], cm).ok).toBe(false)
    expect(computeScale([5, 5], [5, 5], 100).ok).toBe(false)
    expect(computeScale([0, NaN], [5, 5], 100).ok).toBe(false)
  })
})

describe('교차 판정', () => {
  it('끝점 접촉·교차·평행', () => {
    expect(segmentsTouch([0, 0], [10, 10], [0, 10], [10, 0])).toBe(true)
    expect(segmentsTouch([0, 0], [10, 0], [10, 0], [10, 10])).toBe(true)
    expect(segmentsTouch([0, 0], [10, 0], [0, 5], [10, 5])).toBe(false)
  })
  it('볼록·오목(ㄱ자) 다각형은 교차 없음, 인접 접촉 허용', () => {
    expect(findIntersections(rect)).toEqual([])
    const L: Point2[] = [[0, 0], [300, 0], [300, 80], [400, 80], [400, 300], [0, 300]]
    expect(findIntersections(L)).toEqual([])
  })
  it('나비넥타이는 교차 쌍을 돌려준다', () => {
    expect(findIntersections([[0, 0], [100, 100], [100, 0], [0, 100]])).toEqual([[0, 2]])
  })
  it('비인접 선분이 끝점으로 닿으면 교차, 되접힘도 교차', () => {
    // 점 4가 선분 0 위에 닿음
    expect(findIntersections([[0, 0], [100, 0], [100, 100], [50, 100], [50, 0]])).toEqual([[0, 3], [0, 4]])
    expect(findIntersections([[0, 0], [100, 0], [50, 0]])).not.toEqual([])
  })
  it('열린 폴리라인은 닫는 선분을 보지 않는다', () => {
    const open: Point2[] = [[0, 0], [100, 100], [100, 0], [0, 100]]
    expect(findIntersections(open, false)).toEqual([[0, 2]])
    expect(findIntersections([[0, 0], [100, 0], [100, 100]], false)).toEqual([])
  })
})

describe('closePolygon', () => {
  it('3점 미만 거부', () => {
    expect(canClose(2)).toBe(false)
    expect(closePolygon([[0, 0], [10, 0]]).ok).toBe(false)
  })
  it('원점 이동·시계 정규화·반올림', () => {
    const r = closePolygon([[100.4, 200], [100.4, 500], [500, 500], [500, 200]])
    expect(r.ok && Math.min(...r.value.map((p) => p[0]))).toBe(0)
    expect(r.ok && Math.min(...r.value.map((p) => p[1]))).toBe(0)
    expect(r.ok && signedArea(r.value)).toBeGreaterThan(0)
  })
  it('자기 교차는 거부하고 쌍을 돌려준다(AC-04-4)', () => {
    const r = closePolygon([[0, 0], [100, 100], [100, 0], [0, 100]])
    expect(r).toMatchObject({ ok: false, crossings: [[0, 2]] })
  })
  it('방 상한 3000 초과, 점 100개 초과, NaN 거부', () => {
    expect(closePolygon([[0, 0], [3001, 0], [3001, 100]]).ok).toBe(false)
    expect(closePolygon([[0, 0], [3000, 0], [3000, 100]]).ok).toBe(true)
    const many: Point2[] = Array.from({ length: 101 }, (_, i) => [i * 10, (i % 2) * 10])
    expect(closePolygon(many).ok).toBe(false)
    expect(closePolygon([[0, 0], [NaN, 0], [5, 5]]).ok).toBe(false)
  })
  it('겹치는 점·면적 0 거부', () => {
    expect(closePolygon([[0, 0], [100, 0], [100, 0], [0, 100]]).ok).toBe(false)
    expect(closePolygon([[0, 0], [100, 0], [200, 0]]).ok).toBe(false)
  })
})

describe('모서리 편집', () => {
  it('movePoint는 스냅하고 원본을 바꾸지 않는다', () => {
    const r = movePoint(rect, 2, 403, 297, 10)
    expect(r?.[2]).toEqual([400, 300])
    expect(movePoint(rect, 2, 404, 296, 10)?.[2]).toEqual([400, 300])
    expect(movePoint(rect, 9, 0, 0)).toBeNull()
    expect(movePoint(rect, 0, NaN, 0)).toBeNull()
    expect(rect[2]).toEqual([400, 300])
  })
  it('교차·상한 위반을 editError가 잡는다', () => {
    expect(editError(rect)).toBeNull()
    expect(editError(movePoint(rect, 1, 400, 400)!)).toMatch(/교차/)
    expect(editError(movePoint(rect, 1, 3500, 0)!)).toMatch(/3000/)
  })
  it('벽 길이: 끝점이 벽 방향으로 이동(AC-05-2)', () => {
    const r = setWallLength(rect, 0, 250)
    expect(r.ok && r.value[1]).toEqual([250, 0])
    expect(r.ok && r.value[0]).toEqual([0, 0])
    const last = setWallLength(rect, 3, 100) // 벽3: [0,300]->[0,0], 끝점은 점0
    expect(last.ok && last.value[0]).toEqual([0, 200])
  })
  it('벽 길이 입력 거부: 0·음수·NaN·상한·인덱스', () => {
    for (const v of [0, -1, NaN, 5, 3001]) expect(setWallLength(rect, 0, v).ok).toBe(false)
    expect(setWallLength(rect, 9, 100).ok).toBe(false)
    expect(setWallLength([[0, 0], [0, 0], [10, 10]], 0, 100).ok).toBe(false)
  })
})

const door = (x: number, z: number, w = 90): Item => ({
  id: 'd', type: 'FIXTURE', modelType: 'DOOR_SINGLE', position: [x, 0, z], rotation: [0, 0, 0], size: [w, 200, 10],
})

describe('relocateFixtures (AC-05-4)', () => {
  it('벽 위에 맞게 있으면 같은 객체', () => {
    const d = door(200, 0)
    expect(relocateFixtures(rect, [d]).items[0]).toBe(d)
  })
  it('벽이 짧아지면 가까운 벽 안쪽으로 clamp', () => {
    const shrunk = setWallLength(rect, 0, 150)
    const pts = shrunk.ok ? shrunk.value : rect
    const r = relocateFixtures(pts, [door(350, 0)])
    const p = r.items[0].position
    expect(nearestWall(pts, p[0], p[2])?.dist).toBeLessThan(1e-6)
    expect(r.unfit).toEqual([])
  })
  it('들어갈 자리가 없으면 유지하고 unfit', () => {
    const tiny: Point2[] = [[0, 0], [60, 0], [60, 60], [0, 60]]
    const d = door(30, 0, 90)
    const r = relocateFixtures(tiny, [d])
    expect(r.items[0]).toBe(d)
    expect(r.unfit).toEqual(['d'])
  })
  it('가구는 건드리지 않는다', () => {
    const f: Item = { ...door(0, 0), type: 'FURNITURE', modelType: 'BED' }
    expect(relocateFixtures(rect, [f]).items[0]).toBe(f)
  })
})

const past = () => useDocStore.temporal.getState().pastStates.length
beforeEach(() => {
  useTraceStore.getState().cancel()
  useEditStore.setState({ editing: false, selectedCorner: null, selectedWall: null, draggingCorner: null })
  useDocStore.setState({ ...createSample(), pristine: true })
  useDocStore.temporal.getState().clear()
  useUiStore.setState({ notice: null, snapEnabled: true })
})

describe('useTraceStore', () => {
  const setup = () => {
    const t = useTraceStore.getState
    t().start()
    t().setImage({ url: 'blob:x', name: 'a.png', width: 1000, height: 800 })
    return t
  }
  it('축척 전 모서리 찍기 비활성(AC-04-5), 축척 후 cm 변환', () => {
    const t = setup()
    expect(t().addTracePoint(10, 10)).toBe(false)
    t().setBaselinePoint(0, 0, 0)
    t().setBaselinePoint(1, 100, 0)
    expect(t().applyScale(0)).toBe(false)
    expect(t().baselineError).not.toBeNull()
    expect(t().applyScale(200)).toBe(true)
    expect(t().scale).toBe(2)
    expect(t().addTracePoint(100, 50)).toBe(true)
    expect(t().corners[0]).toEqual([50, 25])
  })
  it('닫기: 3점 미만 불가, 교차 오류, 성공 후 commit은 Undo 1단계(AC-03-4)', () => {
    const t = setup()
    t().setBaselinePoint(0, 0, 0)
    t().setBaselinePoint(1, 100, 0)
    t().applyScale(100) // 1 cm/px
    ;[[0, 0], [100, 100], [100, 0], [0, 100]].forEach(([x, z]) => t().addTracePoint(x, z))
    expect(t().closeTrace()).toBe(false)
    expect(t().error?.crossings).toEqual([[0, 2]])
    ;[1, 2, 3].forEach(() => t().undoTracePoint())
    expect(t().closeTrace()).toBe(false) // 1점
    t().addTracePoint(100, 0)
    t().addTracePoint(100, 100)
    expect(t().closeTrace()).toBe(true)
    expect(t().commitTrace(250, false)).toBe(true)
    expect(useDocStore.getState().room.height).toBe(250)
    expect(useDocStore.getState().items).toEqual([])
    expect(past()).toBe(1)
    expect(t().active).toBe(false)
  })
  it('commit은 JSON(room)에만 반영, 이미지 상태는 문서에 없다(AC-04-6)', () => {
    setup()
    expect(Object.keys(useDocStore.getState())).not.toContain('image')
  })
  it('잘못된 천장고면 방을 바꾸지 않고 토스트', () => {
    const t = setup()
    t().setBaselinePoint(0, 0, 0)
    t().setBaselinePoint(1, 100, 0)
    t().applyScale(100)
    ;[[0, 0], [100, 0], [100, 100]].forEach(([x, z]) => t().addTracePoint(x, z))
    t().closeTrace()
    expect(t().commitTrace(50)).toBe(false)
    expect(past()).toBe(0)
    expect(useUiStore.getState().notice).not.toBeNull()
  })
})

describe('useEditStore', () => {
  const e = useEditStore.getState
  it('드래그 1회 = Undo 1단계, 고정 요소 재배치', () => {
    const before = useDocStore.getState().room.points
    expect(e().beginCornerDrag(1)).toBe(true)
    e().moveCorner(1, 350, 0)
    e().moveCorner(1, 300, 0)
    expect(past()).toBe(0)
    e().endCornerDrag()
    expect(useDocStore.getState().room.points[1]).toEqual([300, 0])
    expect(past()).toBe(1)
    useDocStore.temporal.getState().undo()
    expect(useDocStore.getState().room.points).toEqual(before)
  })
  it('교차하면 원위치 + 토스트, 이력 없음(AC-05-3)', () => {
    const before = useDocStore.getState().room.points
    e().beginCornerDrag(1)
    expect(e().moveCorner(1, 400, 400)).toBe(false)
    e().endCornerDrag()
    expect(useDocStore.getState().room.points).toEqual(before)
    expect(past()).toBe(0)
    expect(useUiStore.getState().notice).toMatch(/취소/)
  })
  it('이동 없이 놓으면 이력 없음', () => {
    e().beginCornerDrag(0)
    e().moveCorner(0, 0, 0)
    e().endCornerDrag()
    expect(past()).toBe(0)
  })
  it('벽 길이 입력은 Undo 1단계, 교차면 취소', () => {
    expect(e().setWallLength(0, 250)).toBe(true)
    expect(past()).toBe(1)
    expect(useDocStore.getState().room.points[1][0]).toBe(250)
    expect(e().setWallLength(0, 5)).toBe(false)
    expect(past()).toBe(1)
  })
  it('선택은 방 점 수가 줄면 해제', () => {
    e().selectWall(3)
    useDocStore.getState().createPolygonRoom([[0, 0], [100, 0], [100, 100]], 230)
    expect(e().selectedWall).toBeNull()
  })
  describe('드래그 중 문서 변경 가드', () => {
    it('코너 드래그 중 undo·삭제·불러오기가 막히고 끝나면 풀린다', () => {
      useDocStore.getState().createPolygonRoom([[0, 0], [300, 0], [300, 300], [0, 300]], 230) // Undo 이력 1개
      const doc = useDocStore.getState()
      const sel = doc.items[0]?.id ?? null
      useUiStore.setState({ selectedId: sel })
      expect(e().beginCornerDrag(1)).toBe(true)
      e().moveCorner(1, 250, 0)
      const mid = useDocStore.getState().room
      undo()
      deleteSelected()
      importDocument({ room: { ...mid, points: [[0, 0], [100, 0], [100, 100]] }, items: [] })
      expect(useDocStore.getState().room).toBe(mid)
      expect(useDocStore.getState().items).toBe(doc.items)
      e().endCornerDrag()
      expect(useDocStore.getState().room.points[1]).toEqual([250, 0])
      undo() // 풀렸다
      expect(useDocStore.getState().room.points[1]).toEqual([300, 0])
    })
    it('외부 변경 후 end는 복원·커밋 없이 resume만, points 개수가 달라도 안전', () => {
      e().beginCornerDrag(1)
      e().moveCorner(1, 350, 0)
      useDocStore.getState().createPolygonRoom([[0, 0], [100, 0], [100, 100]], 230) // 가드를 우회한 외부 변경
      const ext = useDocStore.getState().room
      const n = past()
      expect(() => e().endCornerDrag()).not.toThrow()
      expect(useDocStore.getState().room).toBe(ext)
      expect(past()).toBe(n) // 커밋 없음
      expect(useDocStore.temporal.getState().isTracking).toBe(true)
      expect(e().draggingCorner).toBeNull()
    })
    it('외부 변경 후 move는 세션을 끝내고, 인자 i가 다르면 무시', () => {
      e().beginCornerDrag(1)
      expect(e().moveCorner(2, 300, 300)).toBe(false) // i 불일치
      expect(useDocStore.getState().room.points[2]).toEqual([400, 300])
      useDocStore.getState().createPolygonRoom([[0, 0], [100, 0], [100, 100]], 230)
      const ext = useDocStore.getState().room
      expect(e().moveCorner(1, 50, 0)).toBe(false)
      expect(useDocStore.getState().room).toBe(ext)
      expect(e().draggingCorner).toBeNull()
      expect(useDocStore.temporal.getState().isTracking).toBe(true)
    })
  })
})

describe('loadImageFile', () => {
  const pngFile = { type: 'image/png', size: 10, name: 'a.png' } as unknown as File
  let revoked: string[]
  let pending: (() => void)[]
  let dims: { w: number; h: number }
  let n: number
  beforeEach(() => {
    revoked = []
    pending = []
    dims = { w: 100, h: 50 }
    n = 0
    vi.stubGlobal('URL', { createObjectURL: () => `blob:${++n}`, revokeObjectURL: (u: string) => revoked.push(u) })
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 0
        naturalHeight = 0
        onload: () => void = () => {}
        set src(_: string) {
          pending.push(() => {
            this.naturalWidth = dims.w
            this.naturalHeight = dims.h
            this.onload()
          })
        }
      },
    )
  })
  afterEach(() => vi.unstubAllGlobals())
  const t = useTraceStore.getState

  it('디코딩 중 취소하면 URL을 revoke하고 이미지를 등록하지 않는다', async () => {
    t().start()
    const p = t().loadImageFile(pngFile)
    t().cancel()
    pending[0]()
    expect(await p).toBe(false)
    expect(revoked).toEqual(['blob:1'])
    expect(t().image).toBeNull()
  })
  it('오래된 응답은 버리고 최신만 반영한다', async () => {
    t().start()
    const p1 = t().loadImageFile(pngFile)
    const p2 = t().loadImageFile(pngFile)
    pending[1]()
    expect(await p2).toBe(true)
    pending[0]()
    expect(await p1).toBe(false)
    expect(revoked).toEqual(['blob:1'])
    expect(t().image?.url).toBe('blob:2')
  })
  it('3천만 픽셀 초과는 거부 + revoke + 토스트', async () => {
    t().start()
    dims = { w: 6000, h: 5001 }
    const p = t().loadImageFile(pngFile)
    pending[0]()
    expect(await p).toBe(false)
    expect(revoked).toEqual(['blob:1'])
    expect(t().image).toBeNull()
    expect(useUiStore.getState().notice).not.toBeNull()
  })
  it('정상 이미지 등록', async () => {
    t().start()
    const p = t().loadImageFile(pngFile)
    pending[0]()
    expect(await p).toBe(true)
    expect(t().image).toMatchObject({ url: 'blob:1', width: 100, height: 50 })
  })
})

describe('reopenTrace / redoBaseline', () => {
  it('다시 열기는 점을 지우지 않고, 기준선 다시 찍기는 코너를 유지한 채 축척만 푼다', () => {
    const t = useTraceStore.getState
    t().start()
    t().setImage({ url: 'blob:x', name: 'a.png', width: 1000, height: 800 })
    t().setBaselinePoint(0, 0, 0)
    t().setBaselinePoint(1, 100, 0)
    t().applyScale(100)
    ;[[0, 0], [200, 0], [200, 100]].forEach(([x, z]) => t().addTracePoint(x, z))
    expect(t().closeTrace()).toBe(true)
    t().reopenTrace()
    expect(t().closed).toBe(false)
    expect(t().corners).toHaveLength(3)
    t().redoBaseline()
    expect(t().scale).toBeNull()
    expect(t().baseline).toEqual([])
    expect(t().corners).toHaveLength(3)
    t().setBaselinePoint(0, 0, 0)
    t().setBaselinePoint(1, 100, 0)
    t().applyScale(200)
    expect(t().scale).toBe(2)
    expect(t().corners[1]).toEqual([200, 0]) // px 유지
  })
})

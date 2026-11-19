import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Point2 } from './types'
import { SUGGEST_FAIL_NOTICE, suggestDeps, useTraceStore } from './useTraceStore'
import { useUiStore } from './useUiStore'

const IMG = { url: 'blob:x', name: 'a.png', width: 400, height: 300 }
const OUTLINE: Point2[] = [[10, 10], [390, 10], [390, 290], [10, 290]]
const orig = { ...suggestDeps }

type Deferred = { resolve: (r: Point2[] | null) => void; cancel: ReturnType<typeof vi.fn> }
function mockRun(): Deferred[] {
  const calls: Deferred[] = []
  suggestDeps.loadPixels = vi.fn(async () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }))
  suggestDeps.runSuggest = vi.fn(() => {
    let resolve!: (r: Point2[] | null) => void
    const promise = new Promise<Point2[] | null>((r) => (resolve = r))
    const cancel = vi.fn(() => resolve(null))
    calls.push({ resolve, cancel })
    return { promise, cancel }
  })
  return calls
}
const tick = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  useTraceStore.getState().start()
  useTraceStore.getState().setImage(IMG)
  useUiStore.getState().setNotice(null)
})
afterEach(() => {
  Object.assign(suggestDeps, orig)
  useTraceStore.getState().cancel()
  vi.restoreAllMocks()
})

describe('FR-19 윤곽 제안 스토어', () => {
  it('성공: 점선 후보만 생기고 corners·방 생성 불가(AC-19-5)', async () => {
    const calls = mockRun()
    const p = useTraceStore.getState().requestSuggest()
    expect(useTraceStore.getState().suggest).toBe('running')
    await tick()
    calls[0].resolve(OUTLINE)
    await p
    const s = useTraceStore.getState()
    expect(s.suggest).toBe('idle')
    expect(s.candidate).toEqual(OUTLINE)
    expect(s.corners).toEqual([])
    expect(s.closeTrace()).toBe(false)
    expect(s.applySuggestion()).toBe(false) // 축척 전
    expect(useTraceStore.getState().candidate).not.toBeNull()
  })

  it('축척 설정 후 [적용]하면 corners로 승격, 이후 닫기 가능', async () => {
    const calls = mockRun()
    const p = useTraceStore.getState().requestSuggest()
    await tick()
    calls[0].resolve(OUTLINE)
    await p
    const t = useTraceStore.getState()
    t.setBaselinePoint(0, 0, 0)
    t.setBaselinePoint(1, 100, 0)
    expect(t.applyScale(100)).toBe(true)
    expect(useTraceStore.getState().applySuggestion()).toBe(true)
    const s = useTraceStore.getState()
    expect(s.corners).toEqual(OUTLINE)
    expect(s.candidate).toBeNull()
    expect(s.closeTrace()).toBe(true)
  })

  it('적용 시 10cm 스냅, 스냅으로 교차가 생기면 원본 유지', async () => {
    const run = async (cand: Point2[]) => {
      const calls = mockRun()
      const p = useTraceStore.getState().requestSuggest()
      await tick()
      calls[0].resolve(cand)
      await p
      const t = useTraceStore.getState()
      t.setBaselinePoint(0, 0, 0)
      t.setBaselinePoint(1, 100, 0)
      t.applyScale(100)
      useTraceStore.getState().applySuggestion()
      return useTraceStore.getState().corners
    }
    expect(await run([[12, 13], [388, 11], [391, 287], [9, 292]])).toEqual([[10, 10], [390, 10], [390, 290], [10, 290]])
    useTraceStore.getState().start()
    useTraceStore.getState().setImage(IMG)
    // 스냅하면 두 점이 겹쳐 교차/퇴화 -> 원본
    const bow: Point2[] = [[11, 11], [14, 12], [100, 100], [12, 90]]
    const r = await run(bow)
    expect(r).toEqual(bow)
  })

  it('실패(null)면 토스트 + 기존 상태 유지', async () => {
    const calls = mockRun()
    const p = useTraceStore.getState().requestSuggest()
    await tick()
    calls[0].resolve(null)
    await p
    expect(useUiStore.getState().notice).toBe(SUGGEST_FAIL_NOTICE)
    expect(useTraceStore.getState().candidate).toBeNull()
    expect(useTraceStore.getState().image).not.toBeNull()
  })

  it('동시 1개: 실행 중 재요청은 무시(AC-19-9)', async () => {
    const calls = mockRun()
    const p = useTraceStore.getState().requestSuggest()
    await useTraceStore.getState().requestSuggest()
    await tick()
    expect(calls).toHaveLength(1)
    calls[0].resolve(OUTLINE)
    await p
  })

  it('취소하면 worker를 중단하고 결과·토스트 없음', async () => {
    const calls = mockRun()
    const p = useTraceStore.getState().requestSuggest()
    await tick()
    useTraceStore.getState().cancelSuggest()
    await p
    expect(calls[0].cancel).toHaveBeenCalled()
    expect(useTraceStore.getState().suggest).toBe('idle')
    expect(useTraceStore.getState().candidate).toBeNull()
    expect(useUiStore.getState().notice).toBeNull()
  })

  it('이미지 교체 시 이전 결과를 버린다', async () => {
    const calls = mockRun()
    const p = useTraceStore.getState().requestSuggest()
    await tick()
    useTraceStore.getState().setImage({ ...IMG, url: 'blob:y' })
    calls[0].resolve(OUTLINE)
    await p
    expect(useTraceStore.getState().candidate).toBeNull()
    expect(useTraceStore.getState().suggest).toBe('idle')
  })
})

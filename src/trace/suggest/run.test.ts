import { describe, expect, it, vi } from 'vitest'
import { runSuggest, type SuggestJob, type WorkerLike } from './run'

const job: SuggestJob = { pixels: { data: new Uint8ClampedArray(4 * 4 * 4).fill(255), width: 4, height: 4 }, orig: { width: 4, height: 4 } }

const fakeWorker = (): WorkerLike & { terminated: boolean } => ({
  terminated: false,
  onmessage: null,
  onerror: null,
  postMessage() {},
  terminate() {
    this.terminated = true
  },
})

describe('runSuggest', () => {
  it('Worker 없으면 직접 호출(빈 이미지 -> null)', async () => {
    expect(await runSuggest(job, { createWorker: () => null }).promise).toBeNull()
  })

  it('Worker 결과를 돌려주고 terminate', async () => {
    const w = fakeWorker()
    const h = runSuggest(job, { createWorker: () => w })
    w.onmessage?.({ data: [[0, 0], [1, 0], [1, 1]] })
    expect(await h.promise).toEqual([[0, 0], [1, 0], [1, 1]])
    expect(w.terminated).toBe(true)
  })

  it('postMessage 동기 예외면 null로 정리하고 terminate', async () => {
    const w = fakeWorker()
    w.postMessage = () => {
      throw new Error('DataCloneError')
    }
    expect(await runSuggest(job, { createWorker: () => w }).promise).toBeNull()
    expect(w.terminated).toBe(true)
  })

  it('타임아웃이면 terminate하고 null', async () => {
    vi.useFakeTimers()
    const w = fakeWorker()
    const h = runSuggest(job, { createWorker: () => w, timeoutMs: 5000 })
    vi.advanceTimersByTime(5000)
    expect(await h.promise).toBeNull()
    expect(w.terminated).toBe(true)
    vi.useRealTimers()
  })

  it('취소하면 terminate하고 이후 결과는 무시', async () => {
    const w = fakeWorker()
    const h = runSuggest(job, { createWorker: () => w })
    h.cancel()
    w.onmessage?.({ data: [[0, 0], [1, 0], [1, 1]] })
    expect(await h.promise).toBeNull()
    expect(w.terminated).toBe(true)
  })
})

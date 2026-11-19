// 윤곽 제안 실행기(AC-19-8/9): Web Worker에서 계산하고 5초 안에 못 끝나면 terminate. Worker가 없는 환경(테스트)은 직접 호출.
import type { Point2 } from '../../store/types'
import { suggestOutline, type Pixels } from './contour'

export const SUGGEST_TIMEOUT_MS = 5000

export interface SuggestJob {
  pixels: Pixels
  orig: { width: number; height: number }
}

export interface WorkerLike {
  postMessage: (message: unknown, transfer?: Transferable[]) => void
  terminate: () => void
  onmessage: ((e: { data: unknown }) => void) | null
  onerror: ((e: unknown) => void) | null
}

export interface SuggestHandle {
  /** 항상 resolve. 실패·타임아웃·취소는 null */
  promise: Promise<Point2[] | null>
  cancel: () => void
}

const defaultWorker = (): WorkerLike | null =>
  typeof Worker === 'undefined' ? null : (new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) as WorkerLike)

export function runSuggest(
  job: SuggestJob,
  opts: { timeoutMs?: number; createWorker?: () => WorkerLike | null } = {},
): SuggestHandle {
  const timeoutMs = opts.timeoutMs ?? SUGGEST_TIMEOUT_MS
  let finish: (r: Point2[] | null) => void = () => {}
  const promise = new Promise<Point2[] | null>((resolve) => (finish = resolve))
  let worker: WorkerLike | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let done = false
  const end = (r: Point2[] | null) => {
    if (done) return
    done = true
    clearTimeout(timer)
    worker?.terminate()
    finish(r)
  }
  try {
    worker = (opts.createWorker ?? defaultWorker)()
  } catch {
    worker = null // Worker 생성 실패(CSP 등) -> 직접 호출로 대체
  }
  timer = setTimeout(() => end(null), timeoutMs)
  if (worker) {
    worker.onmessage = (e) => end((e.data as Point2[] | null) ?? null)
    worker.onerror = () => end(null)
    // 픽셀 버퍼는 복사하지 않고 넘긴다(이 작업 전용 버퍼).
    try {
      worker.postMessage(job, [job.pixels.data.buffer as ArrayBuffer])
    } catch {
      end(null) // 동기 예외(직렬화·transfer 실패)
    }
  } else {
    // ponytail: 직접 호출은 메인 스레드를 막고 중단할 수 없다. Worker 미지원 브라우저는 사실상 없어 테스트용으로만 쓴다.
    setTimeout(() => {
      if (done) return
      try {
        end(suggestOutline(job.pixels, job.orig))
      } catch {
        end(null)
      }
    }, 0)
  }
  return { promise, cancel: () => end(null) }
}

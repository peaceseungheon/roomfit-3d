// 윤곽 제안 Web Worker. 입력 SuggestJob, 출력 Point2[] | null.
import { suggestOutline } from './contour'
import type { SuggestJob } from './run'

self.addEventListener('message', (e: MessageEvent<SuggestJob>) => {
  let result = null
  try {
    result = suggestOutline(e.data.pixels, e.data.orig)
  } catch {
    // 실패는 null(윤곽 없음)로 알린다
  }
  ;(self as unknown as { postMessage: (m: unknown) => void }).postMessage(result)
})

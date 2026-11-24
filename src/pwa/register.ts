// AC-20-2/4: 프로덕션에서만 등록. 새 SW는 skipWaiting+clientsClaim으로 자동 활성화되며 페이지 reload는 하지 않는다.
export function registerSw() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}))
  }
}

/** AC-20-6: 지원하면 한 번 요청. 거부·오류는 무시. */
export async function requestPersist(storage: Pick<StorageManager, 'persist'> | undefined = navigator.storage) {
  try {
    await storage?.persist?.()
  } catch {
    /* 무시 */
  }
}

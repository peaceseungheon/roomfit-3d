// 광고 로더. 랜딩과 에디터 측면 칸 컴포넌트(ui/SideAd.tsx)만 import할 수 있다(AC-18-2, bundleGuard 테스트).
import { adsConfigured } from './store'

export function adScriptUrl(client: string): string {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`
}

export interface AdSize {
  width: number
  height: number
}

/** 이 시간 안에 data-ad-status가 'filled'가 되지 않으면(광고 차단기 등) 칸을 접는다(AC-18-4). */
export const AD_FILL_TIMEOUT_MS = 8000

/** 단위 요소의 style·data 속성. size가 있으면 고정 크기 단위, 없으면 반응형(auto). */
export function adInsSpec(client: string, slotId: string, size?: AdSize) {
  const data: Record<string, string> = { adClient: client, adSlot: slotId }
  if (!size) Object.assign(data, { adFormat: 'auto', fullWidthResponsive: 'true' })
  return {
    display: size ? 'inline-block' : 'block',
    width: size ? `${size.width}px` : '',
    height: size ? `${size.height}px` : '',
    data,
  }
}

/** 슬롯 요소를 채운다. 로드 실패·미채움이면 onCollapse 호출(AC-18-4). */
export function loadAds(client: string, slotId: string, slot: HTMLElement, onCollapse: () => void, size?: AdSize): () => void {
  if (!adsConfigured(client, slotId)) {
    onCollapse()
    return () => {}
  }
  let live = true
  const collapse = () => live && onCollapse()
  const ins = document.createElement('ins')
  ins.className = 'adsbygoogle'
  const spec = adInsSpec(client, slotId, size)
  ins.style.display = spec.display
  if (size) {
    ins.style.width = spec.width
    ins.style.height = spec.height
  }
  Object.assign(ins.dataset, spec.data)
  slot.replaceChildren(ins)
  const timer = setTimeout(() => ins.dataset.adStatus !== 'filled' && collapse(), AD_FILL_TIMEOUT_MS)
  const observer = new MutationObserver(() => {
    if (ins.dataset.adStatus === 'filled') clearTimeout(timer)
    else if (ins.dataset.adStatus === 'unfilled') collapse()
  })
  observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] })
  const s = document.createElement('script')
  s.async = true
  s.crossOrigin = 'anonymous'
  s.src = adScriptUrl(client)
  s.onerror = collapse
  s.onload = () => {
    if (!live) return
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] }
      ;(w.adsbygoogle ??= []).push({})
    } catch {
      collapse()
    }
  }
  document.head.appendChild(s)
  return () => {
    live = false
    clearTimeout(timer)
    observer.disconnect()
    s.remove()
  }
}

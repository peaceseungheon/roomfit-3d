// 랜딩 전용 광고 로더. 에디터 번들에서 import 금지(AC-18-2).
import { adsConfigured } from './store'

export function adScriptUrl(client: string): string {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`
}

/** 슬롯 요소를 채운다. 로드 실패·미채움이면 onCollapse 호출(AC-18-4). */
export function loadAds(client: string, slotId: string, slot: HTMLElement, onCollapse: () => void): void {
  if (!adsConfigured(client, slotId)) return onCollapse()
  const ins = document.createElement('ins')
  ins.className = 'adsbygoogle'
  ins.style.display = 'block'
  ins.dataset.adClient = client
  ins.dataset.adSlot = slotId
  ins.dataset.adFormat = 'auto'
  ins.dataset.fullWidthResponsive = 'true'
  slot.replaceChildren(ins)
  new MutationObserver(() => ins.dataset.adStatus === 'unfilled' && onCollapse()).observe(ins, {
    attributes: true,
    attributeFilter: ['data-ad-status'],
  })
  const s = document.createElement('script')
  s.async = true
  s.crossOrigin = 'anonymous'
  s.src = adScriptUrl(client)
  s.onerror = onCollapse
  s.onload = () => {
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] }
      ;(w.adsbygoogle ??= []).push({})
    } catch {
      onCollapse()
    }
  }
  document.head.appendChild(s)
}

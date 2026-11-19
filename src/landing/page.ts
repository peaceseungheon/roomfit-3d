// 랜딩·개인정보처리방침 공용 최소 스크립트. 루트 호스팅 가정(절대 경로 /…); 하위 경로 배포 시 vite base 설정 필요. 에디터 번들(three/react)을 import하지 않는다.
import { ADSENSE_CLIENT, ADSENSE_SLOT, CONTACT_EMAIL, EFFECTIVE_DATE } from './config'
import { loadAds } from '../consent/adLoader'
import { adsConfigured, consentAction, readConsent, shouldLoadAds, writeConsent } from '../consent/store'
import { dimRows } from './dimTable'
import { detectWebgl } from '../ui/webgl'
import './landing.css'

const $ = (sel: string) => document.querySelector<HTMLElement>(sel)
const hide = (sel: string, cond: boolean) => {
  if (cond) document.querySelectorAll<HTMLElement>(sel).forEach((e) => (e.hidden = true))
}

const body = document.querySelector<HTMLTableSectionElement>('#dim-rows')
if (body) {
  for (const r of dimRows()) {
    const tr = body.insertRow()
    tr.insertCell().textContent = r.name
    tr.insertCell().textContent = r.dims
  }
}

hide('[data-contact]', !CONTACT_EMAIL)
$('[data-contact-email]')?.replaceChildren(CONTACT_EMAIL)
hide('[data-effective]', !EFFECTIVE_DATE)
$('[data-effective-date]')?.replaceChildren(EFFECTIVE_DATE)
// 광고 슬롯·동의 배너·설정 링크: 설정이 비면 렌더링·로드하지 않음(AC-18-7). 동의(granted) 후에만 광고 로드(AC-18-5).
const adsOn = adsConfigured(ADSENSE_CLIENT, ADSENSE_SLOT)
hide('[data-ad-slot], [data-consent-link], #consent-banner', !adsOn)
const adSlot = $('[data-ad-slot]')
const banner = $('#consent-banner')
if (adsOn && adSlot && banner) {
  // 저장 실패 시에도 이번 방문에는 선택을 적용해야 하므로 메모리 값을 기준으로 한다.
  let current = readConsent()
  const note = $('#consent-note')
  const showBanner = (on: boolean) => {
    banner.hidden = !on
    // 고정 배너가 푸터를 가리지 않도록 높이만큼 하단 여백 확보.
    document.body.style.paddingBottom = on ? `${banner.offsetHeight}px` : ''
  }
  const apply = () => {
    if (!shouldLoadAds(current, ADSENSE_CLIENT, ADSENSE_SLOT)) return
    adSlot.hidden = false // 영역(min-height)이 즉시 예약된다. 실패·미채움이면 다시 접힌다.
    loadAds(ADSENSE_CLIENT, ADSENSE_SLOT, adSlot, () => (adSlot.hidden = true))
  }
  const choose = (v: 'granted' | 'denied') => {
    const action = consentAction(current, v)
    current = v
    const saved = writeConsent(v)
    if (note) note.hidden = saved
    showBanner(false)
    // 이미 로드된 광고 스크립트는 철회 시 페이지를 새로 읽어 제거한다(저장 실패 시 reload하면 되돌아가므로 생략).
    if (action === 'reload' && saved) location.reload()
    else if (action === 'apply') apply()
  }
  $('#consent-grant')!.onclick = () => choose('granted')
  $('#consent-deny')!.onclick = () => choose('denied')
  $('#consent-settings')?.addEventListener('click', (e) => {
    e.preventDefault()
    showBanner(true)
  })
  adSlot.hidden = true
  if (current === 'unset') showBanner(true)
  else apply()
}

const start = document.querySelector<HTMLAnchorElement>('#start')
if (start) {
  const ok = detectWebgl()
  if (!ok) {
    start.setAttribute('aria-disabled', 'true')
    start.removeAttribute('href')
    $('#webgl-error')!.hidden = false
  }
}

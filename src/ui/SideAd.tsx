import { useEffect, useRef, useState } from 'react'
import { loadAds } from '../consent/adLoader'
import { adsConfigured } from '../consent/store'
import { EDITOR_AD_CLIENT, EDITOR_AD_SLOT } from '../landing/config'

const AD_SIZE = { width: 160, height: 600 } // 고정 크기 단위(.side-ad-slot과 같은 값)
const WIDE = '(min-width: 1280px) and (min-height: 760px)' // index.css .side-ad 표시 조건과 같아야 한다(숨은 칸 로드 금지)

// 데스크톱 전용 측면 광고 1칸(AC-18-1). 설정이 비면 아무것도 렌더·로드하지 않는다.
export default function SideAd() {
  return adsConfigured(EDITOR_AD_CLIENT, EDITOR_AD_SLOT) ? <SideAdSlot /> : null
}

function SideAdSlot() {
  const ref = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    // 처음 열 때 좁은 화면이면 스크립트를 불러오지 않고 칸도 접는다(나중에 넓혀도 빈 칸이 남지 않게).
    // 공유·템플릿 해시(#d=·#t=)가 주소창에 남아 있으면 페이지 URL로 광고 요청에 실려 나가므로 싣지 않는다.
    // 평소에는 MenuButton이 마운트 때 해시를 먼저 지운다(effect 순서).
    if (!window.matchMedia(WIDE).matches || !ref.current || /^#[dt]=/.test(location.hash)) {
      setCollapsed(true)
      return
    }
    return loadAds(EDITOR_AD_CLIENT, EDITOR_AD_SLOT, ref.current, () => setCollapsed(true), AD_SIZE)
  }, [])
  if (collapsed) return null
  return (
    <aside className="side-ad" aria-label="광고">
      <span className="side-ad-label">광고</span>
      <div className="side-ad-slot" ref={ref} />
    </aside>
  )
}

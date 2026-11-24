// AC-20-5: 설치 항목 노출 판정. beforeinstallprompt는 모듈 로드 시점에 잡아 둔다(에디터 main.tsx에서 import).
export type InstallMode = 'prompt' | 'ios' | 'hidden'

export interface InstallEnv {
  hasPrompt: boolean
  standalone: boolean
  ios: boolean
}

/** 이미 설치 실행 중이면 숨김, 프롬프트가 있으면 prompt, iOS면 안내 모달, 그 외는 설치 불가로 숨김. */
export function installMode({ hasPrompt, standalone, ios }: InstallEnv): InstallMode {
  if (standalone) return 'hidden'
  if (hasPrompt) return 'prompt'
  return ios ? 'ios' : 'hidden'
}

export function isIos(ua: string, platform: string, touchPoints: number) {
  return /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1) // iPadOS는 Mac으로 위장
}

interface InstallPrompt extends Event {
  prompt(): Promise<void>
}

let deferred: InstallPrompt | null = null

if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // 자동 미니 인포바 대신 메뉴 항목에서만 띄운다
    deferred = e as InstallPrompt
  })
  addEventListener('appinstalled', () => (deferred = null))
}

export function currentInstallMode(): InstallMode {
  return installMode({
    hasPrompt: !!deferred,
    standalone: matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
    ios: isIos(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
  })
}

/** 항목 클릭 때만 호출. 프롬프트는 한 번만 쓸 수 있으므로 보관분을 비운다. */
export async function promptInstall() {
  const p = deferred
  deferred = null
  await p?.prompt()
}

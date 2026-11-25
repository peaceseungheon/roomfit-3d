import { downloadBlob, stampedName } from '../io/download'
import { SHARE_URL_SOFT_MAX, shareUrl } from '../io/shareLink'
import { isDragging } from '../scene/dragSession'
import { selectWarnings } from '../scene/useWarnings'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import { captionLines } from './captureCaption'

const CAPTION_FONT = 'Pretendard, system-ui, sans-serif'

/** 캔버스 아래에 방 치수·경고 요약 띠를 붙인 새 캔버스(AC-15-2). */
function withCaption(src: HTMLCanvasElement): HTMLCanvasElement {
  const { rooms, items } = useDocStore.getState()
  const lines = captionLines(rooms, items, selectWarnings(rooms, items))
  const fs = Math.max(14, Math.round(src.width / 40))
  const pad = Math.round(fs * 0.7)
  const out = document.createElement('canvas')
  out.width = src.width
  out.height = src.height + pad * 2 + Math.round(fs * 1.4) * lines.length
  const ctx = out.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  ctx.fillStyle = '#0f2a4a'
  ctx.fillRect(0, src.height, out.width, out.height - src.height)
  ctx.font = `600 ${fs}px ${CAPTION_FONT}`
  ctx.textBaseline = 'top'
  lines.forEach((l, i) => {
    ctx.fillStyle = l.startsWith('⚠') ? '#ffb4a8' : '#ffffff'
    ctx.fillText(l, pad, src.height + pad + i * Math.round(fs * 1.4), out.width - pad * 2)
  })
  return out
}

/** AC-15-1/2: 현재 3D 캔버스를 PNG로 저장. annotated면 치수·경고 띠를 붙인다. HTML 오버레이는 포함되지 않는다. */
export function capturePng(annotated: boolean) {
  if (isDragging()) return
  const fail = () => useUiStore.getState().setNotice('⚠ 캡처에 실패했습니다. 다시 시도해 주세요.')
  const canvas = document.querySelector<HTMLCanvasElement>('.scene-root canvas')
  if (!canvas) return fail()
  try {
    const target = annotated ? withCaption(canvas) : canvas
    target.toBlob((b) => (b ? downloadBlob(b, stampedName('png')) : fail()), 'image/png')
  } catch {
    fail()
  }
}

/** AC-14-7: 문서를 URL 해시에 담아 클립보드에 복사한다. */
export async function copyShareLink() {
  const { rooms, items } = useDocStore.getState()
  const { setNotice } = useUiStore.getState()
  try {
    const url = await shareUrl({ rooms, items })
    await navigator.clipboard.writeText(url)
    setNotice(url.length > SHARE_URL_SOFT_MAX ? '공유 링크를 복사했습니다. 길어서 일부 메신저에서 잘릴 수 있습니다.' : '공유 링크를 복사했습니다.')
  } catch {
    setNotice('⚠ 공유 링크를 만들지 못했습니다. JSON 내보내기를 이용해 주세요.')
  }
}

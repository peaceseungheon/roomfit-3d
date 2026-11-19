// 브라우저 전용: 이미지 URL을 긴 변 MAX_SIDE 이하로 축소해 RGBA로 읽는다(AC-19-4). 외부로 전송하지 않는다(AC-19-2).
import { MAX_SIDE, type Pixels } from './contour'

export async function loadPixels(url: string, width: number, height: number): Promise<Pixels> {
  const img = new Image()
  img.src = url
  await img.decode()
  const k = Math.min(1, MAX_SIDE / Math.max(width, height))
  const w = Math.max(1, Math.round(width * k))
  const h = Math.max(1, Math.round(height * k))
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas')
  ctx.fillStyle = '#fff' // 투명 PNG는 흰 배경
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h }
}

// 공유 링크(사업성 검토 §5-2). 문서를 deflate+base64url로 URL 해시(#d=…)에 담는다. 해시는 서버로 전송되지 않는다.
// 가이드 페이지의 템플릿 링크(#t=id)도 같은 해시 진입점에서 처리한다.
import type { DocData } from '../store/types'
import { findTemplate } from '../store/templates'
import { IMPORT_MAX_BYTES, processImportText, type ImportOutcome } from './importFile'
import { serializeDocument } from './persist'

/** 이 길이를 넘으면 일부 메신저가 링크를 자를 수 있어 안내한다(경험값). */
export const SHARE_URL_SOFT_MAX = 4000
const HEADLINE = '공유 링크를 읽을 수 없습니다. 현재 작업은 그대로입니다.'

const toB64 = (b: Uint8Array) => btoa(Array.from(b, (c) => String.fromCharCode(c)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, cap: number): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > cap) {
      void reader.cancel()
      throw new Error('too large') // 압축 폭탄 방어: 불러오기 파일과 같은 상한
    }
    chunks.push(value)
  }
  return new Uint8Array(await new Blob(chunks as BlobPart[]).arrayBuffer())
}

export async function encodeShare(doc: DocData): Promise<string> {
  const json = new TextEncoder().encode(serializeDocument(doc, new Date(), undefined))
  return toB64(await pipe(json, new CompressionStream('deflate-raw'), IMPORT_MAX_BYTES))
}

export async function decodeShare(payload: string): Promise<ImportOutcome> {
  try {
    const raw = await pipe(fromB64(payload), new DecompressionStream('deflate-raw'), IMPORT_MAX_BYTES)
    const r = processImportText(new TextDecoder().decode(raw))
    return r.ok ? r : { ok: false, lines: [HEADLINE, ...r.lines.slice(1)] } // 파일용 첫 줄을 링크용으로 교체
  } catch {
    return { ok: false, lines: [HEADLINE, '링크가 손상되었거나 너무 큽니다'] }
  }
}

export async function shareUrl(doc: DocData, base: string = location.origin + location.pathname): Promise<string> {
  return `${base}#d=${await encodeShare(doc)}`
}

/** 해시가 공유(d)·템플릿(t) 진입이면 불러올 문서를, 아니면 null. 알 수 없는 템플릿 id는 무시한다. */
export async function resolveHash(hash: string): Promise<ImportOutcome | null> {
  const m = /^#([dt])=([\w-]+)$/.exec(hash)
  if (!m) return null
  if (m[1] === 'd') return decodeShare(m[2])
  const t = findTemplate(m[2])
  return t ? { ok: true, doc: t.doc() } : null
}


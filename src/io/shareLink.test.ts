import { describe, expect, it } from 'vitest'
import { createSample } from '../store/sample'
import { TEMPLATES } from '../store/templates'
import { decodeShare, encodeShare, resolveHash, shareUrl } from './shareLink'

describe('공유 링크', () => {
  it('인코딩→디코딩이 문서를 보존한다', async () => {
    const doc = createSample()
    const r = await decodeShare(await encodeShare(doc))
    expect(r).toEqual({ ok: true, doc })
  })
  it('URL-safe 문자만 쓴다', async () => {
    expect(await shareUrl(createSample(), 'https://x.test/editor.html')).toMatch(/^https:\/\/x\.test\/editor\.html#d=[\w-]+$/)
  })
  it('손상된 페이로드는 오류로 돌려준다', async () => {
    const r = await decodeShare('AAAA')
    expect(r.ok).toBe(false)
  })
  it('스키마에 맞지 않는 JSON은 검증 오류', async () => {
    const bad = await encodeShare({ rooms: [], items: [] })
    expect((await decodeShare(bad)).ok).toBe(false)
  })
  it('해시 분기: d / t / 무관한 해시 / 모르는 템플릿', async () => {
    const d = await encodeShare(createSample())
    expect((await resolveHash(`#d=${d}`))?.ok).toBe(true)
    expect(await resolveHash(`#t=${TEMPLATES[0].id}`)).toEqual({ ok: true, doc: TEMPLATES[0].doc() })
    expect(await resolveHash('#foo')).toBeNull()
    expect(await resolveHash('#t=nope')).toBeNull()
  })
})

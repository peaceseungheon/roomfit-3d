import { describe, expect, it } from 'vitest'
import { installMode, isIos } from './install'
import { manifest } from './manifest'
import { requestPersist } from './register'

describe('installMode (AC-20-5)', () => {
  const base = { hasPrompt: false, standalone: false, ios: false }
  it('Chromium 프롬프트가 있으면 prompt', () => expect(installMode({ ...base, hasPrompt: true })).toBe('prompt'))
  it('iOS는 안내 모달', () => expect(installMode({ ...base, ios: true })).toBe('ios'))
  it('standalone이면 숨김(프롬프트·iOS여도)', () => {
    expect(installMode({ hasPrompt: true, standalone: true, ios: false })).toBe('hidden')
    expect(installMode({ hasPrompt: false, standalone: true, ios: true })).toBe('hidden')
  })
  it('프롬프트도 iOS도 아니면 숨김', () => expect(installMode(base)).toBe('hidden'))
  it('iOS 판정: iPhone UA와 iPadOS(MacIntel+터치)', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 'iPhone', 5)).toBe(true)
    expect(isIos('Mozilla/5.0 (Macintosh)', 'MacIntel', 5)).toBe(true)
    expect(isIos('Mozilla/5.0 (Macintosh)', 'MacIntel', 0)).toBe(false)
  })
})

describe('requestPersist (AC-20-6)', () => {
  it('지원하면 한 번 호출', async () => {
    let n = 0
    await requestPersist({ persist: async () => (n++, true) })
    expect(n).toBe(1)
  })
  it('미지원·reject·throw를 삼킨다', async () => {
    await expect(requestPersist(undefined)).resolves.toBeUndefined()
    await expect(requestPersist({} as never)).resolves.toBeUndefined()
    await expect(requestPersist({ persist: () => Promise.reject(new Error('x')) })).resolves.toBeUndefined()
    await expect(
      requestPersist({
        persist: () => {
          throw new Error('x')
        },
      }),
    ).resolves.toBeUndefined()
  })
})

describe('manifest (AC-20-1)', () => {
  it('필수 필드', () => {
    expect(manifest).toMatchObject({
      name: 'RoomFit 3D',
      short_name: 'RoomFit',
      start_url: '/editor.html',
      scope: '/',
      display: 'standalone',
      lang: 'ko',
      theme_color: '#0f2a4a',
      background_color: '#eaf0f6',
    })
    const key = manifest.icons.map((i) => `${i.sizes}${'purpose' in i ? ':' + i.purpose : ''}`)
    expect(key).toEqual(['192x192', '512x512', '512x512:maskable'])
  })
})

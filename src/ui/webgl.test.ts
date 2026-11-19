import { describe, expect, it, vi } from 'vitest'
import { detectWebgl } from './webgl'

describe('detectWebgl', () => {
  it('webgl2가 있으면 true, 확인용 컨텍스트를 해제한다', () => {
    const loseContext = vi.fn()
    const gl = { getExtension: () => ({ loseContext }) }
    expect(detectWebgl(() => ({ getContext: (id) => (id === 'webgl2' ? gl : null) }))).toBe(true)
    expect(loseContext).toHaveBeenCalled()
  })
  it('webgl2 없고 webgl만 있어도 true', () => {
    expect(detectWebgl(() => ({ getContext: (id) => (id === 'webgl' ? {} : null) }))).toBe(true)
  })
  it('둘 다 null이면 false', () => {
    expect(detectWebgl(() => ({ getContext: () => null }))).toBe(false)
  })
  it('getContext가 던져도 false', () => {
    expect(detectWebgl(() => ({ getContext: () => { throw new Error('x') } }))).toBe(false)
  })
})

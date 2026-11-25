import { describe, expect, it } from 'vitest'
import { shouldShowStart } from './startFlow'

describe('shouldShowStart', () => {
  it('저장본 없는 첫 진입이면 띄운다', () => expect(shouldShowStart(true, false, '')).toBe(true))
  it('저장본을 복원했으면(pristine=false) 띄우지 않는다', () => expect(shouldShowStart(false, false, '')).toBe(false))
  it('저장본 손상 알림이 있으면 띄우지 않는다', () => expect(shouldShowStart(true, true, '')).toBe(false))
  it('공유·템플릿 링크 진입이면 띄우지 않는다', () => {
    expect(shouldShowStart(true, false, '#d=abc')).toBe(false)
    expect(shouldShowStart(true, false, '#t=studio')).toBe(false)
  })
  it('무관한 해시는 영향 없다', () => expect(shouldShowStart(true, false, '#foo')).toBe(true))
})

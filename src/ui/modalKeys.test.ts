import { describe, expect, it, vi } from 'vitest'
import { modalKeyDown } from './modalKeys'

const ev = (key: string) => ({ key, shiftKey: false, stopPropagation: vi.fn(), preventDefault: vi.fn(), nativeEvent: { stopPropagation: vi.fn() } })

describe('modalKeyDown', () => {
  it('Esc는 모달만 닫고 React 합성 이벤트를 위로 올리지 않는다(바깥 Dialog가 같이 닫히지 않게)', () => {
    const e = ev('Escape')
    const onClose = vi.fn()
    modalKeyDown(e, null, onClose)
    expect(onClose).toHaveBeenCalledOnce()
    expect(e.stopPropagation).toHaveBeenCalled()
    expect(e.nativeEvent.stopPropagation).toHaveBeenCalled()
  })
  it('그 밖의 키도 바깥 핸들러(Tab 순환 등)로 올리지 않는다', () => {
    const e = ev('Tab')
    modalKeyDown(e, null, vi.fn())
    expect(e.stopPropagation).toHaveBeenCalled()
  })
})

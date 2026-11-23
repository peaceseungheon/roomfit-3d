// 에디터 공용 선화 아이콘(24×24, 1.8 스트로크). 장식이므로 aria-hidden — 의미는 항상 버튼의 텍스트·aria-label이 맡는다.
import type { ReactNode } from 'react'

const Icon = ({ children }: { children: ReactNode }) => (
  <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {children}
  </svg>
)

export const UndoIcon = () => (
  <Icon>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </Icon>
)
export const RedoIcon = () => (
  <Icon>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </Icon>
)
export const MenuIcon = () => (
  <Icon>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
)
export const CheckIcon = () => (
  <Icon>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
)
export const WarnIcon = () => (
  <Icon>
    <path d="M12 4 2.8 19.5h18.4z" />
    <path d="M12 10v4.5M12 17.2v.1" />
  </Icon>
)
export const ChevronIcon = ({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }) => (
  <Icon>
    <path d={{ left: 'm14 6-6 6 6 6', right: 'm10 6 6 6-6 6', up: 'm6 14 6-6 6 6', down: 'm6 10 6 6 6-6' }[dir]} />
  </Icon>
)

/** 브랜드 마크: 방 윤곽 + 치수선. 가칭 서비스명에 붙는 임시 마크. */
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="30" rx="4" fill="#f2a900" />
      <path d="M7 9.5h12.5V16H25v6.5H7z" fill="none" stroke="#0f2a4a" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M7 26.5h18M7 24.8v3.4M25 24.8v3.4" stroke="#0f2a4a" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

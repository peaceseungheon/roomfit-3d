/** 상품 사진은 서버·외부 요청 없이 구할 수 없어, 종류 색 직육면체로 "어떤 상품군인지"를 보인다. */
export default function BlockThumb({ color }: { color: string }) {
  return (
    <svg className="affiliate-thumb" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 8 40 16 24 24 8 16Z" fill={color} />
      <path d="M8 16 24 24V41L8 33Z" fill={color} opacity="0.72" />
      <path d="M40 16 24 24V41L40 33Z" fill={color} opacity="0.5" />
      <path d="M24 8 40 16V33L24 41 8 33V16Z M8 16 24 24 40 16 M24 24V41" fill="none" stroke="#0f2a4a" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

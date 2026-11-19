// WebGL 지원 감지(순수). canvas 생성기를 주입받아 테스트 가능. 랜딩과 에디터가 공용으로 쓴다(three/react import 금지).
export const WEBGL_UNSUPPORTED_MESSAGE = '이 브라우저는 3D를 지원하지 않습니다. 최신 Chrome/Edge/Safari/Firefox를 사용하세요.'

type Ctx = { getExtension?: (n: string) => { loseContext?: () => void } | null } | null
type CanvasLike = { getContext: (id: string) => unknown }

export function detectWebgl(create: () => CanvasLike = () => document.createElement('canvas')): boolean {
  try {
    const c = create()
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as Ctx
    gl?.getExtension?.('WEBGL_lose_context')?.loseContext?.() // 확인용 컨텍스트 즉시 해제
    return !!gl
  } catch {
    return false
  }
}

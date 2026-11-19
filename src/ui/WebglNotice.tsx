import { useEffect, useState } from 'react'
import { WEBGL_UNSUPPORTED_MESSAGE } from './webgl'

/** role=alert만 사용(포커스 이동은 이중 낭독이라 제거). WebGL 미지원 안내(PRD 6장). 편집 패널·자동 저장은 그대로 동작하므로 데이터는 유지된다. */
export function WebglUnsupported() {
  return (
    <p className="webgl-notice" role="alert">
      {WEBGL_UNSUPPORTED_MESSAGE}
    </p>
  )
}

const RECOVER_MS = 5000

/** 3D 컨텍스트 소실 오버레이(wireframes 에디터 오류 상태). 자동 복구 대기 후 실패 시 [새로고침]. */
export function ContextLostOverlay({ lost }: { lost: boolean }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!lost) return
    const t = setTimeout(() => setFailed(true), RECOVER_MS)
    return () => {
      clearTimeout(t)
      setFailed(false)
    }
  }, [lost])
  if (!lost) return null
  return (
    <div className="webgl-lost" role="alert">
      <p>화면을 다시 불러오는 중…</p>
      {failed && <button onClick={() => location.reload()}>새로고침</button>}
    </div>
  )
}

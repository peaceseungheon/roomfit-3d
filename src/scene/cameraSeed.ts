import type { Point2 } from '../store/types'
import type { CameraMode } from '../store/useUiStore'

/**
 * 1인칭 시작 위치(eye) 시드. FIRST_PERSON으로 바뀌는 순간에만 eye를 채택한다.
 * 1인칭 중 활성 방이 바뀌어 eye가 달라져도 시드를 유지해 카메라를 옮기지 않는다(바닥 클릭 텔레포트 보존).
 */
export function nextEyeSeed(mode: CameraMode, prevMode: CameraMode, eye: Point2, seed: Point2): Point2 {
  return mode === 'FIRST_PERSON' && mode !== prevMode ? eye : seed
}

import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { MOUSE, TOUCH } from 'three'
import type { CameraMode } from '../store/useUiStore'
import type { Bounds } from './geometry'

/** 1인칭 눈높이(cm), AC-12-2 */
export const EYE_HEIGHT = 160

/**
 * 시점 3종(AC-12-1). mode마다 카메라와 컨트롤을 새로 만든다(key).
 * - 2D: 위에서 내려다보는 직교. 화면 위 = -z(정면 +z가 아래, AC-08-5). 드래그 = 이동.
 * - QUARTER: 대각선 위 원근, 궤도 회전.
 * - FIRST_PERSON: 눈높이 고정. 1cm 앞 target을 도는 방식으로 드래그 = 시선 회전. 위치 이동은 Floor 클릭.
 */
export default function CameraRig({ mode, bounds: b }: { mode: CameraMode; bounds: Bounds }) {
  const size = useThree((s) => s.size)
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minZ + b.maxZ) / 2
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 1)

  if (mode === '2D') {
    return (
      <>
        <OrthographicCamera
          key="cam-2d"
          makeDefault
          position={[cx, 5000, cz]}
          up={[0, 0, -1]}
          zoom={Math.min(size.width, size.height) / (span * 1.2)}
          near={1}
          far={20000}
        />
        <OrbitControls
          key="ctl-2d"
          makeDefault
          target={[cx, 0, cz]}
          enableRotate={false}
          screenSpacePanning
          mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
          touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
        />
      </>
    )
  }
  if (mode === 'FIRST_PERSON') {
    // ponytail: 시작 위치는 외곽 범위 중앙. ㄱ자에서 잘린 쪽 중앙이 방 밖이 될 수 있으면 다각형 내부 점으로 바꾼다.
    return (
      <>
        <PerspectiveCamera key="cam-fp" makeDefault fov={70} near={1} far={20000} position={[cx, EYE_HEIGHT, cz]} />
        <OrbitControls
          key="ctl-fp"
          makeDefault
          target={[cx, EYE_HEIGHT, cz - 1]}
          enableZoom={false}
          enablePan={false}
          rotateSpeed={-0.4}
        />
      </>
    )
  }
  return (
    <>
      <PerspectiveCamera key="cam-q" makeDefault fov={45} near={1} far={20000} position={[cx + span, span * 1.1, cz + span]} />
      <OrbitControls key="ctl-q" makeDefault target={[cx, 0, cz]} maxPolarAngle={Math.PI / 2 - 0.05} />
    </>
  )
}

// 2D 직교 뷰의 평면 입력(누르기·끌기·클릭)과 점·선 표시. 트레이싱(FR-04)과 모서리 편집(FR-05)이 함께 쓴다.
import { useEffect, useMemo, useRef } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import type { Ray } from 'three'
import type { Point2 } from '../store/types'
import { HIT_PX, hitRadiusCm, isDragMove } from './handles'
import { groundPoint } from './interaction'

export interface PlaneHandlers {
  /** 누른 지점(cm)·히트 반경(cm)에 잡을 핸들이 있으면 true. true면 카메라 이동을 끈다 */
  grab: (p: Point2, r: number) => boolean
  /** 잡은 뒤 SLOP_PX를 넘겨 움직일 때마다. first = 첫 호출 */
  drag: (p: Point2, first: boolean) => void
  /** 드래그를 정상 종료 */
  end: () => void
  /** 드래그 취소(pointercancel·창 포커스 상실·언마운트) */
  cancel: () => void
  /** 움직이지 않고 뗐을 때(잡은 경우 포함) */
  click: (p: Point2, r: number) => void
  /** 드래그 중이 아닐 때 포인터가 움직일 때마다(선택). 이벤트 단위 호출이라 프레임마다 부르지 않는다 */
  hover?: (p: Point2) => void
}

type PEvent = ThreeEvent<PointerEvent> & { ray: Ray }
interface Press {
  id: number
  x: number
  y: number
  grabbed: boolean
  dragging: boolean
}

const BIG = 1e6 // cm. 화면 어디를 눌러도 맞는 평면

/**
 * 화면 전체를 덮는 투명 평면. 이 평면보다 아래(먼) 객체로는 누르기 이벤트가 가지 않는다.
 * y는 바닥 위 높이(가구·벽보다 높게). 좌표는 항상 y=0 바닥 레이캐스트로 구한다.
 */
export function CatchPlane({ y, handlers }: { y: number; handlers: PlaneHandlers }) {
  const get = useThree((s) => s.get)
  const h = useRef(handlers)
  useEffect(() => {
    h.current = handlers
  })
  const press = useRef<Press | null>(null)

  const events = useMemo(() => {
    const setControls = (enabled: boolean) => {
      const c = get().controls as unknown as { enabled: boolean } | null
      if (c) c.enabled = enabled
    }
    const radius = () => hitRadiusCm(HIT_PX, get().camera.zoom)
    const moved = (s: Press, e: PointerEvent) => isDragMove(e.clientX - s.x, e.clientY - s.y)
    const finish = (commit: boolean) => {
      const s = press.current
      press.current = null
      if (!s) return
      if (s.grabbed) setControls(true)
      if (s.dragging) (commit ? h.current.end : h.current.cancel)()
    }
    return {
      finish,
      props: {
        onPointerDown: (e: PEvent) => {
          e.stopPropagation()
          if (press.current || (e.pointerType === 'mouse' && e.button !== 0)) return // 두 번째 손가락·보조 버튼은 카메라로
          const p = groundPoint(e.ray)
          if (!p) return
          const grabbed = h.current.grab(p, radius())
          press.current = { id: e.pointerId, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, grabbed, dragging: false }
          if (grabbed) {
            setControls(false)
            ;(e.target as unknown as Element).setPointerCapture(e.pointerId)
          }
        },
        onPointerMove: (e: PEvent) => {
          const s = press.current
          if (!s?.dragging && h.current.hover) {
            const p = groundPoint(e.ray)
            if (p) h.current.hover(p)
          }
          if (!s || !s.grabbed || s.id !== e.pointerId) return
          if (!s.dragging && !moved(s, e.nativeEvent)) return
          const p = groundPoint(e.ray)
          if (!p) return
          e.stopPropagation()
          const first = !s.dragging
          s.dragging = true
          h.current.drag(p, first)
        },
        onPointerUp: (e: PEvent) => {
          const s = press.current
          if (!s || s.id !== e.pointerId) return
          e.stopPropagation()
          const isClick = !s.dragging && !moved(s, e.nativeEvent)
          finish(true)
          const p = groundPoint(e.ray)
          if (isClick && p) h.current.click(p, radius())
        },
        onPointerCancel: () => finish(false),
        onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(), // 아래 바닥(선택 해제)·가구로 클릭이 가지 않게
      },
    }
  }, [get])

  useEffect(() => {
    const abort = () => events.finish(false)
    const up = () => events.finish(true) // 캡처가 풀린 경우의 안전망
    const hidden = () => document.hidden && abort()
    window.addEventListener('blur', abort)
    window.addEventListener('pointerup', up)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('blur', abort)
      window.removeEventListener('pointerup', up)
      document.removeEventListener('visibilitychange', hidden)
      abort()
    }
  }, [events])

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, y, 0]} {...events.props}>
      <planeGeometry args={[BIG, BIG]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}

/** 화면 크기 고정(px) 점. */
export function Dots({ points, y, color, size = 10 }: { points: Point2[]; y: number; color: string; size?: number }) {
  const pos = useMemo(() => new Float32Array(points.flatMap(([x, z]) => [x, y, z])), [points, y])
  if (!points.length) return null
  return (
    <points key={points.length} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={size} sizeAttenuation={false} depthTest={false} />
    </points>
  )
}

/** 꺾은선(closed면 처음으로 돌아옴). */
export function Polyline({ points, y, color, width = 2, closed = false, dash = 0 }: { points: Point2[]; y: number; color: string; width?: number; closed?: boolean; dash?: number }) {
  const pts = useMemo(() => {
    const p = points.map(([x, z]): [number, number, number] => [x, y, z])
    return closed && p.length > 2 ? [...p, p[0]] : p
  }, [points, y, closed])
  if (pts.length < 2) return null
  return <Line points={pts} color={color} lineWidth={width} depthTest={false} raycast={() => null} dashed={dash > 0} dashSize={dash} gapSize={dash} />
}

/** 선분 i(points[i] -> points[i+1])들만 굵게 표시. */
export function Segments({ points, indices, y, color, width = 4 }: { points: Point2[]; indices: number[]; y: number; color: string; width?: number }) {
  const n = points.length
  const pts = useMemo(
    () => indices.flatMap((i): [number, number, number][] => (points[i] && n > 1 ? [[points[i][0], y, points[i][1]], [points[(i + 1) % n][0], y, points[(i + 1) % n][1]]] : [])),
    [points, indices, n, y],
  )
  if (pts.length < 2) return null
  return <Line segments points={pts} color={color} lineWidth={width} depthTest={false} raycast={() => null} />
}

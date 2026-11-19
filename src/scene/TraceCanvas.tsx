// S-04 트레이싱 2D 캔버스(FR-04). 평면 좌표 [x, z] cm, 이미지는 (0,0)부터 imageRect 크기.
// 메인 Scene과 별도 Canvas다: TraceScreen이 화면 전체를 덮는 dialog라 그 안에 캔버스를 두는 것이 가장 단순하다.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { SRGBColorSpace, TextureLoader, type Texture } from 'three'
import { baselineCm, cornersCm, displayScale, traceStep, useTraceStore } from '../store/useTraceStore'
import { findIntersections, imageRect } from '../trace/trace'
import type { Point2 } from '../store/types'
import CameraRig from './CameraRig'
import { hitPoint, traceClickAction } from './handles'
import { CatchPlane, Dots, Polyline, Segments, type PlaneHandlers } from './planeInput'

const LINE_Y = 1
const DOT_Y = 2
const INPUT_Y = 10
const C = { candidate: '#fb8c00', corner: '#1565c0', first: '#ff6f00', line: '#1565c0', bad: '#e53935', baseline: '#2e7d32' }

/** 배경 이미지 평면. 텍스처는 url이 바뀌거나 언마운트되면 해제한다(objectURL 자체는 스토어가 revoke). */
function ImagePlane({ url, width, depth }: { url: string; width: number; depth: number }) {
  const [tex, setTex] = useState<Texture | null>(null)
  useEffect(() => {
    let alive = true
    let loaded: Texture | null = null
    new TextureLoader().load(
      url,
      (t) => {
        t.colorSpace = SRGBColorSpace
        if (alive) setTex((loaded = t))
        else t.dispose()
      },
      undefined,
      () => alive && setTex(null), // 디코딩은 스토어가 이미 확인했다. 여기서 실패하면 배경 없이 점 찍기만 가능
    )
    return () => {
      alive = false
      loaded?.dispose()
      setTex(null)
    }
  }, [url])
  // 평면을 -90° 눕히면 텍스처 위쪽이 -z(작은 z)로 가서 이미지 y -> z와 맞는다.
  return (
    <mesh rotation-x={-Math.PI / 2} position={[width / 2, 0, depth / 2]} raycast={() => null}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial map={tex} color={tex ? '#ffffff' : '#cfd8dc'} toneMapped={false} />
    </mesh>
  )
}

type Grab = { kind: 'baseline' | 'corner'; i: number } | null

function TraceInput() {
  const grab = useRef<Grab>(null)
  const handlers: PlaneHandlers = {
    grab: (p, r) => {
      const s = useTraceStore.getState()
      const step = traceStep(s)
      grab.current = null
      if (step === 'baseline') {
        const i = hitPoint(baselineCm(s), p, r)
        if (i >= 0) grab.current = { kind: 'baseline', i }
      } else if (step === 'corners' || step === 'closed') {
        const i = hitPoint(cornersCm(s), p, r)
        if (i >= 0) grab.current = { kind: 'corner', i }
      }
      return grab.current !== null
    },
    drag: ([x, z]) => {
      const g = grab.current
      const s = useTraceStore.getState()
      if (g?.kind === 'baseline') s.setBaselinePoint(g.i as 0 | 1, x, z)
      else if (g?.kind === 'corner') s.moveTracePoint(g.i, x, z)
    },
    end: () => (grab.current = null),
    cancel: () => (grab.current = null), // ponytail: 트레이싱 점 드래그 취소 시 원위치 복원 없음(Undo 비대상 임시 상태). 필요하면 grab에 시작 좌표 저장
    click: (p, r) => {
      grab.current = null
      const s = useTraceStore.getState()
      const a = traceClickAction(traceStep(s), s.baseline.length, cornersCm(s), p, r)
      if (a.kind === 'baseline') s.setBaselinePoint(a.i, p[0], p[1])
      else if (a.kind === 'add') s.addTracePoint(p[0], p[1])
      else if (a.kind === 'close') s.closeTrace()
    },
  }
  return <CatchPlane y={INPUT_Y} handlers={handlers} />
}

function TraceMarks() {
  const scale = useTraceStore((s) => s.scale)
  const baselinePx = useTraceStore((s) => s.baseline)
  const cornersPx = useTraceStore((s) => s.corners)
  const closed = useTraceStore((s) => s.closed)
  const candidatePx = useTraceStore((s) => s.candidate)
  const dash = useTraceStore((s) => (s.image?.width ?? 1000) * displayScale(s)) / 120
  const hasError = useTraceStore((s) => (s.error?.crossings.length ?? 0) > 0)
  const base = useMemo(() => baselineCm({ baseline: baselinePx, scale }), [baselinePx, scale])
  const pts = useMemo(() => cornersCm({ corners: cornersPx, scale }), [cornersPx, scale])
  // 교차 표시(AC-04-4). error.crossings는 정규화(반전될 수 있는) 순서라 화면 점 순서로 다시 계산한다.
  // 열린 상태에서도 이미 교차한 선분은 미리 붉게 보인다.
  const bad = useMemo(() => {
    const pairs = findIntersections(pts, closed || hasError)
    return [...new Set(pairs.flat())]
  }, [pts, closed, hasError])
  const cand = useMemo(() => (candidatePx ? cornersCm({ corners: candidatePx, scale }) : []), [candidatePx, scale])
  const first: Point2[] = pts.length >= 3 && !closed ? [pts[0]] : []
  return (
    <>
      {/* FR-19 미확정 제안: 점선·속이 빈 느낌의 주황 점. 확정([제안 적용]) 전에는 corners가 아니다 */}
      <Polyline points={cand} y={LINE_Y} color={C.candidate} width={2} closed dash={dash} />
      <Dots points={cand} y={DOT_Y} color={C.candidate} size={8} />
      <Polyline points={base} y={LINE_Y} color={C.baseline} width={3} />
      <Dots points={base} y={DOT_Y} color={C.baseline} />
      <Polyline points={pts} y={LINE_Y} color={C.line} closed={closed || hasError} />
      <Segments points={pts} indices={bad} y={LINE_Y + 0.5} color={C.bad} />
      <Dots points={pts} y={DOT_Y} color={C.corner} />
      <Dots points={first} y={DOT_Y + 0.5} color={C.first} size={16} />
    </>
  )
}

/** TraceScreen의 stage에 넣는 캔버스. 이미지가 없으면 비운다. */
export default function TraceCanvas() {
  const image = useTraceStore((s) => s.image)
  const scale = useTraceStore(displayScale)
  if (!image) return null
  const r = imageRect(image.width, image.height, scale)
  const bounds = { minX: r.x, maxX: r.x + r.width, minZ: r.z, maxZ: r.z + r.depth }
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas>
        <color attach="background" args={['#eceff1']} />
        {/* 2D 고정(회전 불가, 이동·확대 허용). 이미지·축척이 바뀌면 다시 맞춘다(key). */}
        <CameraRig key={`${image.url}:${r.width}:${r.depth}`} mode="2D" bounds={bounds} />
        <ImagePlane url={image.url} width={r.width} depth={r.depth} />
        <TraceMarks />
        <TraceInput />
      </Canvas>
    </div>
  )
}

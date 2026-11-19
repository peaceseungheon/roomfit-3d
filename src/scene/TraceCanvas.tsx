// S-04 트레이싱 2D 캔버스(FR-04). 평면 좌표 [x, z] cm, 이미지는 (0,0)부터 imageRect 크기.
// 메인 Scene과 별도 Canvas다: TraceScreen이 화면 전체를 덮는 dialog라 그 안에 캔버스를 두는 것이 가장 단순하다.
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Grid, Html } from '@react-three/drei'
import { SRGBColorSpace, TextureLoader, type Texture } from 'three'
import { baselineCm, cornersCm, displayScale, previewPoint, selectIsBlank, traceStep, useTraceStore } from '../store/useTraceStore'
import { useUiStore } from '../store/useUiStore'
import { BLANK_EXTENT } from '../trace/draw'
import { findIntersections, imageRect } from '../trace/trace'
import type { Point2 } from '../store/types'
import CameraRig from './CameraRig'
import { gridSteps, hitPoint, traceClickAction } from './handles'
import { CatchPlane, Dots, Polyline, Segments, type PlaneHandlers } from './planeInput'

const LINE_Y = 1
const DOT_Y = 2
const INPUT_Y = 10
const C = { candidate: '#fb8c00', corner: '#1565c0', first: '#ff6f00', line: '#1565c0', bad: '#e53935', baseline: '#2e7d32', preview: '#64b5f6', selected: '#ff6f00' }
const BLANK_RECT: Point2[] = [[0, 0], [BLANK_EXTENT, 0], [BLANK_EXTENT, BLANK_EXTENT], [0, BLANK_EXTENT]]

/** 빈 캔버스 그림 영역(AC-04-7): 흰 바탕 + 격자 + 테두리. 격자 간격은 줌에 따라 바꾼다(gridSteps). */
function BlankArea() {
  const [steps, setSteps] = useState(() => gridSteps(1))
  const cell = useRef(steps.cell)
  // zoom은 OrbitControls가 React 밖에서 바꾸므로 프레임마다 읽되, 단계가 바뀔 때만 setState한다.
  useFrame(({ camera }) => {
    const next = gridSteps(camera.zoom)
    if (next.cell !== cell.current) {
      cell.current = next.cell
      setSteps(next)
    }
  })
  const half = BLANK_EXTENT / 2
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[half, 0, half]} raycast={() => null}>
        <planeGeometry args={[BLANK_EXTENT, BLANK_EXTENT]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      {/* Grid는 메시 중심 기준으로 선을 긋는다. 중심(1500)이 모든 간격의 배수라 선이 0부터 맞는다. */}
      <Grid
        args={[BLANK_EXTENT, BLANK_EXTENT]}
        position={[half, 0.5, half]}
        cellSize={steps.cell}
        sectionSize={steps.section}
        cellColor="#cfd8dc"
        sectionColor="#90a4ae"
        cellThickness={0.6}
        sectionThickness={1}
        fadeDistance={1e6}
        raycast={() => null}
      />
      <Polyline points={BLANK_RECT} y={LINE_Y - 0.5} color="#90a4ae" width={1} closed />
    </>
  )
}

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
      else if (a.kind === 'select') s.selectTracePoint(a.i)
      else if (a.kind === 'insert') s.insertTracePoint(a.wall, p[0], p[1]) // 실패 문구는 스토어 error
    },
    hover: ([x, z]) => useTraceStore.getState().setCursor(x, z),
  }
  return <CatchPlane y={INPUT_Y} handlers={handlers} />
}

/** 그리는 중 미리보기 선(직전 점 -> 보정·스냅 위치)과 길이 라벨(AC-04-10). */
function Preview({ labelRoot }: { labelRoot: RefObject<HTMLDivElement | null> }) {
  const corners = useTraceStore((s) => s.corners)
  const scale = useTraceStore((s) => s.scale)
  const cursor = useTraceStore((s) => s.cursor)
  const ortho = useTraceStore((s) => s.ortho)
  const closed = useTraceStore((s) => s.closed)
  const image = useTraceStore((s) => s.image)
  const snapEnabled = useUiStore((s) => s.snapEnabled) // previewPoint가 내부에서 읽는 스냅 설정. 바뀌면 다시 계산
  const line = useMemo(() => {
    void snapEnabled
    const pv = previewPoint({ image, corners, scale, cursor, ortho, closed }) // 빈 캔버스 가장자리 맞춤은 previewPoint가 한다
    if (!pv || scale === null) return null
    const to: Point2 = pv.point
    const from = cornersCm({ corners: corners.slice(-1), scale })[0]
    const len = Math.hypot(to[0] - from[0], to[1] - from[1])
    return { pts: [from, to] as Point2[], len, mid: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2] as Point2 }
  }, [image, corners, scale, cursor, ortho, closed, snapEnabled])
  if (!line) return null
  return (
    <>
      <Polyline points={line.pts} y={LINE_Y} color={C.preview} width={2} />
      <Dots points={line.pts.slice(1)} y={DOT_Y} color={C.preview} size={8} />
      {line.len > 0 && (
        <Html portal={labelRoot as RefObject<HTMLElement>} position={[line.mid[0], DOT_Y, line.mid[1]]} center style={{ pointerEvents: 'none' }}>
          <span className="scene-label">{Math.round(line.len * 10) / 10}cm</span>
        </Html>
      )}
    </>
  )
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
  const selected = useTraceStore((s) => (s.closed ? s.selected : null))
  const sel: Point2[] = useMemo(() => (selected !== null && pts[selected] ? [pts[selected]] : []), [selected, pts])
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
      <Dots points={sel} y={DOT_Y + 1} color={C.selected} size={18} />
    </>
  )
}

/** TraceScreen의 stage에 넣는 캔버스. 이미지가 없으면 빈 캔버스(BLANK_EXTENT 정사각형 격자, AC-04-7)를 그린다. */
export default function TraceCanvas() {
  const image = useTraceStore((s) => s.image)
  const scale = useTraceStore(displayScale)
  const blank = useTraceStore(selectIsBlank)
  const labelRoot = useRef<HTMLDivElement>(null)
  if (!image && !blank) return null
  const r = image ? imageRect(image.width, image.height, scale) : { x: 0, z: 0, width: BLANK_EXTENT, depth: BLANK_EXTENT }
  const bounds = { minX: r.x, maxX: r.x + r.width, minZ: r.z, maxZ: r.z + r.depth }
  return (
    // isolation: drei Html 라벨의 큰 z-index를 이 캔버스 안에 가둔다(.scene-root와 같은 규칙). 라벨 portal 대상도 이 div.
    <div ref={labelRoot} style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
      <Canvas>
        <color attach="background" args={['#eceff1']} />
        {/* 2D 고정(회전 불가, 이동·확대 허용). 이미지·축척이 바뀌면 다시 맞춘다(key). */}
        <CameraRig key={image ? `${image.url}:${r.width}:${r.depth}` : 'blank'} mode="2D" bounds={bounds} />
        {image ? <ImagePlane url={image.url} width={r.width} depth={r.depth} /> : <BlankArea />}
        <TraceMarks />
        <Preview labelRoot={labelRoot} />
        <TraceInput />
      </Canvas>
    </div>
  )
}

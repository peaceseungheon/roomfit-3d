// S-04 트레이싱 2D 캔버스(FR-04). 평면 좌표 [x, z] cm, 이미지는 (0,0)부터 imageRect 크기.
// 메인 Scene과 별도 Canvas다: TraceScreen이 화면 전체를 덮는 dialog라 그 안에 캔버스를 두는 것이 가장 단순하다.
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Grid, Html } from '@react-three/drei'
import { SRGBColorSpace, TextureLoader, type Texture } from 'three'
import { baselineCm, cornersCm, displayScale, previewPoint, selectIsBlank, traceStep, useTraceStore } from '../store/useTraceStore'
import { blankArea, ghostRooms } from '../store/traceSession'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import { findIntersections, imageRect } from '../trace/trace'
import type { Point2 } from '../store/types'
import CameraRig from './CameraRig'
import type { Bounds } from './geometry'
import { gridSteps, hitPoint } from './handles'
import { CatchPlane, Dots, Polyline, Segments, type PlaneHandlers } from './planeInput'
import { applyTraceClick, cameraKey, gridPlacement, traceBounds } from './traceView'

const LINE_Y = 1
const DOT_Y = 2
const INPUT_Y = 10
const C = { candidate: '#fb8c00', corner: '#0f3057', first: '#f2a900', line: '#0f3057', bad: '#e53935', baseline: '#2e7d32', preview: '#64b5f6', selected: '#f2a900', ghost: '#9fb3c8', snap: '#ec407a' }
const GUIDE_DASH = 15 // 이웃 변 안내선 점선 길이(cm)

/** 빈 캔버스 그림 영역(AC-04-7): 흰 바탕 + 격자 + 테두리. 격자 간격은 줌에 따라 바꾼다(gridSteps). area는 blankArea(고스트). */
function BlankArea({ area }: { area: Bounds }) {
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
  const w = area.maxX - area.minX
  const d = area.maxZ - area.minZ
  const rect = useMemo((): Point2[] => [[area.minX, area.minZ], [area.maxX, area.minZ], [area.maxX, area.maxZ], [area.minX, area.maxZ]], [area])
  const grid = gridPlacement(area)
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[area.minX + w / 2, 0, area.minZ + d / 2]} raycast={() => null}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      {/* Grid는 메시 중심 기준으로 선을 긋는다. gridPlacement가 중심을 영역 min + 500의 배수에 둬 선이 min부터 맞는다. */}
      <Grid
        args={grid.size}
        position={[grid.center[0], 0.5, grid.center[1]]}
        cellSize={steps.cell}
        sectionSize={steps.section}
        cellColor="#c9d6e3"
        sectionColor="#9fb3c8"
        cellThickness={0.6}
        sectionThickness={1}
        fadeDistance={1e6}
        raycast={() => null}
      />
      <Polyline points={rect} y={LINE_Y - 0.5} color="#9fb3c8" width={1} closed />
    </>
  )
}

/** 확정한 방(기존 방)의 옅은 윤곽. 겹쳐서 닫기가 거부된 방(error.overlapWith)은 붉게 굵게. 채움·라벨 없음. */
function Ghosts({ ghosts }: { ghosts: Point2[][] }) {
  const overlap = useTraceStore((s) => s.error?.overlapWith)
  return (
    <>
      {ghosts.map((g, i) => {
        const bad = overlap?.includes(i) ?? false
        return <Polyline key={i} points={g} y={LINE_Y - 0.5} color={bad ? C.bad : C.ghost} width={bad ? 3 : 1} closed />
      })}
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
      <meshBasicMaterial map={tex} color={tex ? '#ffffff' : '#c9d6e3'} toneMapped={false} />
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
    drag: ([x, z], _first, { shift }) => {
      const g = grab.current
      const s = useTraceStore.getState()
      if (g?.kind === 'baseline') s.setBaselinePoint(g.i as 0 | 1, x, z)
      else if (g?.kind === 'corner') s.moveTracePoint(g.i, x, z, shift)
    },
    end: () => (grab.current = null),
    cancel: () => (grab.current = null), // ponytail: 트레이싱 점 드래그 취소 시 원위치 복원 없음(Undo 비대상 임시 상태). 필요하면 grab에 시작 좌표 저장
    click: (p, r, { shift }) => {
      grab.current = null
      applyTraceClick(p, r, shift)
    },
    hover: ([x, z], { shift }) => useTraceStore.getState().setCursor(x, z, shift),
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
  const offset = useTraceStore((s) => s.offset)
  const neighborSnap = useTraceStore((s) => s.neighborSnap)
  const free = useTraceStore((s) => s.free)
  const rooms = useDocStore((s) => s.rooms) // previewPoint가 고스트를 문서에서 읽는다
  const snapEnabled = useUiStore((s) => s.snapEnabled) // previewPoint가 내부에서 읽는 스냅 설정. 바뀌면 다시 계산
  const pv = useMemo(() => {
    void snapEnabled
    void rooms
    return previewPoint({ image, corners, scale, cursor, ortho, closed, offset, neighborSnap, free }) // 빈 캔버스 가장자리 맞춤은 previewPoint가 한다
  }, [image, corners, scale, cursor, ortho, closed, offset, neighborSnap, free, rooms, snapEnabled])
  if (!pv || scale === null) return null
  const to = pv.point
  const hit = pv.hit
  // 첫 점(length null)은 끝점 마커만, 선·길이 라벨은 직전 점이 있을 때만
  const from = pv.length === null ? null : cornersCm({ corners: corners.slice(-1), scale })[0]
  return (
    <>
      {from && <Polyline points={[from, to]} y={LINE_Y} color={C.preview} width={2} />}
      <Dots points={[to]} y={DOT_Y} color={C.preview} size={8} />
      {hit?.kind === 'edge' && <Polyline points={[...hit.edge]} y={LINE_Y} color={C.snap} width={1.5} dash={GUIDE_DASH} />}
      {hit && <Dots points={[hit.point]} y={DOT_Y + 0.5} color={C.snap} size={hit.kind === 'vertex' ? 14 : 10} />}
      {from && pv.length !== null && pv.length > 0 && (
        <Html portal={labelRoot as RefObject<HTMLElement>} position={[(from[0] + to[0]) / 2, DOT_Y, (from[1] + to[1]) / 2]} center style={{ pointerEvents: 'none' }}>
          <span className="scene-label">{Math.round(pv.length * 10) / 10}cm</span>
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
  const offset = useTraceStore((s) => s.offset)
  const mode = useTraceStore((s) => s.mode)
  const rooms = useDocStore((s) => s.rooms)
  const labelRoot = useRef<HTMLDivElement>(null)
  const ghosts = useMemo(() => ghostRooms({ offset }, rooms), [offset, rooms])
  const area = useMemo(() => blankArea(ghosts), [ghosts])
  if (!image && !blank) return null
  const r = image ? imageRect(image.width, image.height, scale) : null
  const bounds = traceBounds(r ? { minX: r.x, maxX: r.x + r.width, minZ: r.z, maxZ: r.z + r.depth } : area, ghosts)
  const key = cameraKey(image && r ? { url: image.url, width: r.width, height: r.depth } : null, mode, offset !== null)
  return (
    // isolation: drei Html 라벨의 큰 z-index를 이 캔버스 안에 가둔다(.scene-root와 같은 규칙). 라벨 portal 대상도 이 div.
    <div ref={labelRoot} style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
      <Canvas>
        <color attach="background" args={['#eaf0f6']} />
        {/* 2D 고정(회전 불가, 이동·확대 허용). 이미지·축척이 바뀌면 다시 맞춘다(key). */}
        <CameraRig key={key} mode="2D" bounds={bounds} eye={[(bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2]} />
        {image && r ? <ImagePlane url={image.url} width={r.width} depth={r.depth} /> : <BlankArea area={area} />}
        <Ghosts ghosts={ghosts} />
        <TraceMarks />
        <Preview labelRoot={labelRoot} />
        <TraceInput />
      </Canvas>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Edges, Grid, Html } from '@react-three/drei'
import { DoubleSide, ExtrudeGeometry, Shape, ShapeGeometry, Vector2, type Vector3 } from 'three'
import { itemLabel } from '../store/catalog'
import { useActiveRoom } from '../store/activeRoom'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import type { Item, Point2, Room } from '../store/types'
import {
  WALL_THICKNESS,
  fixtureKind,
  fixtureTransformIn,
  furnitureMaterialProps,
  furnitureTransform,
  nearestWallIn,
  roomBounds,
  roomsBounds,
  wallBand,
  type Bounds,
} from './geometry'
import CameraRig, { EYE_HEIGHT } from './CameraRig'
import { SNAP_CM } from './interaction'
import { useItemDrag } from './useItemDrag'
import { doorSwing, swingPolygon, warnedIds } from './collision'
import { useWarnings } from './useWarnings'
import { useSceneKeys } from './useSceneKeys'
import { useEditStore } from '../store/useEditStore'
import CornerEditLayer from './CornerEditLayer'
import { ContextLostOverlay } from '../ui/WebglNotice'
import { furnitureDimText, wallDimLabels } from './dimensions'

const DEFAULT_FURNITURE_COLOR = '#9e9e9e'
const SELECTED_COLOR = '#ff6f00'
const WARN_COLOR = '#e53935' // 간섭 하이라이트(AC-11-1)
const SWING_COLOR = '#42a5f5'
const CLICK_SLOP_PX = 3 // 이보다 많이 움직인 클릭은 카메라 드래그로 보고 무시
const stop = (e: ThreeEvent<MouseEvent>) => e.stopPropagation() // 항목 클릭이 바닥(선택 해제)까지 가지 않게
const FIXTURE_COLOR = { DOOR: '#795548', WINDOW: '#81d4fa', OUTLET: '#eeeeee' } as const

// Shape는 XY 평면. rotateX(-90°) 후 (x, -z)가 바닥 (x, z)로, 돌출 깊이가 +y로 간다.
const toShapePts = (pts: Point2[]) => pts.map(([x, z]) => new Vector2(x, -z))

/** 방 하나의 벽 띠. 이웃 방과의 간격에 따라 변별 두께를 쓴다(맞닿으면 최소 띠, 20cm 이상이면 10cm). */
function Walls({ room, rooms }: { room: Room; rooms: Room[] }) {
  const geometry = useMemo(() => {
    const others = rooms.filter((r) => r.id !== room.id).map((r) => r.points)
    const shape = new Shape(toShapePts(wallBand(room.points, others)))
    shape.holes.push(new Shape(toShapePts(room.points)))
    const g = new ExtrudeGeometry(shape, { depth: room.height, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    return g
  }, [room, rooms])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry}>
      {/* ponytail: 쿼터뷰에서 앞쪽 벽이 가구를 가려 반투명 처리. 카메라 쪽 벽만 숨기기는 단계 3 카메라 작업 때 판단 */}
      <meshStandardMaterial color="#f5f5f0" transparent opacity={0.45} depthWrite={false} />
    </mesh>
  )
}

type Controls = { target: Vector3; update: () => void } | null

/** 빈 바닥 클릭: 활성 방 전환 + 선택 해제. 1인칭에서는 그 지점으로 시점 이동(시선 방향 유지, AC-12-2). */
function Floor({ room, active, onActivate }: { room: Room; active: boolean; onActivate: (room: Room) => void }) {
  const get = useThree((s) => s.get)
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > CLICK_SLOP_PX) return
    onActivate(room)
    const ui = useUiStore.getState()
    if (ui.cameraMode !== 'FIRST_PERSON') return
    const { camera, controls } = get()
    const c = controls as unknown as Controls
    if (!c) return
    const look = c.target.clone().sub(camera.position)
    camera.position.set(e.point.x, EYE_HEIGHT, e.point.z)
    c.target.copy(camera.position).add(look)
    c.update()
  }
  const geometry = useMemo(() => {
    const g = new ShapeGeometry(new Shape(toShapePts(room.points)))
    g.rotateX(-Math.PI / 2)
    return g
  }, [room.points])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} onClick={onClick}>
      <meshStandardMaterial color={active ? '#e8ded9' : '#d7ccc8'} />
    </mesh>
  )
}

// labelRoot: drei Html 기본 대상(events.connected)이 마운트 직후 바뀌며 첫 라벨 root가 비워지는 경쟁을 피하려고 고정 DOM을 넘긴다.
function Furniture({ item, labelRoot, warned, showDims }: { item: Item; labelRoot: RefObject<HTMLDivElement | null>; warned: boolean; showDims: boolean }) {
  const { position, rotation } = furnitureTransform(item)
  const [w, h, d] = item.size
  const selected = useUiStore((s) => s.selectedId === item.id)
  const bind = useItemDrag(item.id)
  return (
    <group position={position} rotation={rotation}>
      <mesh {...bind()} onClick={stop}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={warned ? WARN_COLOR : (item.color ?? DEFAULT_FURNITURE_COLOR)} {...furnitureMaterialProps(item)} />
        {selected && <Edges color={SELECTED_COLOR} scale={1.02} />}
      </mesh>
      <Html portal={labelRoot as RefObject<HTMLElement>} position={[0, h / 2 + 10, 0]} center style={{ pointerEvents: 'none' }}>
        {/* 치수는 이름 라벨 둘째 줄에 둬 겹치지 않게 한다(AC-12-4) */}
        <span className="scene-label">
          {itemLabel(item)}
          {showDims && <span className="scene-dim">{furnitureDimText(item)}</span>}
        </span>
      </Html>
    </group>
  )
}

/** 2D 벽 변 길이 라벨(AC-12-4). 변 중점에서 바깥으로 띄운다. 비활성 방은 옅게. */
function WallDims({ room, active, labelRoot }: { room: Room; active: boolean; labelRoot: RefObject<HTMLDivElement | null> }) {
  const labels = useMemo(() => wallDimLabels(room.points), [room.points])
  return labels.map(({ at: [x, z], text }, i) => (
    <Html key={i} portal={labelRoot as RefObject<HTMLElement>} position={[x, room.height, z]} center style={{ pointerEvents: 'none' }}>
      <span className={active ? 'scene-label' : 'scene-label muted'}>{text}</span>
    </Html>
  ))
}

function Fixture({ item, rooms, points, warned }: { item: Item; rooms: Room[]; points: Point2[]; warned: boolean }) {
  const host = nearestWallIn(rooms, item.position[0], item.position[2])
  // 문 부채꼴·드래그 투영은 호스트 방 벽 기준. 소속 방이 없으면 활성 방 기준(기존 동작).
  const hostPoints = host ? host.room.points : points
  const { position, rotationY } = fixtureTransformIn(rooms, item)
  const kind = fixtureKind(item.modelType) ?? 'DOOR'
  const selected = useUiStore((s) => s.selectedId === item.id)
  const bind = useItemDrag(item.id)
  // 벽보다 2cm 두껍게 해 양면에서 보이게 한다.
  return (
    <>
      <mesh position={position} rotation={[0, rotationY, 0]} {...bind()} onClick={stop}>
        <boxGeometry args={[item.size[0], item.size[1], WALL_THICKNESS + 2]} />
        <meshStandardMaterial color={warned ? WARN_COLOR : FIXTURE_COLOR[kind]} />
        {selected && <Edges color={SELECTED_COLOR} scale={1.05} />}
      </mesh>
      {kind === 'DOOR' && <DoorSwingArea item={item} points={hostPoints} warned={warned} />}
    </>
  )
}

/** 문 열림 부채꼴(AC-07-1, 2). 바닥 바로 위 반투명. 실외로 열리면 방 밖에 그려진다. */
function DoorSwingArea({ item, points, warned }: { item: Item; points: Point2[]; warned: boolean }) {
  const geometry = useMemo(() => {
    const s = doorSwing(item, points)
    if (!s) return null
    const g = new ShapeGeometry(new Shape(toShapePts(swingPolygon(s))))
    g.rotateX(-Math.PI / 2)
    return g
  }, [item, points])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null
  return (
    <mesh geometry={geometry} position={[0, 0.3, 0]} raycast={() => null}>
      <meshBasicMaterial color={warned ? WARN_COLOR : SWING_COLOR} transparent opacity={0.3} depthWrite={false} side={DoubleSide} />
    </mesh>
  )
}

export default function Scene() {
  const rooms = useDocStore((s) => s.rooms)
  const active = useActiveRoom()
  const items = useDocStore((s) => s.items)
  const cameraMode = useUiStore((s) => s.cameraMode)
  const warnings = useWarnings()
  const warned = useMemo(() => warnedIds(warnings), [warnings])
  const b = roomsBounds(rooms)
  const ab = roomBounds(active.points)
  const eye: Point2 = [(ab.minX + ab.maxX) / 2, (ab.minZ + ab.maxZ) / 2]
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ)
  const labelRoot = useRef<HTMLDivElement>(null)
  const editing = useEditStore((s) => s.editing)
  const showDims = useUiStore((s) => s.showDimensions) && cameraMode === '2D'
  // 편집 중에는 카메라 맞춤 범위를 고정한다. 방이 바뀔 때마다 다시 맞추면 끄는 점 아래 좌표가 움직여 점이 튄다.
  // (React 권장 "렌더 중 이전 값 비교로 상태 조정" 패턴)
  const [frozen, setFrozen] = useState<Bounds | null>(null)
  const [wasEditing, setWasEditing] = useState(editing)
  if (editing !== wasEditing) {
    setWasEditing(editing)
    setFrozen(editing ? b : null)
  }
  const camBounds = frozen ?? b
  const [lost, setLost] = useState(false)
  useSceneKeys()
  // 모서리 편집은 2D 뷰 전용(AC-05-1). 다른 시점으로 가면 편집 모드를 끈다.
  useEffect(() => {
    if (cameraMode !== '2D') useEditStore.getState().setEditing(false)
  }, [cameraMode])
  // 바닥 클릭: 활성 방 전환 + 선택 해제(편집 선택 정리는 useEditStore 구독이 한다)
  const activate = (room: Room) => {
    const ui = useUiStore.getState()
    ui.setActiveRoomId(room.id)
    ui.select(null)
  }

  return (
    <div ref={labelRoot} className="scene-root">
    <Canvas
      gl={{ preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        const el = gl.domElement
        el.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setLost(true) }) // preventDefault: 브라우저의 복구 허용
        el.addEventListener('webglcontextrestored', () => setLost(false))
      }}
      onPointerMissed={() => useUiStore.getState().select(null)}>
      <color attach="background" args={['#eceff1']} />
      <CameraRig mode={cameraMode} bounds={camBounds} eye={eye} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[b.maxX + span, span * 2, b.maxZ]} intensity={1.5} />
      {rooms.map((r) => (
        <Floor key={`floor-${r.id}`} room={r} active={r.id === active.id} onActivate={activate} />
      ))}
      <Grid
        position={[0, 0.1, 0]}
        cellSize={SNAP_CM}
        sectionSize={SNAP_CM * 10}
        cellColor="#b0bec5"
        sectionColor="#78909c"
        infiniteGrid
        fadeDistance={span * 4}
      />
      {rooms.map((r) => (
        <Walls key={`walls-${r.id}`} room={r} rooms={rooms} />
      ))}
      {showDims && rooms.map((r) => (
        <WallDims key={`dims-${r.id}`} room={r} active={r.id === active.id} labelRoot={labelRoot} />
      ))}
      {editing && cameraMode === '2D' && <CornerEditLayer key={active.id} room={active} />}
      {items.map((it) =>
        it.type === 'FURNITURE' ? (
          <Furniture key={it.id} item={it} labelRoot={labelRoot} warned={warned.has(it.id)} showDims={showDims} />
        ) : (
          <Fixture key={it.id} item={it} rooms={rooms} points={active.points} warned={warned.has(it.id)} />
        ),
      )}
    </Canvas>
    <ContextLostOverlay lost={lost} />
    </div>
  )
}

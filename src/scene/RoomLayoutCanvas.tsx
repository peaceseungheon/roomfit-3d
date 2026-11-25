// S-10 방 배치 2D 캔버스(FR-23). RoomLayoutScreen의 stage에 넣는 별도 Canvas. 방을 누르고 끌면 이동, 빈 곳은 카메라.
import { memo, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, Html } from '@react-three/drei'
import { DoubleSide, Shape, type Vector3 } from 'three'
import type { Point2, Room } from '../store/types'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import { findRoom } from '../store/activeRoom'
import CameraRig from './CameraRig'
import { gridSteps } from './handles'
import { CatchPlane, Polyline, type PlaneHandlers } from './planeInput'
import { commitMove, layoutBounds, normShift, previewMove, roomAt, roomLabelPos, roomSizeText, type MovePreview } from './roomLayout'
import { gridPlacement } from './traceView'

const LINE_Y = 1
const INPUT_Y = 10
const C = { room: '#5b7a99', active: '#0f3057', bad: '#e53935' }

function LayoutGrid({ bounds }: { bounds: ReturnType<typeof layoutBounds> }) {
  const [steps, setSteps] = useState(() => gridSteps(1))
  const cell = useRef(steps.cell)
  useFrame(({ camera }) => {
    const next = gridSteps(camera.zoom)
    if (next.cell !== cell.current) {
      cell.current = next.cell
      setSteps(next)
    }
  })
  const grid = gridPlacement(bounds)
  return (
    <Grid args={grid.size} position={[grid.center[0], 0.5, grid.center[1]]} cellSize={steps.cell} sectionSize={steps.section} cellColor="#c9d6e3" sectionColor="#9fb3c8" cellThickness={0.6} sectionThickness={1} fadeDistance={1e6} raycast={() => null} />
  )
}

type Drag = { id: string; start: Point2; pv: MovePreview | null }

type RoomViewProps = { room: Room; dx: number; dz: number; color: string; bad: boolean; active: boolean; labelRoot: RefObject<HTMLDivElement | null> }

/** 방 하나. room(points 참조)·delta·색이 같으면 다시 만들지 않는다: 끄는 방만 매 포인터 이동마다 도형을 다시 만든다. */
const RoomView = memo(function RoomView({ room, dx, dz, color, bad, active, labelRoot }: RoomViewProps) {
  const pts = useMemo(() => (dx || dz ? room.points.map(([x, z]): Point2 => [x + dx, z + dz]) : room.points), [room.points, dx, dz])
  const shape = useMemo(() => new Shape(pts.map(([x, z]) => ({ x, y: -z }) as never)), [pts]) // 눕힌 평면에서 도형 y는 -z
  const [lx, lz] = useMemo(() => roomLabelPos(pts), [pts])
  const size = useMemo(() => roomSizeText(pts), [pts])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, LINE_Y - 0.6, 0]} raycast={() => null}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={color} transparent opacity={bad ? 0.35 : 0.2} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <Polyline points={pts} y={LINE_Y - 0.5} color={color} width={active ? 5 : 2} closed />
      <Html portal={labelRoot as RefObject<HTMLElement>} position={[lx, LINE_Y, lz]} center style={{ pointerEvents: 'none' }}>
        <div className="layout-label">
          <strong>{room.name}</strong>
          <span>{size}</span>
        </div>
      </Html>
    </group>
  )
})

function Rooms({ drag, labelRoot }: { drag: Drag | null; labelRoot: RefObject<HTMLDivElement | null> }) {
  const rooms = useDocStore((s) => s.rooms)
  const activeId = findRoom(rooms, useUiStore((s) => s.activeRoomId)).id
  return (
    <>
      {rooms.map((r) => {
        const [dx, dz] = drag?.id === r.id && drag.pv ? drag.pv.delta : [0, 0]
        const bad = !!drag?.pv && !drag.pv.ok && (drag.id === r.id || drag.pv.overlapWith.includes(r.id))
        const color = bad ? C.bad : r.id === activeId ? C.active : C.room
        return <RoomView key={r.id} room={r} dx={dx} dz={dz} color={color} bad={bad} active={r.id === activeId} labelRoot={labelRoot} />
      })}
    </>
  )
}

function LayoutInput({ drag, setDrag }: { drag: Drag | null; setDrag: (d: Drag | null) => void }) {
  const camera = useThree((t) => t.camera)
  const controls = useThree((t) => t.controls) as unknown as { target: Vector3; update: () => void } | null
  const ref = useRef(drag) // 핸들러는 항상 최신 드래그를 읽는다(setState 비동기)
  const set = (d: Drag | null) => {
    ref.current = d
    setDrag(d)
  }
  const handlers: PlaneHandlers = {
    grab: (p) => {
      const room = roomAt(useDocStore.getState().rooms, p)
      if (room) set({ id: room.id, start: p, pv: null })
      return !!room
    },
    drag: (p, _first, mods) => {
      const d = ref.current
      if (!d) return
      set({ ...d, pv: previewMove(useDocStore.getState().rooms, d.id, d.start, p, mods.shift, useUiStore.getState().snapEnabled) })
    },
    end: () => {
      const d = ref.current
      set(null)
      if (!d?.pv) return
      const before = useDocStore.getState().rooms
      if (!commitMove(d.id, d.pv)) return
      // 음수 정규화로 문서 전체가 밀렸으면 카메라도 같은 양만 옮겨 사용자가 잡은 시야를 유지한다(줌·이동 리셋 없음)
      const [sx, sz] = normShift(before, useDocStore.getState().rooms, d.id, d.pv.delta)
      if (!sx && !sz) return
      camera.position.x += sx
      camera.position.z += sz
      if (controls) {
        controls.target.x += sx
        controls.target.z += sz
        controls.update()
      }
    },
    cancel: () => set(null),
    click: (p) => {
      set(null)
      const room = roomAt(useDocStore.getState().rooms, p)
      if (room) useUiStore.getState().setActiveRoomId(room.id)
    },
  }
  return <CatchPlane y={INPUT_Y} handlers={handlers} />
}

export default function RoomLayoutCanvas() {
  const rooms = useDocStore((s) => s.rooms)
  const [camBounds] = useState(() => layoutBounds(rooms, 150)) // 시작 때 한 번만(방을 옮길 때마다 카메라가 튀지 않게)
  const bounds = useMemo(() => layoutBounds(rooms, 1500), [rooms])
  const [drag, setDrag] = useState<Drag | null>(null)
  const labelRoot = useRef<HTMLDivElement>(null)
  return (
    <div ref={labelRoot} style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
      <Canvas>
        <color attach="background" args={['#ffffff']} />
        <CameraRig mode="2D" bounds={camBounds} eye={[0, 0]} />
        <LayoutGrid bounds={bounds} />
        <Rooms drag={drag} labelRoot={labelRoot} />
        <LayoutInput drag={drag} setDrag={setDrag} />
      </Canvas>
    </div>
  )
}

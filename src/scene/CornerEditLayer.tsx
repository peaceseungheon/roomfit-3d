// 모서리 편집(FR-05). 편집 모드 + 2D 뷰에서만 마운트된다. 이 층이 누르기를 모두 받으므로 가구·고정 요소는 잡히지 않는다.
import { useEffect, useRef } from 'react'
import { useEditStore } from '../store/useEditStore'
import type { Room } from '../store/types'
import { cornerClickAction, hitPoint } from './handles'
import { CatchPlane, Dots, Polyline, Segments, type PlaneHandlers } from './planeInput'

const C = { wall: '#0f3057', corner: '#0f3057', selected: '#f2a900' }

export default function CornerEditLayer({ room }: { room: Room }) {
  const selectedCorner = useEditStore((s) => s.selectedCorner)
  const selectedWall = useEditStore((s) => s.selectedWall)
  const grab = useRef(-1)
  const ok = useRef(false)
  const points = room.points
  const y = room.height + 2 // 벽 윗면보다 위

  // 언마운트(편집 종료·시점 전환) 중 드래그면 원위치(CatchPlane도 cancel을 부르지만 스토어 쪽을 확실히 정리).
  useEffect(() => () => useEditStore.getState().cancelCornerDrag(), [])

  const handlers: PlaneHandlers = {
    grab: (p, r) => {
      grab.current = hitPoint(points, p, r)
      ok.current = false
      return grab.current >= 0
    },
    drag: ([x, z], first) => {
      const e = useEditStore.getState()
      if (first) ok.current = e.beginCornerDrag(grab.current)
      if (ok.current) e.moveCorner(grab.current, x, z) // 무효 위치는 스토어가 반영하지 않는다
    },
    end: () => ok.current && useEditStore.getState().endCornerDrag(),
    cancel: () => useEditStore.getState().cancelCornerDrag(),
    click: (p, r) => {
      const e = useEditStore.getState()
      const a = cornerClickAction(points, e.selectedWall, p, r)
      if (a.kind === 'corner') e.selectCorner(a.i) // null = 빈 곳: 선택 해제
      else if (a.kind === 'wall') e.selectWall(a.i) // WallEditor가 길이 입력을 연다(AC-05-2)
      else e.insertCorner(a.wall, p[0], p[1]) // 선택한 벽 다시 클릭: 그 자리에 점(AC-05-5). 드래그 중이면 스토어가 거부
    },
  }

  return (
    <>
      <Polyline points={points} y={y} color={C.wall} closed />
      {selectedWall !== null && <Segments points={points} indices={[selectedWall]} y={y + 0.5} color={C.selected} width={5} />}
      <Dots points={points} y={y + 1} color={C.corner} size={12} />
      {selectedCorner !== null && points[selectedCorner] && <Dots points={[points[selectedCorner]]} y={y + 1.5} color={C.selected} size={16} />}
      <CatchPlane y={y + 10} handlers={handlers} />
    </>
  )
}

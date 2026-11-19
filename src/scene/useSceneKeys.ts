import { useEffect } from 'react'
import { useDocStore } from '../store/useDocStore'
import { useTraceStore } from '../store/useTraceStore'
import { useUiStore, type CameraMode } from '../store/useUiStore'
import { isDragging } from './dragSession'
import { moveTarget, nextRotation, snapStep } from './interaction'

// 임시(검증용): 시점 전환 버튼은 단계 4. PRD에 단축키가 없어 1/2/3을 쓴다.
const CAMERA_KEYS: Record<string, CameraMode> = { '1': '2D', '2': 'QUARTER', '3': 'FIRST_PERSON' }

// 방향키는 월드 축 기준(2D 화면 기준과 같다). 위 = -z.
const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

/** R = 선택 가구 90° 회전(AC-08-4), 방향키 = 스냅 단위 이동(AC-10-5). 키 1회 = Undo 1단계. */
export function useSceneKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || isDragging() || useTraceStore.getState().active) return
      const cam = CAMERA_KEYS[e.key]
      if (cam) return useUiStore.getState().setCameraMode(cam)

      const id = useUiStore.getState().selectedId
      const doc = useDocStore.getState()
      const item = doc.items.find((it) => it.id === id)
      if (!item) return
      // 거부(false)면 스토어가 상태를 유지하므로 따로 되돌릴 것이 없다.
      if (e.key === 'r' || e.key === 'R') {
        if (item.type !== 'FURNITURE') return // 고정 요소 방향은 벽에서 유도
        const [rx, ry, rz] = item.rotation
        doc.updateItem(item.id, { rotation: [rx, nextRotation(ry), rz] })
        return
      }
      const dir = ARROWS[e.key]
      if (!dir) return
      e.preventDefault()
      const [x, , z] = item.position
      const step = snapStep(useUiStore.getState().snapEnabled)
      const position = moveTarget(item, x + dir[0] * step, z + dir[1] * step, doc.room.points, step)
      // 벽 끝 등에서 제자리면 빈 Undo 단계를 만들지 않는다.
      if (position.every((v, i) => v === item.position[i])) return
      doc.updateItem(item.id, { position })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

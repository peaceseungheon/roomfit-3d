import { useEffect, useRef } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useGesture } from '@use-gesture/react'
import type { Ray } from 'three'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import type { Point2 } from '../store/types'
import { beginDrag, cancelDrag, endDrag, isDragging, moveDrag } from './dragSession'
import { groundPoint, moveTarget, pressMode, snapStep, type PressMode } from './interaction'

type Controls = { enabled: boolean } | null

/**
 * 마우스(주 버튼)는 누르면 선택하고 그대로 드래그 이동한다. 터치는 이미 선택된 항목만 이동하고,
 * 선택 안 된 항목은 선택만 한다(카메라 조작 유지, AC-10-4). 위치는 y=0 바닥 레이캐스트 + 잡은 지점 오프셋.
 * 드래그 중 OrbitControls를 끄고, 끝나면 Undo 1단계로 커밋(dragSession).
 */
export function useItemDrag(id: string) {
  const get = useThree((s) => s.get)
  const offset = useRef<Point2>([0, 0])
  const active = useRef(false)
  const mode = useRef<PressMode>('ignore')
  /** 이 항목이 누른 뒤 OrbitControls를 꺼 둔 상태. 안전망이 이 경우에만 개입한다. */
  const held = useRef(false)

  const setControls = (enabled: boolean) => {
    held.current = !enabled
    const c = get().controls as Controls
    if (c) c.enabled = enabled
  }

  useEffect(() => {
    const restoreControls = () => {
      if (!held.current) return
      held.current = false
      const c = get().controls as Controls
      if (c) c.enabled = true
    }
    // 종료 이벤트 유실 안전망: 창 밖 해제·포커스 상실·탭 숨김에서 세션을 끝내고 카메라 조작을 되살린다.
    const release = (commit: boolean) => {
      if (active.current && isDragging(id)) {
        if (commit) endDrag()
        else cancelDrag()
      }
      active.current = false
      restoreControls()
    }
    const onUp = () => release(true)
    const onAbort = () => release(false)
    const onVisibility = () => {
      if (document.hidden) onAbort()
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onAbort)
    window.addEventListener('blur', onAbort)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onAbort)
      window.removeEventListener('blur', onAbort)
      document.removeEventListener('visibilitychange', onVisibility)
      // 드래그 중 언마운트(Undo·불러오기로 항목이 사라짐 등)되면 세션을 끝낸다.
      if (active.current && isDragging(id)) cancelDrag()
      restoreControls()
    }
  }, [id, get])

  return useGesture(
    {
      onPointerDown: ({ event }) => {
        const e = event as unknown as ThreeEvent<PointerEvent>
        const ui = useUiStore.getState()
        mode.current = pressMode(e.pointerType, e.button, ui.selectedId === id)
        if (mode.current === 'ignore') return
        e.stopPropagation()
        ui.select(id)
        if (mode.current === 'drag') setControls(false)
      },
      onDrag: ({ event, first, last }) => {
        if (mode.current !== 'drag') return
        const e = event as unknown as ThreeEvent<PointerEvent> & { ray?: Ray }
        e.stopPropagation?.()
        const state = useDocStore.getState()
        const item = state.items.find((it) => it.id === id)
        const p = e.ray ? groundPoint(e.ray) : null
        if (first && item && p) {
          offset.current = [item.position[0] - p[0], item.position[2] - p[1]]
          active.current = beginDrag(id)
        }
        if (active.current && item && p) {
          active.current = moveDrag(moveTarget(item, p[0] + offset.current[0], p[1] + offset.current[1], state.rooms, snapStep(useUiStore.getState().snapEnabled)))
        }
        if (last) {
          if (active.current) {
            if ((e.nativeEvent ?? e).type === 'pointercancel') cancelDrag()
            else endDrag()
          }
          active.current = false
          setControls(true)
        }
      },
      // 움직임 없이 뗀 탭·취소에서도 카메라 조작을 되살린다.
      onPointerUp: () => setControls(true),
      onPointerCancel: () => setControls(true),
    },
    { drag: { pointer: { capture: true } } },
  )
}

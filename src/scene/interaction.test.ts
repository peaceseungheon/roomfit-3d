import { beforeEach, describe, expect, it } from 'vitest'
import { Ray, Vector3 } from 'three'
import { createSample } from '../store/sample'
import { useDocStore } from '../store/useDocStore'
import type { Item, Point2 } from '../store/types'
import { beginDrag, cancelDrag, endDrag, isDragging, moveDrag } from './dragSession'
import { groundPoint, moveTarget, nextRotation, pressMode, projectOntoWall, snap } from './interaction'

const rect: Point2[] = [[0, 0], [400, 0], [400, 300], [0, 300]]
const diag: Point2[] = [[0, 0], [300, 0], [0, 400]] // 빗변 길이 500
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]))

describe('snap / groundPoint', () => {
  it('10cm 반올림, 음수 포함', () => {
    expect([snap(14), snap(15), snap(-14), snap(-16), snap(7, 1)]).toEqual([10, 20, -10, -20, 7])
  })
  it('비스듬한 광선의 y=0 교점', () => {
    const r = new Ray(new Vector3(0, 100, 0), new Vector3(1, -1, 2).normalize())
    close(groundPoint(r)!, [100, 200])
  })
  it('위를 보거나 바닥과 평행하면 null', () => {
    expect(groundPoint(new Ray(new Vector3(0, 100, 0), new Vector3(0, 1, 0)))).toBeNull()
    expect(groundPoint(new Ray(new Vector3(0, 100, 0), new Vector3(1, 0, 0)))).toBeNull()
  })
})

describe('projectOntoWall', () => {
  it('가장 가까운 벽으로 붙고 벽 따라 10cm 스냅', () => {
    expect(projectOntoWall(rect, 123, 20, 90)).toEqual([120, 0])
    expect(projectOntoWall(rect, 390, 157, 90)).toEqual([400, 160])
  })
  it('폭이 벽 구간 밖으로 나가지 않게 clamp(모서리 근처)', () => {
    expect(projectOntoWall(rect, 10, 5, 90)).toEqual([45, 0])
    expect(projectOntoWall(rect, -50, -50, 90)).toEqual([45, 0])
  })
  it('벽이 폭보다 짧으면 벽 중앙', () => {
    expect(projectOntoWall(rect, 380, 150, 500)).toEqual([400, 150])
  })
  it('빗변 벽에서는 벽 위 거리로 스냅해 벽선 위에 남는다', () => {
    const [x, z] = projectOntoWall(diag, 160, 210, 90) // 빗변 위 투영 s=252 → 250
    expect(x / 300 + z / 400).toBeCloseTo(1)
    close([x, z], [150, 200])
  })
})

describe('moveTarget / nextRotation', () => {
  const furn: Item = { id: 'f', type: 'FURNITURE', modelType: 'DESK', position: [0, 0, 0], rotation: [0, 0, 0], size: [120, 73, 60] }
  it('가구는 스냅만, 방 밖도 허용, y=0', () => {
    expect(moveTarget(furn, -33, 512, rect)).toEqual([-30, 0, 510])
  })
  it('고정 요소는 벽 위로', () => {
    expect(moveTarget({ ...furn, type: 'FIXTURE', size: [90, 210, 5] }, 200, 290, rect)).toEqual([200, 0, 300])
  })
  it('90° 단위, 0~359', () => {
    expect([0, 90, 270, 45, -90].map(nextRotation)).toEqual([90, 180, 0, 135, 0])
  })
})

describe('dragSession: 드래그 1회 = Undo 1단계 (AC-13-2)', () => {
  const t = () => useDocStore.temporal.getState()
  const pos = (id = 'item_002') => useDocStore.getState().items.find((i) => i.id === id)!.position

  beforeEach(() => {
    cancelDrag()
    useDocStore.setState({ ...createSample(), pristine: true })
    t().clear()
  })

  it('여러 번 움직여도 이력 1단계, Undo하면 시작 위치', () => {
    expect(beginDrag('item_002')).toBe(true)
    for (let i = 1; i <= 20; i++) expect(moveDrag([320 + i * 10, 0, 60])).toBe(true)
    expect(t().pastStates.length).toBe(0)
    endDrag()
    expect(pos()).toEqual([520, 0, 60])
    expect(t().pastStates.length).toBe(1)
    expect(t().isTracking).toBe(true)
    t().undo()
    expect(pos()).toEqual([320, 0, 60])
    t().redo()
    expect(pos()).toEqual([520, 0, 60])
  })

  it('제자리로 돌아오면 이력 없음, pristine 유지', () => {
    beginDrag('item_002')
    moveDrag([400, 0, 60])
    moveDrag([320, 0, 60])
    endDrag()
    expect(t().pastStates.length).toBe(0)
    expect(useDocStore.getState().pristine).toBe(true)
  })

  it('취소(pointercancel 등)는 시작 상태로 복원하고 이력 없음', () => {
    beginDrag('item_002')
    moveDrag([500, 0, 60])
    cancelDrag()
    expect(pos()).toEqual([320, 0, 60])
    expect(t().pastStates.length).toBe(0)
    expect(t().isTracking).toBe(true)
    expect(useDocStore.getState().pristine).toBe(true)
  })

  it('스토어 거부(false)면 세션 취소·상태 유지', () => {
    beginDrag('item_002')
    moveDrag([400, 0, 60])
    expect(moveDrag([Number.NaN, 0, 0])).toBe(false)
    expect(isDragging()).toBe(false)
    expect(pos()).toEqual([320, 0, 60])
    expect(t().isTracking).toBe(true)
  })

  it('없는 id는 시작하지 않고 pause도 안 건다', () => {
    expect(beginDrag('nope')).toBe(false)
    expect(t().isTracking).toBe(true)
  })

  it('세션 중 새 드래그 시작은 이전 것을 취소', () => {
    beginDrag('item_002')
    moveDrag([400, 0, 60])
    beginDrag('item_003')
    moveDrag([300, 0, 230])
    endDrag()
    expect(pos()).toEqual([320, 0, 60])
    expect(pos('item_003')).toEqual([300, 0, 230])
    expect(t().pastStates.length).toBe(1)
  })

  it('연속 드래그 2회 = 2단계', () => {
    for (const x of [400, 450]) {
      beginDrag('item_002')
      moveDrag([x, 0, 60])
      endDrag()
    }
    expect(t().pastStates.length).toBe(2)
  })

  describe('세션 중 외부 변경은 덮어쓰지 않는다', () => {
    const ids = () => useDocStore.getState().items.map((i) => i.id)

    it.each([['end', endDrag], ['cancel', cancelDrag]] as const)('Undo 후 %s: Undo 결과 유지, 부활 없음', (_, finishFn) => {
      useDocStore.getState().removeItem('item_003')
      expect(t().pastStates.length).toBe(1)
      beginDrag('item_002')
      moveDrag([500, 0, 60])
      t().undo() // item_003 부활, item_002는 드래그 전 위치
      finishFn()
      expect(ids()).toContain('item_003')
      expect(pos()).toEqual([320, 0, 60])
      expect(t().isTracking).toBe(true)
      expect(t().pastStates.length).toBe(0)
    })

    it.each([['end', endDrag], ['cancel', cancelDrag]] as const)('다른 항목 삭제 후 %s: 삭제 유지', (_, finishFn) => {
      beginDrag('item_002')
      moveDrag([500, 0, 60])
      useDocStore.getState().removeItem('item_003')
      finishFn()
      expect(ids()).not.toContain('item_003')
      expect(t().isTracking).toBe(true)
    })

    it('드래그 대상 삭제 후 end: 부활 없음', () => {
      beginDrag('item_002')
      moveDrag([500, 0, 60])
      useDocStore.getState().removeItem('item_002')
      endDrag()
      expect(ids()).not.toContain('item_002')
      expect(t().isTracking).toBe(true)
    })

    it('loadDocument 후 end: 불러온 문서 유지', () => {
      const loaded = { ...createSample(), items: [] }
      beginDrag('item_002')
      moveDrag([500, 0, 60])
      useDocStore.getState().loadDocument(loaded)
      endDrag()
      expect(useDocStore.getState().items).toEqual([])
      expect(t().isTracking).toBe(true)
    })

    it('외부 변경 뒤 moveDrag는 세션을 끝내고 false', () => {
      beginDrag('item_002')
      useDocStore.getState().removeItem('item_003')
      expect(moveDrag([500, 0, 60])).toBe(false)
      expect(isDragging()).toBe(false)
      expect(pos()).toEqual([320, 0, 60])
      expect(ids()).not.toContain('item_003')
    })
  })

  it('세션 없이 end/cancel/move는 무해', () => {
    endDrag()
    cancelDrag()
    expect(moveDrag([0, 0, 0])).toBe(false)
    expect(t().pastStates.length).toBe(0)
    expect(t().isTracking).toBe(true)
  })
})

describe('pressMode (AC-10-4)', () => {
  it('터치: 선택된 항목만 드래그, 아니면 선택만', () => {
    expect(pressMode('touch', 0, true)).toBe('drag')
    expect(pressMode('touch', 0, false)).toBe('select')
  })
  it('마우스·펜: 주 버튼만 드래그, 선택 여부 무관', () => {
    expect(pressMode('mouse', 0, false)).toBe('drag')
    expect(pressMode('mouse', 0, true)).toBe('drag')
    expect(pressMode('pen', 0, false)).toBe('drag')
    expect(pressMode('mouse', 1, true)).toBe('ignore')
    expect(pressMode('mouse', 2, false)).toBe('ignore')
  })
})

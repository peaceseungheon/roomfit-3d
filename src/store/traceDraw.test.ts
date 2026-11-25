import { beforeEach, describe, expect, it } from 'vitest'
import type { Point2 } from './types'
import { createSample } from './sample'
import { cornersCm, previewPoint, selectIsBlank, traceStep, useTraceStore } from './useTraceStore'
import { useDocStore } from './useDocStore'
import { getActiveRoom } from './activeRoom'
import { useEditStore } from './useEditStore'
import { useUiStore } from './useUiStore'

const t = useTraceStore.getState
const draw = (pts: Point2[]) => pts.forEach(([x, z]) => t().addTracePoint(x, z))

beforeEach(() => {
  t().cancel()
  useEditStore.setState({ editing: false, selectedCorner: null, selectedWall: null, draggingCorner: null })
  useDocStore.setState({ ...createSample(), pristine: true })
  useDocStore.temporal.getState().clear()
  useUiStore.setState({ notice: null, snapEnabled: true })
})

describe('빈 캔버스 시작', () => {
  it('start는 이미지 없이 축척 1로 열려 바로 점을 찍을 수 있다', () => {
    t().start()
    expect(selectIsBlank(t())).toBe(true)
    expect(traceStep(t())).toBe('corners')
    expect(t().ortho).toBe(true)
    expect(t().addTracePoint(103, 98)).toBe(true)
    expect(t().corners[0]).toEqual([100, 100]) // 스냅 10cm
  })
  it('직각 보정 켜짐: 두 번째 점부터 직전 점 기준 수평/수직', () => {
    t().start()
    draw([[0, 0], [300, 40], [310, 200]])
    expect(t().corners).toEqual([[0, 0], [300, 0], [300, 200]])
  })
  it('직각 끄면 대각선, 스냅 끄면 1cm', () => {
    t().start()
    t().setOrtho(false)
    useUiStore.setState({ snapEnabled: false })
    draw([[0, 0], [103, 47]])
    expect(t().corners[1]).toEqual([103, 47])
  })
  it('영역 밖은 0~3000으로 맞추고 길이 0 선분은 거부', () => {
    t().start()
    t().addTracePoint(-50, 5000)
    expect(t().corners[0]).toEqual([0, 3000])
    expect(t().addTracePoint(0, 3000)).toBe(false)
  })
  it('마지막 점 되돌리기', () => {
    t().start()
    draw([[0, 0], [100, 0]])
    t().undoTracePoint()
    expect(t().corners).toEqual([[0, 0]])
  })
  it('기준선 다시 찍기는 빈 캔버스에서 축척을 풀지 않는다', () => {
    t().start()
    t().redoBaseline()
    expect(t().scale).toBe(1)
  })
  it('이미지를 올리면 기존대로 기준선 단계(점 초기화, 직각 설정 유지)', () => {
    t().start()
    t().setOrtho(false)
    draw([[0, 0]])
    t().setImage({ url: 'blob:x', name: 'a.png', width: 100, height: 100 })
    expect(traceStep(t())).toBe('baseline')
    expect(t().corners).toEqual([])
    expect(t().ortho).toBe(false)
    expect(t().addTracePoint(10, 10)).toBe(false)
  })
})

describe('길이 입력으로 점 추가', () => {
  it('커서 방향 가장 가까운 축으로 길이만큼', () => {
    t().start()
    draw([[100, 100]])
    t().setCursor(150, 90)
    expect(t().addTracePointByLength(250)).toBe(true)
    expect(cornersCm(t())[1]).toEqual([350, 100])
    t().setCursor(350, 400)
    expect(t().addTracePointByLength(120)).toBe(true)
    expect(cornersCm(t())[2]).toEqual([350, 220])
  })
  it('시작점 없음·범위 밖 길이·그림 영역 밖은 lengthError + false', () => {
    t().start()
    expect(t().addTracePointByLength(100)).toBe(false)
    expect(t().lengthError).not.toBeNull()
    draw([[100, 100]])
    expect(t().addTracePointByLength(5)).toBe(false)
    t().setCursor(0, 100) // 왼쪽
    expect(t().addTracePointByLength(500)).toBe(false)
    expect(t().lengthError).toContain('그림 영역')
    expect(t().corners).toHaveLength(1)
    expect(t().addTracePointByLength(500, [900, 100])).toBe(true)
    expect(t().lengthError).toBeNull()
  })
  it('닫힌 뒤에는 거부', () => {
    t().start()
    draw([[0, 0], [300, 0], [300, 200]])
    t().closeTrace()
    expect(t().addTracePointByLength(100)).toBe(false)
  })
})

describe('previewPoint', () => {
  it('보정·스냅된 위치와 길이', () => {
    t().start()
    draw([[100, 100]])
    t().setCursor(247, 120)
    expect(previewPoint(t())).toEqual({ point: [250, 100], length: 150, hit: null })
  })
  it('점·커서가 없으면 null', () => {
    t().start()
    expect(previewPoint(t())).toBeNull()
  })
})

describe('닫은 뒤 점 삽입/삭제(트레이싱)', () => {
  const closedRect = () => {
    t().start()
    draw([[0, 0], [400, 0], [400, 300], [0, 300]])
    expect(t().closeTrace()).toBe(true)
  }
  it('삽입: 닫힌 채 pendingRoom이 갱신된다', () => {
    closedRect()
    expect(t().insertTracePoint(0, 200, 8)).toBe(true)
    expect(t().closed).toBe(true)
    expect(t().corners).toHaveLength(5)
    expect(cornersCm(t())[1]).toEqual([200, 0])
    expect(t().pendingRoom).toHaveLength(5)
  })
  it('삭제: 3점 미만 거부, 정상은 갱신', () => {
    closedRect()
    expect(t().deleteTracePoint(2)).toBe(true)
    expect(t().pendingRoom).toHaveLength(3)
    expect(t().deleteTracePoint(0)).toBe(false)
    expect(t().error?.message).toContain('3개')
    expect(t().corners).toHaveLength(3)
  })
  it('닫히지 않은 상태에서는 무시', () => {
    t().start()
    draw([[0, 0], [100, 0]])
    expect(t().insertTracePoint(0, 50, 0)).toBe(false)
    expect(t().deleteTracePoint(0)).toBe(false)
  })
})

describe('useEditStore 점 삽입/삭제(방 편집, AC-05-5)', () => {
  const past = () => useDocStore.temporal.getState().pastStates.length
  const pts = () => getActiveRoom().points
  it('삽입은 Undo 1단계, 새 점 선택', () => {
    const n = pts().length
    const before = past()
    expect(useEditStore.getState().insertCorner(0, (pts()[0][0] + pts()[1][0]) / 2, pts()[0][1])).toBe(true)
    expect(pts()).toHaveLength(n + 1)
    expect(past()).toBe(before + 1)
    expect(useEditStore.getState().selectedCorner).toBe(1)
    useDocStore.temporal.getState().undo()
    expect(pts()).toHaveLength(n)
  })
  it('삭제는 Undo 1단계, 3점 이하 거부 + 토스트', () => {
    useEditStore.getState().insertCorner(0, (pts()[0][0] + pts()[1][0]) / 2, pts()[0][1])
    const before = past()
    const n = pts().length
    expect(useEditStore.getState().deleteCorner(1)).toBe(true)
    expect(pts()).toHaveLength(n - 1)
    expect(past()).toBe(before + 1)
    useDocStore.setState({ rooms: [{ ...getActiveRoom(), points: [[0, 0], [300, 0], [0, 300]] }] })
    expect(useEditStore.getState().deleteCorner(0)).toBe(false)
    expect(useUiStore.getState().notice).toContain('3개')
  })
  it('실패한 삽입은 문서를 바꾸지 않는다', () => {
    const before = past()
    expect(useEditStore.getState().insertCorner(0, pts()[0][0] + 2, pts()[0][1])).toBe(false)
    expect(past()).toBe(before)
  })
})

describe('QA 회귀(R2, R3, R5, R6)', () => {
  it('R2: 빈 캔버스에서 점 이동도 영역(0~3000)으로 맞추고, 다시 열 때 선택을 푼다', () => {
    t().start()
    draw([[100, 100], [300, 100], [300, 300]])
    t().moveTracePoint(1, -500, 9000)
    expect(cornersCm(t())[1]).toEqual([0, 3000])
    t().closeTrace()
    t().selectTracePoint(1)
    expect(t().selected).toBe(1)
    t().moveTracePoint(0, 50, 50)
    expect(t().closed).toBe(false)
    expect(t().selected).toBeNull()
  })
  it('R3: 직전 점과 같은 위치면 false + 안내 문구(error)', () => {
    t().start()
    draw([[100, 100]])
    expect(t().addTracePoint(103, 98)).toBe(false)
    expect(t().error?.message).toContain('같은 위치')
    expect(t().addTracePoint(200, 100)).toBe(true)
    expect(t().error).toBeNull()
  })
  it('R5: 빈 캔버스 미리보기 점 = 실제로 추가되는 점(영역 밖 커서도)', () => {
    t().start()
    draw([[2900, 2900]])
    for (const c of [[5000, 2900], [2900, -400], [2950, 2960]] as Point2[]) {
      t().setCursor(c[0], c[1])
      const pv = previewPoint(t())
      t().addTracePoint(c[0], c[1])
      const added = cornersCm(t()).at(-1)
      if (pv) expect(added).toEqual(pv.point)
    }
  })
  it('R6: lengthError는 되돌리기·직각 토글·입력 변경 시 지워진다', () => {
    t().start()
    draw([[100, 100]])
    for (const clear of [() => t().undoTracePoint(), () => t().setOrtho(false), () => t().clearLengthError()]) {
      if (t().corners.length === 0) draw([[100, 100]])
      t().addTracePointByLength(1)
      expect(t().lengthError).not.toBeNull()
      clear()
      expect(t().lengthError).toBeNull()
    }
  })
})

describe('드래그 직사각형', () => {
  it('대각 두 점(스냅 적용)으로 모서리 4개를 만들고 닫을 수 있다', () => {
    t().start()
    expect(t().setTraceRect([103, 98], [403, 298])).toBe(true)
    expect(cornersCm(t())).toEqual([[100, 100], [400, 100], [400, 300], [100, 300]])
    expect(t().closeTrace()).toBe(true)
  })
  it('폭이나 깊이가 0이면 점을 비운다', () => {
    t().start()
    t().setTraceRect([100, 100], [300, 300])
    expect(t().setTraceRect([100, 100], [102, 300])).toBe(false) // 스냅 후 폭 0
    expect(t().corners).toEqual([])
  })
})

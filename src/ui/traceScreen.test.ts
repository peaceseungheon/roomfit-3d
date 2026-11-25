import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { ROOMS_MAX } from '../io/validate'
import { createSample } from '../store/sample'
import type { Point2, Room } from '../store/types'
import { useDocStore } from '../store/useDocStore'
import { useTraceStore } from '../store/useTraceStore'
import { useUiStore } from '../store/useUiStore'
import { redo, undo } from './actions'
import RoomDialog from './RoomDialog'
import TraceScreen from './TraceScreen'

// zustand는 서버 렌더에서 초기 상태를 읽는다. 정적 마크업에서 현재 상태가 보이게 초기 상태 객체를 현재 값으로 덮는다(테스트 전용).
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => {
  for (const store of [useTraceStore, useDocStore]) Object.assign(store.getInitialState(), store.getState())
  return renderToStaticMarkup(el)
}
const screen = () => html(createElement(TraceScreen))
const t = () => useTraceStore.getState()
const sq: Point2[] = [[0, 0], [1, 0], [1, 1], [0, 1]]

/** 닫힌 사각형 한 칸을 세션에 올린다(scale 1이므로 px=cm). */
const closedSession = (extra: object = {}) =>
  useTraceStore.setState({ corners: [[0, 0], [200, 0], [200, 200], [0, 200]], closed: true, pendingRoom: sq, ...extra })

beforeEach(() => {
  t().cancel()
  useDocStore.setState({ ...createSample(), pristine: true })
  useDocStore.temporal.getState().clear()
  useUiStore.setState({ activeRoomId: null, notice: null })
})

describe('RoomDialog 그려서 만들기', () => {
  it('add 모드도 그리기 버튼을 보이고 다음 단계 문구는 없다', () => {
    const add = html(createElement(RoomDialog, { onClose: () => {}, mode: 'add' }))
    expect(add).toContain('그려서 만들기(평면도 배경 선택 가능)')
    expect(add).not.toContain('다음 단계에서')
    expect(html(createElement(RoomDialog, { onClose: () => {} }))).toContain('그려서 만들기(평면도 배경 선택 가능)')
  })
  it('add 시작은 mode add, active', () => {
    t().start('add')
    expect(t().mode).toBe('add')
    expect(t().active).toBe(true)
  })
})

describe('TraceScreen 확정 흐름', () => {
  it('취소/끝내기 라벨과 방 N개 확정 표시', () => {
    t().start()
    expect(screen()).toContain('>취소</button>')
    expect(screen()).not.toContain('개 확정')
    useTraceStore.setState({ confirmed: 2 })
    const m = screen()
    expect(m).toContain('>끝내기</button>')
    expect(m).toContain('>방 2개 확정</span>')
    expect(m).toContain('방 2개 확정. 다음 방의 모서리를 찍거나 [끝내기]를 누르세요.')
  })
  it('첫 방 확정 뒤 배경 없이 그리기·업로드·기준선 컨트롤을 숨긴다', () => {
    t().setImage({ url: 'blob:x', name: 'a.png', width: 100, height: 100 })
    useTraceStore.setState({ scale: 1 })
    expect(screen()).toContain('배경 없이 그리기')
    expect(screen()).toContain('기준선 다시 찍기')
    useTraceStore.setState({ confirmed: 1 })
    const m = screen()
    for (const w of ['배경 없이 그리기', '기준선 다시 찍기', '실제 길이', 'type="file"']) expect(m).not.toContain(w)
  })
  it('손대지 않은 샘플이면 트레이싱 확정에서도 기존 가구를 묻지 않는다(AC-01-6)', () => {
    t().start()
    closedSession()
    expect(screen()).not.toContain('기존 가구')
  })
  it('방 1개 replace 흐름: 기존 버튼 유지 + 다음 방 따기 하나만 추가', () => {
    useDocStore.setState({ pristine: false })
    t().start()
    closedSession()
    const m = screen()
    for (const w of ['>방 생성</button>', '>방 생성 후 다음 방 따기</button>', '기존 가구', '>취소</button>', '>닫기</button>', '>다시 편집</button>', '점 삭제'])
      expect(m).toContain(w)
    expect(m).toContain('value="230"') // 천장고 기본값(TRACE_DEFAULT_HEIGHT)
  })
  it('천장고 기본값은 lastHeight, 가구 라디오는 replace 첫 방에만', () => {
    t().start('add')
    useTraceStore.setState({ confirmed: 1, lastHeight: 275 })
    closedSession()
    const m = screen()
    expect(m).toContain('value="275"')
    expect(m).not.toContain('기존 가구')
    t().cancel()
    t().start('add') // add 첫 방(confirmed 0)도 라디오 없음
    closedSession()
    expect(screen()).not.toContain('기존 가구')
  })
  it('방 20개면 확정 버튼 비활성 + 사유, replace 첫 방은 예외', () => {
    const base = useDocStore.getState().rooms[0]
    const rooms: Room[] = Array.from({ length: ROOMS_MAX }, (_, i) => ({ ...base, id: `r${i}` }))
    useDocStore.setState({ rooms })
    t().start('add')
    closedSession()
    const m = screen()
    expect(m).toContain(`방은 최대 ${ROOMS_MAX}개까지 추가할 수 있습니다`)
    expect(m).toMatch(/disabled=""[^>]*>방 생성<\/button>/)
    expect(m).toMatch(/disabled=""[^>]*>방 생성 후 다음 방 따기<\/button>/)
    t().cancel()
    t().start()
    closedSession()
    const r = screen()
    expect(r).not.toContain('최대')
    expect(r).not.toMatch(/disabled=""[^>]*>방 생성<\/button>/)
  })
  it('이웃 방에 붙이기 체크박스는 고스트가 있을 때만', () => {
    t().start()
    expect(screen()).not.toContain('이웃 방에 붙이기')
    t().cancel()
    t().start('add')
    const m = screen()
    expect(m).toContain('이웃 방에 붙이기')
    expect(m).toContain('Shift를 누르고 있으면 이웃 방 스냅이 꺼집니다')
  })
})

describe('트레이싱 중 문서 Undo/Redo 차단', () => {
  it('active면 undo/redo가 문서에 닿지 않는다', () => {
    useDocStore.getState().removeItem('item_001')
    const n = useDocStore.getState().items.length
    t().start()
    undo()
    expect(useDocStore.getState().items).toHaveLength(n)
    t().cancel()
    undo()
    expect(useDocStore.getState().items).toHaveLength(n + 1)
    t().start()
    redo()
    expect(useDocStore.getState().items).toHaveLength(n + 1)
  })
})

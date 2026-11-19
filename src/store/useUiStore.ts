import { create } from 'zustand'
import type { ValidationError } from '../io/validate'
import { useDocStore } from './useDocStore'

export type CameraMode = '2D' | 'QUARTER' | 'FIRST_PERSON'
export type SaveStatus = 'idle' | 'saved' | 'failed'

/** 저장본 복원 실패 정보. 토스트 표시는 UI 단계 몫. */
export interface RestoreFailure {
  errors: ValidationError[]
  /** 손상 원문을 백업 키에 보존했는지 */
  backedUp: boolean
}

// Undo/Redo 비대상 UI 상태 (AC-13-1)
interface UiState {
  selectedId: string | null
  cameraMode: CameraMode
  saveStatus: SaveStatus
  notice: string | null
  /** 알림이 설정될 때마다 증가 — 같은 문구여도 토스트 타이머를 재시작 */
  noticeSeq: number
  restoreFailure: RestoreFailure | null
  /** 이동 스냅 켜짐(AC-10-2). 끄면 1cm 단위 */
  snapEnabled: boolean
  /** 2D 뷰 치수 라벨 표시(AC-12-4). 저장하지 않음 */
  showDimensions: boolean
  select: (id: string | null) => void
  setCameraMode: (m: CameraMode) => void
  setSaveStatus: (s: SaveStatus) => void
  setNotice: (n: string | null) => void
  setRestoreFailure: (f: RestoreFailure | null) => void
  setSnapEnabled: (on: boolean) => void
  setShowDimensions: (on: boolean) => void
}

export const useUiStore = create<UiState>()((set) => ({
  selectedId: null,
  cameraMode: 'QUARTER',
  saveStatus: 'idle',
  notice: null,
  noticeSeq: 0,
  restoreFailure: null,
  snapEnabled: true,
  showDimensions: true,
  select: (selectedId) => set({ selectedId }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setNotice: (notice) => set((s) => ({ notice, noticeSeq: s.noticeSeq + 1 })),
  setRestoreFailure: (restoreFailure) => set({ restoreFailure }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setShowDimensions: (showDimensions) => set({ showDimensions }),
}))

// Undo/Redo/불러오기/초기화 뒤 사라진 항목의 선택을 해제한다
useDocStore.subscribe((s) => {
  const id = useUiStore.getState().selectedId
  if (id && !s.items.some((it) => it.id === id)) useUiStore.getState().select(null)
})

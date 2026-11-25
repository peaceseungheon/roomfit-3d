import { useState } from 'react'
import { detectWebgl } from './ui/webgl'
import { WebglUnsupported } from './ui/WebglNotice'
import Scene from './scene/Scene'
import TraceCanvas from './scene/TraceCanvas'
import { useDocStore } from './store/useDocStore'
import CatalogList from './ui/CatalogList'
import DimensionBoxForm from './ui/DimensionBoxForm'
import DimensionPanel from './ui/DimensionPanel'
import { FixtureList, RoomSection } from './ui/PanelSections'
import StartDialog from './ui/StartDialog'
import Toast from './ui/Toast'
import TraceScreen from './ui/TraceScreen'
import WallEditor from './ui/WallEditor'
import TopBar, { DimensionsToggle, SnapToggle } from './ui/TopBar'
import WarningBadge from './ui/WarningBadge'
import { useEditorKeys } from './ui/useEditorKeys'
import { ChevronIcon } from './ui/icons'
import { Analytics } from "@vercel/analytics/react"

const WEBGL_OK = detectWebgl()
const SHEET_LEVELS = ['min', 'mid', 'full'] as const

export default function App() {
  useEditorKeys()
  const empty = useDocStore((s) => s.items.length === 0)
  const [collapsed, setCollapsed] = useState(false) // 태블릿 패널 접기
  const [sheet, setSheet] = useState<(typeof SHEET_LEVELS)[number]>('mid') // 모바일 하단 시트

  return (
    <div className="app">
      <TopBar />
      <div className="body">
        <div className="canvas-wrap">
          {WEBGL_OK ? <Scene /> : <WebglUnsupported />}
          <div className="overlay">
            <WarningBadge />
            <SnapToggle className="narrow-only" />
            <DimensionsToggle />
          </div>
          {empty && <p className="empty-hint">패널에서 가구를 추가해 보세요</p>}
        </div>
        <button
          className="panel-toggle tablet-only"
          aria-expanded={!collapsed}
          aria-label={collapsed ? '패널 열기' : '패널 접기'}
          onClick={() => setCollapsed((c) => !c)}
        >
          <ChevronIcon dir={collapsed ? 'left' : 'right'} />
        </button>
        <aside className="panel" data-collapsed={collapsed} data-sheet={sheet} aria-label="편집 패널">
          <button
            className="sheet-handle mobile-only"
            aria-label="패널 높이 바꾸기"
            onClick={() => setSheet(SHEET_LEVELS[(SHEET_LEVELS.indexOf(sheet) + 1) % 3])}
          >
            <span className="grip" aria-hidden="true" />
          </button>
          <div className="panel-body">
            <DimensionPanel />
            <CatalogList />
            <DimensionBoxForm />
            <FixtureList />
            <WallEditor />
            <RoomSection />
          </div>
        </aside>
      </div>
      <TraceScreen stage={WEBGL_OK ? <TraceCanvas /> : null} />
      <StartDialog />
      <Toast />
      <Analytics />
    </div>
  )
}

import { useEffect, useId, useRef, useState } from 'react'
import { adsConfigured, readConsent, writeConsent } from '../consent/store'
import { ADSENSE_CLIENT, ADSENSE_SLOT } from '../landing/config'
import { downloadBlob, stampedName } from '../io/download'
import { readImportFile } from '../io/importFile'
import { serializeDocument } from '../io/persist'
import { SHARE_URL_SOFT_MAX, resolveHash, shareUrl } from '../io/shareLink'
import { currentInstallMode, promptInstall } from '../pwa/install'
import { isDragging } from '../scene/dragSession'
import { selectWarnings } from '../scene/useWarnings'
import { TEMPLATES } from '../store/templates'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import type { DocData } from '../store/types'
import { importDocument, resetToSample } from './actions'
import { captionLines } from './captureCaption'
import ConfirmDialog from './ConfirmDialog'
import { CheckIcon, MenuIcon, WarnIcon } from './icons'

type Dlg = { kind: 'error'; lines: string[] } | { kind: 'import'; doc: DocData } | { kind: 'reset' } | { kind: 'ios' } | { kind: 'templates' }

function exportJson() {
  const { rooms, items } = useDocStore.getState()
  downloadBlob(new Blob([serializeDocument({ rooms, items })], { type: 'application/json' }), stampedName('json'))
}

const CAPTION_FONT = 'Pretendard, system-ui, sans-serif'

/** 캔버스 아래에 방 치수·경고 요약 띠를 붙인 새 캔버스(AC-15-2). */
function withCaption(src: HTMLCanvasElement): HTMLCanvasElement {
  const { rooms, items } = useDocStore.getState()
  const lines = captionLines(rooms, items, selectWarnings(rooms, items))
  const fs = Math.max(14, Math.round(src.width / 40))
  const pad = Math.round(fs * 0.7)
  const out = document.createElement('canvas')
  out.width = src.width
  out.height = src.height + pad * 2 + Math.round(fs * 1.4) * lines.length
  const ctx = out.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  ctx.fillStyle = '#0f2a4a'
  ctx.fillRect(0, src.height, out.width, out.height - src.height)
  ctx.font = `600 ${fs}px ${CAPTION_FONT}`
  ctx.textBaseline = 'top'
  lines.forEach((l, i) => {
    ctx.fillStyle = l.startsWith('⚠') ? '#ffb4a8' : '#ffffff'
    ctx.fillText(l, pad, src.height + pad + i * Math.round(fs * 1.4), out.width - pad * 2)
  })
  return out
}

/** AC-15-1/2: 현재 3D 캔버스를 PNG로 저장. annotated면 치수·경고 띠를 붙인다. HTML 오버레이는 포함되지 않는다. */
function capturePng(annotated: boolean) {
  if (isDragging()) return
  const fail = () => useUiStore.getState().setNotice('⚠ 캡처에 실패했습니다. 다시 시도해 주세요.')
  const canvas = document.querySelector<HTMLCanvasElement>('.scene-root canvas')
  if (!canvas) return fail()
  try {
    const target = annotated ? withCaption(canvas) : canvas
    target.toBlob((b) => (b ? downloadBlob(b, stampedName('png')) : fail()), 'image/png')
  } catch {
    fail()
  }
}

/** AC-14-7: 문서를 URL 해시에 담아 클립보드에 복사한다. */
async function copyShareLink() {
  const { rooms, items } = useDocStore.getState()
  const { setNotice } = useUiStore.getState()
  try {
    const url = await shareUrl({ rooms, items })
    await navigator.clipboard.writeText(url)
    setNotice(url.length > SHARE_URL_SOFT_MAX ? '공유 링크를 복사했습니다. 길어서 일부 메신저에서 잘릴 수 있습니다.' : '공유 링크를 복사했습니다.')
  } catch {
    setNotice('⚠ 공유 링크를 만들지 못했습니다. JSON 내보내기를 이용해 주세요.')
  }
}

function MenuStatus() {
  const s = useUiStore((st) => st.saveStatus)
  if (s === 'failed')
    return (
      <p className="save failed">
        <WarnIcon /> 저장 실패. JSON 내보내기로 백업하세요
      </p>
    )
  return (
    <p role="status" className="save">
      저장 상태: {s === 'saved' ? '저장됨' : '변경 대기 없음'}
      {s === 'saved' && <CheckIcon />}
    </p>
  )
}

/** AC-18-6/7: 광고 설정이 있을 때만. 변경은 다음 랜딩 방문부터 적용. */
function ConsentToggle() {
  const [on, setOn] = useState(() => readConsent() === 'granted')
  const [failed, setFailed] = useState(false)
  if (!adsConfigured(ADSENSE_CLIENT, ADSENSE_SLOT)) return null
  return (
    <label className="consent-toggle">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          const v = e.target.checked
          const ok = writeConsent(v ? 'granted' : 'denied')
          setFailed(!ok)
          if (ok) setOn(v)
        }}
      />{' '}
      광고·쿠키 동의
      <span className="hint"> 다음 랜딩 방문부터 적용</span>
      {failed && <span role="status"> 저장하지 못했습니다. 다음 방문에 다시 물을 수 있습니다.</span>}
    </label>
  )
}

/** S-06 메뉴(≡). 내보내기·불러오기·샘플 초기화와 저장 상태. */
export default function MenuButton() {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const [dlg, setDlg] = useState<Dlg | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const installMode = open ? currentInstallMode() : 'hidden' // 메뉴를 열 때 판정(프롬프트는 그 사이 도착할 수 있다)

  // 공유 링크(#d=)·가이드의 템플릿 링크(#t=)로 들어오면 덮어쓰기 확인을 띄운다(AC-14-8). 해시는 바로 지운다.
  // 이미 열린 탭에 링크를 붙여 넣어도 새로고침 없이 hashchange로 들어온다.
  useEffect(() => {
    const enter = () => {
      const hash = location.hash
      if (!/^#[dt]=/.test(hash)) return
      history.replaceState(null, '', location.pathname + location.search)
      void resolveHash(hash).then((r) => r && setDlg(r.ok ? { kind: 'import', doc: r.doc } : { kind: 'error', lines: r.lines }))
    }
    enter()
    window.addEventListener('hashchange', enter)
    return () => window.removeEventListener('hashchange', enter)
  }, [])

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const onPick = async (f: File | undefined) => {
    if (file.current) file.current.value = '' // 같은 파일 다시 선택 가능하게
    if (!f) return
    const r = await readImportFile(f)
    setDlg(r.ok ? { kind: 'import', doc: r.doc } : { kind: 'error', lines: r.lines })
  }

  const choose = (run: () => void) => () => {
    setOpen(false)
    run()
  }

  return (
    <div
      className="menu-wrap"
      ref={wrap}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          setOpen(false)
          toggle.current?.focus()
        }
      }}
    >
      <button ref={toggle} data-modal-fallback aria-label="메뉴" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((o) => !o)}>
        <MenuIcon />
      </button>
      {open && (
        // 버튼과 체크박스가 섞인 팝오버라 ARIA menu 패턴(방향키 이동)을 약속하지 않고 Tab으로 이동하는 그룹으로 둔다
        <div id={menuId} className="menu" role="group" aria-label="메뉴">
          <MenuStatus />
          <button onClick={choose(exportJson)}>JSON 내보내기</button>
          <button onClick={() => {
              setOpen(false)
              file.current?.click()
            }}>JSON 불러오기</button>
          <button onClick={choose(() => capturePng(false))}>캡처(PNG)</button>
          <button onClick={choose(() => capturePng(true))}>캡처(치수·경고 포함)</button>
          <button onClick={choose(() => void copyShareLink())}>공유 링크 복사</button>
          <button onClick={choose(() => setDlg({ kind: 'templates' }))}>템플릿 불러오기</button>
          <button onClick={choose(() => setDlg({ kind: 'reset' }))}>샘플로 초기화</button>
          {installMode !== 'hidden' && (
            <button onClick={choose(() => (installMode === 'ios' ? setDlg({ kind: 'ios' }) : void promptInstall()))}>앱으로 설치</button>
          )}
          <ConsentToggle />
        </div>
      )}
      <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => void onPick(e.target.files?.[0])} />
      {dlg?.kind === 'error' && (
        <ConfirmDialog title="불러오기 실패" alertOnly confirmLabel="닫기" onConfirm={() => setDlg(null)} onCancel={() => setDlg(null)}>
          <p>{dlg.lines[0]}</p>
          <ul>
            {dlg.lines.slice(1).map((l, i) => (
              <li key={`${i}-${l}`}>{l}</li>
            ))}
          </ul>
        </ConfirmDialog>
      )}
      {dlg?.kind === 'ios' && (
        <ConfirmDialog title="앱으로 설치" alertOnly info confirmLabel="닫기" onConfirm={() => setDlg(null)} onCancel={() => setDlg(null)}>
          <p>브라우저의 공유 메뉴에서 &quot;홈 화면에 추가&quot;를 선택하세요.</p>
        </ConfirmDialog>
      )}
      {dlg?.kind === 'templates' && (
        <ConfirmDialog title="템플릿 불러오기" alertOnly info confirmLabel="닫기" onConfirm={() => setDlg(null)} onCancel={() => setDlg(null)}>
          <ul className="template-list">
            {TEMPLATES.map((t) => (
              <li key={t.id}>
                <button onClick={() => setDlg({ kind: 'import', doc: t.doc() })}>
                  <strong>{t.name}</strong>
                  <span className="hint"> {t.desc}</span>
                </button>
              </li>
            ))}
          </ul>
        </ConfirmDialog>
      )}
      {dlg?.kind === 'import' && (
        <ConfirmDialog
          title="불러오기"
          onCancel={() => setDlg(null)}
          onConfirm={() => {
            importDocument(dlg.doc)
            setDlg(null)
          }}
        >
          <p>현재 작업을 덮어씁니다. 계속할까요?</p>
          <p className="hint">되돌리기(Undo)로 복구할 수 있습니다.</p>
        </ConfirmDialog>
      )}
      {dlg?.kind === 'reset' && (
        <ConfirmDialog
          title="샘플로 초기화"
          onCancel={() => setDlg(null)}
          onConfirm={() => {
            resetToSample()
            setDlg(null)
          }}
        >
          <p>현재 작업을 샘플 방으로 바꿉니다. 계속할까요?</p>
          <p className="hint">되돌리기(Undo)로 복구할 수 있습니다.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}

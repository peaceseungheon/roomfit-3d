import { useEffect, useRef, useState } from 'react'
import { adsConfigured, readConsent, writeConsent } from '../consent/store'
import { ADSENSE_CLIENT, ADSENSE_SLOT } from '../landing/config'
import { downloadBlob, stampedName } from '../io/download'
import { resolveHash } from '../io/shareLink'
import { readImportFile } from '../io/importFile'
import { serializeDocument } from '../io/persist'
import { currentInstallMode, promptInstall } from '../pwa/install'
import { TEMPLATES } from '../store/templates'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import type { DocData } from '../store/types'
import { importDocument, resetToSample } from './actions'
import { usePopover } from './usePopover'
import ConfirmDialog from './ConfirmDialog'
import { CheckIcon, MenuIcon, WarnIcon } from './icons'

type Dlg = { kind: 'error'; lines: string[] } | { kind: 'import'; doc: DocData } | { kind: 'reset' } | { kind: 'ios' } | { kind: 'templates' }

function exportJson() {
  const { rooms, items } = useDocStore.getState()
  downloadBlob(new Blob([serializeDocument({ rooms, items })], { type: 'application/json' }), stampedName('json'))
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
  const { open, setOpen, menuId, wrap, toggle, onKeyDown } = usePopover()
  const [dlg, setDlg] = useState<Dlg | null>(null)
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
      onKeyDown={onKeyDown}
    >
      <button ref={toggle} data-modal-fallback aria-label="메뉴" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((o) => !o)}>
        <MenuIcon />
      </button>
      {open && (
        // 버튼과 체크박스가 섞인 팝오버라 ARIA menu 패턴(방향키 이동)을 약속하지 않고 Tab으로 이동하는 그룹으로 둔다
        <div id={menuId} className="menu" role="group" aria-label="메뉴">
          <MenuStatus />
          <p className="menu-group">시작</p>
          <button onClick={choose(() => setDlg({ kind: 'templates' }))}>템플릿 불러오기</button>
          <button onClick={choose(() => setDlg({ kind: 'reset' }))}>샘플로 초기화</button>
          <a className="menu-link" href="/guide.html" target="_blank" rel="noopener" onClick={() => setOpen(false)}>
            배치 가이드 (새 탭)
          </a>
          <p className="menu-group">파일</p>
          <button onClick={choose(exportJson)}>JSON 내보내기</button>
          <button onClick={() => {
              setOpen(false)
              file.current?.click()
            }}>JSON 불러오기</button>
          {installMode !== 'hidden' && (
            <>
              <p className="menu-group">앱</p>
              <button onClick={choose(() => (installMode === 'ios' ? setDlg({ kind: 'ios' }) : void promptInstall()))}>앱으로 설치</button>
            </>
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

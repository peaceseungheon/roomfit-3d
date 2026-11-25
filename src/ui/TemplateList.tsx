import { TEMPLATES } from '../store/templates'
import type { DocData } from '../store/types'

/** 템플릿 선택 목록(메뉴 "템플릿 불러오기"와 시작 화면이 공용). */
export default function TemplateList({ onPick }: { onPick: (doc: DocData) => void }) {
  return (
    <ul className="template-list">
      {TEMPLATES.map((t) => (
        <li key={t.id}>
          <button onClick={() => onPick(t.doc())}>
            <strong>{t.name}</strong>
            <span className="hint"> {t.desc}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

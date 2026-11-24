import { FURNITURE_CATALOG } from '../store/catalog'

/** 치수 박스 종류 드롭다운(생성 폼·속성 패널 공용). 빈 값 = 기타(링크 없음). */
export default function CategorySelect({ id, value, onChange }: { id: string; value: string | undefined; onChange: (v: string | undefined) => void }) {
  return (
    <div className="field">
      <label htmlFor={id}>종류</label>
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">기타(링크 없음)</option>
        {FURNITURE_CATALOG.map((c) => (
          <option key={c.modelType} value={c.modelType}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}

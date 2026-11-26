import { AFFILIATE_DISCLOSURE, itemAffiliate } from '../affiliate/links'
import { itemLabel } from '../store/catalog'
import type { Item } from '../store/types'
import BlockThumb from './BlockThumb'

interface Props {
  items: readonly Item[]
  /** 없으면 체크는 읽기 전용(disabled). */
  onToggle?: (id: string, purchased: boolean) => void
}

/** FR-17 구매 리스트: 가구(FIXTURE 제외)와 구매 체크, 링크가 있는 항목의 제휴 링크. */
export default function PurchaseList({ items, onToggle }: Props) {
  const furniture = items.filter((it) => it.type === 'FURNITURE')
  if (!furniture.length) return <p className="hint">배치된 가구가 없습니다. 가구를 추가하면 여기에 모입니다.</p>
  const done = furniture.filter((it) => it.purchased).length
  const rows = furniture.map((it) => ({ it, aff: itemAffiliate(it) }))
  return (
    <div className="purchase">
      <p role="status" className="purchase-summary">
        구매함 {done} / 전체 {furniture.length}
      </p>
      <ul className="purchase-items">
        {rows.map(({ it, aff }) => (
          <li key={it.id}>
            <label>
              <input
                type="checkbox"
                checked={!!it.purchased}
                disabled={!onToggle}
                onChange={(e) => onToggle?.(it.id, e.target.checked)}
              />{' '}
              <span>구매함</span> <strong>{itemLabel(it)}</strong>{' '}
              <small>
                {it.size[0]}×{it.size[2]}×{it.size[1]} cm
              </small>
            </label>
            {aff && (
              <a className="affiliate-card" href={aff.url} target="_blank" rel="sponsored noopener noreferrer">
                <BlockThumb color={aff.color} />
                <span className="affiliate-text">
                  <strong>쿠팡에서 {aff.kindName} 보기</strong>
                  <small>{aff.band}</small>
                </span>
                <span className="affiliate-go" aria-hidden="true">↗</span>
                <span className="sr-only">(새 탭)</span>
              </a>
            )}
          </li>
        ))}
      </ul>
      {rows.some((r) => r.aff) && <p className="hint">{AFFILIATE_DISCLOSURE}</p>}
    </div>
  )
}

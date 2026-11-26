import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createSample } from '../store/sample'
import type { Item } from '../store/types'
import PurchaseList from './PurchaseList'

const sofa: Item = { id: 's', type: 'FURNITURE', modelType: 'SOFA', position: [0, 0, 0], rotation: [0, 0, 0], size: [150, 80, 90] }
const win: Item = { id: 'w', type: 'FIXTURE', modelType: 'WINDOW', position: [0, 0, 0], rotation: [0, 0, 0], size: [120, 110, 5] }
const html = (items: Item[], toggle = false) => renderToStaticMarkup(<PurchaseList items={items} onToggle={toggle ? () => {} : undefined} />)

describe('PurchaseList', () => {
  it('가구가 없으면 안내 문구, FIXTURE만 있어도 같다', () => {
    expect(html([])).toContain('배치된 가구가 없습니다')
    expect(html([win])).toContain('배치된 가구가 없습니다')
  })
  it('FIXTURE는 제외하고 요약·치수(W×D×H)를 보인다', () => {
    const out = html([{ ...sofa, purchased: true }, win])
    expect(out).toContain('구매함 1 / 전체 1')
    expect(out).toContain('150×90×80 cm')
    expect(out).not.toContain('창문')
  })
  it('onToggle이 없으면 체크가 disabled, 있으면 활성', () => {
    expect(html([sofa])).toContain('disabled')
    expect(html([sofa], true)).not.toContain('disabled')
  })
  it('링크가 있으면 sponsored 링크와 고지 문구를 함께 보인다', () => {
    const out = html([sofa])
    expect(out).toContain('rel="sponsored noopener noreferrer"')
    expect(out).toContain('제휴 링크입니다')
  })
  it('링크가 없으면(카테고리 없는 치수 박스) 고지 문구도 없다', () => {
    const box: Item = { ...sofa, id: 'b', modelType: 'DIMENSION_BOX' }
    const out = html([box])
    expect(out).not.toContain('href=')
    expect(out).not.toContain('제휴 링크입니다')
  })
  it('샘플 문서도 렌더된다', () => {
    expect(html(createSample().items)).toContain('구매함 0 /')
  })
})

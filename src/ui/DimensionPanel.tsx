import { useEffect, useRef, useState } from 'react'
import { affiliateUrl } from '../affiliate/links'
import { NAME_MAX } from '../io/validate'
import { DEFAULT_ELEVATION, DIMENSION_BOX, isDimensionBox, itemLabel } from '../store/catalog'
import { nextRotation } from '../scene/interaction'
import { fixtureKind, nearestWall } from '../scene/geometry'
import { useWarnings } from '../scene/useWarnings'
import { reasonsFor } from './warningText'
import { useDocStore } from '../store/useDocStore'
import { useUiStore } from '../store/useUiStore'
import type { Item } from '../store/types'
import { deleteSelected, duplicateSelected, patchItem } from './actions'
import Field from './Field'
import {
  POSITION_LIMIT,
  ROTATION_LIMITS,
  SIZE_LIMITS,
  composeSwing,
  fromUiSize,
  parseSwing,
  toUiSize,
  type Hinge,
  type Side,
} from './itemFields'

function NameField({ item }: { item: Item }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const next = draft.trim() || undefined
    if (next !== item.name) patchItem(item.id, { name: next })
    setDraft(null)
  }
  return (
    <div className="field">
      <label htmlFor="item-name">이름</label>
      <input
        id="item-name"
        maxLength={NAME_MAX}
        value={draft ?? itemLabel(item)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </div>
  )
}

/**
 * AC-09-5: 치수 박스 색상 편집. color input은 항상 #rrggbb를 낸다.
 * 피커 드래그 중 연속 input은 로컬 draft로만 두고, 네이티브 change/blur/선택 해제(언마운트) 때 patchItem 1회(Undo 1단계).
 */
function ColorField({ item }: { item: Item }) {
  const current = item.color ?? DIMENSION_BOX.color
  const [draft, setDraft] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  const pending = useRef<{ id: string; base: string; value: string | null }>({ id: item.id, base: current, value: null })
  pending.current.id = item.id
  pending.current.base = current
  pending.current.value = draft
  const flush = () => {
    const { id, base, value } = pending.current
    pending.current.value = null
    setDraft(null)
    if (value !== null && value !== base) patchItem(id, { color: value })
  }
  useEffect(() => {
    const el = ref.current
    const pend = pending.current // 객체는 교체되지 않고 값만 갱신된다
    el?.addEventListener('change', flush)
    return () => {
      el?.removeEventListener('change', flush)
      const { id, base, value } = pend
      if (value !== null && value !== base) patchItem(id, { color: value })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])
  return (
    <div className="field">
      <label htmlFor="item-color">색상</label>
      <input
        ref={ref}
        id="item-color"
        type="color"
        value={draft ?? current}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={flush}
      />
      <span className="unit">{draft ?? current}</span>
    </div>
  )
}

function SwingFields({ item }: { item: Item }) {
  const { hinge, side } = parseSwing(item.doorSwing?.direction)
  const set = (h: Hinge, s: Side) =>
    patchItem(item.id, {
      doorSwing: { direction: composeSwing(h, s), radius: item.size[0], angle: item.doorSwing?.angle ?? 90 },
    })
  return (
    <>
      <div className="field">
        <label htmlFor="swing-hinge">여는 방향</label>
        <select id="swing-hinge" value={hinge} onChange={(e) => set(e.target.value as Hinge, side)}>
          <option value="LEFT">좌</option>
          <option value="RIGHT">우</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="swing-side">열리는 쪽</label>
        <select id="swing-side" value={side} onChange={(e) => set(hinge, e.target.value as Side)}>
          <option value="IN">실내</option>
          <option value="OUT">실외</option>
        </select>
      </div>
    </>
  )
}

function FurnitureFields({ item }: { item: Item }) {
  const ui = toUiSize(item.size)
  const setSize = (k: 'w' | 'd' | 'h') => (v: number) => patchItem(item.id, { size: fromUiSize({ ...ui, [k]: v }) })
  const [px, , pz] = item.position
  const lo = -POSITION_LIMIT
  const hi = POSITION_LIMIT
  return (
    <>
      <Field label="가로 W" value={ui.w} min={SIZE_LIMITS.w[0]} max={SIZE_LIMITS.w[1]} onCommit={setSize('w')} />
      <Field label="깊이 D" value={ui.d} min={SIZE_LIMITS.d[0]} max={SIZE_LIMITS.d[1]} onCommit={setSize('d')} />
      <Field label="높이 H" value={ui.h} min={SIZE_LIMITS.h[0]} max={SIZE_LIMITS.h[1]} onCommit={setSize('h')} />
      <Field label="위치 X" value={px} min={lo} max={hi} onCommit={(v) => patchItem(item.id, { position: [v, 0, pz] })} />
      <Field label="위치 Z" value={pz} min={lo} max={hi} onCommit={(v) => patchItem(item.id, { position: [px, 0, v] })} />
      <Field
        label="회전"
        unit="°"
        value={Math.round(item.rotation[1])}
        min={ROTATION_LIMITS[0]}
        max={ROTATION_LIMITS[1]}
        onCommit={(v) => patchItem(item.id, { rotation: [item.rotation[0], v, item.rotation[2]] })}
      />
      <button
        aria-label="90도 회전"
        onClick={() => patchItem(item.id, { rotation: [item.rotation[0], nextRotation(item.rotation[1]), item.rotation[2]] })}
      >
        +90°
      </button>
    </>
  )
}

function FixtureFields({ item }: { item: Item }) {
  const room = useDocStore((s) => s.room)
  const kind = fixtureKind(item.modelType)
  const ui = toUiSize(item.size)
  // AC-06-3: 폭은 벽 길이를 넘을 수 없다
  const wall = nearestWall(room.points, item.position[0], item.position[2])
  const maxW = Math.min(SIZE_LIMITS.w[1], Math.floor(wall?.len ?? SIZE_LIMITS.w[1]))
  const elev = item.elevation ?? DEFAULT_ELEVATION[item.modelType] ?? 0
  const setWidth = (v: number) =>
    patchItem(item.id, {
      size: fromUiSize({ ...ui, w: v }),
      // 문 열림 반경 = 문 폭(AC-07-1)
      ...(kind === 'DOOR'
        ? { doorSwing: { direction: item.doorSwing?.direction ?? 'LEFT_IN', radius: v, angle: item.doorSwing?.angle ?? 90 } }
        : {}),
    })
  return (
    <>
      {kind !== 'OUTLET' && (
        <>
          <Field label="폭" value={ui.w} min={1} max={maxW} onCommit={setWidth} />
          <Field
            label="높이"
            value={ui.h}
            min={SIZE_LIMITS.h[0]}
            max={SIZE_LIMITS.h[1]}
            onCommit={(v) => patchItem(item.id, { size: fromUiSize({ ...ui, h: v }) })}
          />
        </>
      )}
      {kind !== 'DOOR' && (
        <Field label="바닥 위 높이" value={elev} min={0} max={room.height} onCommit={(v) => patchItem(item.id, { elevation: v })} />
      )}
      {kind === 'DOOR' && <SwingFields item={item} />}
      <p className="hint">위치는 벽을 따라 드래그해서 옮깁니다.</p>
    </>
  )
}

/** FR-17: 기본 가구 15종 + 설정된 URL이 있을 때만 링크와 고지를 함께 표시. */
function AffiliateLink({ item }: { item: Item }) {
  const url = item.type === 'FURNITURE' ? affiliateUrl(item.modelType) : null
  if (!url) return null
  return (
    <div className="affiliate">
      <a href={url} target="_blank" rel="sponsored noopener noreferrer">
        이 종류 상품 보기 ↗
      </a>
      <p className="hint">제휴 링크입니다. 구매 시 수수료를 받을 수 있습니다</p>
    </div>
  )
}

export default function DimensionPanel() {
  const id = useUiStore((s) => s.selectedId)
  const item = useDocStore((s) => s.items.find((it) => it.id === id))
  if (!item) return <p className="hint">가구를 선택하면 치수를 바꿀 수 있습니다.</p>
  const isFurniture = item.type === 'FURNITURE'
  return (
    <ItemPanel item={item} isFurniture={isFurniture} />
  )
}

/** AC-11 / S-05 경고: 선택 항목이 간섭 중이면 속성 하단에 사유를 글로 표시한다. */
function ItemWarnings({ id }: { id: string }) {
  const warnings = useWarnings()
  const items = useDocStore((s) => s.items)
  const reasons = reasonsFor(warnings, id, (o) => {
    const it = items.find((x) => x.id === o)
    return it ? itemLabel(it) : '이름 없음'
  })
  if (!reasons.length) return null
  return (
    <ul className="item-warnings" aria-label="경고 사유">
      {reasons.map((r, i) => (
        <li key={i}>⚠ {r}</li>
      ))}
    </ul>
  )
}

function ItemPanel({ item, isFurniture }: { item: Item; isFurniture: boolean }) {
  return (
    <section aria-label="선택한 항목 치수" key={item.id}>
      <h2>속성</h2>
      <NameField item={item} />
      {isDimensionBox(item) && <ColorField item={item} />}
      {isFurniture ? <FurnitureFields item={item} /> : <FixtureFields item={item} />}
      <div className="row">
        {isFurniture && <button onClick={duplicateSelected}>복제</button>}
        <button onClick={deleteSelected}>삭제</button>
      </div>
      <ItemWarnings id={item.id} />
      <AffiliateLink item={item} />
    </section>
  )
}

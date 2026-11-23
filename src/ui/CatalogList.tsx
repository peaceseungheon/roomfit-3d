import { FURNITURE_CATALOG } from '../store/catalog'
import { addFromCatalog } from './actions'

export default function CatalogList() {
  return (
    <section aria-label="가구 카탈로그">
      <h2>가구 추가</h2>
      <ul className="catalog">
        {FURNITURE_CATALOG.map((c) => (
          <li key={c.modelType}>
            <button onClick={() => addFromCatalog(c.modelType)}>
              <span className="swatch" style={{ background: c.color }} aria-hidden="true" />
              <span className="cat-text">
                {c.name}{' '}
                <small>
                  {c.w}×{c.d}×{c.h}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

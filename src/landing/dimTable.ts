import { FURNITURE_CATALOG } from '../store/catalog'

/** 치수표 행. catalog.ts가 단일 출처이며 표기는 W×D×H(cm). */
export function dimRows(catalog: readonly { name: string; w: number; d: number; h: number }[] = FURNITURE_CATALOG) {
  return catalog.map((c) => ({ name: c.name, dims: `${c.w} × ${c.d} × ${c.h}` }))
}

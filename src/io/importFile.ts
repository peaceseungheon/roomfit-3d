// 불러오기 파일 텍스트 처리(AC-14-3). 실패해도 예외 없이 사용자용 문구를 돌려준다.
import type { DocData } from '../store/types'
import { parseDocument, type ValidationError } from './validate'

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024
const MAX_LINES = 5
const HEADLINE = '파일을 읽을 수 없습니다. 현재 작업은 그대로입니다.'

export type ImportOutcome = { ok: true; doc: DocData } | { ok: false; lines: string[] }

export function formatImportErrors(errors: ValidationError[]): string[] {
  const shown = errors.slice(0, MAX_LINES).map((e) => `${e.path}: ${e.message}`)
  const rest = errors.length - shown.length
  return [HEADLINE, ...shown, ...(rest > 0 ? [`외 ${rest}건`] : [])]
}

export function processImportText(text: string): ImportOutcome {
  const r = parseDocument(text)
  return r.ok
    ? { ok: true, doc: { rooms: r.value.rooms, items: r.value.items } }
    : { ok: false, lines: formatImportErrors(r.errors) }
}

/** File을 읽어 처리. 크기 초과·읽기 실패도 ImportOutcome으로 돌려준다. */
export async function readImportFile(file: Pick<File, 'size' | 'text'>): Promise<ImportOutcome> {
  if (file.size > IMPORT_MAX_BYTES) return { ok: false, lines: [HEADLINE, '파일이 5MB를 넘습니다'] }
  try {
    return processImportText(await file.text())
  } catch {
    return { ok: false, lines: [HEADLINE, '파일을 열지 못했습니다'] }
  }
}

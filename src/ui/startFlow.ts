/** 에디터 첫 진입 시작 화면(S-09)을 띄울지. 저장본·불러오기 실패·공유/템플릿 링크 진입이면 띄우지 않는다(AC-01-6). */
export const shouldShowStart = (pristine: boolean, restoreFailed: boolean, hash: string): boolean =>
  pristine && !restoreFailed && !/^#[dt]=/.test(hash)

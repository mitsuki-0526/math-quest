/** 解説などの TeX を、シートや チャットで 読める 平文に(判定の 記録・一括判定の CSV 用) */
export function texToPlain(tex: string): string {
  return tex
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
    .replace(/\\left\(|\\right\)/g, (m) => (m.includes('left') ? '(' : ')'))
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\leqq/g, '≦')
    .replace(/\\geqq/g, '≧')
    .replace(/\\(quad|;|,|\\ )/g, ' ')
    .replace(/\\to/g, '→')
    .replace(/\\ldots/g, '…')
    .replace(/\^\{?2\}?/g, '²')
    .replace(/\^\{?3\}?/g, '³')
    .replace(/\\pi/g, 'π')
    .replace(/[{}]/g, '')
    .replace(/-/g, '−')
    .replace(/\s+/g, ' ')
    .trim();
}

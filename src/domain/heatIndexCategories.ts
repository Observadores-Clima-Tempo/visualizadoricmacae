/**
 * Classificação canônica de risco do índice de calor.
 *
 * Este módulo é a única fonte de verdade para as faixas: limites, rótulos em
 * pt-BR, nomes de tokens CSS e textos orientativos. Nenhuma camada de
 * renderização deve recalcular faixas — todas consomem `classifyHeatIndex`.
 *
 * Não há valores de cor aqui: as cores vivem em `src/styles/tokens.css` e este
 * módulo expõe apenas o nome do token correspondente.
 */

export type RiskCategoryId =
  | 'none'
  | 'caution'
  | 'extremeCaution'
  | 'danger'
  | 'extremeDanger'
  | 'unknown'

export type RiskCategory = {
  id: RiskCategoryId
  /** Rótulo em pt-BR. */
  label: string
  /** Faixa legível em pt-BR, ex.: `27 °C a 31,9 °C`. */
  rangeLabel: string
  /** Nome do token CSS, ex.: `--risk-caution-bg`. */
  token: string
  /** Texto orientativo em pt-BR (legenda e tooltip). */
  description: string
}

/**
 * Limites canônicos, em °C.
 *
 * `caution`, `extremeCaution` e `danger` são inclusivos no limite inferior;
 * `dangerMax` é inclusivo no limite superior — 54 é `danger` e 54,004 é
 * `extremeDanger`.
 */
export const HEAT_INDEX_THRESHOLDS = {
  caution: 27,
  extremeCaution: 32,
  danger: 41,
  dangerMax: 54,
} as const

/** Marcador exibido quando o valor está ausente ou é inválido. */
export const MISSING_HEAT_INDEX_LABEL = '—'

const NONE: RiskCategory = Object.freeze({
  id: 'none',
  label: 'Sem alerta',
  rangeLabel: 'Abaixo de 27 °C',
  token: '--risk-none-bg',
  description:
    'Abaixo das categorias de alerta adotadas — isto não é garantia de ausência de risco individual.',
})

const CAUTION: RiskCategory = Object.freeze({
  id: 'caution',
  label: 'Cuidado',
  rangeLabel: '27 °C a 31,9 °C',
  token: '--risk-caution-bg',
  description: 'Possível fadiga com exposição prolongada e/ou atividade física.',
})

const EXTREME_CAUTION: RiskCategory = Object.freeze({
  id: 'extremeCaution',
  label: 'Cuidado Extremo',
  rangeLabel: '32 °C a 40,9 °C',
  token: '--risk-extreme-caution-bg',
  description:
    'Possibilidade de insolação, câimbras musculares ou exaustão pelo calor.',
})

const DANGER: RiskCategory = Object.freeze({
  id: 'danger',
  label: 'Perigo',
  rangeLabel: '41 °C a 54 °C',
  token: '--risk-danger-bg',
  description:
    'Câimbras ou exaustão pelo calor são prováveis; insolação e dor de cabeça são possíveis.',
})

const EXTREME_DANGER: RiskCategory = Object.freeze({
  id: 'extremeDanger',
  label: 'Perigo Extremo',
  rangeLabel: 'Acima de 54 °C',
  token: '--risk-extreme-danger-bg',
  description:
    'Insolação altamente provável e risco de desidratação grave em condições de exposição prolongada e/ou atividade física.',
})

/**
 * Categoria usada apenas para valores ausentes/inválidos. Não é uma faixa de
 * risco e não faz parte de `RISK_CATEGORIES`.
 */
const UNKNOWN: RiskCategory = Object.freeze({
  id: 'unknown',
  label: 'Sem dado',
  rangeLabel: '—',
  token: '--color-surface-muted',
  description: 'Não há leitura válida de índice de calor para este horário.',
})

/** As 5 faixas de risco reais, em ordem crescente de risco. */
export const RISK_CATEGORIES: readonly RiskCategory[] = Object.freeze([
  NONE,
  CAUTION,
  EXTREME_CAUTION,
  DANGER,
  EXTREME_DANGER,
])

const CATEGORY_BY_ID: Readonly<Record<RiskCategoryId, RiskCategory>> = Object.freeze({
  none: NONE,
  caution: CAUTION,
  extremeCaution: EXTREME_CAUTION,
  danger: DANGER,
  extremeDanger: EXTREME_DANGER,
  unknown: UNKNOWN,
})

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Classifica um valor bruto de índice de calor (°C).
 *
 * O valor recebido nunca é arredondado: `54.004` é `extremeDanger`, mesmo que
 * seja exibido como `54,0`. Valores ausentes, `NaN` e infinitos retornam a
 * categoria `unknown`.
 */
export function classifyHeatIndex(value: number | null | undefined): RiskCategory {
  if (!isFiniteNumber(value)) {
    return CATEGORY_BY_ID.unknown
  }

  if (value < HEAT_INDEX_THRESHOLDS.caution) {
    return CATEGORY_BY_ID.none
  }

  if (value < HEAT_INDEX_THRESHOLDS.extremeCaution) {
    return CATEGORY_BY_ID.caution
  }

  if (value < HEAT_INDEX_THRESHOLDS.danger) {
    return CATEGORY_BY_ID.extremeCaution
  }

  if (value <= HEAT_INDEX_THRESHOLDS.dangerMax) {
    return CATEGORY_BY_ID.danger
  }

  return CATEGORY_BY_ID.extremeDanger
}

const heatIndexFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/**
 * Formata um valor de índice de calor para exibição (uma casa decimal, vírgula
 * pt-BR). Valores ausentes ou inválidos retornam `—`.
 */
export function formatHeatIndex(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) {
    return MISSING_HEAT_INDEX_LABEL
  }

  return heatIndexFormatter.format(value)
}

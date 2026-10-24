import { describe, expect, it } from 'vitest'

import {
  HEAT_INDEX_THRESHOLDS,
  MISSING_HEAT_INDEX_LABEL,
  RISK_CATEGORIES,
  classifyHeatIndex,
  formatHeatIndex,
} from '@/domain/heatIndexCategories'

describe('HEAT_INDEX_THRESHOLDS — tabela canônica', () => {
  it('expõe os limites exatos do projeto', () => {
    expect(HEAT_INDEX_THRESHOLDS).toEqual({
      caution: 27,
      extremeCaution: 32,
      danger: 41,
      dangerMax: 54,
    })
  })
})

describe('RISK_CATEGORIES — faixas canônicas', () => {
  it('tem exatamente 5 faixas, em ordem crescente e sem "unknown"', () => {
    expect(RISK_CATEGORIES).toHaveLength(5)
    expect(RISK_CATEGORIES.map((category) => category.id)).toEqual([
      'none',
      'caution',
      'extremeCaution',
      'danger',
      'extremeDanger',
    ])
  })

  it('mantém rótulos, faixas legíveis e tokens estáveis', () => {
    expect(
      RISK_CATEGORIES.map(({ id, label, rangeLabel, token }) => ({
        id,
        label,
        rangeLabel,
        token,
      })),
    ).toEqual([
      {
        id: 'none',
        label: 'Sem alerta',
        rangeLabel: 'Abaixo de 27 °C',
        token: '--risk-none-bg',
      },
      {
        id: 'caution',
        label: 'Cuidado',
        rangeLabel: '27 °C a 31,9 °C',
        token: '--risk-caution-bg',
      },
      {
        id: 'extremeCaution',
        label: 'Cuidado Extremo',
        rangeLabel: '32 °C a 40,9 °C',
        token: '--risk-extreme-caution-bg',
      },
      {
        id: 'danger',
        label: 'Perigo',
        rangeLabel: '41 °C a 54 °C',
        token: '--risk-danger-bg',
      },
      {
        id: 'extremeDanger',
        label: 'Perigo Extremo',
        rangeLabel: 'Acima de 54 °C',
        token: '--risk-extreme-danger-bg',
      },
    ])
  })

  it('traz uma descrição orientativa em todas as faixas', () => {
    for (const category of RISK_CATEGORIES) {
      expect(category.description.length).toBeGreaterThan(0)
    }
  })
})

describe('classifyHeatIndex — limites das faixas', () => {
  it('abaixo de 27 °C é "none"', () => {
    expect(classifyHeatIndex(-5).id).toBe('none')
    expect(classifyHeatIndex(0).id).toBe('none')
    expect(classifyHeatIndex(26.999).id).toBe('none')
  })

  it('27 °C a 31,999 °C é "caution"', () => {
    expect(classifyHeatIndex(27).id).toBe('caution')
    expect(classifyHeatIndex(29.5).id).toBe('caution')
    expect(classifyHeatIndex(31.999).id).toBe('caution')
  })

  it('32 °C a 40,999 °C é "extremeCaution"', () => {
    expect(classifyHeatIndex(32).id).toBe('extremeCaution')
    expect(classifyHeatIndex(36).id).toBe('extremeCaution')
    expect(classifyHeatIndex(40.999).id).toBe('extremeCaution')
  })

  it('41 °C a 54 °C é "danger", com 54 inclusive', () => {
    expect(classifyHeatIndex(41).id).toBe('danger')
    expect(classifyHeatIndex(47.5).id).toBe('danger')
    expect(classifyHeatIndex(54).id).toBe('danger')
  })

  it('acima de 54 °C é "extremeDanger"', () => {
    expect(classifyHeatIndex(54.004).id).toBe('extremeDanger')
    expect(classifyHeatIndex(60).id).toBe('extremeDanger')
  })

  it('valores ausentes ou inválidos são "unknown"', () => {
    expect(classifyHeatIndex(null).id).toBe('unknown')
    expect(classifyHeatIndex(undefined).id).toBe('unknown')
    expect(classifyHeatIndex(Number.NaN).id).toBe('unknown')
    expect(classifyHeatIndex(Number.POSITIVE_INFINITY).id).toBe('unknown')
    expect(classifyHeatIndex(Number.NEGATIVE_INFINITY).id).toBe('unknown')
  })

  it('retorna sempre um dos objetos canônicos de RISK_CATEGORIES', () => {
    for (const value of [-5, 27, 32, 41, 55]) {
      expect(RISK_CATEGORIES).toContain(classifyHeatIndex(value))
    }
    expect(classifyHeatIndex(0)).toBe(RISK_CATEGORIES[0])
    expect(classifyHeatIndex(27)).toBe(RISK_CATEGORIES[1])
    expect(classifyHeatIndex(32)).toBe(RISK_CATEGORIES[2])
    expect(classifyHeatIndex(41)).toBe(RISK_CATEGORIES[3])
    expect(classifyHeatIndex(55)).toBe(RISK_CATEGORIES[4])
    expect(classifyHeatIndex(null).id).toBe('unknown')
    expect(RISK_CATEGORIES.some((category) => category.id === 'unknown')).toBe(false)
  })
})

describe('formatHeatIndex — exibição', () => {
  it('usa uma casa decimal com vírgula pt-BR', () => {
    expect(formatHeatIndex(42.14)).toBe('42,1')
    expect(formatHeatIndex(27)).toBe('27,0')
    expect(formatHeatIndex(-3.26)).toBe('-3,3')
  })

  it('arredonda apenas na exibição, preservando a classificação bruta', () => {
    expect(formatHeatIndex(54.004)).toBe('54,0')
    expect(classifyHeatIndex(54.004).id).toBe('extremeDanger')
    expect(formatHeatIndex(54)).toBe('54,0')
    expect(classifyHeatIndex(54).id).toBe('danger')
  })

  it('retorna "—" para valores ausentes ou inválidos', () => {
    expect(formatHeatIndex(null)).toBe(MISSING_HEAT_INDEX_LABEL)
    expect(formatHeatIndex(undefined)).toBe(MISSING_HEAT_INDEX_LABEL)
    expect(formatHeatIndex(Number.NaN)).toBe(MISSING_HEAT_INDEX_LABEL)
    expect(formatHeatIndex(Number.POSITIVE_INFINITY)).toBe(MISSING_HEAT_INDEX_LABEL)
    expect(MISSING_HEAT_INDEX_LABEL).toBe('—')
  })
})

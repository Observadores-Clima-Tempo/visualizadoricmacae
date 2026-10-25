import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SummaryPanel } from '@/components/summary/SummaryPanel'
import { buildHeatGrid } from '@/domain/heatIndexGrid'
import { computePeriodSummary } from '@/domain/heatIndexSummary'
import type { HeatIndexReading } from '@/domain/heatIndexTypes'

const BAIRRO = 'teste'

function reading(date: string, hour: number, heatIndexC: number): HeatIndexReading {
  return {
    bairroId: BAIRRO,
    date,
    hour,
    heatIndexC,
    temperatureC: 30,
    relativeHumidity: 60,
    readingCount: 1,
  }
}

function renderPanel(readings: HeatIndexReading[], days: string[]) {
  const grid = buildHeatGrid(readings, { days, aggregation: 'mean' })

  return renderToStaticMarkup(<SummaryPanel summary={computePeriodSummary(grid)} />)
}

const FIXTURE_READINGS = [
  reading('2025-01-18', 10, 30),
  reading('2025-01-19', 12, 42),
  reading('2025-01-19', 13, 45),
  reading('2025-01-19', 14, 53.4),
  reading('2025-01-20', 5, 38),
]

const FIXTURE_DAYS = ['2025-01-18', '2025-01-19', '2025-01-20']

describe('SummaryPanel — valores formatados', () => {
  const markup = renderPanel(FIXTURE_READINGS, FIXTURE_DAYS)

  it('renderiza só o título, sem a linha de contexto do período', () => {
    expect(markup).toContain('>Resumo<')
    expect(markup).toContain('id="summary-panel-title"')
    expect(markup).not.toContain('id="heatmap-panel-title"')
    expect(markup).not.toContain('18/01/2025 – 20/01/2025')
    expect(markup).not.toContain('3 dias · Trapiche')
  })

  it('renderiza os quatro títulos dos cartões', () => {
    expect(markup).toContain('IC máximo registrado')
    expect(markup).toContain('Horas em Perigo')
    expect(markup).toContain('Maior período consecutivo em Perigo')
    expect(markup).toContain('Dias com ocorrência de Perigo')
  })

  it('mostra o IC máximo com uma casa decimal e a data/hora', () => {
    expect(markup).toContain('53,4')
    expect(markup).toContain('°C')
    expect(markup).toContain('19/01/2025 às 14h')
  })

  it('mostra a maior sequência com início e fim inclusivos', () => {
    expect(markup).toContain('19/01/2025 · 12h → 14h')
  })

  it('não exibe descrição nos cartões de horas e de dias', () => {
    expect(markup).not.toContain('horas com dados')
    expect(markup).not.toContain('dias com dados')
  })

  it('não emite cores literais no markup', () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('SummaryPanel — sequência entre dias', () => {
  it('exibe as duas datas quando a sequência atravessa a meia-noite', () => {
    const readings = [
      reading('2025-01-23', 22, 42),
      reading('2025-01-23', 23, 43),
      reading('2025-01-24', 0, 44),
      reading('2025-01-24', 1, 44),
      reading('2025-01-24', 2, 44),
      reading('2025-01-24', 3, 44),
      reading('2025-01-24', 4, 44),
      reading('2025-01-24', 5, 45),
      reading('2025-01-24', 6, 46),
    ]
    const days = ['2025-01-23', '2025-01-24']

    const markup = renderPanel(readings, days)

    expect(markup).toContain('23/01 22h → 24/01 6h')
  })
})

describe('SummaryPanel — estado sem dado', () => {
  const markup = renderPanel([], ['2025-01-23', '2025-01-24'])

  it('usa placeholders em vez de inventar valores', () => {
    expect(markup).toContain('Sem dados no período')
    expect(markup).toContain('Nenhuma hora em Perigo no período')
  })

  it('mostra o travessão nos cartões sem medição', () => {
    expect(markup).toContain('>—</p>')
  })
})

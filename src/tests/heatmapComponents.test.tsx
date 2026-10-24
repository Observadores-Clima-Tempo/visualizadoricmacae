import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HeatmapGrid } from '@/components/heatmap/HeatmapGrid'
import { HeatmapPanel } from '@/components/heatmap/HeatmapPanel'
import { buildHeatGrid } from '@/domain/heatIndexGrid'
import type { HeatIndexReading } from '@/domain/heatIndexTypes'

const DAYS = ['2024-12-01', '2024-12-02']

const READINGS: HeatIndexReading[] = [
  {
    bairroId: 'barreto',
    date: '2024-12-01',
    hour: 14,
    heatIndexC: 42.1,
    temperatureC: 33,
    relativeHumidity: 70,
    readingCount: 6,
  },
  {
    bairroId: 'barreto',
    date: '2024-12-01',
    hour: 9,
    heatIndexC: 25.4,
    temperatureC: 26,
    relativeHumidity: 80,
    readingCount: 2,
  },
  {
    bairroId: 'barreto',
    date: '2024-12-02',
    hour: 0,
    heatIndexC: 32.5,
    temperatureC: 28,
    relativeHumidity: 75,
    readingCount: 1,
  },
]

const grid = buildHeatGrid(READINGS, { days: DAYS, aggregation: 'mean' })

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1
}

describe('HeatmapGrid', () => {
  const markup = renderToStaticMarkup(<HeatmapGrid grid={grid} bairroLabel="Barreto" />)

  it('renderiza 24 colunas de horas, a coluna de datas e uma linha por dia', () => {
    expect(countOccurrences(markup, 'scope="col"')).toBe(25)
    expect(countOccurrences(markup, 'scope="row"')).toBe(2)
    expect(countOccurrences(markup, 'data-date=')).toBe(48)
  })

  it('usa rótulos de hora de 0h a 23h', () => {
    expect(markup).toContain('>0h<')
    expect(markup).toContain('>14h<')
    expect(markup).toContain('>23h<')
  })

  it('mostra a data abreviada e o dia da semana na coluna fixa', () => {
    expect(markup).toContain('>01/12<')
    expect(markup).toContain('>dom<')
    expect(markup).toContain('>02/12<')
    expect(markup).toContain('>seg<')
  })

  it('mantém as datas em ordem cronológica', () => {
    expect(markup.indexOf('01/12')).toBeLessThan(markup.indexOf('02/12'))
  })

  it('descreve cada célula no aria-label', () => {
    expect(markup).toContain(
      '01/12/2024, 14 horas, índice de calor 42,1 graus Celsius, Perigo, 6 observações, bairro Barreto',
    )
    expect(markup).toContain('01/12/2024, 0 horas, sem dado, bairro Barreto')
  })

  it('classifica as células pelas faixas canônicas', () => {
    expect(markup).toContain('data-category="danger"')
    expect(markup).toContain('data-category="none"')
    expect(markup).toContain('data-category="extremeCaution"')
    expect(countOccurrences(markup, 'data-category="unknown"')).toBe(45)
  })

  it('exibe o marcador de ausência de dado e nunca a cor de faixa baixa', () => {
    expect(markup).toContain('>—</td>')
  })

  it('descreve o conjunto na caption oculta', () => {
    expect(markup).toContain('Bairro Barreto')
    expect(markup).toContain('de 01/12/2024 a 02/12/2024')
    expect(markup).toContain('2 dias e 24 horas por dia')
  })

  it('não emite cores literais no markup', () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('HeatmapPanel', () => {
  it('renderiza título, subtítulo, ações e rodapé', () => {
    const markup = renderToStaticMarkup(
      <HeatmapPanel actions={<button type="button">Bairro</button>} footer="90 dias">
        <span>grade</span>
      </HeatmapPanel>,
    )

    expect(markup).toContain('Mapa de calor por hora e dia')
    expect(markup).toContain('Índice de calor (°C) no bairro selecionado')
    expect(markup).toContain('>Bairro</button>')
    expect(markup).toContain('>grade<')
    expect(markup).toContain('90 dias')
    expect(markup).toContain('id="heatmap-panel-title"')
  })

  it('não renderiza áreas opcionais quando não recebem conteúdo', () => {
    const markup = renderToStaticMarkup(
      <HeatmapPanel>
        <span>grade</span>
      </HeatmapPanel>,
    )

    expect(markup).not.toContain('<footer')
  })
})

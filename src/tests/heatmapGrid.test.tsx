import { beforeAll, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { HeatmapGrid } from '@/components/heatmap/HeatmapGrid'
import { parseAllSources } from '@/data/csvParser'
import { enumerateIsoDays } from '@/data/normalizeTimestamp'
import { buildHeatGrid, getCell, type HeatGrid } from '@/domain/heatIndexGrid'
import type { BairroReadings } from '@/domain/heatIndexTypes'

/**
 * Testes de renderização da matriz com os CSVs reais de `data/`.
 *
 * Os valores conferidos aqui são os mesmos do checklist manual da Etapa 09
 * (Trapiche 19/01/2025 14h, Cabiunas 05/01/2025) — se um deles mudar, o mapa
 * renderizado deixou de refletir o dado importado.
 */

const V1_DAYS = enumerateIsoDays('2024-12-01', '2025-02-28')

let bairros: BairroReadings[]

function gridFor(label: string): HeatGrid {
  const bairro = bairros.find((item) => item.bairroLabel === label)
  if (!bairro) throw new Error(`Bairro ausente: ${label}`)
  return buildHeatGrid(bairro.readings, { days: V1_DAYS, aggregation: 'mean' })
}

function cellElement(container: HTMLElement, date: string, hour: number): HTMLElement {
  const element = container.querySelector<HTMLElement>(
    `td[data-date="${date}"][data-hour="${hour}"]`,
  )
  if (!element) throw new Error(`Célula ausente: ${date} ${hour}h`)
  return element
}

beforeAll(() => {
  bairros = parseAllSources().bairros
})

describe('HeatmapGrid — estrutura com os dados reais', () => {
  it('renderiza 24 cabeçalhos de hora (0h a 23h) e 90 cabeçalhos de linha', () => {
    const { container } = render(<HeatmapGrid grid={gridFor('Trapiche')} bairroLabel="Trapiche" />)

    const columnHeaders = [...container.querySelectorAll('thead th')]
    expect(columnHeaders).toHaveLength(25)

    const hourHeaders = [...container.querySelectorAll('thead th[data-hour]')]
    expect(hourHeaders.map((header) => header.textContent)).toEqual(
      Array.from({ length: 24 }, (_unused, hour) => `${hour}h`),
    )

    expect(container.querySelectorAll('tbody th')).toHaveLength(90)
    expect(container.querySelectorAll('td[data-date]')).toHaveLength(2160)
  })

  it('exibe o valor e a categoria de Trapiche em 19/01/2025 às 14h', () => {
    const { container } = render(<HeatmapGrid grid={gridFor('Trapiche')} bairroLabel="Trapiche" />)

    const cell = cellElement(container, '2025-01-19', 14)

    expect(cell.textContent).toBe('53,4')
    expect(cell.getAttribute('data-category')).toBe('danger')
  })

  it('descreve a célula com data, hora, valor, categoria e bairro no aria-label', () => {
    const { container } = render(<HeatmapGrid grid={gridFor('Trapiche')} bairroLabel="Trapiche" />)

    const label = cellElement(container, '2025-01-19', 14).getAttribute('aria-label')

    expect(label).toContain('19/01/2025, 14 horas')
    expect(label).toContain('índice de calor 53,4 graus Celsius')
    expect(label).toContain('Perigo')
    expect(label).toContain('bairro Trapiche')
  })

  it('não deixa nenhuma célula de Trapiche na categoria de perigo extremo', () => {
    const { container } = render(<HeatmapGrid grid={gridFor('Trapiche')} bairroLabel="Trapiche" />)

    expect(container.querySelectorAll('td[data-category="extremeDanger"]')).toHaveLength(0)
  })
})

describe('HeatmapGrid — células sem dado', () => {
  it('mostra o marcador de ausência e a categoria unknown', () => {
    const grid = gridFor('Cabiunas')

    // 05/01/2025 só tem leitura válida fora da hora 1 (as demais linhas do
    // arquivo têm IC negativo e são descartadas na importação).
    expect(getCell(grid, '2025-01-05', 1)?.heatIndexC).toBeNull()

    const { container } = render(<HeatmapGrid grid={grid} bairroLabel="Cabiunas" />)
    const cell = cellElement(container, '2025-01-05', 1)

    expect(cell.textContent).toBe('—')
    expect(cell.getAttribute('data-category')).toBe('unknown')
    expect(cell.getAttribute('aria-label')).toBe('05/01/2025, 1 horas, sem dado, bairro Cabiunas')
  })

  it('mantém os dias de janeiro de Mirante na matriz, mesmo vazios', () => {
    const { container } = render(<HeatmapGrid grid={gridFor('Mirante')} bairroLabel="Mirante" />)

    expect(container.querySelectorAll('tbody tr')).toHaveLength(90)
    expect(container.querySelectorAll('td[data-date="2025-01-18"]')).toHaveLength(24)
    expect(
      container.querySelectorAll('td[data-date="2025-01-18"][data-category="unknown"]'),
    ).toHaveLength(24)
  })
})

describe('HeatmapGrid — troca de bairro', () => {
  it('re-renderiza com outra grade e outro rótulo sem quebrar a estrutura', () => {
    const trapiche = gridFor('Trapiche')
    const cabiunas = gridFor('Cabiunas')

    const { container, rerender } = render(
      <HeatmapGrid grid={trapiche} bairroLabel="Trapiche" />,
    )
    expect(cellElement(container, '2025-01-19', 14).textContent).toBe('53,4')

    rerender(<HeatmapGrid grid={cabiunas} bairroLabel="Cabiunas" />)

    expect(container.querySelectorAll('td[data-date]')).toHaveLength(2160)
    expect(container.querySelectorAll('tbody th')).toHaveLength(90)
    expect(container.querySelector('caption')?.textContent).toContain('Bairro Cabiunas')
    expect(cellElement(container, '2025-01-19', 14).textContent).not.toBe('53,4')
    expect(cellElement(container, '2025-01-19', 14).getAttribute('aria-label')).toContain(
      'bairro Cabiunas',
    )
  })

  it('mantém um único ponto de tabulação, reiniciado na primeira célula da nova grade', () => {
    const { container, rerender } = render(
      <HeatmapGrid grid={gridFor('Trapiche')} bairroLabel="Trapiche" />,
    )

    expect(container.querySelectorAll('td[tabindex="0"]')).toHaveLength(1)

    rerender(<HeatmapGrid grid={gridFor('Cabiunas')} bairroLabel="Cabiunas" />)

    const tabStops = [...container.querySelectorAll<HTMLElement>('td[tabindex="0"]')]
    expect(tabStops).toHaveLength(1)
    expect(tabStops[0]?.dataset.date).toBe('2024-12-01')
    expect(tabStops[0]?.dataset.hour).toBe('0')
  })
})

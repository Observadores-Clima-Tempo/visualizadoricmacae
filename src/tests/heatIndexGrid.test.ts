import { beforeAll, describe, expect, it } from 'vitest'

import { parseAllSources } from '@/data/csvParser'
import { enumerateIsoDays } from '@/data/normalizeTimestamp'
import { classifyHeatIndex } from '@/domain/heatIndexCategories'
import type { BairroReadings, HeatIndexReading } from '@/domain/heatIndexTypes'
import {
  GRID_HOURS,
  buildHeatGrid,
  getCell,
  getDayRow,
  type HeatGrid,
} from '@/domain/heatIndexGrid'

const V1_DAYS = enumerateIsoDays('2024-12-01', '2025-02-28')
const TWO_DAYS = ['2025-01-01', '2025-01-02']

function makeReading(
  overrides: Pick<HeatIndexReading, 'bairroId' | 'date' | 'hour' | 'heatIndexC'> &
    Partial<HeatIndexReading>,
): HeatIndexReading {
  return {
    temperatureC: 30,
    relativeHumidity: 60,
    readingCount: 1,
    ...overrides,
  }
}

function rowFor(grid: HeatGrid, date: string) {
  const row = getDayRow(grid, date)
  if (!row) throw new Error(`Linha ausente para ${date}`)
  return row
}

describe('buildHeatGrid — estrutura da grade', () => {
  it('expõe 24 horas, em ordem crescente', () => {
    expect(GRID_HOURS).toEqual(Array.from({ length: 24 }, (_unused, hour) => hour))
  })

  it('mantém todos os dias informados, mesmo sem leitura', () => {
    const grid = buildHeatGrid([], { days: TWO_DAYS, aggregation: 'mean' })

    expect(grid.days).toEqual(TWO_DAYS)
    expect(grid.cells).toHaveLength(2)
    expect(grid.cells[0]).toHaveLength(24)
    expect(grid.cells[0]?.[0]).toEqual({
      date: '2025-01-01',
      hour: 0,
      heatIndexC: null,
      observationCount: 0,
      bairroCount: 0,
    })
    expect(grid.coverage).toEqual({
      totalCells: 48,
      filledCells: 0,
      ratio: 0,
      daysWithData: 0,
      daysWithoutData: 2,
    })
    expect(grid.bairroIds).toEqual([])
  })

  it('ordena e deduplica os dias sem mutar o array recebido', () => {
    const days = ['2025-01-03', '2025-01-01', '2025-01-02', '2025-01-01']
    const snapshot = [...days]

    const grid = buildHeatGrid([], { days, aggregation: 'mean' })

    expect(grid.days).toEqual(['2025-01-01', '2025-01-02', '2025-01-03'])
    expect(days).toEqual(snapshot)
  })

  it('calcula cobertura por célula e por dia', () => {
    const readings = [
      makeReading({ bairroId: 'centro', date: '2025-01-01', hour: 0, heatIndexC: 30 }),
      makeReading({ bairroId: 'centro', date: '2025-01-01', hour: 23, heatIndexC: 31 }),
    ]

    const grid = buildHeatGrid(readings, { days: TWO_DAYS, aggregation: 'mean' })

    expect(grid.coverage).toEqual({
      totalCells: 48,
      filledCells: 2,
      ratio: 2 / 48,
      daysWithData: 1,
      daysWithoutData: 1,
    })
  })

  it('sem dias no período, a cobertura é vazia e a razão é 0', () => {
    const grid = buildHeatGrid([], { days: [], aggregation: 'mean' })

    expect(grid.days).toEqual([])
    expect(grid.cells).toEqual([])
    expect(grid.coverage).toEqual({
      totalCells: 0,
      filledCells: 0,
      ratio: 0,
      daysWithData: 0,
      daysWithoutData: 0,
    })
  })
})

describe('buildHeatGrid — agregação entre bairros', () => {
  const readings = [
    makeReading({ bairroId: 'barreto', date: '2025-01-01', hour: 10, heatIndexC: 30 }),
    makeReading({ bairroId: 'trapiche', date: '2025-01-01', hour: 10, heatIndexC: 40 }),
  ]

  it('mean calcula a média dos IC já calculados de cada bairro', () => {
    const grid = buildHeatGrid(readings, { days: TWO_DAYS, aggregation: 'mean' })
    expect(getCell(grid, '2025-01-01', 10)).toEqual({
      date: '2025-01-01',
      hour: 10,
      heatIndexC: 35,
      observationCount: 2,
      bairroCount: 2,
    })
  })

  it('max retorna o maior valor presente', () => {
    const grid = buildHeatGrid(readings, { days: TWO_DAYS, aggregation: 'max' })
    expect(getCell(grid, '2025-01-01', 10)?.heatIndexC).toBe(40)
  })

  it('nunca recalcula a fórmula da NOAA sobre médias de temperatura/umidade', () => {
    const sameWeather = [
      makeReading({
        bairroId: 'a',
        date: '2025-01-01',
        hour: 10,
        heatIndexC: 30,
        temperatureC: 30,
        relativeHumidity: 60,
      }),
      makeReading({
        bairroId: 'b',
        date: '2025-01-01',
        hour: 10,
        heatIndexC: 42,
        temperatureC: 30,
        relativeHumidity: 60,
      }),
    ]

    const grid = buildHeatGrid(sameWeather, { days: TWO_DAYS, aggregation: 'mean' })
    expect(getCell(grid, '2025-01-01', 10)?.heatIndexC).toBe(36)
  })

  it('conta apenas os bairros com valor na célula', () => {
    const grid = buildHeatGrid(
      [readings[0]!, makeReading({ bairroId: 'trapiche', date: '2025-01-02', hour: 10, heatIndexC: 50 })],
      { days: TWO_DAYS, aggregation: 'max' },
    )

    const cell = getCell(grid, '2025-01-01', 10)
    expect(cell?.bairroCount).toBe(1)
    expect(cell?.observationCount).toBe(1)
    expect(cell?.heatIndexC).toBe(30)
    expect(grid.bairroIds).toEqual(['barreto', 'trapiche'])
  })

  it('soma readingCount das leituras agrupadas', () => {
    const grid = buildHeatGrid(
      [
        makeReading({
          bairroId: 'miramar',
          date: '2025-01-01',
          hour: 9,
          heatIndexC: 26.5,
          readingCount: 2,
        }),
        makeReading({
          bairroId: 'miramar',
          date: '2025-01-01',
          hour: 9,
          heatIndexC: 27,
          readingCount: 3,
        }),
      ],
      { days: TWO_DAYS, aggregation: 'mean' },
    )

    expect(getCell(grid, '2025-01-01', 9)?.observationCount).toBe(5)
    expect(getCell(grid, '2025-01-01', 9)?.bairroCount).toBe(1)
  })
})

describe('buildHeatGrid — ausência de dados', () => {
  it('deixa null nas horas sem leitura, sem interpolar nem usar zero', () => {
    const grid = buildHeatGrid(
      [
        makeReading({ bairroId: 'centro', date: '2025-01-01', hour: 8, heatIndexC: 33 }),
        makeReading({ bairroId: 'centro', date: '2025-01-01', hour: 10, heatIndexC: 35 }),
      ],
      { days: ['2025-01-01'], aggregation: 'mean' },
    )

    const cell = getCell(grid, '2025-01-01', 9)
    expect(cell?.heatIndexC).toBeNull()
    expect(cell?.heatIndexC).not.toBe(0)
    expect(cell?.observationCount).toBe(0)
    expect(cell?.bairroCount).toBe(0)
  })

  it('ignora leituras fora do intervalo de days', () => {
    const grid = buildHeatGrid(
      [
        makeReading({ bairroId: 'centro', date: '2024-12-31', hour: 23, heatIndexC: 30 }),
        makeReading({ bairroId: 'centro', date: '2025-01-01', hour: 0, heatIndexC: 31 }),
      ],
      { days: TWO_DAYS, aggregation: 'mean' },
    )

    expect(grid.coverage.filledCells).toBe(1)
    expect(getCell(grid, '2024-12-31', 23)).toBeUndefined()
    expect(getCell(grid, '2025-01-01', 0)?.heatIndexC).toBe(31)
    expect(grid.bairroIds).toEqual(['centro'])
  })

  it('não muta as leituras recebidas', () => {
    const readings = [
      makeReading({ bairroId: 'centro', date: '2025-01-01', hour: 0, heatIndexC: 30 }),
      makeReading({ bairroId: 'centro', date: '2025-01-01', hour: 1, heatIndexC: 31 }),
    ]
    const snapshot = readings.map((reading) => ({ ...reading }))

    buildHeatGrid(readings, { days: TWO_DAYS, aggregation: 'mean' })

    expect(readings).toEqual(snapshot)
  })

  it('descarta leituras com hora ou índice de calor inválidos', () => {
    const grid = buildHeatGrid(
      [
        makeReading({ bairroId: 'centro', date: '2025-01-01', hour: 24, heatIndexC: 30 }),
        makeReading({ bairroId: 'centro', date: '2025-01-01', hour: -1, heatIndexC: 30 }),
        makeReading({ bairroId: 'centro', date: '2025-01-01', hour: 10.5, heatIndexC: 30 }),
        makeReading({ bairroId: 'centro', date: '2025-01-01', hour: 12, heatIndexC: Number.NaN }),
        makeReading({ bairroId: 'centro', date: '2025-01-01', hour: 13, heatIndexC: 30 }),
      ],
      { days: ['2025-01-01'], aggregation: 'mean' },
    )

    expect(grid.coverage.filledCells).toBe(1)
    expect(getCell(grid, '2025-01-01', 13)?.heatIndexC).toBe(30)
    expect(getCell(grid, '2025-01-01', 12)?.heatIndexC).toBeNull()
    expect(getCell(grid, '2025-01-01', 10)?.heatIndexC).toBeNull()
  })

  it('ignora um readingCount não finito ao somar observações', () => {
    const grid = buildHeatGrid(
      [
        makeReading({
          bairroId: 'centro',
          date: '2025-01-01',
          hour: 8,
          heatIndexC: 30,
          readingCount: Number.NaN,
        }),
      ],
      { days: ['2025-01-01'], aggregation: 'mean' },
    )

    expect(getCell(grid, '2025-01-01', 8)?.observationCount).toBe(0)
  })
})

describe('getCell e getDayRow', () => {
  const grid = buildHeatGrid(
    [makeReading({ bairroId: 'centro', date: '2025-01-02', hour: 5, heatIndexC: 28 })],
    { days: TWO_DAYS, aggregation: 'mean' },
  )

  it('encontra a célula e a linha do dia', () => {
    expect(getCell(grid, '2025-01-02', 5)?.heatIndexC).toBe(28)
    expect(getDayRow(grid, '2025-01-02')).toBe(grid.cells[1])
    expect(getDayRow(grid, '2025-01-02')).toHaveLength(24)
  })

  it('retorna undefined para data ou hora inexistente', () => {
    expect(getCell(grid, '2025-01-03', 5)).toBeUndefined()
    expect(getCell(grid, '2025-01-02', 24)).toBeUndefined()
    expect(getCell(grid, '2025-01-02', -1)).toBeUndefined()
    expect(getCell(grid, '2025-01-02', 5.5)).toBeUndefined()
    expect(getDayRow(grid, '2025-01-03')).toBeUndefined()
  })
})

describe('integração com os CSVs reais de data/', () => {
  let bairros: BairroReadings[]

  beforeAll(() => {
    bairros = parseAllSources().bairros
  })

  function gridFor(label: string, aggregation: 'mean' | 'max' = 'mean'): HeatGrid {
    const bairro = bairros.find((item) => item.bairroLabel === label)
    if (!bairro) throw new Error(`Bairro ausente: ${label}`)
    return buildHeatGrid(bairro.readings, { days: V1_DAYS, aggregation })
  }

  it('monta a grade da V1 com 90 dias × 24 horas', () => {
    const grid = gridFor('Barreto')

    expect(V1_DAYS[0]).toBe('2024-12-01')
    expect(V1_DAYS[V1_DAYS.length - 1]).toBe('2025-02-28')
    expect(grid.days).toHaveLength(90)
    expect(grid.coverage.totalCells).toBe(2160)
    expect(grid.cells.every((row) => row.length === 24)).toBe(true)
    expect(grid.bairroIds).toEqual(['barreto'])
  })

  it('Trapiche em 2025-01-19 às 14h tem 53,40 °C exato e categoria danger', () => {
    const grid = gridFor('Trapiche')
    const cell = getCell(grid, '2025-01-19', 14)

    expect(cell?.heatIndexC).toBe(53.4)
    expect(cell?.observationCount).toBe(1)
    expect(classifyHeatIndex(cell?.heatIndexC).id).toBe('danger')
  })

  it('Cabiunas mantém as linhas de 2025-01-05 e 2025-01-06, com nulos nos horários sem leitura válida', () => {
    // As leituras inválidas do arquivo (IC negativo) não preenchem a célula.
    const grid = gridFor('Cabiunas')
    const jan5 = rowFor(grid, '2025-01-05')
    const jan6 = rowFor(grid, '2025-01-06')

    expect(jan5[0]?.heatIndexC).toBe(22.21)
    expect(jan5[1]?.heatIndexC).toBeNull()
    expect(jan5.slice(6).every((cell) => cell.heatIndexC === null)).toBe(true)
    expect(jan6.slice(0, 12).every((cell) => cell.heatIndexC === null)).toBe(true)
    expect(jan6[12]?.heatIndexC).toBe(31.66)
  })

  it('Mirante preserva dias integralmente nulos de janeiro', () => {
    const grid = gridFor('Mirante')
    const emptyDays = [
      '2025-01-01',
      '2025-01-02',
      '2025-01-18',
      '2025-01-19',
      '2025-01-20',
      '2025-01-21',
      '2025-01-22',
      '2025-01-23',
      '2025-01-24',
      '2025-01-25',
      '2025-01-26',
      '2025-01-27',
    ]

    for (const date of emptyDays) {
      expect(grid.days).toContain(date)
      expect(rowFor(grid, date).every((cell) => cell.heatIndexC === null)).toBe(true)
    }

    expect(grid.coverage.daysWithData).toBe(73)
    expect(grid.coverage.daysWithoutData).toBe(17)
  })

  it('Barreto tem 88 dias com dados', () => {
    expect(gridFor('Barreto').coverage.daysWithData).toBe(88)
  })

  it('Miramar soma leituras duplicadas na observação da célula', () => {
    const grid = gridFor('Miramar')
    const cell = getCell(grid, '2025-01-02', 9)

    expect(cell?.observationCount).toBe(2)
    expect(cell?.bairroCount).toBe(1)
    expect(cell?.heatIndexC).toBe(27.365)
  })

  it('agrega dois bairros reais sem interpolar horas ausentes', () => {
    const barreto = bairros.find((item) => item.bairroLabel === 'Barreto')!
    const trapiche = bairros.find((item) => item.bairroLabel === 'Trapiche')!
    const readings = [...barreto.readings, ...trapiche.readings]

    const meanGrid = buildHeatGrid(readings, { days: V1_DAYS, aggregation: 'mean' })
    const maxGrid = buildHeatGrid(readings, { days: V1_DAYS, aggregation: 'max' })

    expect(meanGrid.bairroIds).toEqual(['barreto', 'trapiche'])

    const meanCell = getCell(meanGrid, '2025-01-19', 14)
    const maxCell = getCell(maxGrid, '2025-01-19', 14)
    const barretoCell = getCell(gridFor('Barreto'), '2025-01-19', 14)
    const trapicheCell = getCell(gridFor('Trapiche'), '2025-01-19', 14)

    const barretoValue = barretoCell?.heatIndexC
    const trapicheValue = trapicheCell?.heatIndexC
    if (barretoValue === null || barretoValue === undefined || trapicheValue === null || trapicheValue === undefined) {
      throw new Error('Esperava valor nos dois bairros em 2025-01-19 14h')
    }

    expect(maxCell?.heatIndexC).toBe(53.4)
    expect(maxCell?.bairroCount).toBe(2)
    expect(meanCell?.bairroCount).toBe(2)
    expect(meanCell?.heatIndexC).toBeCloseTo((barretoValue + trapicheValue) / 2, 10)
  })

  it('não interpola a média quando um dos bairros não tem leitura', () => {
    const mirante = bairros.find((item) => item.bairroLabel === 'Mirante')!
    const trapiche = bairros.find((item) => item.bairroLabel === 'Trapiche')!

    const grid = buildHeatGrid([...mirante.readings, ...trapiche.readings], {
      days: V1_DAYS,
      aggregation: 'mean',
    })

    // 2025-01-18 é um dia inteiro sem dados de Mirante.
    expect(rowFor(gridFor('Mirante'), '2025-01-18').every((cell) => cell.heatIndexC === null)).toBe(true)

    const trapicheCell = getCell(gridFor('Trapiche'), '2025-01-18', 14)
    const cell = getCell(grid, '2025-01-18', 14)

    expect(cell?.bairroCount).toBe(1)
    expect(cell?.heatIndexC).toBe(trapicheCell?.heatIndexC)
  })
})

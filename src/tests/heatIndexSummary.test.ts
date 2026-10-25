import { describe, expect, it } from 'vitest'

import { buildHeatGrid } from '@/domain/heatIndexGrid'
import { computePeriodSummary } from '@/domain/heatIndexSummary'
import { HEAT_INDEX_THRESHOLDS } from '@/domain/heatIndexCategories'
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

function summaryOf(readings: HeatIndexReading[], days: string[]) {
  return computePeriodSummary(buildHeatGrid(readings, { days, aggregation: 'mean' }))
}

describe('computePeriodSummary — grade vazia', () => {
  it('devolve o resumo neutro quando não há dias', () => {
    const summary = summaryOf([], [])

    expect(summary.max).toBeNull()
    expect(summary.dangerHours).toEqual({ count: 0, validHours: 0, ratio: 0 })
    expect(summary.longestDangerStreak).toBeNull()
    expect(summary.dangerDays).toEqual({ count: 0, daysWithData: 0, ratio: 0 })
  })

  it('zera as razões quando os dias existem mas nenhum tem leitura', () => {
    const summary = summaryOf([], ['2025-01-01', '2025-01-02'])

    expect(summary.max).toBeNull()
    expect(summary.dangerHours).toEqual({ count: 0, validHours: 0, ratio: 0 })
    expect(summary.dangerDays).toEqual({ count: 0, daysWithData: 0, ratio: 0 })
    expect(summary.longestDangerStreak).toBeNull()
  })
})

describe('computePeriodSummary — máximo', () => {
  it('escolhe o maior IC entre as células preenchidas', () => {
    const summary = summaryOf(
      [
        reading('2025-01-01', 10, 42),
        reading('2025-01-01', 14, 53.4),
        reading('2025-01-01', 15, 45),
      ],
      ['2025-01-01'],
    )

    expect(summary.max).toEqual({ date: '2025-01-01', hour: 14, value: 53.4 })
  })

  it('resolve empate pela data mais antiga', () => {
    const summary = summaryOf(
      [reading('2025-01-02', 10, 45), reading('2025-01-01', 10, 45)],
      ['2025-01-01', '2025-01-02'],
    )

    expect(summary.max).toEqual({ date: '2025-01-01', hour: 10, value: 45 })
  })

  it('resolve empate no mesmo dia pela hora menor', () => {
    const summary = summaryOf(
      [reading('2025-01-01', 10, 45), reading('2025-01-01', 9, 45)],
      ['2025-01-01'],
    )

    expect(summary.max).toEqual({ date: '2025-01-01', hour: 9, value: 45 })
  })

  it('ignora células sem leitura', () => {
    const summary = summaryOf([reading('2025-01-01', 9, 33)], ['2025-01-01'])

    expect(summary.max).toEqual({ date: '2025-01-01', hour: 9, value: 33 })
  })
})

describe('computePeriodSummary — limite de Perigo', () => {
  const days = ['2025-01-01']

  it('trata 40,99 como fora de Perigo', () => {
    const summary = summaryOf([reading('2025-01-01', 12, 40.99)], days)

    expect(summary.dangerHours.count).toBe(0)
    expect(summary.longestDangerStreak).toBeNull()
    expect(summary.dangerDays.count).toBe(0)
  })

  it('inclui 41 e 54 em Perigo', () => {
    const summary = summaryOf(
      [reading('2025-01-01', 12, 41), reading('2025-01-01', 13, 54)],
      days,
    )

    expect(HEAT_INDEX_THRESHOLDS.danger).toBe(41)
    expect(summary.dangerHours.count).toBe(2)
  })

  it('inclui Perigo Extremo (54,004) na contagem de Perigo', () => {
    const summary = summaryOf([reading('2025-01-01', 12, 54.004)], days)

    expect(summary.dangerHours.count).toBe(1)
    expect(summary.dangerDays.count).toBe(1)
  })
})

describe('computePeriodSummary — contagens e razões', () => {
  it('conta horas e dias em Perigo e usa a cobertura como denominador', () => {
    const summary = summaryOf(
      [
        reading('2025-01-01', 10, 41),
        reading('2025-01-01', 11, 42),
        reading('2025-01-02', 5, 43),
        reading('2025-01-02', 6, 20),
        reading('2025-01-03', 7, 21),
      ],
      ['2025-01-01', '2025-01-02', '2025-01-03'],
    )

    expect(summary.dangerHours).toEqual({ count: 3, validHours: 5, ratio: 3 / 5 })
    expect(summary.dangerDays).toEqual({ count: 2, daysWithData: 3, ratio: 2 / 3 })
  })

  it('não conta lacunas como hora válida nem como dia com dados', () => {
    const summary = summaryOf(
      [reading('2025-01-01', 10, 42), reading('2025-01-02', 11, 30)],
      ['2025-01-01', '2025-01-02'],
    )

    expect(summary.dangerHours.validHours).toBe(2)
    expect(summary.dangerDays.daysWithData).toBe(2)
    expect(summary.dangerDays.count).toBe(1)
  })
})

describe('computePeriodSummary — maior sequência em Perigo', () => {
  it('devolve sequência de uma hora com início e fim iguais', () => {
    const summary = summaryOf([reading('2025-01-01', 14, 45)], ['2025-01-01'])

    expect(summary.longestDangerStreak).toEqual({
      hours: 1,
      start: { date: '2025-01-01', hour: 14 },
      end: { date: '2025-01-01', hour: 14 },
    })
  })

  it('emenda 23h de um dia com 0h do dia seguinte', () => {
    const summary = summaryOf(
      [reading('2025-01-01', 23, 42), reading('2025-01-02', 0, 43)],
      ['2025-01-01', '2025-01-02'],
    )

    expect(summary.longestDangerStreak).toEqual({
      hours: 2,
      start: { date: '2025-01-01', hour: 23 },
      end: { date: '2025-01-02', hour: 0 },
    })
  })

  it('marca o fim da sequência como inclusivo', () => {
    const summary = summaryOf(
      [
        reading('2025-01-01', 10, 42),
        reading('2025-01-01', 11, 43),
        reading('2025-01-01', 12, 44),
      ],
      ['2025-01-01'],
    )

    expect(summary.longestDangerStreak).toEqual({
      hours: 3,
      start: { date: '2025-01-01', hour: 10 },
      end: { date: '2025-01-01', hour: 12 },
    })
  })

  it('quebra a sequência em uma célula sem leitura', () => {
    const summary = summaryOf(
      [reading('2025-01-01', 10, 42), reading('2025-01-01', 12, 42)],
      ['2025-01-01'],
    )

    expect(summary.longestDangerStreak).toEqual({
      hours: 1,
      start: { date: '2025-01-01', hour: 10 },
      end: { date: '2025-01-01', hour: 10 },
    })
  })

  it('quebra a sequência em uma célula abaixo de 41', () => {
    const summary = summaryOf(
      [
        reading('2025-01-01', 10, 42),
        reading('2025-01-01', 11, 40.99),
        reading('2025-01-01', 12, 42),
      ],
      ['2025-01-01'],
    )

    expect(summary.longestDangerStreak).toEqual({
      hours: 1,
      start: { date: '2025-01-01', hour: 10 },
      end: { date: '2025-01-01', hour: 10 },
    })
  })

  it('em empate, mantém a sequência mais antiga', () => {
    const summary = summaryOf(
      [
        reading('2025-01-01', 10, 42),
        reading('2025-01-01', 11, 43),
        reading('2025-01-02', 10, 44),
        reading('2025-01-02', 11, 45),
      ],
      ['2025-01-01', '2025-01-02'],
    )

    expect(summary.longestDangerStreak).toEqual({
      hours: 2,
      start: { date: '2025-01-01', hour: 10 },
      end: { date: '2025-01-01', hour: 11 },
    })
  })

  it('não emenda células de dias não consecutivos na grade', () => {
    const summary = summaryOf(
      [reading('2025-01-01', 23, 42), reading('2025-01-03', 0, 43)],
      ['2025-01-01', '2025-01-03'],
    )

    expect(summary.longestDangerStreak?.hours).toBe(1)
  })
})

import { describe, expect, it } from 'vitest'

import { buildHourlyProfile, findProfilePeak } from '@/domain/heatIndexAggregations'
import { buildHeatGrid } from '@/domain/heatIndexGrid'
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

function profileOf(readings: HeatIndexReading[], days: string[]) {
  return buildHourlyProfile(buildHeatGrid(readings, { days, aggregation: 'mean' }))
}

/** Uma leitura por hora, em um único dia — grade completa de 24 células. */
function fullDay(date: string, valueAt: (hour: number) => number): HeatIndexReading[] {
  return Array.from({ length: 24 }, (_unused, hour) => reading(date, hour, valueAt(hour)))
}

describe('buildHourlyProfile — série de 24 pontos', () => {
  it('devolve uma entrada por hora, de 0 a 23, em ordem', () => {
    const profile = profileOf(fullDay('2025-01-01', () => 30), ['2025-01-01'])

    expect(profile).toHaveLength(24)
    expect(profile.map((point) => point.hour)).toEqual(
      Array.from({ length: 24 }, (_unused, hour) => hour),
    )
  })

  it('todas as horas da grade completa têm média e um dia usado', () => {
    const profile = profileOf(fullDay('2025-01-01', () => 30), ['2025-01-01'])

    for (const point of profile) {
      expect(point.average).toBe(30)
      expect(point.daysUsed).toBe(1)
    }
  })
})

describe('buildHourlyProfile — média por hora', () => {
  it('calcula a média apenas sobre os dias com valor válido naquela hora', () => {
    const profile = profileOf(
      [
        reading('2025-01-01', 14, 40),
        reading('2025-01-02', 14, 44),
        reading('2025-01-03', 14, 45),
        // A hora 15 só tem dois dias: 30 e 31 → 30,5 (nunca dividido por 3).
        reading('2025-01-01', 15, 30),
        reading('2025-01-02', 15, 31),
      ],
      ['2025-01-01', '2025-01-02', '2025-01-03'],
    )

    expect(profile[14]).toEqual({ hour: 14, average: 43, daysUsed: 3 })
    expect(profile[15]).toEqual({ hour: 15, average: 30.5, daysUsed: 2 })
  })

  it('marca a hora sem nenhum dia válido como lacuna, nunca como zero', () => {
    const profile = profileOf([reading('2025-01-01', 9, 28)], ['2025-01-01', '2025-01-02'])

    expect(profile[9]).toEqual({ hour: 9, average: 28, daysUsed: 1 })
    expect(profile[10]).toEqual({ hour: 10, average: null, daysUsed: 0 })
    expect(profile.some((point) => point.average === 0)).toBe(false)
  })

  it('usa a média do dia e hora já consolidada na grade', () => {
    const profile = profileOf(
      [reading('2025-01-01', 12, 33.4), reading('2025-01-01', 12, 34.6)],
      ['2025-01-01'],
    )

    expect(profile[12]).toEqual({ hour: 12, average: 34, daysUsed: 1 })
  })

  it('funciona com um único dia na grade', () => {
    const profile = profileOf(
      [reading('2025-01-01', 3, 26), reading('2025-01-01', 21, 29)],
      ['2025-01-01'],
    )

    expect(profile[3]).toEqual({ hour: 3, average: 26, daysUsed: 1 })
    expect(profile[21]).toEqual({ hour: 21, average: 29, daysUsed: 1 })
    expect(profile[4]).toEqual({ hour: 4, average: null, daysUsed: 0 })
  })

  it('não inventa valores quando a grade não tem leitura alguma', () => {
    const profile = profileOf([], ['2025-01-01', '2025-01-02'])

    expect(profile).toHaveLength(24)
    expect(profile.every((point) => point.average === null && point.daysUsed === 0)).toBe(true)
  })
})

describe('findProfilePeak', () => {
  it('devolve a hora e a média de maior valor', () => {
    const profile = profileOf(
      fullDay('2025-01-01', (hour) => (hour === 14 ? 38.25 : 30 + hour / 10)),
      ['2025-01-01'],
    )

    expect(findProfilePeak(profile)).toEqual({ hour: 14, average: 38.25 })
  })

  it('resolve empate pela primeira hora', () => {
    const profile = profileOf(
      [
        reading('2025-01-01', 13, 41),
        reading('2025-01-01', 15, 41),
        reading('2025-01-01', 16, 39),
      ],
      ['2025-01-01'],
    )

    expect(findProfilePeak(profile)).toEqual({ hour: 13, average: 41 })
  })

  it('devolve null quando todos os pontos são nulos', () => {
    expect(findProfilePeak(profileOf([], ['2025-01-01']))).toBeNull()
  })

  it('ignora as lacunas ao procurar o pico', () => {
    const profile = profileOf(
      [reading('2025-01-01', 2, 25), reading('2025-01-01', 18, 36)],
      ['2025-01-01', '2025-01-02'],
    )

    expect(findProfilePeak(profile)).toEqual({ hour: 18, average: 36 })
  })
})

/**
 * Resumo agregado do período de um bairro.
 *
 * Camada pura: consome apenas a grade pronta (`buildHeatGrid`) e devolve
 * números — sem React, sem rótulos, sem formatação e sem saber qual bairro
 * está ativo. Células sem leitura (`null`) nunca contam como valor, hora em
 * Perigo ou dia com Perigo.
 */

import { HEAT_INDEX_THRESHOLDS } from '@/domain/heatIndexCategories'
import type { HeatGrid } from '@/domain/heatIndexGrid'

export type SummaryMoment = { date: string; hour: number; value: number }

export type DangerHoursSummary = {
  count: number
  validHours: number
  ratio: number
}

export type DangerStreakSummary = {
  hours: number
  start: { date: string; hour: number }
  end: { date: string; hour: number }
}

export type DangerDaysSummary = {
  count: number
  daysWithData: number
  ratio: number
}

export type PeriodSummary = {
  max: SummaryMoment | null
  dangerHours: DangerHoursSummary
  longestDangerStreak: DangerStreakSummary | null
  dangerDays: DangerDaysSummary
}

const HOURS_PER_DAY = 24
const MILLISECONDS_PER_DAY = 86_400_000
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Número de dias civis desde a época, calculado com `Date.UTC` a partir dos
 * componentes de `YYYY-MM-DD` — nunca com `new Date(date)`, que interpretaria
 * a string em UTC e poderia deslocar o dia no fuso local.
 */
function dayNumber(date: string): number {
  const match = ISO_DATE_RE.exec(date)
  if (!match) return Number.NaN

  return (
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / MILLISECONDS_PER_DAY
  )
}

/**
 * Posição da célula na linha do tempo, em horas: dias desde a época × 24 +
 * hora. Duas células são consecutivas quando a diferença entre suas posições
 * é exatamente 1 — assim 23h de um dia e 0h do dia seguinte se emendam.
 */
function timelineSlot(date: string, hour: number): number {
  return dayNumber(date) * HOURS_PER_DAY + hour
}

function ratio(count: number, total: number): number {
  return total === 0 ? 0 : count / total
}

/** Sequência ainda aberta, com a posição da última célula para emendar a próxima. */
type OpenStreak = DangerStreakSummary & { lastSlot: number }

/**
 * Calcula os quatro números do painel de resumo.
 *
 * - `max`: maior IC entre as células preenchidas; empate fica com a data mais
 *   antiga e, depois, com a hora menor (a grade é percorrida em ordem
 *   cronológica e só um valor estritamente maior substitui o atual).
 * - `dangerHours`: horas com IC ≥ `HEAT_INDEX_THRESHOLDS.danger`, incluindo
 *   *Perigo Extremo*.
 * - `longestDangerStreak`: maior sequência consecutiva no tempo de células em
 *   Perigo, com início e fim inclusivos; empate fica com a mais antiga.
 * - `dangerDays`: dias com pelo menos uma célula em Perigo.
 */
export function computePeriodSummary(grid: HeatGrid): PeriodSummary {
  const dangerThreshold = HEAT_INDEX_THRESHOLDS.danger

  let max: SummaryMoment | null = null
  let dangerHoursCount = 0
  let dangerDaysCount = 0

  let openStreak: OpenStreak | null = null
  let longestStreak: DangerStreakSummary | null = null

  grid.days.forEach((date, dayIndex) => {
    const row = grid.cells[dayIndex]
    let dayHasDanger = false

    for (const cell of row) {
      const value = cell.heatIndexC

      if (value === null) {
        openStreak = null
        continue
      }

      if (max === null || value > max.value) {
        max = { date: cell.date, hour: cell.hour, value }
      }

      if (value < dangerThreshold) {
        openStreak = null
        continue
      }

      dangerHoursCount += 1
      dayHasDanger = true

      const slot = timelineSlot(date, cell.hour)
      const moment = { date: cell.date, hour: cell.hour }

      if (openStreak !== null && slot === openStreak.lastSlot + 1) {
        openStreak = {
          hours: openStreak.hours + 1,
          start: openStreak.start,
          end: moment,
          lastSlot: slot,
        }
      } else {
        openStreak = { hours: 1, start: moment, end: moment, lastSlot: slot }
      }

      if (longestStreak === null || openStreak.hours > longestStreak.hours) {
        longestStreak = {
          hours: openStreak.hours,
          start: openStreak.start,
          end: openStreak.end,
        }
      }
    }

    if (dayHasDanger) dangerDaysCount += 1
  })

  const validHours = grid.coverage.filledCells
  const daysWithData = grid.coverage.daysWithData

  return {
    max,
    dangerHours: {
      count: dangerHoursCount,
      validHours,
      ratio: ratio(dangerHoursCount, validHours),
    },
    longestDangerStreak: longestStreak,
    dangerDays: {
      count: dangerDaysCount,
      daysWithData,
      ratio: ratio(dangerDaysCount, daysWithData),
    },
  }
}

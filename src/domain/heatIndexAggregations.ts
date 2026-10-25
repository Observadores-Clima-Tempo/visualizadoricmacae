/**
 * Perfil horário médio do período.
 *
 * Camada pura: consome apenas a grade pronta (`buildHeatGrid`) e devolve
 * números — sem React, sem rótulos e sem formatação. Hora sem nenhum dia
 * válido vira `average: null` (lacuna explícita), nunca zero: o gráfico
 * interrompe a linha em vez de inventar um valor.
 *
 * A média é sempre calculada sobre o IC que já aparece na matriz (o valor do
 * único bairro ativo), nunca sobre temperatura ou umidade.
 */

import { GRID_HOURS, type HeatGrid } from '@/domain/heatIndexGrid'

export type HourlyProfilePoint = {
  hour: number // 0..23
  average: number | null // média das células preenchidas naquela hora
  daysUsed: number // dias com valor válido naquela hora
}

const HOURS_PER_DAY = GRID_HOURS.length

/**
 * Série de exatamente 24 pontos, um por hora de `0` a `23`.
 *
 * Para cada hora, a média considera apenas os dias com valor válido naquela
 * hora, e `daysUsed` é essa contagem. Hora sem nenhum dia válido devolve
 * `average: null` e `daysUsed: 0`.
 */
export function buildHourlyProfile(grid: HeatGrid): HourlyProfilePoint[] {
  const sums = new Array<number>(HOURS_PER_DAY).fill(0)
  const counts = new Array<number>(HOURS_PER_DAY).fill(0)

  for (const row of grid.cells) {
    for (const cell of row) {
      const value = cell.heatIndexC
      if (value === null || !Number.isFinite(value)) continue
      if (!Number.isInteger(cell.hour) || cell.hour < 0 || cell.hour >= HOURS_PER_DAY) continue

      sums[cell.hour] += value
      counts[cell.hour] += 1
    }
  }

  return GRID_HOURS.map((hour) => {
    const daysUsed = counts[hour]

    return {
      hour,
      average: daysUsed === 0 ? null : sums[hour] / daysUsed,
      daysUsed,
    }
  })
}

/**
 * Hora de maior média do perfil.
 *
 * Devolve `null` quando todos os pontos são nulos; em caso de empate, fica com
 * a primeira hora (só um valor estritamente maior substitui o atual).
 */
export function findProfilePeak(
  profile: readonly HourlyProfilePoint[],
): { hour: number; average: number } | null {
  let peak: { hour: number; average: number } | null = null

  for (const point of profile) {
    const average = point.average
    if (average === null || !Number.isFinite(average)) continue

    if (peak === null || average > peak.average) {
      peak = { hour: point.hour, average }
    }
  }

  return peak
}

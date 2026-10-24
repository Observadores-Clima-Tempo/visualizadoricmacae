/**
 * Day × hour heat index grid.
 *
 * Pure domain layer: it takes the normalized readings from the import layer
 * and produces the matrix consumed by the heat map and by the V2 summaries.
 * Missing data is never replaced by `0` and is never interpolated — a cell
 * without any valid reading stays `null`.
 */

import type { BairroId, HeatIndexReading } from '@/domain/heatIndexTypes'

export type AggregationMode = 'mean' | 'max'

export type HeatCell = {
  date: string // YYYY-MM-DD
  hour: number // 0-23
  heatIndexC: number | null // null = no data
  observationCount: number // raw readings summed across every bairro
  bairroCount: number // bairros that contributed a value
}

export type HeatGridCoverage = {
  totalCells: number
  filledCells: number
  ratio: number // filledCells / totalCells
  daysWithData: number
  daysWithoutData: number
}

export type HeatGrid = {
  days: string[] // consecutive days, chronological order
  hours: readonly number[] // 0..23
  cells: HeatCell[][] // cells[dayIndex][hour]
  coverage: HeatGridCoverage
  aggregation: AggregationMode
  bairroIds: BairroId[]
}

/** The 24 hour buckets, in ascending order. */
export const GRID_HOURS: readonly number[] = Object.freeze(
  Array.from({ length: 24 }, (_unused, hour) => hour),
)

const HOURS_PER_DAY = GRID_HOURS.length

/** Readings merged into one `(date, hour)` cell, grouped by bairro. */
type BairroBucket = {
  sum: number
  count: number
}

type CellBucket = {
  bairros: Map<BairroId, BairroBucket>
  observationCount: number
}

function isHour(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < HOURS_PER_DAY
}

/**
 * Duplicated days are removed and the result is sorted chronologically. The
 * input array is never mutated.
 */
function normalizeDays(days: readonly string[]): string[] {
  return [...new Set(days)].sort()
}

/**
 * Builds the day × hour grid for the given readings.
 *
 * `options.days` is authoritative: it is always the inclusive, consecutive
 * range supplied by the caller, even when some of those days have no reading.
 * Readings outside that range are ignored.
 */
export function buildHeatGrid(
  readings: HeatIndexReading[],
  options: { days: string[]; aggregation: AggregationMode },
): HeatGrid {
  const days = normalizeDays(options.days)
  const daysInRange = new Set(days)
  const buckets = new Map<string, CellBucket>()
  const contributingBairros = new Set<BairroId>()

  for (const reading of readings) {
    if (!daysInRange.has(reading.date)) continue
    if (!isHour(reading.hour)) continue
    if (typeof reading.heatIndexC !== 'number' || !Number.isFinite(reading.heatIndexC)) continue

    const key = `${reading.date}|${reading.hour}`
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { bairros: new Map(), observationCount: 0 }
      buckets.set(key, bucket)
    }

    contributingBairros.add(reading.bairroId)

    const bairro = bucket.bairros.get(reading.bairroId)
    if (bairro) {
      bairro.sum += reading.heatIndexC
      bairro.count += 1
    } else {
      bucket.bairros.set(reading.bairroId, { sum: reading.heatIndexC, count: 1 })
    }

    bucket.observationCount += Number.isFinite(reading.readingCount) ? reading.readingCount : 0
  }

  let filledCells = 0
  let daysWithData = 0

  const cells = days.map((date) => {
    let dayHasData = false

    const row = GRID_HOURS.map((hour) => {
      const bucket = buckets.get(`${date}|${hour}`)
      if (!bucket || bucket.bairros.size === 0) {
        return {
          date,
          hour,
          heatIndexC: null,
          observationCount: 0,
          bairroCount: 0,
        } satisfies HeatCell
      }

      let value: number | null = null
      for (const bairro of bucket.bairros.values()) {
        // Readings are already hourly means; a bairro contributes a single
        // value per cell, so the NOAA formula is never recomputed here.
        const bairroValue = bairro.sum / bairro.count
        if (value === null) {
          value = bairroValue
        } else if (options.aggregation === 'max') {
          value = Math.max(value, bairroValue)
        } else {
          value += bairroValue
        }
      }

      if (value !== null && options.aggregation === 'mean') {
        value /= bucket.bairros.size
      }

      filledCells += 1
      dayHasData = true

      return {
        date,
        hour,
        heatIndexC: value,
        observationCount: bucket.observationCount,
        bairroCount: bucket.bairros.size,
      } satisfies HeatCell
    })

    if (dayHasData) daysWithData += 1
    return row
  })

  const totalCells = days.length * HOURS_PER_DAY

  return {
    days,
    hours: GRID_HOURS,
    cells,
    coverage: {
      totalCells,
      filledCells,
      ratio: totalCells === 0 ? 0 : filledCells / totalCells,
      daysWithData,
      daysWithoutData: days.length - daysWithData,
    },
    aggregation: options.aggregation,
    bairroIds: [...contributingBairros].sort(),
  }
}

/** Returns the cell for a `(date, hour)` pair, or `undefined` when absent. */
export function getCell(grid: HeatGrid, date: string, hour: number): HeatCell | undefined {
  if (!isHour(hour)) return undefined
  const dayIndex = grid.days.indexOf(date)
  if (dayIndex === -1) return undefined
  return grid.cells[dayIndex]?.[hour]
}

/** Returns the 24 cells of a day, or `undefined` when the day is not in the grid. */
export function getDayRow(grid: HeatGrid, date: string): HeatCell[] | undefined {
  const dayIndex = grid.days.indexOf(date)
  if (dayIndex === -1) return undefined
  return grid.cells[dayIndex]
}

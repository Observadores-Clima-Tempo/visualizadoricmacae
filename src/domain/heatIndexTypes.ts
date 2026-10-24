/**
 * Domain model of the heat index visualizer.
 *
 * Only normalized values live here: no CSV column names, no Fahrenheit
 * columns, no `IC Ajustado` / `Diferença` fields. Every consumer outside
 * `src/data/` must depend exclusively on these types.
 */

export type BairroId = string

export type TimestampParts = {
  year: number
  month: number // 1-12
  day: number // 1-31
  hour: number // 0-23
  minute: number // 0-59
  second: number // 0-59
}

export type HeatIndexReading = {
  bairroId: BairroId
  /** Local Macaé calendar day, `YYYY-MM-DD`, already rounded to the hour bucket. */
  date: string
  /** Hour bucket, 0-23. */
  hour: number
  /** Hourly mean of the valid readings, keeping the original precision. */
  heatIndexC: number
  temperatureC: number | null
  relativeHumidity: number | null
  /** How many raw readings were merged into this value. */
  readingCount: number
}

export type BairroReadings = {
  bairroId: BairroId
  bairroLabel: string
  readings: HeatIndexReading[]
}

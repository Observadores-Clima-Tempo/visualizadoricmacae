import Papa from 'papaparse'

import type { BairroId, BairroReadings, HeatIndexReading } from '@/domain/heatIndexTypes'
import { listSources, type CsvSource } from '@/data/csvSources'
import { matchTimestamp, parseFiniteNumber, toHourBucket } from '@/data/normalizeTimestamp'

/**
 * CSV import layer. This module is the only place allowed to know the column
 * names of the source files; everything outside `src/data/` consumes the
 * normalized `HeatIndexReading` model.
 */

/** Normalized header names used to resolve columns by name (never by index). */
export const CSV_COLUMNS = {
  date: 'date',
  time: 'time',
  heatIndex: 'ic (c°)',
  temperature: 'temp (c)',
  humidity: 'ur (%)',
} as const

const REQUIRED_COLUMNS = [CSV_COLUMNS.date, CSV_COLUMNS.heatIndex] as const

/** Detailed issues are capped per file so a broken export cannot bloat memory. */
export const MAX_ISSUES_PER_FILE = 20

export type ImportIssueReason =
  | 'invalid_timestamp'
  | 'missing_heat_index'
  | 'non_numeric_heat_index'
  | 'non_positive_heat_index'
  | 'missing_temperature_or_humidity'

export const IMPORT_ISSUE_REASONS: readonly ImportIssueReason[] = [
  'invalid_timestamp',
  'missing_heat_index',
  'non_numeric_heat_index',
  'non_positive_heat_index',
  'missing_temperature_or_humidity',
]

export type ImportIssue = {
  bairroId: BairroId
  /** 1-based line number inside the file, header included. */
  row: number
  reason: ImportIssueReason
  raw: string
}

export type ImportReport = {
  bairroId: BairroId
  bairroLabel: string
  rows: number
  accepted: number
  readings: number
  rejected: number
  rejectedByReason: Record<ImportIssueReason, number>
  detectedFormats: string[]
  firstDate: string | null
  lastDate: string | null
  distinctDays: number
  duplicateHours: number
}

export type ParseAllSourcesResult = {
  bairros: BairroReadings[]
  reports: ImportReport[]
  totalRejected: number
}

export type ParseStationResult = {
  readings: HeatIndexReading[]
  report: ImportReport
  issues: ImportIssue[]
}

/** Thrown when the file does not provide the mandatory columns. */
export class CsvHeaderError extends Error {
  readonly missingColumns: string[]
  readonly foundColumns: string[]

  constructor(bairroLabel: string, missingColumns: string[], foundColumns: string[]) {
    super(
      `Cabeçalho inválido em ${bairroLabel}. Colunas ausentes: ${missingColumns
        .map((column) => `"${column}"`)
        .join(', ')}. Colunas encontradas: ${
        foundColumns.length > 0 ? foundColumns.map((column) => `"${column}"`).join(', ') : '(nenhuma)'
      }.`,
    )
    this.name = 'CsvHeaderError'
    this.missingColumns = missingColumns
    this.foundColumns = foundColumns
  }
}

/** Removes BOM, trims, normalizes Unicode, collapses spaces and lowercases. */
export function normalizeHeader(header: string): string {
  return (header ?? '')
    .replace(/^\uFEFF/, '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

type HourBucket = {
  date: string
  hour: number
  count: number
  heatIndexSum: number
  temperatureSum: number
  temperatureCount: number
  humiditySum: number
  humidityCount: number
}

function rawExcerpt(row: Record<string, string | undefined>): string {
  const text = Object.values(row)
    .map((value) => (value ?? '').trim())
    .join(' | ')
  return text.length > 160 ? `${text.slice(0, 157)}…` : text
}

function emptyRejectedByReason(): Record<ImportIssueReason, number> {
  return {
    invalid_timestamp: 0,
    missing_heat_index: 0,
    non_numeric_heat_index: 0,
    non_positive_heat_index: 0,
    missing_temperature_or_humidity: 0,
  }
}

/**
 * Parses one station file: validates every row, drops the invalid ones and
 * merges the valid readings that land on the same `(date, hour)` bucket.
 */
export function parseStationCsv(source: CsvSource): ParseStationResult {
  const parsed = Papa.parse<Record<string, string | undefined>>(source.content, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    transformHeader: normalizeHeader,
  })

  const fields = parsed.meta.fields ?? []
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !fields.includes(column))
  if (missingColumns.length > 0) {
    throw new CsvHeaderError(source.bairroLabel, missingColumns, fields)
  }

  const hasTime = fields.includes(CSV_COLUMNS.time)
  const hasTemperature = fields.includes(CSV_COLUMNS.temperature)
  const hasHumidity = fields.includes(CSV_COLUMNS.humidity)

  const rows = parsed.data
  const rejectedByReason = emptyRejectedByReason()
  const detectedFormats = new Set<string>()
  const issues: ImportIssue[] = []
  const buckets = new Map<string, HourBucket>()

  let accepted = 0
  let rejected = 0

  const reject = (row: number, reason: ImportIssueReason, raw: string): void => {
    rejected += 1
    rejectedByReason[reason] += 1
    if (issues.length < MAX_ISSUES_PER_FILE) {
      issues.push({ bairroId: source.bairroId, row, reason, raw })
    }
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? {}
    const lineNumber = index + 2 // +1 for the header, +1 for 1-based lines

    const match = matchTimestamp(row[CSV_COLUMNS.date] ?? '', hasTime ? row[CSV_COLUMNS.time] : undefined)
    if (!match) {
      reject(lineNumber, 'invalid_timestamp', rawExcerpt(row))
      continue
    }

    const rawHeatIndex = (row[CSV_COLUMNS.heatIndex] ?? '').trim()
    if (rawHeatIndex === '') {
      reject(lineNumber, 'missing_heat_index', rawExcerpt(row))
      continue
    }

    const heatIndex = parseFiniteNumber(rawHeatIndex)
    if (heatIndex === null) {
      reject(lineNumber, 'non_numeric_heat_index', rawExcerpt(row))
      continue
    }

    if (heatIndex <= 0) {
      reject(lineNumber, 'non_positive_heat_index', rawExcerpt(row))
      continue
    }

    const rawTemperature = hasTemperature ? (row[CSV_COLUMNS.temperature] ?? '').trim() : null
    const rawHumidity = hasHumidity ? (row[CSV_COLUMNS.humidity] ?? '').trim() : null
    if ((rawTemperature !== null && rawTemperature === '') || (rawHumidity !== null && rawHumidity === '')) {
      reject(lineNumber, 'missing_temperature_or_humidity', rawExcerpt(row))
      continue
    }

    const temperatureC = rawTemperature === null ? null : parseFiniteNumber(rawTemperature)
    const relativeHumidity = rawHumidity === null ? null : parseFiniteNumber(rawHumidity)

    accepted += 1
    detectedFormats.add(match.format)

    const { date, hour } = toHourBucket(match.parts)
    const key = `${date}#${hour}`
    const bucket = buckets.get(key)

    if (bucket) {
      bucket.count += 1
      bucket.heatIndexSum += heatIndex
      if (temperatureC !== null) {
        bucket.temperatureSum += temperatureC
        bucket.temperatureCount += 1
      }
      if (relativeHumidity !== null) {
        bucket.humiditySum += relativeHumidity
        bucket.humidityCount += 1
      }
      continue
    }

    buckets.set(key, {
      date,
      hour,
      count: 1,
      heatIndexSum: heatIndex,
      temperatureSum: temperatureC ?? 0,
      temperatureCount: temperatureC === null ? 0 : 1,
      humiditySum: relativeHumidity ?? 0,
      humidityCount: relativeHumidity === null ? 0 : 1,
    })
  }

  let duplicateHours = 0
  const readings: HeatIndexReading[] = []

  for (const bucket of buckets.values()) {
    if (bucket.count > 1) duplicateHours += 1
    readings.push({
      bairroId: source.bairroId,
      date: bucket.date,
      hour: bucket.hour,
      heatIndexC: bucket.heatIndexSum / bucket.count,
      temperatureC: bucket.temperatureCount > 0 ? bucket.temperatureSum / bucket.temperatureCount : null,
      relativeHumidity: bucket.humidityCount > 0 ? bucket.humiditySum / bucket.humidityCount : null,
      readingCount: bucket.count,
    })
  }

  readings.sort((a, b) => (a.date === b.date ? a.hour - b.hour : a.date < b.date ? -1 : 1))

  const report: ImportReport = {
    bairroId: source.bairroId,
    bairroLabel: source.bairroLabel,
    rows: rows.length,
    accepted,
    readings: readings.length,
    rejected,
    rejectedByReason,
    detectedFormats: [...detectedFormats].sort(),
    firstDate: readings[0]?.date ?? null,
    lastDate: readings[readings.length - 1]?.date ?? null,
    distinctDays: new Set(readings.map((reading) => reading.date)).size,
    duplicateHours,
  }

  return { readings, report, issues }
}

/**
 * Imports every bundled CSV. Files with an invalid header are skipped with a
 * warning instead of breaking the application.
 */
export function parseAllSources(): ParseAllSourcesResult {
  const bairros: BairroReadings[] = []
  const reports: ImportReport[] = []
  let totalRejected = 0

  for (const source of listSources()) {
    try {
      const { readings, report } = parseStationCsv(source)
      bairros.push({ bairroId: source.bairroId, bairroLabel: source.bairroLabel, readings })
      reports.push(report)
      totalRejected += report.rejected
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[csvParser] Arquivo ignorado (${source.path}): ${message}`)
    }
  }

  return { bairros, reports, totalRejected }
}

import type { TimestampParts } from '@/domain/heatIndexTypes'

/**
 * Timestamp handling for the import layer.
 *
 * Everything here works with *civil* components: the values in the CSVs are
 * local Macaé wall-clock times and must never be shifted by a time zone.
 * `Date` is therefore never constructed from a string, and `toISOString()` is
 * never used.
 */

/** Minutes at or above this value roll the reading into the next hour. */
export const HOUR_ROUNDING_MINUTE = 40

export type TimestampFormat =
  | 'yyyy-mm-dd + time'
  | 'yyyy-mm-dd'
  | 'dd-mmm-yyyy hh:mm'
  | 'dd/mm/yyyy hh:mm'
  | 'yyyy-mm-ddthh:mm'

export type TimestampMatch = {
  parts: TimestampParts
  format: TimestampFormat
}

const MONTHS_PT: Readonly<Record<string, number>> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
const ABBREV_DATE_RE = /^(\d{1,2})-([\p{L}]{3,20})-(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/u
const SLASH_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
const ISO_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?$/

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29
  return DAYS_IN_MONTH[month - 1] ?? 0
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0')
}

function optionalNumber(value: string | undefined): number {
  return value === undefined || value === '' ? 0 : Number(value)
}

/** Two digit years are read as `20xx`. */
function normalizeYear(year: number): number {
  return year < 100 ? 2000 + year : year
}

function buildParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): TimestampParts | null {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return null
  if (!Number.isInteger(month) || month < 1 || month > 12) return null
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) return null
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null
  if (!Number.isInteger(second) || second < 0 || second > 59) return null
  return { year, month, day, hour, minute, second }
}

/**
 * Parses a timestamp and reports which input shape was recognised, trying the
 * supported formats in order. Returns `null` when nothing matches or when the
 * components fall outside their valid ranges.
 */
export function matchTimestamp(dateText: string, timeText?: string): TimestampMatch | null {
  const date = (dateText ?? '').trim()
  const time = (timeText ?? '').trim()
  if (date === '') return null

  // 1. `YYYY-MM-DD` in the date column (+ `H:MM` / `HH:MM` / `HH:MM:SS` in `Time`)
  const isoDate = ISO_DATE_RE.exec(date)
  if (isoDate) {
    const year = Number(isoDate[1])
    const month = Number(isoDate[2])
    const day = Number(isoDate[3])

    if (time === '') {
      const parts = buildParts(year, month, day, 0, 0, 0)
      return parts ? { parts, format: 'yyyy-mm-dd' } : null
    }

    const timeMatch = TIME_RE.exec(time)
    if (!timeMatch) return null
    const parts = buildParts(
      year,
      month,
      day,
      Number(timeMatch[1]),
      Number(timeMatch[2]),
      optionalNumber(timeMatch[3]),
    )
    return parts ? { parts, format: 'yyyy-mm-dd + time' } : null
  }

  // 2. `DD-MMM-YYYY HH:MM` with a lowercase Portuguese month abbreviation
  const abbrev = ABBREV_DATE_RE.exec(date)
  if (abbrev) {
    const month = MONTHS_PT[abbrev[2].toLowerCase()]
    if (month === undefined) return null
    const parts = buildParts(
      normalizeYear(Number(abbrev[3])),
      month,
      Number(abbrev[1]),
      optionalNumber(abbrev[4]),
      optionalNumber(abbrev[5]),
      optionalNumber(abbrev[6]),
    )
    return parts ? { parts, format: 'dd-mmm-yyyy hh:mm' } : null
  }

  // 3. `DD/MM/YYYY HH:MM(:SS)`
  const slash = SLASH_DATE_RE.exec(date)
  if (slash) {
    const parts = buildParts(
      normalizeYear(Number(slash[3])),
      Number(slash[2]),
      Number(slash[1]),
      optionalNumber(slash[4]),
      optionalNumber(slash[5]),
      optionalNumber(slash[6]),
    )
    return parts ? { parts, format: 'dd/mm/yyyy hh:mm' } : null
  }

  // 4. ISO with `T`: `YYYY-MM-DDTHH:MM(:SS)`
  const isoDateTime = ISO_DATETIME_RE.exec(date)
  if (isoDateTime) {
    const parts = buildParts(
      Number(isoDateTime[1]),
      Number(isoDateTime[2]),
      Number(isoDateTime[3]),
      Number(isoDateTime[4]),
      Number(isoDateTime[5]),
      optionalNumber(isoDateTime[6]),
    )
    return parts ? { parts, format: 'yyyy-mm-ddthh:mm' } : null
  }

  return null
}

export function parseTimestamp(dateText: string, timeText?: string): TimestampParts | null {
  return matchTimestamp(dateText, timeText)?.parts ?? null
}

export function formatIsoDate(parts: Pick<TimestampParts, 'year' | 'month' | 'day'>): string {
  return `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}`
}

/** Days since 1970-01-01 for a civil date (Howard Hinnant's algorithm). */
function daysFromCivil(year: number, month: number, day: number): number {
  const adjustedYear = month <= 2 ? year - 1 : year
  const era = Math.floor(adjustedYear / 400)
  const yearOfEra = adjustedYear - era * 400
  const monthIndex = (month + 9) % 12
  const dayOfYear = Math.floor((153 * monthIndex + 2) / 5) + day - 1
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146097 + dayOfEra - 719468
}

function civilFromDays(days: number): { year: number; month: number; day: number } {
  const z = days + 719468
  const era = Math.floor(z / 146097)
  const dayOfEra = z - era * 146097
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) /
      365,
  )
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100))
  const monthIndex = Math.floor((5 * dayOfYear + 2) / 153)
  const day = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1
  const month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0)
  return { year, month, day }
}

function splitIsoDate(isoDate: string): { year: number; month: number; day: number } {
  const match = ISO_DATE_RE.exec(isoDate)
  if (!match) throw new Error(`Invalid ISO date: "${isoDate}"`)
  const parts = buildParts(Number(match[1]), Number(match[2]), Number(match[3]), 0, 0, 0)
  if (!parts) throw new Error(`Invalid ISO date: "${isoDate}"`)
  return { year: parts.year, month: parts.month, day: parts.day }
}

/** Civil day arithmetic on `YYYY-MM-DD` strings, without `Date`. */
export function addDaysIso(isoDate: string, delta: number): string {
  const { year, month, day } = splitIsoDate(isoDate)
  const shifted = civilFromDays(daysFromCivil(year, month, day) + delta)
  return formatIsoDate(shifted)
}

/** Inclusive list of `YYYY-MM-DD` days between two ISO dates. */
export function enumerateIsoDays(startIso: string, endIso: string): string[] {
  const start = splitIsoDate(startIso)
  const end = splitIsoDate(endIso)
  const startDays = daysFromCivil(start.year, start.month, start.day)
  const endDays = daysFromCivil(end.year, end.month, end.day)
  if (endDays < startDays) throw new Error(`End date "${endIso}" is before start date "${startIso}"`)

  const days: string[] = []
  for (let day = startDays; day <= endDays; day += 1) {
    days.push(formatIsoDate(civilFromDays(day)))
  }
  return days
}

/**
 * Hour bucket of a reading: minute `>= 40` moves to the next hour; advancing
 * past 23h moves to hour `0` of the following day.
 */
export function toHourBucket(parts: TimestampParts): { date: string; hour: number } {
  let date = formatIsoDate(parts)
  let hour = parts.hour

  if (parts.minute >= HOUR_ROUNDING_MINUTE) {
    hour += 1
    if (hour >= 24) {
      hour = 0
      date = addDaysIso(date, 1)
    }
  }

  return { date, hour }
}

/** Parses a decimal number using `.` as separator; `null` for anything invalid. */
export function parseFiniteNumber(text: string): number | null {
  const trimmed = (text ?? '').trim()
  if (trimmed === '') return null

  // Tolerate a comma decimal separator (pt-BR exports) without accepting
  // thousand separators such as `1.234,56`.
  const normalized = /^-?\d+,\d+$/.test(trimmed) ? trimmed.replace(',', '.') : trimmed
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null

  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

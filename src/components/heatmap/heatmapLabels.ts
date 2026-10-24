/**
 * Rótulos de data e hora do mapa de calor.
 *
 * As datas chegam do domínio como `YYYY-MM-DD` — dia civil de Macaé — e são
 * formatadas por manipulação de string e `Date.UTC`, nunca por `new Date(date)`
 * nem `toISOString()`, para que nenhum fuso horário desloque o rótulo.
 */

const WEEKDAY_ABBREVIATIONS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

type IsoDateParts = {
  year: number
  month: number
  day: number
  /** 0 = domingo … 6 = sábado. */
  weekday: number
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function parseIsoDate(date: string): IsoDateParts | null {
  const match = ISO_DATE_RE.exec(date)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  return {
    year,
    month,
    day,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  }
}

/** `2024-12-01` -> `01/12` */
export function formatDayMonth(date: string): string {
  const parts = parseIsoDate(date)
  if (!parts) return date
  return `${pad2(parts.day)}/${pad2(parts.month)}`
}

/** `2024-12-01` -> `01/12/2024` */
export function formatFullDate(date: string): string {
  const parts = parseIsoDate(date)
  if (!parts) return date
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`
}

/** `2024-12-01` -> `dom` */
export function formatWeekdayAbbreviation(date: string): string {
  const parts = parseIsoDate(date)
  if (!parts) return ''
  return WEEKDAY_ABBREVIATIONS[parts.weekday] ?? ''
}

/** `2024-12-01` -> `Dom` (usado nas linhas do tooltip). */
export function formatWeekdayShort(date: string): string {
  const abbreviation = formatWeekdayAbbreviation(date)
  if (abbreviation === '') return ''
  return abbreviation.charAt(0).toUpperCase() + abbreviation.slice(1)
}

/** `14` -> `14h` */
export function formatHourLabel(hour: number): string {
  return `${hour}h`
}

import { CalendarDays, Clock, Thermometer, Timer } from 'lucide-react'

import { formatDayMonth, formatFullDate, formatHourLabel } from '@/components/heatmap/heatmapLabels'
import type { DangerStreakSummary, PeriodSummary } from '@/domain/heatIndexSummary'
import { SummaryCard } from './SummaryCard'
import styles from './SummaryPanel.module.css'

/** Id próprio do título: não reutiliza o id do painel do mapa. */
export const SUMMARY_PANEL_TITLE_ID = 'summary-panel-title'

const ONE_DECIMAL = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const INTEGER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

function formatDecimal(value: number): string {
  return ONE_DECIMAL.format(value)
}

function formatInteger(value: number): string {
  return INTEGER.format(value)
}

/** `01/12/2024 – 28/02/2025 · 90 dias · Trapiche` */
function formatContext(days: readonly string[], bairroLabel: string): string {
  const first = days[0]
  const last = days[days.length - 1]
  const period =
    first !== undefined && last !== undefined
      ? `${formatFullDate(first)} – ${formatFullDate(last)}`
      : 'Período indisponível'
  const dayCount = days.length === 1 ? '1 dia' : `${formatInteger(days.length)} dias`

  return `${period} · ${dayCount} · ${bairroLabel}`
}

/** Mesmo dia: `19/01/2025 · 12h → 20h`; entre dias: `23/01 22h → 24/01 06h`. */
function formatStreak(streak: DangerStreakSummary): string {
  const startHour = formatHourLabel(streak.start.hour)
  const endHour = formatHourLabel(streak.end.hour)

  if (streak.start.date === streak.end.date) {
    return `${formatFullDate(streak.start.date)} · ${startHour} → ${endHour}`
  }

  return `${formatDayMonth(streak.start.date)} ${startHour} → ${formatDayMonth(streak.end.date)} ${endHour}`
}

export type SummaryPanelProps = {
  summary: PeriodSummary
  bairroLabel: string
  days: readonly string[]
}

/**
 * Coluna lateral com o resumo do período do bairro ativo.
 *
 * Não calcula nem formata datas: recebe o `PeriodSummary` pronto, os dias que
 * a grade cobre e o rótulo do bairro. Sem botões, filtros ou seletores.
 */
export function SummaryPanel({ summary, bairroLabel, days }: SummaryPanelProps) {
  const { max, dangerHours, longestDangerStreak, dangerDays } = summary

  const hasHours = dangerHours.validHours > 0
  const hasDays = dangerDays.daysWithData > 0

  return (
    <aside className={styles.panel} aria-labelledby={SUMMARY_PANEL_TITLE_ID}>
      <header className={styles.header}>
        <h2 id={SUMMARY_PANEL_TITLE_ID} className={styles.title}>
          Resumo do período
        </h2>
        <p className={styles.context}>{formatContext(days, bairroLabel)}</p>
      </header>

      <div className={styles.cards}>
        <SummaryCard
          icon={<Thermometer size={18} />}
          title="IC máximo registrado"
          value={max === null ? '—' : formatDecimal(max.value)}
          unit={max === null ? undefined : '°C'}
          description={
            max === null
              ? 'Sem dados no período'
              : `${formatFullDate(max.date)} às ${formatHourLabel(max.hour)}`
          }
        />

        <SummaryCard
          icon={<Clock size={18} />}
          title="Horas em Perigo"
          value={hasHours ? formatInteger(dangerHours.count) : '—'}
          unit={hasHours ? 'h' : undefined}
        />

        <SummaryCard
          icon={<Timer size={18} />}
          title="Maior período consecutivo em Perigo"
          value={formatInteger(longestDangerStreak?.hours ?? 0)}
          unit="h"
          description={
            longestDangerStreak === null
              ? 'Nenhuma hora em Perigo no período'
              : formatStreak(longestDangerStreak)
          }
        />

        <SummaryCard
          icon={<CalendarDays size={18} />}
          title="Dias com ocorrência de Perigo"
          value={hasDays ? formatInteger(dangerDays.count) : '—'}
          unit={hasDays ? 'dias' : undefined}
        />
      </div>
    </aside>
  )
}

import { memo } from 'react'
import type { HeatCell } from '@/domain/heatIndexGrid'
import { HeatmapCell } from './HeatmapCell'
import { formatDayMonth, formatFullDate, formatWeekdayAbbreviation } from './heatmapLabels'
import styles from './HeatmapGrid.module.css'

type HeatmapRowProps = {
  /** Dia civil no formato `YYYY-MM-DD`. */
  day: string
  /** As 24 células do dia, já na ordem das horas. */
  cells: HeatCell[]
  bairroLabel: string
}

/**
 * Uma linha da matriz: cabeçalho fixo com a data e as células do dia.
 *
 * `memo` evita que as 90 linhas sejam reprocessadas quando apenas o estado de
 * hover/foco mudar na Etapa 06 — desde que `cells` e `bairroLabel` continuem
 * estáveis entre renders.
 */
export const HeatmapRow = memo(function HeatmapRow({
  day,
  cells,
  bairroLabel,
}: HeatmapRowProps) {
  return (
    <tr className={styles.row}>
      <th scope="row" className={styles.rowHeader} aria-label={formatFullDate(day)}>
        <span className={styles.rowHeaderContent}>
          <span>{formatDayMonth(day)}</span>
          <span className={styles.weekday}>{formatWeekdayAbbreviation(day)}</span>
        </span>
      </th>
      {cells.map((cell) => (
        <HeatmapCell key={cell.hour} cell={cell} bairroLabel={bairroLabel} />
      ))}
    </tr>
  )
})

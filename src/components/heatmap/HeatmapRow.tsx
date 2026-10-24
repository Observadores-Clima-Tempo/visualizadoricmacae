import { memo } from 'react'
import type { HeatCell } from '@/domain/heatIndexGrid'
import { HeatmapCell } from './HeatmapCell'
import { formatFullDate, formatWeekdayAbbreviation } from './heatmapLabels'
import styles from './HeatmapGrid.module.css'

type HeatmapRowProps = {
  /** Dia civil no formato `YYYY-MM-DD`. */
  day: string
  /** As 24 células do dia, já na ordem das horas. */
  cells: HeatCell[]
  bairroLabel: string
  /** Índice 0-based do dia; o cabeçalho de horas ocupa a linha 1 do grid ARIA. */
  rowIndex: number
  /** Hora da célula dona do `tabIndex=0`, ou `null` quando ela está em outra linha. */
  tabStopHour: number | null
}

/**
 * Uma linha da matriz: cabeçalho fixo com a data e as células do dia.
 *
 * `memo` evita que as 90 linhas sejam reprocessadas quando apenas o tooltip ou
 * o destaque de cabeçalhos mudar: só as linhas cujo `tabStopHour` mudou são
 * re-renderizadas pelo roving tabindex.
 */
export const HeatmapRow = memo(function HeatmapRow({
  day,
  cells,
  bairroLabel,
  rowIndex,
  tabStopHour,
}: HeatmapRowProps) {
  return (
    <tr className={styles.row} aria-rowindex={rowIndex + 2}>
      <th
        scope="row"
        className={styles.rowHeader}
        aria-label={formatFullDate(day)}
        aria-colindex={1}
      >
        <span className={styles.rowHeaderContent}>
          <span>{formatFullDate(day)}</span>
          <span className={styles.weekday}>{formatWeekdayAbbreviation(day)}</span>
        </span>
      </th>
      {cells.map((cell, hourIndex) => (
        <HeatmapCell
          key={cell.hour}
          cell={cell}
          bairroLabel={bairroLabel}
          rowIndex={rowIndex}
          colIndex={hourIndex}
          isTabStop={tabStopHour === cell.hour}
        />
      ))}
    </tr>
  )
})

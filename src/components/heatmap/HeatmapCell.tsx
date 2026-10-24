import {
  classifyHeatIndex,
  formatHeatIndex,
  MISSING_HEAT_INDEX_LABEL,
} from '@/domain/heatIndexCategories'
import type { HeatCell } from '@/domain/heatIndexGrid'
import { formatFullDate } from './heatmapLabels'
import styles from './HeatmapGrid.module.css'

type HeatmapCellProps = {
  cell: HeatCell
  bairroLabel: string
  /** Índice 0-based do dia; o cabeçalho de horas ocupa a linha 1 do grid ARIA. */
  rowIndex: number
  /** Índice 0-based da hora; a coluna de datas ocupa a coluna 1 do grid ARIA. */
  colIndex: number
  /** Participa do roving tabindex (`tabIndex=0`); as demais células ficam `-1`. */
  isTabStop: boolean
}

function buildAriaLabel(cell: HeatCell, bairroLabel: string): string {
  const when = `${formatFullDate(cell.date)}, ${cell.hour} horas`
  const place = `bairro ${bairroLabel}`

  if (cell.heatIndexC === null || !Number.isFinite(cell.heatIndexC)) {
    return `${when}, sem dado, ${place}`
  }

  const category = classifyHeatIndex(cell.heatIndexC)
  const parts = [
    when,
    `índice de calor ${formatHeatIndex(cell.heatIndexC)} graus Celsius`,
    category.label,
  ]

  if (cell.observationCount > 0) {
    parts.push(
      cell.observationCount === 1 ? '1 observação' : `${cell.observationCount} observações`,
    )
  }

  parts.push(place)
  return parts.join(', ')
}

/**
 * Uma célula da matriz.
 *
 * O preenchimento vem de `data-category` resolvido no CSS Module: nenhuma cor
 * literal é escolhida aqui. `data-date` e `data-hour` identificam a célula para
 * a delegação de eventos do `useHeatmapInteraction`, sem handlers individuais.
 */
export function HeatmapCell({
  cell,
  bairroLabel,
  rowIndex,
  colIndex,
  isTabStop,
}: HeatmapCellProps) {
  const category = classifyHeatIndex(cell.heatIndexC)
  const hasData = category.id !== 'unknown'

  return (
    <td
      role="gridcell"
      className={styles.cell}
      data-category={category.id}
      data-date={cell.date}
      data-hour={cell.hour}
      aria-rowindex={rowIndex + 2}
      aria-colindex={colIndex + 2}
      aria-label={buildAriaLabel(cell, bairroLabel)}
      tabIndex={isTabStop ? 0 : -1}
    >
      {hasData ? formatHeatIndex(cell.heatIndexC) : MISSING_HEAT_INDEX_LABEL}
    </td>
  )
}

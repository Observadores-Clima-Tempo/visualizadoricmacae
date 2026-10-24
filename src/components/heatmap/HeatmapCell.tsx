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
 * literal é escolhida aqui. `data-date` e `data-hour` deixam a célula pronta
 * para a delegação de eventos da Etapa 06, sem handlers individuais.
 */
export function HeatmapCell({ cell, bairroLabel }: HeatmapCellProps) {
  const category = classifyHeatIndex(cell.heatIndexC)
  const hasData = category.id !== 'unknown'

  return (
    <td
      className={styles.cell}
      data-category={category.id}
      data-date={cell.date}
      data-hour={cell.hour}
      aria-label={buildAriaLabel(cell, bairroLabel)}
    >
      {hasData ? formatHeatIndex(cell.heatIndexC) : MISSING_HEAT_INDEX_LABEL}
    </td>
  )
}

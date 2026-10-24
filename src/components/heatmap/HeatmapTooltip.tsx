import type { RefObject } from 'react'
import {
  classifyHeatIndex,
  formatHeatIndex,
  MISSING_HEAT_INDEX_LABEL,
} from '@/domain/heatIndexCategories'
import type { HeatCell } from '@/domain/heatIndexGrid'
import { formatFullDate, formatHourLabel, formatWeekdayShort } from './heatmapLabels'
import styles from './HeatmapTooltip.module.css'

type HeatmapTooltipProps = {
  cell: HeatCell
  /** Nó posicionado imperativamente por `useHeatmapInteraction`. */
  elementRef: RefObject<HTMLDivElement | null>
}

/**
 * Tooltip único da matriz: data, hora, valor e categoria de risco.
 *
 * É complementar à célula — todo o conteúdo também existe no `aria-label` —,
 * por isso fica `aria-hidden` e nunca captura o ponteiro. A posição vem do hook
 * que o renderiza; aqui só se resolve cor de categoria por `data-category`.
 */
export function HeatmapTooltip({ cell, elementRef }: HeatmapTooltipProps) {
  const category = classifyHeatIndex(cell.heatIndexC)
  const hasData = category.id !== 'unknown'

  return (
    <div ref={elementRef} className={styles.tooltip} role="tooltip" aria-hidden="true">
      <p className={styles.when}>
        {formatWeekdayShort(cell.date)}, {formatFullDate(cell.date)} ·{' '}
        {formatHourLabel(cell.hour)}
      </p>
      <p className={styles.value}>
        {hasData ? `${formatHeatIndex(cell.heatIndexC)} °C` : MISSING_HEAT_INDEX_LABEL}
      </p>
      <p>
        <span className={styles.badge} data-category={category.id}>
          {category.label}
        </span>
      </p>
    </div>
  )
}

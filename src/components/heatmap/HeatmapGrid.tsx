import type { HeatGrid } from '@/domain/heatIndexGrid'
import { HeatmapRow } from './HeatmapRow'
import { HeatmapTooltip } from './HeatmapTooltip'
import { HEATMAP_PANEL_TITLE_ID } from './HeatmapPanel'
import { formatFullDate, formatHourLabel } from './heatmapLabels'
import { useHeatmapInteraction } from './useHeatmapInteraction'
import styles from './HeatmapGrid.module.css'

export type HeatmapGridProps = {
  grid: HeatGrid
  /** Nome do bairro usado nas descrições acessíveis. */
  bairroLabel: string
}

/** Id da `<caption>`: descrição do conjunto, referenciada por `aria-describedby`. */
export const HEATMAP_GRID_CAPTION_ID = 'heatmap-grid-caption'

function buildCaption(grid: HeatGrid, bairroLabel: string): string {
  const firstDay = grid.days[0]
  const lastDay = grid.days[grid.days.length - 1]
  const period =
    firstDay && lastDay
      ? `de ${formatFullDate(firstDay)} a ${formatFullDate(lastDay)}`
      : 'sem dias no período'

  return (
    `Mapa de calor do índice de calor em graus Celsius por hora e dia. ` +
    `Bairro ${bairroLabel}, ${period}, ${grid.days.length} dias e ` +
    `${grid.hours.length} horas por dia.`
  )
}

/**
 * Matriz dias × horas do índice de calor.
 *
 * Tabela nativa com cabeçalho de horas e coluna de datas fixos, rolagem nos
 * dois eixos e células coloridas por categoria de risco. A interação — tooltip
 * único, destaque de linha/coluna e roving tabindex — vem de
 * `useHeatmapInteraction`; nenhuma célula recebe handler próprio.
 */
export function HeatmapGrid({ grid, bairroLabel }: HeatmapGridProps) {
  const { scrollerRef, tableRef, tooltipRef, tooltip, activeCell } = useHeatmapInteraction(grid)

  return (
    <div ref={scrollerRef} className={styles.scroller}>
      <table
        ref={tableRef}
        className={styles.table}
        role="grid"
        aria-labelledby={HEATMAP_PANEL_TITLE_ID}
        aria-describedby={HEATMAP_GRID_CAPTION_ID}
        aria-rowcount={grid.days.length + 1}
        aria-colcount={grid.hours.length + 1}
      >
        <caption id={HEATMAP_GRID_CAPTION_ID} className={styles.caption}>
          {buildCaption(grid, bairroLabel)}
        </caption>
        <thead>
          <tr aria-rowindex={1}>
            <th scope="col" className={styles.cornerCell} aria-colindex={1}>
              Data
            </th>
            {grid.hours.map((hour, hourIndex) => (
              <th
                key={hour}
                scope="col"
                className={styles.hourHeader}
                data-hour={hour}
                aria-colindex={hourIndex + 2}
              >
                {formatHourLabel(hour)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.days.map((day, dayIndex) => (
            <HeatmapRow
              key={day}
              day={day}
              cells={grid.cells[dayIndex]}
              bairroLabel={bairroLabel}
              rowIndex={dayIndex}
              tabStopHour={activeCell.date === day ? activeCell.hour : null}
            />
          ))}
        </tbody>
      </table>
      {tooltip ? (
        <HeatmapTooltip cell={tooltip.cell} bairroLabel={bairroLabel} elementRef={tooltipRef} />
      ) : null}
    </div>
  )
}

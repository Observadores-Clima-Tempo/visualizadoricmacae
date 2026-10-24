import type { HeatCell, HeatGrid } from '@/domain/heatIndexGrid'
import { HeatmapRow } from './HeatmapRow'
import { formatFullDate, formatHourLabel } from './heatmapLabels'
import styles from './HeatmapGrid.module.css'

export type HeatmapGridProps = {
  grid: HeatGrid
  /** Nome do bairro usado nas descrições acessíveis. */
  bairroLabel: string
  /**
   * Reservado para a Etapa 06, quando a interação passa a ser delegada no
   * contêiner de rolagem. Nesta etapa nenhum handler é ligado por célula.
   */
  onCellHover?: (cell: HeatCell) => void
  /** Reservado para a Etapa 06. */
  onCellFocus?: (cell: HeatCell) => void
}

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
 * dois eixos e células coloridas por categoria de risco. A legenda, o tooltip e
 * a navegação por teclado pertencem a etapas posteriores.
 */
export function HeatmapGrid({ grid, bairroLabel }: HeatmapGridProps) {
  return (
    <div className={styles.scroller}>
      <table className={styles.table}>
        <caption className={styles.caption}>{buildCaption(grid, bairroLabel)}</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.cornerCell}>
              Data
            </th>
            {grid.hours.map((hour) => (
              <th
                key={hour}
                scope="col"
                className={styles.hourHeader}
                data-hour={hour}
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
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

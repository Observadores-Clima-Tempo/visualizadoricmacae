import type { ReactNode } from 'react'
import styles from './HeatmapPanel.module.css'

/** Id estável do título, usado como rótulo acessível pela grade. */
export const HEATMAP_PANEL_TITLE_ID = 'heatmap-panel-title'

type HeatmapPanelProps = {
  /** Controle à direita do cabeçalho (seletor de bairro na Etapa 07). */
  actions?: ReactNode
  children: ReactNode
}

/**
 * Cartão branco que envolve o mapa de calor: cabeçalho compacto com o título e
 * as ações, e o corpo ocupando toda a altura restante para a matriz.
 */
export function HeatmapPanel({ actions, children }: HeatmapPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby={HEATMAP_PANEL_TITLE_ID}>
      <header className={styles.header}>
        <h2 id={HEATMAP_PANEL_TITLE_ID} className={styles.title}>
          Mapa de calor por hora e dia
        </h2>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  )
}

import type { ReactNode } from 'react'
import styles from './HeatmapPanel.module.css'

/** Id estável do título, usado como rótulo acessível pela grade. */
export const HEATMAP_PANEL_TITLE_ID = 'heatmap-panel-title'

type HeatmapPanelProps = {
  /** Controle à direita do cabeçalho (seletor de bairro na Etapa 07). */
  actions?: ReactNode
  /** Nota discreta de rodapé (contagens de leituras na Etapa 07). */
  footer?: ReactNode
  children: ReactNode
}

/**
 * Cartão branco que envolve o mapa de calor, com título, subtítulo e áreas
 * reservadas para as ações do cabeçalho e para a nota de rodapé.
 */
export function HeatmapPanel({ actions, footer, children }: HeatmapPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby={HEATMAP_PANEL_TITLE_ID}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={HEATMAP_PANEL_TITLE_ID} className={styles.title}>
            Mapa de calor por hora e dia
          </h2>
          <p className={styles.subtitle}>
            Índice de calor (°C) no bairro selecionado. Compare vários dias e identifique os
            horários de maior risco.
          </p>
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      <div className={styles.body}>{children}</div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </section>
  )
}

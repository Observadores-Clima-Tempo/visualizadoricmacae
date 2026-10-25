import type { ReactNode } from 'react'
import styles from './SummaryCard.module.css'

export type SummaryCardProps = {
  /** Ícone já renderizado; o cartão o envolve em um círculo decorativo. */
  icon: ReactNode
  title: string
  value: string
  unit?: string
  description?: ReactNode
}

/**
 * Cartão de um indicador do resumo: ícone, título discreto, valor em destaque
 * e uma descrição curta. Todos os cartões compartilham altura mínima para
 * alinhar a coluna, e nenhum usa cor de risco como fundo.
 */
export function SummaryCard({ icon, title, value, unit, description }: SummaryCardProps) {
  return (
    <article className={styles.card}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.value}>
          {value}
          {unit ? <span className={styles.unit}>{unit}</span> : null}
        </p>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
    </article>
  )
}

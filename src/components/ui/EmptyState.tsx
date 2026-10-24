import type { ReactNode } from 'react'
import styles from './states.module.css'

export type EmptyStateProps = {
  title: string
  description?: ReactNode
  /** Nota secundária, menor e discreta (ex.: contagem de registros descartados). */
  note?: ReactNode
  action?: ReactNode
}

/** Bloco central de "sem dados". Usado dentro do painel, sem moldura própria. */
export function EmptyState({ title, description, note, action }: EmptyStateProps) {
  return (
    <div className={styles.state} role="status">
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
      {note ? <p className={styles.note}>{note}</p> : null}
    </div>
  )
}

import type { ReactNode } from 'react'
import styles from './states.module.css'

export type ErrorStateProps = {
  title: string
  description?: ReactNode
  actionLabel?: string
  onAction?: () => void
}

/** Bloco de erro de carregamento: cartão próprio, anunciado como `alert`. */
export function ErrorState({ title, description, actionLabel, onAction }: ErrorStateProps) {
  return (
    <div className={`${styles.state} ${styles.surface}`} role="alert">
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
      {actionLabel && onAction ? (
        <div className={styles.action}>
          <button type="button" className={styles.button} onClick={onAction}>
            {actionLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}

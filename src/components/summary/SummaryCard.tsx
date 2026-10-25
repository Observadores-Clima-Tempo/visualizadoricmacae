import type { ReactNode } from 'react'

import styles from './SummaryCard.module.css'

export type SummaryCardProps = {
  title: string
  value: string
  unit?: string
  description?: ReactNode
}

/**
 * Cartão de um indicador do resumo: título discreto, valor em destaque e uma
 * descrição curta. Sem ícone e sem cor de risco no fundo; a altura é ditada
 * pela linha do grid do painel, para que os quatro caibam sem rolagem.
 */
export function SummaryCard({ title, value, unit, description }: SummaryCardProps) {
  return (
    <article className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.value}>
        {value}
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </p>
      {description ? <p className={styles.description}>{description}</p> : null}
    </article>
  )
}

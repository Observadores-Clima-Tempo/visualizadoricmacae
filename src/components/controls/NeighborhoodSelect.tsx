import { useId } from 'react'

import type { BairroId } from '@/domain/heatIndexTypes'
import styles from './NeighborhoodSelect.module.css'

export type NeighborhoodOption = {
  bairroId: BairroId
  bairroLabel: string
}

export type NeighborhoodSelectProps = {
  /** Bairros já em ordem alfabética pt-BR. */
  bairros: readonly NeighborhoodOption[]
  value: BairroId | null
  onChange: (bairroId: BairroId) => void
}

/**
 * Seletor de bairro da V1: um `<select>` nativo (teclado e leitor de tela
 * funcionam sem código extra), com rótulo visível e largura estável para que a
 * troca de nome não empurre o cabeçalho do painel.
 */
export function NeighborhoodSelect({ bairros, value, onChange }: NeighborhoodSelectProps) {
  const selectId = useId()

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={selectId}>
        Bairro
      </label>
      <select
        id={selectId}
        className={styles.select}
        value={value ?? ''}
        disabled={bairros.length === 0}
        onChange={(event) => onChange(event.target.value)}
      >
        {bairros.map((bairro) => (
          <option key={bairro.bairroId} value={bairro.bairroId}>
            {bairro.bairroLabel}
          </option>
        ))}
      </select>
    </div>
  )
}

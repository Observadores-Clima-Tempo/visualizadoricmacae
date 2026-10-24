import { useCallback, useEffect, useState } from 'react'

import { NeighborhoodSelect } from '@/components/controls/NeighborhoodSelect'
import { HeatmapGrid } from '@/components/heatmap/HeatmapGrid'
import { HeatmapPanel } from '@/components/heatmap/HeatmapPanel'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import type { AggregationMode } from '@/domain/heatIndexGrid'
import type { BairroId } from '@/domain/heatIndexTypes'
import { useHeatIndexData } from '@/hooks/useHeatIndexData'
import styles from './App.module.css'

/** A V1 mostra um único bairro por vez: a agregação ainda não tem efeito. */
const V1_AGGREGATION: AggregationMode = 'mean'

const TITLE_BASE = 'Índice de Calor'

function formatCount(value: number): string {
  return value.toLocaleString('pt-BR')
}

/**
 * Página da V1: carrega o dataset uma única vez, alterna entre os seis bairros
 * e mantém o seletor ligado ao mapa de calor. Barra de título, filtros de
 * período, cartões, gráfico e legenda pertencem à V2.
 */
export function App() {
  const [selectedBairroId, setSelectedBairroId] = useState<BairroId | null>(null)
  const { bairros, reports, grid, error, activeBairroId, retry } = useHeatIndexData({
    bairroId: selectedBairroId,
    aggregation: V1_AGGREGATION,
  })

  const activeBairroLabel =
    bairros.find((bairro) => bairro.bairroId === activeBairroId)?.bairroLabel ?? ''
  const activeReport = reports.find((report) => report.bairroId === activeBairroId) ?? null
  const hasReadings = activeReport !== null && activeReport.readings > 0

  useEffect(() => {
    document.title =
      activeBairroLabel === ''
        ? `${TITLE_BASE} — Macaé`
        : `${TITLE_BASE} — ${activeBairroLabel} — Macaé`
  }, [activeBairroLabel])

  const handleBairroChange = useCallback((nextBairroId: BairroId) => {
    // Preserva a rolagem vertical: a matriz muda de conteúdo, não de altura.
    const { scrollX, scrollY } = window
    setSelectedBairroId(nextBairroId)
    window.requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY)
    })
  }, [])

  const footer =
    hasReadings && activeReport ? (
      <p className={styles.footnote}>{formatCount(grid.days.length)} dias no período</p>
    ) : undefined

  return (
    <div className={styles.page}>
      <main className={styles.content}>
        {error ? (
          <ErrorState
            title="Não foi possível carregar os dados"
            description={error}
            actionLabel="Tentar novamente"
            onAction={retry}
          />
        ) : (
          <HeatmapPanel
            actions={
              <NeighborhoodSelect
                bairros={bairros}
                value={activeBairroId}
                onChange={handleBairroChange}
              />
            }
            footer={footer}
          >
            {hasReadings ? (
              <HeatmapGrid grid={grid} bairroLabel={activeBairroLabel} />
            ) : (
              <EmptyState
                title="Nenhum registro válido para este bairro"
                description="Nenhuma linha deste CSV gerou uma leitura de índice de calor utilizável."
                note={
                  activeReport && activeReport.rejected > 0
                    ? `${formatCount(activeReport.rejected)} registros ignorados por conterem dados inválidos.`
                    : undefined
                }
              />
            )}
          </HeatmapPanel>
        )}
      </main>
    </div>
  )
}

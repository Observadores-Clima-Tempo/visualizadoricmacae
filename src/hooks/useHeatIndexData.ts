import { useCallback, useMemo, useState } from 'react'

import { listSources } from '@/data/csvSources'
import { parseAllSources, type ImportReport } from '@/data/csvParser'
import { enumerateIsoDays } from '@/data/normalizeTimestamp'
import { buildHeatGrid, type AggregationMode, type HeatGrid } from '@/domain/heatIndexGrid'
import type { BairroId, HeatIndexReading } from '@/domain/heatIndexTypes'

/**
 * Fonte única de dados da aplicação.
 *
 * O dataset é montado **uma vez por carregamento** e guardado em nível de
 * módulo: alternar bairros (ou a agregação) nunca reparseia os CSVs, apenas
 * reconstrói a grade do bairro ativo. O hook é o único ponto que liga a camada
 * de importação (`src/data/`) ao domínio (`src/domain/`).
 */

/** Item do seletor de bairro: apenas o necessário para rotular a opção. */
export type BairroOption = {
  bairroId: BairroId
  bairroLabel: string
}

type HeatIndexDataset = {
  bairros: BairroOption[]
  reports: ImportReport[]
  readingsByBairro: ReadonlyMap<BairroId, HeatIndexReading[]>
  /** Intervalo corrido e inclusivo que a grade deve cobrir. */
  days: string[]
  error: string | null
}

export type UseHeatIndexDataParams = {
  /** Bairro ativo; `null` resolve para o primeiro bairro em ordem alfabética. */
  bairroId: BairroId | null
  aggregation: AggregationMode
}

export type UseHeatIndexDataResult = {
  bairros: BairroOption[]
  reports: ImportReport[]
  readingsByBairro: ReadonlyMap<BairroId, HeatIndexReading[]>
  grid: HeatGrid
  error: string | null
  /** Bairro efetivamente usado na grade (`null` quando não há bairros). */
  activeBairroId: BairroId | null
  /** Descarta o dataset em cache e importa os CSVs novamente. */
  retry: () => void
}

const NO_READINGS: HeatIndexReading[] = []

let cachedDataset: HeatIndexDataset | null = null

/**
 * Intervalo corrido e inclusivo que a grade deve cobrir: do menor `firstDate`
 * do dataset até {@link resolveLastDatasetDay}. Dias sem leitura continuam na
 * lista — a grade nunca é derivada das leituras.
 */
function resolveDatasetDays(
  reports: ImportReport[],
  readingsByBairro: ReadonlyMap<BairroId, HeatIndexReading[]>,
): string[] {
  const firstDates = reports
    .map((report) => report.firstDate)
    .filter((date): date is string => date !== null)

  const start = firstDates.reduce<string | null>(
    (earliest, date) => (earliest === null || date < earliest ? date : earliest),
    null,
  )

  if (start === null) return []
  const end = resolveLastDatasetDay(reports, readingsByBairro)
  if (end === null || end < start) return []

  return enumerateIsoDays(start, end)
}

/**
 * Último dia do intervalo global.
 *
 * O arredondamento de hora da importação (minuto ≥ 40) empurra a leitura das
 * 23:59 do último dia do CSV para a hora 0 do dia seguinte. Esse dia extra não
 * faz parte do período dos arquivos — sem o ajuste o período terminaria em
 * 01/03/2025 — então o intervalo fecha no último dia com leitura depois das 0h.
 * Se nenhum dia tiver leitura fora da hora 0, vale o maior `lastDate` do
 * dataset.
 */
function resolveLastDatasetDay(
  reports: ImportReport[],
  readingsByBairro: ReadonlyMap<BairroId, HeatIndexReading[]>,
): string | null {
  let lastDayAfterMidnight: string | null = null

  for (const readings of readingsByBairro.values()) {
    for (const reading of readings) {
      if (reading.hour === 0) continue
      if (lastDayAfterMidnight === null || reading.date > lastDayAfterMidnight) {
        lastDayAfterMidnight = reading.date
      }
    }
  }

  if (lastDayAfterMidnight !== null) return lastDayAfterMidnight

  return reports
    .map((report) => report.lastDate)
    .filter((date): date is string => date !== null)
    .reduce<string | null>(
      (latest, date) => (latest === null || date > latest ? date : latest),
      null,
    )
}

function buildDatasetError(): string {
  const sources = listSources()

  if (sources.length === 0) {
    return 'Nenhum arquivo CSV foi encontrado em data/. Adicione os arquivos dos bairros e recarregue.'
  }

  const files = sources.map((source) => `${source.bairroLabel}.csv`).join(', ')
  return (
    `Nenhum dos ${sources.length} arquivos CSV pôde ser importado (${files}). ` +
    'Confira se cada arquivo contém as colunas obrigatórias "date" e "ic (c°)", sem cabeçalho duplicado.'
  )
}

function createDataset(): HeatIndexDataset {
  const { bairros, reports, readingsByBairro } = collectSources()
  const hasSources = listSources().length > 0

  return {
    bairros: bairros.sort((a, b) => a.bairroLabel.localeCompare(b.bairroLabel, 'pt-BR')),
    reports: [...reports].sort((a, b) => a.bairroLabel.localeCompare(b.bairroLabel, 'pt-BR')),
    readingsByBairro,
    days: resolveDatasetDays(reports, readingsByBairro),
    error: hasSources && bairros.length === 0 ? buildDatasetError() : null,
  }
}

function collectSources(): {
  bairros: BairroOption[]
  reports: ImportReport[]
  readingsByBairro: Map<BairroId, HeatIndexReading[]>
} {
  const { bairros, reports } = parseAllSources()
  const readingsByBairro = new Map<BairroId, HeatIndexReading[]>()
  const options: BairroOption[] = []

  for (const bairro of bairros) {
    readingsByBairro.set(bairro.bairroId, bairro.readings)
    options.push({ bairroId: bairro.bairroId, bairroLabel: bairro.bairroLabel })
  }

  return { bairros: options, reports, readingsByBairro }
}

function getDataset(): HeatIndexDataset {
  cachedDataset ??= createDataset()
  return cachedDataset
}

/**
 * Dataset completo + grade do bairro ativo.
 *
 * `grid` é memoizada por `(bairroId, days, aggregation)`: trocar de bairro
 * reconstrói apenas a matriz do bairro escolhido.
 */
export function useHeatIndexData({
  bairroId,
  aggregation,
}: UseHeatIndexDataParams): UseHeatIndexDataResult {
  const [dataset, setDataset] = useState<HeatIndexDataset>(getDataset)

  const retry = useCallback(() => {
    cachedDataset = null
    setDataset(getDataset())
  }, [])

  const activeBairroId = bairroId ?? dataset.bairros[0]?.bairroId ?? null
  const readings = (activeBairroId ? dataset.readingsByBairro.get(activeBairroId) : undefined) ?? NO_READINGS

  const grid = useMemo(
    () => buildHeatGrid(readings, { days: dataset.days, aggregation }),
    [readings, dataset.days, aggregation],
  )

  return {
    bairros: dataset.bairros,
    reports: dataset.reports,
    readingsByBairro: dataset.readingsByBairro,
    grid,
    error: dataset.error,
    activeBairroId,
    retry,
  }
}

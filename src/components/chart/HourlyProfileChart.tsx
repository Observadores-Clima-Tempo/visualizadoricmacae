import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatHourLabel } from '@/components/heatmap/heatmapLabels'
import { EmptyState } from '@/components/ui/EmptyState'
import { findProfilePeak, type HourlyProfilePoint } from '@/domain/heatIndexAggregations'
import { resolveYScale } from './profileChartScale'
import styles from './HourlyProfileChart.module.css'

/** Id estável do título: não reutiliza os ids do mapa nem do resumo. */
export const HOURLY_PROFILE_TITLE_ID = 'hourly-profile-title'

const ONE_DECIMAL = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** `34.25` -> `34,2 °C` */
function formatTemperature(value: number): string {
  return `${ONE_DECIMAL.format(value)} °C`
}

/** Ponto entregue ao Recharts: `label` é a categoria do eixo X (`14h`). */
type ProfileChartPoint = {
  hour: number
  label: string
  average: number | null
}

type ProfileTooltipProps = {
  active?: boolean
  payload?: readonly { payload?: ProfileChartPoint }[]
}

/**
 * Tooltip em HTML (nunca dentro do SVG): hora e média. Hora sem leitura mostra
 * `Sem dado` — sem percentual e sem zero.
 */
function ProfileTooltip({ active, payload }: ProfileTooltipProps) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipHour}>{formatHourLabel(point.hour)}</p>
      {point.average === null ? (
        <p className={styles.tooltipEmpty}>Sem dado</p>
      ) : (
        <p className={styles.tooltipValue}>{formatTemperature(point.average)}</p>
      )}
    </div>
  )
}

export type HourlyProfileChartProps = {
  profile: readonly HourlyProfilePoint[]
  /** Rótulo do bairro ativo, usado nas descrições acessíveis. */
  bairroLabel: string
}

/**
 * Cartão com o perfil horário médio do bairro ativo (0h a 23h).
 *
 * O gráfico é decorativo (`aria-hidden`) e não entra na ordem de tabulação: os
 * mesmos números ficam disponíveis na tabela oculta e no resumo textual, que
 * são lidos por leitores de tela.
 */
export function HourlyProfileChart({ profile, bairroLabel }: HourlyProfileChartProps) {
  const data = useMemo<ProfileChartPoint[]>(
    () =>
      profile.map((point) => ({
        hour: point.hour,
        label: formatHourLabel(point.hour),
        average: point.average,
      })),
    [profile],
  )

  const peak = useMemo(() => findProfilePeak(profile), [profile])
  const yScale = useMemo(() => resolveYScale(profile), [profile])

  return (
    <section className={styles.card} aria-labelledby={HOURLY_PROFILE_TITLE_ID}>
      <h2 id={HOURLY_PROFILE_TITLE_ID} className={styles.title}>
        Média horária do período
      </h2>

      {peak === null ? (
        <div className={styles.empty}>
          <EmptyState
            title="Sem dados no período"
            description="Nenhuma hora do bairro selecionado tem leitura válida para montar o perfil médio."
          />
        </div>
      ) : (
        <div className={styles.plot}>
          <div className={styles.chart} aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                accessibilityLayer={false}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  type="category"
                  interval={0}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  type="number"
                  domain={yScale.domain}
                  ticks={yScale.ticks}
                  interval={0}
                  tickFormatter={yScale.formatTick}
                  width={44}
                  tickLine={false}
                  axisLine={false}
                  label={{
                    value: '°C',
                    position: 'insideTopLeft',
                    offset: 0,
                    className: styles.axisUnit,
                  }}
                />
                <Tooltip
                  content={<ProfileTooltip />}
                  filterNull={false}
                  isAnimationActive={false}
                  cursor={{ stroke: 'var(--color-border)', strokeDasharray: '4 4' }}
                />
                <Line
                  type="monotone"
                  dataKey="average"
                  stroke="currentColor"
                  strokeWidth={2}
                  dot={{ r: 2, fill: 'currentColor', stroke: 'currentColor' }}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <ReferenceDot
                  x={formatHourLabel(peak.hour)}
                  y={peak.average}
                  r={4}
                  fill="currentColor"
                  stroke="none"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Resumo do pico em texto puro: o gráfico em si é decorativo. */}
      {peak === null ? null : (
        <p className="srOnly">
          Pico médio às {formatHourLabel(peak.hour)} com {formatTemperature(peak.average)}
        </p>
      )}

      {/*
       * A tabela vai dentro de um wrapper `.srOnly`: em uma `<table>` o
       * `overflow: hidden` do utilitário não recorta o conteúdo, e a tabela
       * continuaria ocupando espaço no documento.
       */}
      <div className="srOnly">
        <table>
          <caption>
            Perfil horário médio do índice de calor em {bairroLabel}: média por hora e número de
            dias com dados.
          </caption>
          <thead>
            <tr>
              <th scope="col">Hora</th>
              <th scope="col">Média</th>
              <th scope="col">Dias com dados</th>
            </tr>
          </thead>
          <tbody>
            {profile.map((point) => (
              <tr key={point.hour}>
                <th scope="row">{formatHourLabel(point.hour)}</th>
                <td>
                  {point.average === null ? 'Sem dado' : formatTemperature(point.average)}
                </td>
                <td>{point.daysUsed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

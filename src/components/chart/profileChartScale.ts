import type { HourlyProfilePoint } from '@/domain/heatIndexAggregations'

const TICK_FORMAT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

/** Distância fixa entre duas linhas-guia horizontais, em °C. */
const Y_TICK_STEP = 4

/** Escala do eixo Y: domínio fechado, linhas-guia e formatação dos rótulos. */
export type YScale = {
  domain: [number, number]
  ticks: number[]
  formatTick: (value: number) => string
}

/** `30` -> `30` (o eixo não tem casas decimais). */
function formatTick(value: number): string {
  return TICK_FORMAT.format(value)
}

/**
 * Escala do eixo Y: só os dados, com folga de ~1 °C em cima e embaixo.
 *
 * O domínio e as linhas-guia são explícitos e sempre alinhados a múltiplos de
 * `Y_TICK_STEP`: quando o Recharts escolhe os ticks sozinho, ele mantém as
 * bordas do domínio e encaixa valores "bonitos" no meio — o que deixa as
 * primeiras e as últimas linhas-guia mais próximas (ou mais distantes) que as
 * demais. Com `ticks` explícitos (e `interval={0}` no eixo), toda linha-guia
 * dista exatamente 4 °C da vizinha.
 */
export function resolveYScale(profile: readonly HourlyProfilePoint[]): YScale {
  const values = profile
    .map((point) => point.average)
    .filter((average): average is number => average !== null && Number.isFinite(average))

  if (values.length === 0) {
    return { domain: [0, Y_TICK_STEP], ticks: [0, Y_TICK_STEP], formatTick }
  }

  // Bordas inteiras e múltiplas do passo: todos os ticks caem em pontos do
  // eixo que são múltiplos de 4 °C, então o intervalo entre duas linhas-guia
  // vizinhas é sempre `Y_TICK_STEP`.
  const start = Math.floor((Math.floor(Math.min(...values)) - 1) / Y_TICK_STEP) * Y_TICK_STEP
  const end = Math.ceil((Math.ceil(Math.max(...values)) + 1) / Y_TICK_STEP) * Y_TICK_STEP

  const ticks: number[] = []
  for (let value = start; value <= end; value += Y_TICK_STEP) {
    ticks.push(value)
  }

  return { domain: [start, end], ticks, formatTick }
}

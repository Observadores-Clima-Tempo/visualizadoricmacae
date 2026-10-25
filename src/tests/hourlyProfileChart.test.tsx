import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HourlyProfileChart } from '@/components/chart/HourlyProfileChart'
import { resolveYScale } from '@/components/chart/profileChartScale'
import type { HourlyProfilePoint } from '@/domain/heatIndexAggregations'

/**
 * O `ResponsiveContainer` do Recharts mede o elemento pai e, em jsdom, essa
 * medição é sempre 0×0 — por isso o SVG não é renderizado aqui e nenhum teste
 * depende da geometria do gráfico. O que se verifica é tudo o que é HTML: o
 * resumo textual do pico e a tabela oculta (a fonte acessível dos mesmos
 * números).
 */
function profileFrom(values: readonly (number | null)[]): HourlyProfilePoint[] {
  return values.map((average, hour) => ({
    hour,
    average,
    daysUsed: average === null ? 0 : 3,
  }))
}

/** Hora 14 como pico (34,2 °C) e as demais horas em 30 °C. */
const FIXTURE = profileFrom(
  Array.from({ length: 24 }, (_unused, hour) => (hour === 14 ? 34.2 : 30)),
)

const WITH_GAP = profileFrom(
  Array.from({ length: 24 }, (_unused, hour) =>
    hour === 2 || hour === 3 ? null : hour === 14 ? 34.2 : 30,
  ),
)

describe('HourlyProfileChart — cartão', () => {
  it('mostra só o título, sem subtítulo nem selo do pico', () => {
    render(<HourlyProfileChart profile={FIXTURE} bairroLabel="Trapiche" />)

    expect(screen.getByRole('heading', { name: 'Média horária do período' })).toBeTruthy()
    expect(
      screen.queryByText('Perfil horário médio do índice de calor nos dias selecionados.'),
    ).toBeNull()
    expect(screen.queryByText(/^Pico médio:/)).toBeNull()
  })

  it('descreve o pico em texto para leitores de tela', () => {
    render(<HourlyProfileChart profile={FIXTURE} bairroLabel="Trapiche" />)

    expect(screen.getByText('Pico médio às 14h com 34,2 °C')).toBeTruthy()
  })
})

describe('HourlyProfileChart — tabela oculta', () => {
  it('lista as 24 horas com média e dias com dados', () => {
    render(<HourlyProfileChart profile={FIXTURE} bairroLabel="Trapiche" />)

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')

    // Cabeçalho + 24 horas.
    expect(rows).toHaveLength(25)
    expect(within(table).getByRole('columnheader', { name: 'Hora' })).toBeTruthy()
    expect(within(table).getByRole('columnheader', { name: 'Média' })).toBeTruthy()
    expect(
      within(table).getByRole('columnheader', { name: 'Dias com dados' }),
    ).toBeTruthy()
    expect(within(table).getByRole('rowheader', { name: '14h' })).toBeTruthy()
    expect(rows[15]?.textContent).toBe('14h34,2 °C3')
  })

  it('descreve o perfil e o bairro na legenda da tabela', () => {
    render(<HourlyProfileChart profile={FIXTURE} bairroLabel="Trapiche" />)

    expect(screen.getByRole('table').querySelector('caption')?.textContent).toContain(
      'Perfil horário médio do índice de calor em Trapiche',
    )
  })
})

describe('HourlyProfileChart — linhas-guia do eixo Y', () => {
  /** Perfil linear de `min` a `max` em 24 horas, para variar a amplitude. */
  function ramp(min: number, max: number): HourlyProfilePoint[] {
    return profileFrom(
      Array.from({ length: 24 }, (_unused, hour) => min + ((max - min) * hour) / 23),
    )
  }

  it('separa as linhas-guia em exatamente 4 °C', () => {
    for (const [min, max] of [
      [30, 34],
      [24, 35.6],
      [10, 45],
    ] as const) {
      const { ticks } = resolveYScale(ramp(min, max))
      const gaps = ticks.slice(1).map((value, index) => value - ticks[index])

      expect(new Set(gaps), `ticks: ${ticks.join(', ')}`).toEqual(new Set([4]))
    }
  })

  it('fecha o domínio nas linhas-guia das bordas e cobre todos os dados', () => {
    const profile = ramp(24, 35.6)
    const { domain, ticks } = resolveYScale(profile)
    const values = profile.map((point) => point.average as number)

    expect(ticks[0]).toBe(domain[0])
    expect(ticks.at(-1)).toBe(domain[1])
    expect(domain[0]).toBeLessThanOrEqual(Math.min(...values))
    expect(domain[1]).toBeGreaterThanOrEqual(Math.max(...values))
  })

  it('mantém o passo de 4 °C no perfil sem dados', () => {
    const { ticks } = resolveYScale(profileFrom(Array.from({ length: 24 }, () => null)))

    expect(ticks).toEqual([0, 4])
  })
})

describe('HourlyProfileChart — horas sem dado', () => {
  it('escreve "Sem dado" em vez de zero nas horas vazias', () => {
    render(<HourlyProfileChart profile={WITH_GAP} bairroLabel="Mirante" />)

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')

    expect(rows[3]?.textContent).toBe('2hSem dado0')
    expect(within(table).getAllByText('Sem dado')).toHaveLength(2)
    expect(within(table).queryByText('0 °C')).toBeNull()
  })
})

describe('HourlyProfileChart — perfil vazio', () => {
  const emptyProfile = profileFrom(Array.from({ length: 24 }, () => null))

  it('mostra o estado vazio, sem o resumo do pico', () => {
    render(<HourlyProfileChart profile={emptyProfile} bairroLabel="Mirante" />)

    expect(screen.getByRole('status').textContent).toContain('Sem dados no período')
    expect(screen.queryByText(/Pico médio/)).toBeNull()
  })

  it('mantém a tabela oculta com as 24 horas sem leitura', () => {
    render(<HourlyProfileChart profile={emptyProfile} bairroLabel="Mirante" />)

    const table = screen.getByRole('table')

    expect(within(table).getAllByRole('row')).toHaveLength(25)
    expect(within(table).getAllByText('Sem dado')).toHaveLength(24)
  })
})

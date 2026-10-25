import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HourlyProfileChart } from '@/components/chart/HourlyProfileChart'
import type { HourlyProfilePoint } from '@/domain/heatIndexAggregations'

/**
 * O `ResponsiveContainer` do Recharts mede o elemento pai e, em jsdom, essa
 * medição é sempre 0×0 — por isso o SVG não é renderizado aqui e nenhum teste
 * depende da geometria do gráfico. O que se verifica é tudo o que é HTML: o
 * selo do pico, o resumo textual e a tabela oculta (a fonte acessível dos
 * mesmos números).
 */
function profileFrom(values: readonly (number | null)[]): HourlyProfilePoint[] {
  return values.map((average, hour) => ({
    hour,
    average,
    daysUsed: average === null ? 0 : 3,
  }))
}

/** Hora 14 como pico (34,25 °C) e as demais horas em 30 °C. */
const FIXTURE = profileFrom(
  Array.from({ length: 24 }, (_unused, hour) => (hour === 14 ? 34.2 : 30)),
)

const WITH_GAP = profileFrom(
  Array.from({ length: 24 }, (_unused, hour) =>
    hour === 2 || hour === 3 ? null : hour === 14 ? 34.2 : 30,
  ),
)

describe('HourlyProfileChart — cartão', () => {
  it('mostra título, subtítulo e o selo textual do pico', () => {
    render(<HourlyProfileChart profile={FIXTURE} bairroLabel="Trapiche" />)

    expect(screen.getByRole('heading', { name: 'Média horária do período' })).toBeTruthy()
    expect(
      screen.getByText('Perfil horário médio do índice de calor nos dias selecionados.'),
    ).toBeTruthy()

    // O selo não é cortado: é HTML, com hora e valor em um único texto legível.
    const peak = screen.getByText(/^Pico médio:/)
    expect(peak.tagName).toBe('P')
    expect(peak.textContent).toBe('Pico médio: 14h · 34,2 °C')
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

  it('mostra o estado vazio, sem o selo do pico', () => {
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

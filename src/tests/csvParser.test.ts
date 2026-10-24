import { beforeAll, describe, expect, it } from 'vitest'

import type { BairroReadings } from '@/domain/heatIndexTypes'
import { listSources, toBairroId, toBairroLabel, type CsvSource } from '@/data/csvSources'
import {
  CsvHeaderError,
  MAX_ISSUES_PER_FILE,
  parseAllSources,
  parseStationCsv,
  type ImportReport,
} from '@/data/csvParser'

const HEADER_WITH_TIME =
  'Date,Time,Temp (C),UR (%),Temp (F),Índice de Calor (IC),IC Ajustado,IC (C°),Diferença'

const HEADER_WITHOUT_TIME = 'Date,Temp (C),UR (%),Temp (F),Índice de Calor (IC),IC Ajustado,IC (C°),Diferença'

function makeSource(content: string, label = 'Teste'): CsvSource {
  return { bairroId: toBairroId(label), bairroLabel: label, path: `/data/${label}.csv`, content }
}

describe('csvSources', () => {
  it('lê todos os arquivos de data/ e ordena por rótulo em pt-BR', () => {
    const labels = listSources().map((source) => source.bairroLabel)
    expect(labels).toEqual(['Barreto', 'Cabiunas', 'Miramar', 'Mirante', 'Trapiche', 'Visconde'])
  })

  it('deriva identificador sem acento e em minúsculas', () => {
    expect(toBairroId('Cabiunas')).toBe('cabiunas')
    expect(toBairroId('Visconde de Araújo')).toBe('visconde-de-araujo')
    expect(toBairroLabel('cabiunas')).toBe('Cabiunas')
    expect(toBairroLabel('são joão')).toBe('Sao joao')
  })

  it('carrega o conteúdo bruto de cada CSV', () => {
    for (const source of listSources()) {
      expect(source.content.length).toBeGreaterThan(0)
      expect(source.content).toContain('IC (C°)')
    }
  })
})

describe('parseStationCsv — cabeçalho', () => {
  it('lança erro citando as colunas ausentes e as encontradas', () => {
    const source = makeSource('Data,Temperatura\n2024-12-01,25', 'Falho')

    let error: unknown
    try {
      parseStationCsv(source)
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(CsvHeaderError)
    const headerError = error as CsvHeaderError
    expect(headerError.message).toContain('Cabeçalho inválido em Falho')
    expect(headerError.message).toContain('"date"')
    expect(headerError.message).toContain('"ic (c°)"')
    expect(headerError.message).toContain('"data"')
    expect(headerError.missingColumns).toEqual(['date', 'ic (c°)'])
    expect(headerError.foundColumns).toEqual(['data', 'temperatura'])
  })

  it('normaliza BOM, espaços extras e caixa alta', () => {
    const content = `\uFEFF  DATE ,  Time ,Temp (C),Ur (%),Temp (F),Índice de Calor (IC),IC Ajustado, IC (C°) ,Diferença
2024-12-01,00:59:50,24.5,91.2,76.1,76.12,77.58,25.32,0.82`
    const { report, readings } = parseStationCsv(makeSource(content))
    expect(report.rejected).toBe(0)
    expect(report.detectedFormats).toEqual(['yyyy-mm-dd + time'])
    expect(readings).toHaveLength(1)
  })

  it('resolve as colunas pelo nome mesmo quando a ordem muda (Cabiunas)', () => {
    const content = `${HEADER_WITHOUT_TIME}
01-dez-2024 00:00,24.09,97.18,75.36,73.61,76.99,24.99,0.90
01-dez-2024 01:00,23.81,97.56,74.85,72.35,76.45,24.69,0.88`
    const { report, readings } = parseStationCsv(makeSource(content, 'Cabiunas'))
    expect(report.accepted).toBe(2)
    expect(report.detectedFormats).toEqual(['dd-mmm-yyyy hh:mm'])
    expect(readings[0]).toMatchObject({ date: '2024-12-01', hour: 0, heatIndexC: 24.99 })
    expect(readings[1]).toMatchObject({ date: '2024-12-01', hour: 1, heatIndexC: 24.69 })
  })
})

describe('parseStationCsv — validação de linhas', () => {
  it('classifica cada motivo de rejeição com a prioridade especificada', () => {
    const content = `${HEADER_WITH_TIME}
2024-12-01,00:59:50,24.5,91.2,76.1,76.12,77.58,25.32,0.82
31/31/2024,00:00,24.5,91.2,76.1,76.12,77.58,25.32,0.82
2024-12-01,10:00:00,25,80,77,70,72,,0.5
2024-12-01,10:00:00,25,80,77,70,72,abc,0.5
2024-12-01,10:00:00,,,70,72,72,-2.5,0.5
2024-12-01,10:00:00,,80,77,70,72,25.5,0.5`

    const { report, issues } = parseStationCsv(makeSource(content))

    expect(report.rows).toBe(6)
    expect(report.accepted).toBe(1)
    expect(report.rejected).toBe(5)
    expect(report.rejectedByReason).toEqual({
      invalid_timestamp: 1,
      missing_heat_index: 1,
      non_numeric_heat_index: 1,
      non_positive_heat_index: 1,
      missing_temperature_or_humidity: 1,
    })
    expect(issues.map((issue) => issue.reason)).toEqual([
      'invalid_timestamp',
      'missing_heat_index',
      'non_numeric_heat_index',
      'non_positive_heat_index',
      'missing_temperature_or_humidity',
    ])
    expect(issues[0]?.row).toBe(3)
    expect(issues[0]?.bairroId).toBe('teste')
  })

  it('descarta leituras com IC negativo e contabiliza o total agregado', () => {
    const rows = Array.from(
      { length: 25 },
      (_unused, index) => `2024-12-01,${String(index % 24).padStart(2, '0')}:00:00,,,70,72,72,-1.5,0.5`,
    )
    const content = `${HEADER_WITH_TIME}\n${rows.join('\n')}`

    const { report, issues } = parseStationCsv(makeSource(content))

    expect(report.rejected).toBe(25)
    expect(report.rejectedByReason.non_positive_heat_index).toBe(25)
    expect(issues).toHaveLength(MAX_ISSUES_PER_FILE)
  })

  it('mantém temperatura e umidade válidas e anula as ausentes', () => {
    const content = `${HEADER_WITHOUT_TIME}
01-dez-2024 00:00,24.09,97.18,75.36,73.61,76.99,24.99,0.90`
    const { readings } = parseStationCsv(makeSource(content, 'Cabiunas'))
    expect(readings[0]).toMatchObject({ temperatureC: 24.09, relativeHumidity: 97.18 })
  })
})

describe('parseStationCsv — deduplicação por hora', () => {
  it('agrupa leituras da mesma hora pela média e conta as leituras', () => {
    const content = `${HEADER_WITH_TIME}
2024-12-02,14:57:10,37.7,46.7,99.86,114.72,114.72,45.96,8.26
2024-12-02,15:28:46,37.9,45.7,100.22,114.73,114.73,45.96,8.06
2024-12-02,16:59:57,34,56,93.2,105.02,105.02,40.56,6.56`

    const { readings, report } = parseStationCsv(makeSource(content))

    expect(readings).toHaveLength(2)
    expect(report.accepted).toBe(3)
    expect(report.duplicateHours).toBe(1)
    expect(readings[0]).toMatchObject({ date: '2024-12-02', hour: 15, readingCount: 2 })
    expect(readings[0]?.heatIndexC).toBeCloseTo(45.96, 10)
    expect(readings[0]?.temperatureC).toBeCloseTo(37.8, 10)
    expect(readings[1]).toMatchObject({ date: '2024-12-02', hour: 17, readingCount: 1 })
  })

  it('ordena as leituras por data e hora', () => {
    const content = `${HEADER_WITH_TIME}
2024-12-02,00:59:50,24.5,91.2,76.1,76.12,77.58,25.32,0.82
2024-12-01,23:59:50,24.5,91.2,76.1,76.12,77.58,26.32,0.82
2024-12-01,05:59:50,24.5,91.2,76.1,76.12,77.58,24.32,0.82`

    const { readings } = parseStationCsv(makeSource(content))

    expect(readings.map((reading) => `${reading.date}#${reading.hour}`)).toEqual([
      '2024-12-01#6',
      '2024-12-02#0',
      '2024-12-02#1',
    ])
  })
})

describe('integração com os CSVs reais de data/', () => {
  let bairros: BairroReadings[]
  let reports: ImportReport[]
  let totalRejected: number

  beforeAll(() => {
    const result = parseAllSources()
    bairros = result.bairros
    reports = result.reports
    totalRejected = result.totalRejected
  })

  const reportFor = (label: string): ImportReport => {
    const report = reports.find((item) => item.bairroLabel === label)
    if (!report) throw new Error(`Relatório ausente para ${label}`)
    return report
  }

  it('importa os seis bairros, ordenados alfabeticamente', () => {
    expect(bairros).toHaveLength(6)
    expect(bairros.map((bairro) => bairro.bairroLabel)).toEqual([
      'Barreto',
      'Cabiunas',
      'Miramar',
      'Mirante',
      'Trapiche',
      'Visconde',
    ])
    expect(reports).toHaveLength(6)
    expect(totalRejected).toBeGreaterThan(0)
  })

  it('Cabiunas usa dd-mmm-yyyy e não tem coluna Time', () => {
    const report = reportFor('Cabiunas')
    expect(report.detectedFormats).toEqual(['dd-mmm-yyyy hh:mm'])
    expect(report.distinctDays).toBe(90)
    expect(report.firstDate).toBe('2024-12-01')
    expect(report.lastDate).toBe('2025-02-28')
    expect(report.rows).toBe(2160)
  })

  it('os demais bairros usam ISO + Time', () => {
    for (const label of ['Barreto', 'Miramar', 'Mirante', 'Trapiche', 'Visconde']) {
      expect(reportFor(label).detectedFormats).toEqual(['yyyy-mm-dd + time'])
    }
  })

  it('conta as linhas aceitas por bairro (tolerância de 2 linhas)', () => {
    const expected: Record<string, number> = {
      Barreto: 2039,
      Cabiunas: 2124,
      Miramar: 2122,
      Mirante: 1647,
      Trapiche: 2155,
      Visconde: 2082,
    }

    for (const [label, accepted] of Object.entries(expected)) {
      expect(Math.abs(reportFor(label).accepted - accepted), `accepted de ${label}`).toBeLessThanOrEqual(2)
    }
  })

  it('rejeita as leituras sentinela de IC negativo', () => {
    expect(reportFor('Cabiunas').rejectedByReason.non_positive_heat_index).toBeGreaterThan(30)
    expect(reportFor('Visconde').rejectedByReason.non_positive_heat_index).toBeGreaterThan(35)
    expect(reportFor('Miramar').rejectedByReason.non_positive_heat_index).toBeGreaterThan(0)
  })

  it('readings nunca excede accepted e a diferença é a duplicidade de horas', () => {
    for (const report of reports) {
      expect(report.readings).toBeLessThanOrEqual(report.accepted)
      expect(report.accepted - report.readings).toBe(report.duplicateHours)
      expect(report.rows).toBe(report.accepted + report.rejected)
    }
  })

  it('horas duplicadas vêm das leituras fora do minuto :59', () => {
    // Every collision is caused by an off-minute sample (e.g. 14:57:10 and
    // 15:28:46) landing on the same hour bucket as the regular `:59` sample.
    const duplicateHours: Record<string, number> = {
      Barreto: 11,
      Cabiunas: 0,
      Miramar: 3,
      Mirante: 1,
      Trapiche: 0,
      Visconde: 8,
    }

    for (const [label, expected] of Object.entries(duplicateHours)) {
      expect(reportFor(label).duplicateHours, `duplicateHours de ${label}`).toBe(expected)
    }
  })

  it('Barreto agrupa 14:57:10 e 15:28:46 na hora 15 do dia 02/12/2024', () => {
    const barreto = bairros.find((bairro) => bairro.bairroLabel === 'Barreto')
    const reading = barreto?.readings.find((item) => item.date === '2024-12-02' && item.hour === 15)

    expect(reading).toBeDefined()
    expect(reading?.readingCount).toBe(2)
    expect(reading?.heatIndexC).toBeCloseTo(45.96, 10)
  })

  it('as leituras de 23:59 caem na hora 0 do dia seguinte', () => {
    const barreto = bairros.find((bairro) => bairro.bairroLabel === 'Barreto')
    const hourZero = barreto?.readings.filter((item) => item.hour === 0) ?? []
    expect(hourZero.length).toBeGreaterThan(0)
    expect(hourZero.every((item) => item.date > '2024-12-01')).toBe(true)
  })

  it('não desloca dias por fuso: o primeiro dia de cada bairro é 2024-12-01', () => {
    for (const bairro of bairros) {
      expect(bairro.readings[0]?.date, `primeiro dia de ${bairro.bairroLabel}`).toBe('2024-12-01')
    }
  })

  it('nenhum valor importado é nulo, zero ou negativo', () => {
    for (const bairro of bairros) {
      for (const reading of bairro.readings) {
        expect(Number.isFinite(reading.heatIndexC)).toBe(true)
        expect(reading.heatIndexC).toBeGreaterThan(0)
        expect(reading.hour).toBeGreaterThanOrEqual(0)
        expect(reading.hour).toBeLessThanOrEqual(23)
      }
    }
  })
})

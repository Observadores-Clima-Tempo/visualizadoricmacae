import { describe, expect, it } from 'vitest'

import {
  addDaysIso,
  enumerateIsoDays,
  formatIsoDate,
  matchTimestamp,
  parseFiniteNumber,
  parseTimestamp,
  toHourBucket,
} from '@/data/normalizeTimestamp'

describe('parseTimestamp — formatos suportados', () => {
  it('YYYY-MM-DD + coluna Time com HH:MM:SS', () => {
    expect(parseTimestamp('2024-12-01', '00:59:50')).toEqual({
      year: 2024,
      month: 12,
      day: 1,
      hour: 0,
      minute: 59,
      second: 50,
    })
  })

  it('YYYY-MM-DD + coluna Time com H:MM e HH:MM', () => {
    expect(parseTimestamp('2024-12-01', '7:05')).toMatchObject({ hour: 7, minute: 5, second: 0 })
    expect(parseTimestamp('2024-12-01', '23:59')).toMatchObject({ hour: 23, minute: 59, second: 0 })
  })

  it('DD-MMM-YYYY HH:MM com mês abreviado em português', () => {
    expect(parseTimestamp('01-dez-2024 00:00')).toEqual({
      year: 2024,
      month: 12,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    })
    expect(parseTimestamp('15-jan-2025 06:30')).toMatchObject({ month: 1, day: 15, hour: 6, minute: 30 })
    expect(parseTimestamp('28-fev-2024 23:59:59')).toMatchObject({ month: 2, day: 28, second: 59 })
  })

  it('aceita ano com dois dígitos como 20xx', () => {
    expect(parseTimestamp('01-dez-24 00:00')).toMatchObject({ year: 2024 })
  })

  it('DD/MM/YYYY HH:MM(:SS)', () => {
    expect(parseTimestamp('01/12/2024 14:57')).toMatchObject({ month: 12, day: 1, hour: 14, minute: 57 })
    expect(parseTimestamp('01/12/2024 14:57:10')).toMatchObject({ second: 10 })
  })

  it('ISO com T', () => {
    expect(parseTimestamp('2024-12-02T14:57:10')).toMatchObject({
      year: 2024,
      month: 12,
      day: 2,
      hour: 14,
      minute: 57,
      second: 10,
    })
  })

  it('ISO com espaço entre data e hora, incluindo 29 de fevereiro', () => {
    expect(parseTimestamp('2024-02-29 08:00')).toMatchObject({
      year: 2024,
      month: 2,
      day: 29,
      hour: 8,
      minute: 0,
    })
    expect(parseTimestamp('2023-02-29 08:00')).toBeNull()
  })

  it('YYYY-MM-DD isolado vira 00:00:00', () => {
    expect(parseTimestamp('2024-12-01')).toEqual({
      year: 2024,
      month: 12,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    })
  })

  it('informa o formato reconhecido', () => {
    expect(matchTimestamp('2024-12-01', '00:59:50')?.format).toBe('yyyy-mm-dd + time')
    expect(matchTimestamp('01-dez-2024 00:00')?.format).toBe('dd-mmm-yyyy hh:mm')
    expect(matchTimestamp('01/12/2024 00:00')?.format).toBe('dd/mm/yyyy hh:mm')
    expect(matchTimestamp('2024-12-01T00:00:00')?.format).toBe('yyyy-mm-ddthh:mm')
    expect(matchTimestamp('2024-12-01')?.format).toBe('yyyy-mm-dd')
  })
})

describe('parseTimestamp — validação', () => {
  it('rejeita textos desconhecidos', () => {
    expect(parseTimestamp('')).toBeNull()
    expect(parseTimestamp('ontem')).toBeNull()
    expect(parseTimestamp('2024-13-01')).toBeNull()
    expect(parseTimestamp('2024-12-32')).toBeNull()
    expect(parseTimestamp('2024-12-01', '25:00')).toBeNull()
    expect(parseTimestamp('2024-12-01', '23:60')).toBeNull()
    expect(parseTimestamp('2024-12-01', '23:59:60')).toBeNull()
    expect(parseTimestamp('2024-12-01', '00h59')).toBeNull()
    expect(parseTimestamp('01-xxx-2024 00:00')).toBeNull()
  })

  it('valida dia conforme o mês, incluindo bissexto', () => {
    expect(parseTimestamp('29-fev-2024 00:00')).toMatchObject({ month: 2, day: 29 })
    expect(parseTimestamp('29-fev-2025 00:00')).toBeNull()
    expect(parseTimestamp('29-fev-1900 00:00')).toBeNull()
    expect(parseTimestamp('29-fev-2000 00:00')).toMatchObject({ year: 2000, day: 29 })
    expect(parseTimestamp('31-abr-2024 00:00')).toBeNull()
    expect(parseTimestamp('31-dez-2024 00:00')).toMatchObject({ month: 12, day: 31 })
  })
})

describe('toHourBucket — arredondamento da hora', () => {
  const bucket = (dateText: string, timeText: string) => {
    const parts = parseTimestamp(dateText, timeText)
    if (!parts) throw new Error(`Timestamp inválido: ${dateText} ${timeText}`)
    return toHourBucket(parts)
  }

  it('minuto 39 permanece na hora e minuto 40 avança', () => {
    expect(bucket('2024-12-01', '20:39:59')).toEqual({ date: '2024-12-01', hour: 20 })
    expect(bucket('2024-12-01', '20:40:00')).toEqual({ date: '2024-12-01', hour: 21 })
    expect(bucket('2024-12-01', '20:28:00')).toEqual({ date: '2024-12-01', hour: 20 })
    expect(bucket('2024-12-01', '20:42:31')).toEqual({ date: '2024-12-01', hour: 21 })
    expect(bucket('2024-12-01', '20:59:46')).toEqual({ date: '2024-12-01', hour: 21 })
  })

  it('00:00 fica na hora 0', () => {
    expect(toHourBucket(parseTimestamp('01-dez-2024 00:00')!)).toEqual({ date: '2024-12-01', hour: 0 })
  })

  it('reproduz os limites e os horários fora do :59 dos CSVs reais', () => {
    expect(bucket('2024-12-01', '14:39:59')).toEqual({ date: '2024-12-01', hour: 14 })
    expect(bucket('2024-12-01', '14:40:00')).toEqual({ date: '2024-12-01', hour: 15 })
    expect(bucket('2024-12-02', '14:57:10')).toEqual({ date: '2024-12-02', hour: 15 })
    expect(bucket('2024-12-02', '12:43:37')).toEqual({ date: '2024-12-02', hour: 13 })
    expect(bucket('2024-12-01', '23:59:47')).toEqual({ date: '2024-12-02', hour: 0 })
  })

  it('23:59 avança para a hora 0 do dia seguinte', () => {
    expect(bucket('2024-12-01', '23:59:47')).toEqual({ date: '2024-12-02', hour: 0 })
  })

  it('virada de mês e de ano', () => {
    expect(bucket('2024-12-31', '23:59:00')).toEqual({ date: '2025-01-01', hour: 0 })
    expect(bucket('2024-02-28', '23:59:00')).toEqual({ date: '2024-02-29', hour: 0 })
    expect(bucket('2025-02-28', '23:59:00')).toEqual({ date: '2025-03-01', hour: 0 })
  })
})

describe('aritmética civil de datas', () => {
  it('formatIsoDate preenche com zeros', () => {
    expect(formatIsoDate({ year: 2024, month: 1, day: 5 })).toBe('2024-01-05')
  })

  it('addDaysIso anda para frente e para trás', () => {
    expect(addDaysIso('2024-12-01', 1)).toBe('2024-12-02')
    expect(addDaysIso('2024-12-31', 1)).toBe('2025-01-01')
    expect(addDaysIso('2024-03-01', -1)).toBe('2024-02-29')
    expect(addDaysIso('2024-01-01', -1)).toBe('2023-12-31')
    expect(addDaysIso('2024-12-01', 31)).toBe('2025-01-01')
    expect(addDaysIso('2024-12-01', 89)).toBe('2025-02-28')
    expect(addDaysIso('2024-12-01', 90)).toBe('2025-03-01')
  })

  it('enumerateIsoDays é inclusivo', () => {
    expect(enumerateIsoDays('2024-12-30', '2025-01-02')).toEqual([
      '2024-12-30',
      '2024-12-31',
      '2025-01-01',
      '2025-01-02',
    ])
    expect(enumerateIsoDays('2024-12-01', '2025-02-28')).toHaveLength(90)
    expect(enumerateIsoDays('2024-12-01', '2024-12-01')).toEqual(['2024-12-01'])
  })

  it('enumerateIsoDays rejeita intervalo invertido', () => {
    expect(() => enumerateIsoDays('2024-12-02', '2024-12-01')).toThrow()
  })

  it('addDaysIso rejeita datas fora do formato ou do calendário', () => {
    expect(() => addDaysIso('01/12/2024', 1)).toThrow(/Invalid ISO date/)
    expect(() => addDaysIso('2024-13-01', 1)).toThrow(/Invalid ISO date/)
    expect(() => addDaysIso('2023-02-29', 1)).toThrow(/Invalid ISO date/)
  })
})

describe('parseFiniteNumber', () => {
  it('aceita número decimal com ponto', () => {
    expect(parseFiniteNumber('45.96')).toBe(45.96)
    expect(parseFiniteNumber(' 24 ')).toBe(24)
    expect(parseFiniteNumber('-1.5')).toBe(-1.5)
    expect(parseFiniteNumber('0')).toBe(0)
  })

  it('aceita a vírgula como separador decimal (export pt-BR)', () => {
    expect(parseFiniteNumber('45,96')).toBe(45.96)
    expect(parseFiniteNumber('-3,94')).toBe(-3.94)
    expect(parseFiniteNumber('1.234,56')).toBeNull()
  })

  it('rejeita valores inválidos', () => {
    expect(parseFiniteNumber('')).toBeNull()
    expect(parseFiniteNumber('   ')).toBeNull()
    expect(parseFiniteNumber('abc')).toBeNull()
    expect(parseFiniteNumber('NaN')).toBeNull()
    expect(parseFiniteNumber('Infinity')).toBeNull()
    expect(parseFiniteNumber('12abc')).toBeNull()
    expect(parseFiniteNumber('9'.repeat(400))).toBeNull()
  })
})

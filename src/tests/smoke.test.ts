import { describe, expect, it } from 'vitest'
import { App } from '@/app/App'

describe('ambiente de testes', () => {
  it('executa a suíte', () => {
    expect(true).toBe(true)
  })

  it('resolve o alias @/ apontando para src', () => {
    expect(typeof App).toBe('function')
  })
})

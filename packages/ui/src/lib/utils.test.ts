import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn ze skalą strony publicznej', () => {
  it('stopień skali to rozmiar, nie kolor: obok koloru oba zostają', () => {
    expect(cn('pub-score text-brand-line', 'text-pub-64')).toBe('pub-score text-brand-line text-pub-64')
    expect(cn('text-pub-14 text-muted-foreground')).toBe('text-pub-14 text-muted-foreground')
  })

  it('późniejszy stopień skali zastępuje wcześniejszy, także zwykły rozmiar Tailwinda', () => {
    expect(cn('text-pub-13', 'text-pub-20')).toBe('text-pub-20')
    expect(cn('text-sm', 'text-pub-40')).toBe('text-pub-40')
  })
})

import { describe, expect, it } from 'vitest'
import { divergenceNote, groupsQualifiersSentence } from './bracket-notes'

/** Wiersz tabeli grupy: miejsce i drużyna. */
const row = (position: number, id: number, name: string) => ({ position, team: { id, name } })

const groupA = [row(1, 1, 'Sokoły Ursus'), row(2, 2, 'Wilki Bemowo'), row(3, 3, 'Orły Bielany'), row(4, 4, 'Rysie Wola')]
const groupB = [row(1, 5, 'Żubry Praga'), row(2, 6, 'Lwy Ochota'), row(3, 7, 'Niedźwiedzie Mokotów'), row(4, 8, 'Jastrzębie Wawer')]

describe('divergenceNote', () => {
  it('drabinka z czołówki tabel: bez notki', () => {
    expect(divergenceNote([{ rows: groupA, qualifiers: 2 }, { rows: groupB, qualifiers: 2 }], new Set([1, 2, 5, 6]))).toBeNull()
  })

  it('jedna drużyna z drabinki stoi dziś pod linią, a nad nią inna', () => {
    expect(divergenceNote([{ rows: groupA, qualifiers: 2 }, { rows: groupB, qualifiers: 2 }], new Set([1, 3, 5, 6]))).toBe(
      'Drabinka różni się od dzisiejszych tabel grup: w drabince gra Orły Bielany, a w tabeli grupy nad linią stoi dziś Wilki Bemowo.',
    )
  })

  it('kilka drużyn: liczba mnoga i wyliczenie, człony grup po średniku', () => {
    expect(divergenceNote([{ rows: groupA, qualifiers: 2 }, { rows: groupB, qualifiers: 2 }], new Set([3, 4, 5, 7]))).toBe(
      'Drabinka różni się od dzisiejszych tabel grup: w drabince grają Orły Bielany i Rysie Wola, a w tabeli grupy nad linią stoją dziś Sokoły Ursus i Wilki Bemowo; ' +
        'w drabince gra Niedźwiedzie Mokotów, a w tabeli grupy nad linią stoi dziś Lwy Ochota.',
    )
  })

  it('po zmianie liczby wychodzących zostaje człon bez pary', () => {
    // Mniej wychodzących: Wilki grają, choć stoją dziś pod linią.
    expect(divergenceNote([{ rows: groupA, qualifiers: 1 }], new Set([1, 2]))).toBe(
      'Drabinka różni się od dzisiejszych tabel grup: w drabince gra Wilki Bemowo, choć w tabeli grupy stoi dziś pod linią.',
    )
    // Więcej wychodzących: Orły stoją nad linią, a w drabince ich nie ma.
    expect(divergenceNote([{ rows: groupA, qualifiers: 3 }], new Set([1, 2]))).toBe(
      'Drabinka różni się od dzisiejszych tabel grup: w tabeli grupy nad linią stoi dziś Orły Bielany, a w drabince nie gra.',
    )
  })
})

describe('groupsQualifiersSentence', () => {
  it('ta sama liczba w każdej grupie', () => {
    expect(groupsQualifiersSentence([{ qualifiers: 2 }, { qualifiers: 2 }])).toBe('Z każdej grupy wychodzą 2 drużyny.')
    expect(groupsQualifiersSentence([{ qualifiers: 1 }, { qualifiers: 1 }])).toBe('Z każdej grupy wychodzi 1 drużyna.')
    expect(groupsQualifiersSentence([{ qualifiers: 5 }])).toBe('Z grupy wychodzi 5 drużyn.')
  })

  it('różne liczby: łącznie z wszystkich grup', () => {
    expect(groupsQualifiersSentence([{ qualifiers: 2 }, { qualifiers: 1 }])).toBe('Z grup wychodzą łącznie 3 drużyny.')
  })

  it('bez grup: bez zdania', () => {
    expect(groupsQualifiersSentence([])).toBeNull()
  })
})

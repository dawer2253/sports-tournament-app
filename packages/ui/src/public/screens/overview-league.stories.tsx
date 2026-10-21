import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { emptyLeaderboard, leaderboardsBySport, publicLeagueSeason, publicTournament } from '../../lib/demo-data'
import {
  boardStateText,
  expectBoardsStacked,
  expectRootWithoutSideScroll,
  expectSkeletonThenData,
  stageFacts,
} from '../../test/overview'
import { desktop1280, phone375 } from '../../test/viewport'
import { OverviewDemo } from './overview-demo'

const table = (rows: (typeof publicLeagueSeason.inProgress)['rows']) => ({ rows, scoreLabel: 'Bramki', allowsDraw: true })

/**
 * Przegląd ligi piłkarskiej (#296): osobna story na każdy stan turnieju.
 * Kolor turnieju z globalnego przełącznika „Kolor turnieju”.
 */
const meta = {
  title: 'Strona publiczna/Ekrany/Przegląd/Liga piłkarska',
  component: OverviewDemo,
  parameters: { layout: 'fullscreen', ...desktop1280.parameters },
  globals: desktop1280.globals,
  args: {
    mode: 'league',
    tournament: publicTournament,
    lists: publicLeagueSeason.inProgress.lists,
    table: table(publicLeagueSeason.inProgress.rows),
    leaderboard: leaderboardsBySport.football.goals!,
  },
} satisfies Meta<typeof OverviewDemo>

export default meta
type Story = StoryObj<typeof meta>

/** Przed ułożeniem terminarza: same drużyny, bez tabeli z zerami, klasyfikacji i pasa etapu. */
export const BezTerminarza: Story = {
  name: 'Bez terminarza',
  args: { teams: publicLeagueSeason.teams, lists: undefined, table: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const showcase = within(canvas.getByRole('region', { name: 'Drużyny' }))
    await expect(showcase.getAllByRole('listitem').map((item) => item.querySelector('[data-slot="showcase-team-name"]')?.textContent)).toEqual([
      'Burza',
      'Dragons',
      'FC Górka',
      'Huragan',
      'Orły',
      'Sparta',
      'Tygrysy',
      'Wilki',
    ])
    await expect(showcase.getByText('Terminarz pojawi się tutaj, gdy organizator go ułoży.')).toBeInTheDocument()
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
    await expect(canvas.queryByRole('region', { name: 'Bramki' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('region', { name: 'Mistrz' })).not.toBeInTheDocument()
    await expect(canvasElement.querySelector('[data-slot="stage-band"]')).toBeNull()
  },
}

/** Terminarz ułożony, nic nie rozegrane: pierwsza kolejka, tabela z terminem startu. */
export const PrzedStartem: Story = {
  name: 'Przed startem',
  args: {
    lists: publicLeagueSeason.beforeStart.lists,
    table: table(publicLeagueSeason.beforeStart.rows),
    leaderboard: emptyLeaderboard('goals', 'Bramki'),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const band = within(canvas.getByRole('region', { name: 'Kolejka 1' }))
    await expect(band.getByText('Pierwsza kolejka')).toBeInTheDocument()
    await expect(stageFacts(canvasElement)).toEqual(['sob., 5 wrz', '0 z 4 rozegrane', 'z 14 kolejek'])
    await expect(within(canvas.getByRole('region', { name: 'Tabela' })).getByText('Startuje sob., 5 wrz, 10:00')).toBeInTheDocument()
    await expect(canvas.getByText('Klasyfikacja ruszy po pierwszym zakończonym meczu.')).toBeInTheDocument()
  },
}

/**
 * Sezon w trakcie: piąta kolejka z meczem zakończonym, trwającym
 * i zaplanowanym, obok szósta kolejka i lider strzelców.
 */
export const WTrakcie: Story = {
  name: 'W trakcie',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const band = within(canvas.getByRole('region', { name: 'Kolejka 5' }))
    await expect(band.getByText('Bieżąca kolejka')).toBeInTheDocument()
    await expect(stageFacts(canvasElement)).toEqual(['sob., 3 paź', '1 z 4 rozegrane', 'z 14 kolejek'])
    // Zegar demo (#297): 2. połowa 20 minut po starcie, więc 66′ przy „Na żywo”.
    await expect(boardStateText(canvasElement, 'live')).toBe('Na żywo66′')
    await expect(boardStateText(canvasElement, 'finished')).toBe('Koniec')
    await expect(boardStateText(canvasElement, 'scheduled')).toMatch(/^\d{2}:\d{2}$/)
    // Każda tablica prowadzi na stronę meczu.
    for (const link of band.getAllByRole('link')) await expect(link.getAttribute('href')).toMatch(/^\/t\/liga-osiedlowa\/mecze\/\d+$/)
    await expect(canvas.getByRole('region', { name: 'Kolejka 6' })).toBeInTheDocument()
    await expect(within(canvas.getByRole('region', { name: 'Bramki' })).getByText('Jan Kowalski')).toBeInTheDocument()
    await expect(canvas.queryByRole('region', { name: 'Mistrz' })).not.toBeInTheDocument()
  },
}

const inProgressFixtures = publicLeagueSeason.inProgress.lists.fixtures
const liveNow = inProgressFixtures.find((match) => match.status === 'live')!
const [nextLive, nextUndated] = inProgressFixtures.filter((match) => match.round.order === 6)

/**
 * Następna kolejka w bocznej kolumnie (#306): mecz szóstej kolejki zaczęty
 * przed końcem piątej ma „Na żywo” z minutą zamiast godziny, a mecz bez
 * terminu krótkie „–” z pełnym napisem w `title`, bez łamania na linie.
 */
export const NastepnaKolejkaNaZywo: Story = {
  name: 'Następna kolejka, mecz na żywo i bez terminu',
  args: {
    lists: {
      ...publicLeagueSeason.inProgress.lists,
      fixtures: inProgressFixtures.map((match) => {
        if (match.id === nextLive!.id) {
          const { livePeriod, periodStartedAt, onBreak } = liveNow
          return { ...match, status: 'live' as const, homeScore: 0, awayScore: 0, livePeriod, periodStartedAt, onBreak }
        }
        return match.id === nextUndated!.id ? { ...match, kickoffAt: null } : match
      }),
    },
  },
  play: async ({ canvasElement }) => {
    const lines = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="next-match"]')]
    const line = (id: number) => lines.find((candidate) => candidate.getAttribute('href')?.endsWith(`/${id}`))!
    await expect(within(line(nextLive!.id)).getByText('Na żywo')).toBeVisible()
    await expect(line(nextLive!.id)).toHaveTextContent('66′')
    const undated = within(line(nextUndated!.id)).getByTitle('Termin do ustalenia')
    await expect(undated).toHaveTextContent('–')
    await expect(undated.getBoundingClientRect().height).toBeLessThan(parseFloat(getComputedStyle(undated).lineHeight) * 1.5)
    await expect(lines.filter((candidate) => within(candidate).queryByText('Na żywo'))).toHaveLength(1)
  },
}

/** Po końcu: ostatnia kolejka, pas „Mistrz” nad tabelą, bez następnej kolejki. */
export const Zakonczony: Story = {
  name: 'Zakończony',
  args: {
    tournament: { ...publicTournament, status: 'finished' },
    finished: true,
    lists: publicLeagueSeason.finished.lists,
    table: table(publicLeagueSeason.finished.rows),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(within(canvas.getByRole('region', { name: 'Kolejka 14' })).getByText('Ostatnia kolejka')).toBeInTheDocument()
    await expect(canvas.getByRole('region', { name: 'Mistrz' })).toHaveTextContent(publicLeagueSeason.finished.rows[0]!.team.name)
    await expect(canvasElement.querySelector('[data-slot="next-match"]')).toBeNull()
  },
}

/** Telefon 375 px: tablice jedna pod drugą, nic nie przewija się w bok. */
export const WTrakcieTelefon: Story = {
  name: 'W trakcie, telefon',
  parameters: phone375.parameters,
  globals: phone375.globals,
  play: async ({ canvasElement }) => {
    await expectBoardsStacked(canvasElement)
    await expectRootWithoutSideScroll()
  },
}

/** Pierwsze wczytanie: szkielet w kształcie ekranu, który znika po danych. */
export const Wczytywanie: Story = {
  args: { loadingMs: 600 },
  play: async ({ canvasElement }) => {
    await expectSkeletonThenData(canvasElement, 'Kolejka 5')
  },
}

/** Błąd tabeli nie zdejmuje pasa etapu ani bocznej kolumny. */
export const BladTabeli: Story = {
  name: 'Błąd tabeli',
  args: { mainError: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(within(canvas.getByRole('region', { name: 'Tabela' })).getByRole('alert')).toHaveTextContent('Nie udało się wczytać tabeli')
    await expect(canvas.getByRole('region', { name: 'Kolejka 5' })).toBeInTheDocument()
    await expect(canvas.getByRole('region', { name: 'Bramki' })).toBeInTheDocument()
  },
}

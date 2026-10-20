import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import type { MatchPageMatch } from '../components/data/match-page-data'
import {
  demoTeamLogoUrl,
  matchPageBasketball,
  matchPageFinished,
  matchPageLive,
  matchPageScheduled,
  matchPageVolleyball,
  matchPageVolleyballLive,
  scheduleTimeZone,
  volleyballClockSettings,
} from '../lib/demo-data'
import { phone375 } from '../test/viewport'
import { MatchClockProvider } from './live'
import { MatchBoard } from './match-board'

const meta = {
  title: 'Strona publiczna/Komponenty/Mecz/Tablica',
  component: MatchBoard,
  parameters: { layout: 'padded' },
  args: { match: matchPageFinished, timeZone: scheduleTimeZone },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-5xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MatchBoard>

export default meta
type Story = StoryObj<typeof meta>

const home = matchPageFinished.homeTeam!.name
const away = matchPageFinished.awayTeam!.name

/** Lista strzelców drużyny jako tekst wierszy; pusta, gdy listy nie ma. */
function scorersOf(canvasElement: HTMLElement, team: string) {
  const list = within(canvasElement).queryByRole('list', { name: `Strzelcy: ${team}` })
  return list ? within(list).getAllByRole('listitem').map((item) => item.textContent) : []
}

/**
 * Piłka po meczu: fakty nad tablicą, „Koniec”, przegrany przygaszony,
 * a samobój gościa stoi u gospodarza z „(sam.)”.
 */
export const PoMeczu: Story = {
  name: 'Po meczu',
  play: async ({ canvasElement }) => {
    const board = within(canvasElement.querySelector<HTMLElement>('[data-slot="match-board"]')!)
    await expect(canvasElement.querySelector('[data-slot="match-board"]')).toHaveAccessibleName(`Mecz: ${home} – ${away}`)
    await expect(board.getByText(matchPageFinished.round.name)).toBeInTheDocument()
    await expect(board.getByText(matchPageFinished.venue!.name)).toBeInTheDocument()
    await expect(board.getByText('Koniec')).toBeInTheDocument()
    await expect(
      board.getByLabelText(`Wynik ${matchPageFinished.homeScore} : ${matchPageFinished.awayScore}`),
    ).toBeInTheDocument()

    const homeLines = scorersOf(canvasElement, home)
    const awayLines = scorersOf(canvasElement, away)
    await expect(homeLines.filter((line) => line?.endsWith('(sam.)'))).toHaveLength(1)
    await expect(awayLines.some((line) => line?.includes('(sam.)'))).toBe(false)
  },
}

/** Na żywo: „Na żywo” zamiast „Koniec”, nikt nie jest przygaszony. */
export const NaZywo: Story = {
  name: 'Na żywo',
  args: { match: matchPageLive },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Na żywo')).toBeInTheDocument()
    await expect(canvas.queryByText('Koniec')).not.toBeInTheDocument()
    await expect(canvasElement.querySelectorAll('[data-dim]')).toHaveLength(0)
  },
}

/** Zaplanowany: godzina w miejscu wyniku, bez okienek i bez strzelców. */
export const Zaplanowany: Story = {
  args: { match: matchPageScheduled },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const time = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: scheduleTimeZone }).format(
      new Date(matchPageScheduled.kickoffAt!),
    )
    await expect(canvasElement.querySelector('[data-slot="match-board-kickoff"]')).toHaveTextContent(time)
    await expect(canvasElement.querySelector('[data-slot="score-window"]')).toBeNull()
    await expect(canvas.queryByRole('list', { name: /^Strzelcy/ })).not.toBeInTheDocument()
    await expect(canvas.queryByText('Koniec')).not.toBeInTheDocument()
  },
}

/** Bez terminu: „Termin do ustalenia” nad tablicą, w miejscu wyniku kreska. */
export const BezTerminu: Story = {
  name: 'Bez terminu',
  args: { match: { ...matchPageScheduled, kickoffAt: null } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Termin do ustalenia')).toBeInTheDocument()
    await expect(canvasElement.querySelector('[data-slot="score-window"]')).toBeNull()
  },
}

const thirdPlace: MatchPageMatch = {
  ...matchPageFinished,
  round: { name: 'Finał' },
  homeScore: 1,
  awayScore: 1,
  homePenalties: 3,
  awayPenalties: 4,
  bracket: { label: 'Mecz o 3. miejsce', penaltySlot: true },
}

/**
 * Mecz o 3. miejsce rozstrzygnięty karnymi (#234): etykieta pozycji zamiast
 * rundy „Finał”, karne w nawiasie przy wyniku każdej drużyny, pogrubione
 * u zwycięzcy, a przegrany przygaszony mimo remisu.
 */
export const PoKarnych: Story = {
  name: 'Po karnych',
  args: { match: thirdPlace },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Mecz o 3. miejsce')).toBeInTheDocument()
    await expect(canvas.queryByText('Finał')).not.toBeInTheDocument()
    await expect(canvas.getByLabelText('Wynik 1 : 1, karne 3 : 4')).toBeInTheDocument()
    await expect(canvas.getByText('(3)')).toHaveClass('font-normal')
    await expect(canvas.getByText('(4)')).toHaveClass('font-bold')
    const dimmed = [...canvasElement.querySelectorAll<HTMLElement>('[data-dim]')].map((element) => element.dataset.side)
    await expect(new Set(dimmed)).toEqual(new Set(['home']))
    await expectPenaltiesBesideScores(canvasElement)
  },
}

/**
 * Karne stoją obok okienka swojej drużyny, w tej samej linii: gospodarza
 * z lewej od jego wyniku, gościa z prawej od jego wyniku.
 */
async function expectPenaltiesBesideScores(canvasElement: HTMLElement) {
  const [home, away] = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="score-window"]')].map((element) => element.getBoundingClientRect())
  const [homePens, awayPens] = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="penalties"]')].map((element) => element.getBoundingClientRect())
  await expect(homePens!.right).toBeLessThanOrEqual(home!.left)
  await expect(awayPens!.left).toBeGreaterThanOrEqual(away!.right)
  for (const [pens, window] of [[homePens!, home!], [awayPens!, away!]] as const) {
    const middle = pens.top + pens.height / 2
    await expect(middle).toBeGreaterThan(window.top)
    await expect(middle).toBeLessThan(window.bottom)
  }
}

/** Karne na telefonie 375 px przy długich nazwach: obok wyników, wynik na środku, bez przewijania w bok. */
export const PoKarnychTelefon: Story = {
  name: 'Po karnych, telefon',
  args: { match: { ...thirdPlace, homeTeam: { id: thirdPlace.homeTeam!.id, name: 'Międzyszkolny Klub Sportowy Huragan Bemowo', logoUrl: null } } },
  parameters: { ...phone375.parameters },
  globals: phone375.globals,
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBe(375)
    await document.fonts.ready
    await expectPenaltiesBesideScores(canvasElement)
    await expectScoreCentered(canvasElement)
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
  },
}

/** Kosz: na tablicy każdy zawodnik z punktami, nie trzech jak w wierszu meczu (#192). */
export const Kosz: Story = {
  args: { match: matchPageBasketball },
  play: async ({ canvasElement }) => {
    const lines = [matchPageBasketball.homeTeam!.name, matchPageBasketball.awayTeam!.name].flatMap((team) =>
      scorersOf(canvasElement, team),
    )
    await expect(lines).toHaveLength(matchPageBasketball.scorers!.length)
    await expect(lines.length).toBeGreaterThan(6)
  },
}

const longNames: MatchPageMatch = {
  ...matchPageFinished,
  homeTeam: { id: matchPageFinished.homeTeam!.id, name: 'Międzyszkolny Klub Sportowy Huragan Bemowo', logoUrl: null },
}

/** Środek okienek wyniku stoi na środku tablicy (± 1 px), niezależnie od nazw (#162). */
async function expectScoreCentered(canvasElement: HTMLElement) {
  const board = canvasElement.querySelector<HTMLElement>('[data-slot="match-board"]')!.getBoundingClientRect()
  const score = canvasElement.querySelector<HTMLElement>('[data-slot="match-board-score"]')!.getBoundingClientRect()
  await expect(Math.abs(score.left + score.width / 2 - (board.left + board.width / 2))).toBeLessThanOrEqual(1)
}

export const DlugieNazwy: Story = {
  name: 'Długie nazwy',
  args: { match: longNames },
  play: async ({ canvasElement }) => {
    await expectScoreCentered(canvasElement)
  },
}

/** Długie nazwy na telefonie 375 px: wynik na środku, strona nie przewija się w bok. */
export const DlugieNazwyTelefon: Story = {
  name: 'Długie nazwy, telefon',
  args: { match: longNames },
  parameters: { ...phone375.parameters },
  globals: phone375.globals,
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBe(375)
    await document.fonts.ready
    await expectScoreCentered(canvasElement)
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
  },
}

/** Herb wgrany (`logoUrl`) u gospodarza, herb zastępczy u gościa. */
export const Herby: Story = {
  args: {
    match: { ...matchPageFinished, homeTeam: { ...matchPageFinished.homeTeam!, logoUrl: demoTeamLogoUrl } },
  },
  play: async ({ canvasElement }) => {
    const crests = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="match-board-team"] [data-slot="crest"]')]
    await expect(crests).toHaveLength(2)
    await expect(crests[0]!.querySelector('img')).toHaveAttribute('src', demoTeamLogoUrl)
    await expect(crests[1]!.querySelector('img')).toBeNull()
    await expect(crests[1]!.querySelector('[data-slot="crest-fallback"]')).not.toBeNull()
  },
}

/** Sety z tablicy jako „N. set H:A”. */
function setsOf(canvasElement: HTMLElement) {
  const list = within(canvasElement).getByRole('list', { name: 'Sety' })
  return within(list).getAllByRole('listitem').map((item) => item.textContent)
}

/** Siatkówka 3:2 (#301): okienka niosą sety wygrane, a pod tablicą wszystkie pięć setów. */
export const Siatkowka: Story = {
  name: 'Siatkówka',
  args: { match: matchPageVolleyball },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText('Wynik 3 : 2')).toBeInTheDocument()
    await expect(setsOf(canvasElement)).toEqual(['1. set 25:23', '2. set 23:25', '3. set 25:21', '4. set 20:25', '5. set 15:11'])
  },
}

/**
 * Siatkówka na żywo: 1:1 w setach, a trzeci set niedokończony stoi na liście
 * jako bieżący stan. Zegar siatkówki nie pokazuje minuty ani części.
 */
export const SiatkowkaNaZywo: Story = {
  name: 'Siatkówka na żywo',
  args: { match: matchPageVolleyballLive },
  decorators: [
    (Story) => (
      <MatchClockProvider settings={volleyballClockSettings}>
        <Story />
      </MatchClockProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText('Wynik 1 : 1')).toBeInTheDocument()
    await expect(setsOf(canvasElement)).toEqual(['1. set 25:21', '2. set 18:25', '3. set 14:12'])
    await expect(within(canvasElement).queryByText(/′|kwarta|część/)).toBeNull()
  },
}

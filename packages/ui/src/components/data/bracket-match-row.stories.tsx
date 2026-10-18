import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { cupChampion, cupRounds, scheduleTimeZone } from '../../lib/demo-data'
import { cn } from '../../lib/utils'
import { expectTextFits, phone375, textFitProblems } from '../../test/viewport'
import { BracketChampion, BracketMatchRow } from './bracket-match-row'
import type { BracketMatchRowData } from './bracket-match-row-data'

const [quarterFinals, semiFinals, finalRound] = cupRounds.map((round) => round.matches)

const meta = {
  title: 'UI/Dane/Wiersz meczu drabinki',
  component: BracketMatchRow,
  parameters: { layout: 'padded' },
  args: { match: quarterFinals![0]!, timeZone: scheduleTimeZone, penaltySlot: true },
} satisfies Meta<typeof BracketMatchRow>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Ćwierćfinał rozstrzygnięty karnymi: karne w polu wyniku, „(4) 2:2 (3)”,
 * pogrubione u zwycięzcy; zwycięzca pogrubiony, przegrany przyciszony,
 * krawędź do półfinału.
 */
export const PoKarnych: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = canvas.getByRole('group', { name: 'Ćwierćfinał 2: Dragons – Wilki' })
    const score = row.querySelector('[data-slot="bracket-score"]')!
    await expect(score).toHaveTextContent('(4)2:2(3)')
    await expect(within(row).getByText('(4)')).toHaveClass('font-bold')
    await expect(within(row).getByText('(3)')).toHaveClass('font-normal')
    await expect(within(row).getByText('Dragons')).toHaveClass('font-semibold')
    await expect(within(row).getByText('Wilki')).toHaveClass('text-muted-foreground')
    await expect(within(row).getByText('zwycięzca → Półfinał 1')).toBeInTheDocument()
    await expect(within(row).getByText('Zakończony')).toBeInTheDocument()
    await expect(within(row).getByText('sob., 3 paź, 12:00')).toBeInTheDocument()
  },
}

/** Półfinał z meczem o 3. miejsce: dwie krawędzie, bez wyniku. */
export const DwieKrawedzie: Story = {
  args: { match: semiFinals![1]! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('zwycięzca → Finał')).toBeInTheDocument()
    await expect(canvas.getByText('przegrany → o 3. miejsce')).toBeInTheDocument()
    await expect(canvas.getByText('–')).toBeInTheDocument()
    await expect(canvas.getByText('Zaplanowany')).toBeInTheDocument()
  },
}

/**
 * Pole wyniku w piłce ma zawsze miejsce na karne, więc stoi tak samo
 * w wierszu z karnymi i bez. W koszu (bez remisów) jest węższe, bez miejsca
 * na karne (#234).
 */
export const PoleWyniku: Story = {
  render: (args) => (
    <div className="max-w-4xl space-y-2">
      <BracketMatchRow {...args} match={quarterFinals![0]!} />
      <BracketMatchRow {...args} match={quarterFinals![1]!} />
      <div data-testid="kosz">
        <BracketMatchRow {...args} match={{ ...quarterFinals![1]!, homePenalties: null, awayPenalties: null }} penaltySlot={false} />
      </div>
    </div>
  ),
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const fields = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="bracket-score"]')].map((field) =>
      field.getBoundingClientRect(),
    )
    await expect(fields).toHaveLength(3)
    const [penalties, plain, basketball] = fields as [DOMRect, DOMRect, DOMRect]
    await expect(plain.width).toBeCloseTo(penalties.width, 1)
    await expect(plain.left).toBeCloseTo(penalties.left, 1)
    await expect(basketball.width).toBeLessThan(plain.width)
    await expect(within(canvasElement).getByTestId('kosz').querySelector('[data-slot="penalties"]')).toBeNull()
  },
}

/** Pusty slot mówi, skąd przyjdzie drużyna. */
export const PustySlot: Story = {
  args: { match: finalRound![0]! },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('group', { name: 'Mecz o 3. miejsce: Dragons – Przegrany: Półfinał 2' })).toBeInTheDocument()
    await expect(canvas.getByText('Przegrany: Półfinał 2')).toHaveClass('italic')
  },
}

/** Mecz bez terminu, prosto z generatora. */
export const BezTerminu: Story = {
  args: { match: { ...finalRound![1]!, kickoffAt: null } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Termin do ustalenia')).toBeInTheDocument()
    await expect(canvas.getByText('Zwycięzca: Półfinał 2')).toBeInTheDocument()
  },
}

/** Z `onSelect` cały wiersz jest przyciskiem. */
export const Klikalny: Story = {
  args: { onSelect: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Ćwierćfinał 2: Dragons – Wilki' }))
    await expect(args.onSelect).toHaveBeenCalled()
  },
}

/** Wiersze z długimi nazwami (do 20 znaków) i podpisami pustych slotów (#239). */
const longRows: BracketMatchRowData[] = [
  {
    ...quarterFinals![0]!,
    id: 951,
    home: { team: { id: 51, name: 'Niedźwiedzie Mokotów' } },
    away: { team: { id: 52, name: 'Jastrzębie Białołęka' } },
  },
  {
    ...quarterFinals![1]!,
    id: 952,
    home: { team: { id: 53, name: 'Tygrysy Targówek' } },
    away: { team: { id: 54, name: 'Jastrzębie Wilanów' } },
  },
  {
    ...finalRound![0]!,
    id: 953,
    homeScore: null,
    awayScore: null,
    homePenalties: null,
    awayPenalties: null,
    status: 'scheduled',
    home: { team: null, source: 'Przegrany: Półfinał 1' },
    away: { team: null, source: 'Przegrany: Półfinał 2' },
  },
  {
    ...finalRound![1]!,
    id: 954,
    home: { team: null, source: 'Zwycięzca: Półfinał 1' },
    away: { team: null, source: 'Zwycięzca: Półfinał 2' },
  },
]

function LongRows({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {longRows.map((match) => (
        <BracketMatchRow key={match.id} match={match} timeZone={scheduleTimeZone} penaltySlot />
      ))}
    </div>
  )
}

/**
 * Nazwy w każdej szerokości wiersza, od telefonu po szeroki panel (#239):
 * przy oknie ok. 800 px wiersz obok sidebaru ma ok. 510 px i układ
 * pięciokolumnowy zostawiał nazwom 0 px. Nazwa łamie się na drugą linię
 * zamiast dostać wielokropek, pole wyniku stoi w jednej kolumnie, a wiersz
 * nie wystaje poza siebie.
 */
export const ProgUkladu: Story = {
  render: () => <LongRows className="w-[343px]" />,
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector<HTMLElement>('[data-slot="bracket-match-row"]')!.parentElement!.parentElement!
    // Bez `expect` w pętli, jak w „UI/Dane/Wiersz meczu”: każde trafia do panelu
    // Interactions, a przy kilkudziesięciu szerokościach story trwa za długo.
    const problems: string[] = []
    // Od 343 px, czyli treści panelu na telefonie 375 px z DoD #239.
    for (let width = 343; width <= 1024; width += 16) {
      container.style.width = `${width}px`
      for (const name of canvasElement.querySelectorAll<HTMLElement>('[data-slot="bracket-team"]')) {
        problems.push(...textFitProblems(name).map((problem) => `${width}px: ${problem}`))
      }
      for (const row of canvasElement.querySelectorAll('[data-slot="bracket-match-row"]')) {
        if (row.scrollWidth > row.clientWidth) problems.push(`${width}px: wiersz wystaje`)
      }
      const lefts = [...canvasElement.querySelectorAll('[data-slot="bracket-score"]')].map((score) => score.getBoundingClientRect().left)
      if (Math.max(...lefts) - Math.min(...lefts) > 0.5) problems.push(`${width}px: wyniki nie stoją w jednej kolumnie`)
    }
    await expect(problems).toEqual([])
  },
}

/** Telefon 375 px: długie nazwy i podpisy pustych slotów w dwóch liniach, bez wielokropka. */
export const TelefonDlugieNazwy: Story = {
  ...phone375,
  // Szerokość treści panelu przy 375 px, także w Vitest bez marginesu `padded`.
  render: () => <LongRows className="w-[343px] max-w-full" />,
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBe(375)
    await expectTextFits([...canvasElement.querySelectorAll<HTMLElement>('[data-slot="bracket-team"]')])
  },
}

/** Telefon: etykieta nad parą, stan i krawędzie pod nią. */
export const Telefon: Story = {
  args: { match: semiFinals![0]! },
  globals: { viewport: { value: 'mobile2', isRotated: false } },
}

/** Karta mistrza pod listą rund. */
export const Mistrz: StoryObj<typeof BracketChampion> = {
  render: () => <BracketChampion team={cupChampion} className="max-w-sm" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('FC GórkaZwycięzca pucharu')
  },
}

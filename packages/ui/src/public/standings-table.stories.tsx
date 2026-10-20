import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { MIN_TEXT_CONTRAST, contrastRatio } from '../lib/contrast'
import {
  publicBasketballStandingsRows,
  publicGroupStandings,
  publicStandingsRows,
  publicStandingsTiebreakers,
  publicVolleyballStandingsRows,
  publicVolleyballTiebreakers,
} from '../lib/demo-data'
import { withQualifiers } from '../lib/qualifiers'
import { ownBrand } from '../test/brand'
import { cssHex } from '../test/theme'
import { expectTextFits, phone375 } from '../test/viewport'
import { ChampionBand, StandingsTable, TiebreakSentence } from './standings-table'
import { EachSample } from './story-samples'

const meta = {
  title: 'Strona publiczna/Komponenty/Tabela',
  component: StandingsTable,
  parameters: { layout: 'padded' },
  args: { rows: publicStandingsRows.inProgress, scoreLabel: 'Bramki', allowsDraw: true, label: 'Tabela, Faza zasadnicza' },
  render: (args) => (
    <div className="flex flex-col gap-6 px-3">
      <StandingsTable {...args} />
      <TiebreakSentence tiebreakers={publicStandingsTiebreakers} />
    </div>
  ),
} satisfies Meta<typeof StandingsTable>

export default meta
type Story = StoryObj<typeof meta>

const bodyRows = (canvas: HTMLElement) => [...canvas.querySelectorAll<HTMLElement>('[data-slot="standings-row"]')]
const hasBar = (row: HTMLElement) => row.querySelector('[data-slot="standings-bar"]') !== null

/** Kolor zmiennej z najbliższego `.public-site` jako `#rrggbb`. */
function brandVar(element: Element, name: string) {
  const probe = document.createElement('span')
  probe.style.color = `var(${name})`
  element.closest('.public-site')!.append(probe)
  const color = cssHex(getComputedStyle(probe).color)
  probe.remove()
  return color
}

/**
 * Liga w trakcie: każdy skrót w nagłówku ma `title` z pełną nazwą, a pasek
 * lidera stoi tylko przy pierwszym miejscu. Zdanie pod tabelą pomija `points`.
 */
export const Liga: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const titles = canvas.getAllByRole('columnheader').map((header) => [header.textContent, header.querySelector('abbr')?.getAttribute('title') ?? null])
    await expect(titles).toEqual([
      ['#', 'Miejsce'],
      ['Drużyna', null],
      ['M', 'Mecze'],
      ['W', 'Wygrane'],
      ['R', 'Remisy'],
      ['P', 'Porażki'],
      ['Bramki', 'Bramki zdobyte i stracone'],
      ['+/−', 'Bilans'],
      ['Forma', 'Pięć ostatnich meczów, najnowszy z prawej'],
      ['Pkt', 'Punkty'],
    ])
    await expect(bodyRows(canvasElement).map(hasBar)).toEqual([true, false, false, false, false, false, false, false])
    await expect(
      canvas.getByText('Przy równej liczbie punktów: bezpośredni mecz → różnica bramek → bramki zdobyte → nazwa drużyny (alfabetycznie).'),
    ).toBeInTheDocument()
  },
}

/** Przed startem nikt nie prowadzi: bez paska lidera i z pustą formą. */
export const PrzedStartem: Story = {
  name: 'Przed startem',
  args: { rows: publicStandingsRows.beforeStart },
  play: async ({ canvasElement }) => {
    await expect(bodyRows(canvasElement).some(hasBar)).toBe(false)
    await expect(canvasElement.querySelectorAll('[data-result]')).toHaveLength(0)
  },
}

/** Koszykówka: zdobycze to „Punkty”, bez kolumny `R` i bez remisu w formie. */
export const Koszykowka: Story = {
  name: 'Koszykówka',
  args: { rows: publicBasketballStandingsRows, scoreLabel: 'Punkty', allowsDraw: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('columnheader', { name: 'Punkty' })).toBeInTheDocument()
    await expect(canvas.queryByRole('columnheader', { name: 'R' })).not.toBeInTheDocument()
    await expect(canvasElement.querySelectorAll('[data-result]').length).toBeGreaterThan(0)
    await expect(canvasElement.querySelectorAll('[data-result="draw"]')).toHaveLength(0)
  },
}

const groupA = publicGroupStandings[0]!

/**
 * Grupa (wariant zwarty): pasek mają dokładnie drużyny nad linią wyjścia,
 * a linia stoi między ostatnią wychodzącą a pierwszą niewychodzącą.
 */
export const Grupa: Story = {
  args: { rows: withQualifiers(groupA.rows, groupA.qualifiers), compact: true, group: true, label: `Tabela, ${groupA.name}` },
  play: async ({ canvasElement }) => {
    const rows = bodyRows(canvasElement)
    await expect(rows.map(hasBar)).toEqual([true, true, false, false])
    const lines = rows.map((row) => row.querySelector('[data-slot="qualifiers-line"]') !== null)
    await expect(lines).toEqual([false, false, true, false])
    await expect(within(rows[2]!).getByText('wyjście z grupy')).toBeVisible()
    await expect(within(canvasElement).queryByRole('columnheader', { name: 'Forma' })).not.toBeInTheDocument()
    await expect(within(canvasElement).queryByRole('columnheader', { name: 'Bramki' })).not.toBeInTheDocument()
  },
}

/**
 * Telefon 375 px: widać tylko `#`, Drużyna, `M`, `+/−` i `Pkt`, strona nie
 * przewija się w bok, a nazwy drużyn mieszczą się bez ucinania.
 */
export const Telefon: Story = {
  ...phone375,
  play: async ({ canvasElement }) => {
    await document.fonts.ready
    const visible = within(canvasElement).getAllByRole('columnheader').filter((header) => header.checkVisibility())
    await expect(visible.map((header) => header.textContent)).toEqual(['#', 'Drużyna', 'M', '+/−', 'Pkt'])
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
    await expectTextFits([...canvasElement.querySelectorAll<HTMLElement>('[data-slot="team-name"]')])
  },
}

/**
 * Pas „Mistrz” na czterech kolorach turnieju: tekst na wypełnieniu ma
 * kontrast ≥ 4,5:1 z `--brand`, a obrys ma kolor `--brand-line`.
 */
export const PasMistrza: Story = {
  name: 'Pas „Mistrz”',
  parameters: ownBrand,
  render: () => <EachSample>{() => <ChampionBand row={publicStandingsRows.finished[0]!} scoreLabel="Bramki" />}</EachSample>,
  play: async ({ canvasElement }) => {
    const bands = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="champion-band"]')]
    await expect(bands).toHaveLength(4)
    for (const band of bands) {
      const sample = band.closest<HTMLElement>('[data-sample]')!.dataset.sample
      const style = getComputedStyle(band)
      const fill = cssHex(style.backgroundColor)
      await expect({ sample, fill }).toEqual({ sample, fill: brandVar(band, '--brand') })
      await expect({ sample, border: cssHex(style.borderTopColor), width: style.borderTopWidth }).toEqual({
        sample,
        border: brandVar(band, '--brand-line'),
        width: '1px',
      })
      const texts = [...band.querySelectorAll<HTMLElement>('span')].filter((span) => span.childElementCount === 0 && span.textContent?.trim())
      await expect(texts.length).toBeGreaterThan(0)
      for (const text of texts) {
        const ratio = contrastRatio(cssHex(getComputedStyle(text).color), fill)
        await expect({ sample, text: text.textContent, ok: ratio >= MIN_TEXT_CONTRAST }).toEqual({ sample, text: text.textContent, ok: true })
      }
    }
  },
}

/**
 * Siatkówka (#301): zdobycze to sety, za nimi kolumna punktów w setach
 * z etykietą z odpowiedzi (`rallyPointsLabel`), bez remisów. Czaple stoją
 * przed Mewami przy równych punktach i zwycięstwach: rozdziela je stosunek setów.
 */
export const Siatkowka: Story = {
  name: 'Siatkówka',
  args: { rows: publicVolleyballStandingsRows, scoreLabel: 'Sety', allowsDraw: false, rallyPointsLabel: 'Punkty w setach' },
  render: (args) => (
    <div className="flex flex-col gap-6 px-3">
      <StandingsTable {...args} />
      <TiebreakSentence tiebreakers={publicVolleyballTiebreakers} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const titles = canvas.getAllByRole('columnheader').map((header) => [header.textContent, header.querySelector('abbr')?.getAttribute('title') ?? null])
    await expect(titles).toEqual([
      ['#', 'Miejsce'],
      ['Drużyna', null],
      ['M', 'Mecze'],
      ['W', 'Wygrane'],
      ['P', 'Porażki'],
      ['Sety', 'Sety zdobyte i stracone'],
      ['Punkty w setach', 'Punkty w setach zdobyte i stracone'],
      ['+/−', 'Bilans'],
      ['Forma', 'Pięć ostatnich meczów, najnowszy z prawej'],
      ['Pkt', 'Punkty'],
    ])
    await expect([...canvasElement.querySelectorAll('[data-slot="rally-points"]')].map((cell) => cell.textContent)).toEqual([
      '183:162',
      '183:188',
      '155:161',
      '195:205',
    ])
    await expect(
      [...canvasElement.querySelectorAll('[data-slot="team-name"]')].map((name) => name.textContent),
    ).toEqual(['Orlęta Wawer', 'Czaple Ursynów', 'Mewy Żoliborz', 'Jaskółki Targówek'])
    await expect(
      canvas.getByText('Przy równej liczbie punktów: zwycięstwa → stosunek setów → stosunek punktów w setach → bezpośredni mecz → nazwa drużyny (alfabetycznie).'),
    ).toBeInTheDocument()
  },
}

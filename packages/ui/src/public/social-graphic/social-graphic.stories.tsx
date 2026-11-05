import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'
import { SOCIAL_GRAPHIC_SIZE, type SocialGraphicContent, type SocialGraphicFormat } from './data'
import {
  BROKEN_IMAGE,
  SAMPLE_TIME_ZONE,
  basketballSample,
  extremeSample,
  footballSample,
  sampleContents,
  volleyballSample,
  type GraphicSample,
} from './samples'
import { SocialGraphic } from './social-graphic'

/** Kilka grafik obok siebie: rodzaje próbki w jednym formacie. */
function Gallery({ sample, format, contents = sampleContents(sample) }: { sample: GraphicSample; format: SocialGraphicFormat; contents?: SocialGraphicContent[] }) {
  return (
    <div className="flex flex-wrap items-start gap-6 p-6">
      {contents.map((content) => (
        <SocialGraphic key={content.kind} tournament={sample.tournament} format={format} content={content} timeZone={SAMPLE_TIME_ZONE} />
      ))}
    </div>
  )
}

const meta = {
  title: 'Strona publiczna/Komponenty/Grafika',
  component: Gallery,
  parameters: { layout: 'fullscreen' },
  args: { sample: footballSample, format: '4:5' },
} satisfies Meta<typeof Gallery>

export default meta
type Story = StoryObj<typeof meta>

const graphics = (canvas: HTMLElement) => [...canvas.querySelectorAll<HTMLElement>('[data-slot="social-graphic"]')]

const graphic = (canvas: HTMLElement, kind: SocialGraphicContent['kind']) =>
  canvas.querySelector<HTMLElement>(`[data-slot="social-graphic"][data-kind="${kind}"]`)!

/** Każda grafika ma wymiary formatu, a żaden wiersz listy nie wychodzi poza kadr. */
async function expectFramed(canvas: HTMLElement, format: SocialGraphicFormat) {
  const { width, height } = SOCIAL_GRAPHIC_SIZE[format]
  for (const frame of graphics(canvas).filter((candidate) => candidate.dataset.format === format)) {
    const box = frame.getBoundingClientRect()
    await expect(box.width).toBe(width)
    await expect(box.height).toBe(height)
    for (const item of frame.querySelectorAll('li, [data-slot="social-graphic-note"]')) {
      await expect(item.getBoundingClientRect().bottom).toBeLessThanOrEqual(box.bottom + 0.5)
    }
  }
}

/** Liczba z dopisku „i N kolejnych…” albo `null`, gdy go nie ma. */
function noteCount(frame: HTMLElement): number | null {
  const text = frame.querySelector('[data-slot="social-graphic-note"]')?.textContent
  return text ? Number(/i (\d+) kolejnych/.exec(text)![1]) : null
}

export const Pilka45: Story = {
  name: 'Piłka 4:5',
  play: async ({ canvasElement }) => {
    await expect(graphics(canvasElement)).toHaveLength(4)
    await expectFramed(canvasElement, '4:5')
    await expect(within(graphic(canvasElement, 'matchPreview')).getByText('12:00')).toBeVisible()
    await expect(within(graphic(canvasElement, 'matchPreview')).getByText('Boisko Bemowo')).toBeVisible()
    await expect(within(graphic(canvasElement, 'matchResult')).getByText('Adam Zieliński 15′, Tomasz Lis 70′')).toBeVisible()
    await expect(within(graphic(canvasElement, 'standings')).getByText('Po kolejce 3')).toBeVisible()
    await expect(within(graphic(canvasElement, 'standings')).getByText('Bramki')).toBeVisible()
    await expect(within(graphic(canvasElement, 'leaderboard')).getByText('Bramki · lider')).toBeVisible()
  },
}

export const Pilka916: Story = {
  name: 'Piłka 9:16',
  args: { format: '9:16' },
  play: async ({ canvasElement }) => {
    await expect(graphics(canvasElement)).toHaveLength(4)
    await expectFramed(canvasElement, '9:16')
  },
}

/** Etykieta zdobyczy to „Punkty”, a zapowiedź pokazuje halę. */
export const Koszykowka45: Story = {
  name: 'Koszykówka 4:5',
  args: { sample: basketballSample },
  play: async ({ canvasElement }) => {
    await expectFramed(canvasElement, '4:5')
    await expect(within(graphic(canvasElement, 'standings')).getByText('Punkty')).toBeVisible()
    await expect(within(graphic(canvasElement, 'standings')).getByText('168:141')).toBeVisible()
    await expect(within(graphic(canvasElement, 'leaderboard')).getByText('Punkty · lider')).toBeVisible()
    await expect(within(graphic(canvasElement, 'matchResult')).getByText('71–78')).toBeVisible()
    await expect(within(graphic(canvasElement, 'matchPreview')).getByText(/Hala OSiR Wola/)).toBeVisible()
  },
}

export const Koszykowka916: Story = {
  name: 'Koszykówka 9:16',
  args: { sample: basketballSample, format: '9:16' },
  play: async ({ canvasElement }) => {
    await expectFramed(canvasElement, '9:16')
  },
}

/** Wynik to sety wygrane z listą setów, a bilans tabeli liczy sety. */
export const Siatkowka45: Story = {
  name: 'Siatkówka 4:5',
  args: { sample: volleyballSample },
  play: async ({ canvasElement }) => {
    await expectFramed(canvasElement, '4:5')
    await expect(within(graphic(canvasElement, 'matchResult')).getByText('25:20, 23:25, 25:22, 25:19')).toBeVisible()
    await expect(within(graphic(canvasElement, 'standings')).getByText('Sety')).toBeVisible()
  },
}

export const Siatkowka916: Story = {
  name: 'Siatkówka 9:16',
  args: { sample: volleyballSample, format: '9:16' },
  play: async ({ canvasElement }) => {
    await expectFramed(canvasElement, '9:16')
  },
}

/**
 * Długa lista: 16 drużyn. Tabela trzyma najwyżej 10 wierszy, a gdy kadr
 * mieści mniej, wiersze gęstnieją i reszta idzie w dopisek.
 */
export const DlugaLista: Story = {
  name: 'Długa lista',
  args: { sample: extremeSample, contents: [{ kind: 'standings', data: extremeSample.standings }] },
  render: (args) => (
    <div className="flex flex-wrap items-start">
      <Gallery {...args} format="4:5" />
      <Gallery {...args} format="9:16" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const frame of graphics(canvasElement)) {
      const rows = frame.querySelectorAll('li').length
      await expect(rows).toBeLessThanOrEqual(10)
      await expect(noteCount(frame)).toBe(16 - rows)
      await expect(frame).toHaveTextContent('kolejnych drużyn')
    }
    await expectFramed(canvasElement, '4:5')
    await expectFramed(canvasElement, '9:16')
  },
}

/** Pięciu zawodników ex aequo na 5. miejscu: wchodzą do granicy 8 wierszy, reszta w dopisku. */
export const RemisNaPiatymMiejscu: Story = {
  name: 'Remis na 5. miejscu',
  args: { sample: extremeSample, contents: [{ kind: 'leaderboard', data: extremeSample.leaderboard }] },
  play: async ({ canvasElement }) => {
    const frame = graphic(canvasElement, 'leaderboard')
    // Lider na karcie i siedmiu na liście: granica 8 wierszy.
    await expect(frame.querySelectorAll('li')).toHaveLength(7)
    await expect([...frame.querySelectorAll('li')].filter((row) => row.firstElementChild!.textContent === '5')).toHaveLength(4)
    await expect(noteCount(frame)).toBe(2)
  },
}

export const MeczPucharowyZKarnymi: Story = {
  name: 'Mecz pucharowy z karnymi',
  args: { sample: extremeSample, contents: [{ kind: 'matchResult', data: extremeSample.result }] },
  play: async ({ canvasElement }) => {
    const frame = within(graphic(canvasElement, 'matchResult'))
    await expect(frame.getByText('Wynik · Półfinał')).toBeVisible()
    await expect(frame.getByText('karne 4:3')).toBeVisible()
    await expect(frame.getByText(/Jan Kowalczyk 33′ \(sam\.\), Adam Nowak$/)).toBeVisible()
  },
}

export const ZapowiedzBezObiektu: Story = {
  name: 'Zapowiedź bez obiektu',
  args: { sample: extremeSample, contents: [{ kind: 'matchPreview', data: extremeSample.preview! }] },
  play: async ({ canvasElement }) => {
    const frame = graphic(canvasElement, 'matchPreview')
    await expect(within(frame).getByText('18:30')).toBeVisible()
    await expect(within(frame).getByText('Zapowiedź · Ćwierćfinał')).toBeVisible()
    // Pod godziną zostaje sam dzień meczu.
    await expect(within(frame).getByText('18:30').parentElement!.children).toHaveLength(2)
  },
}

/** Długie nazwy drużyn i turnieju we wszystkich rodzajach i obu formatach. */
export const Skrajne: Story = {
  args: { sample: extremeSample },
  render: (args) => (
    <div>
      <Gallery {...args} format="4:5" />
      <Gallery {...args} format="9:16" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(graphics(canvasElement)).toHaveLength(8)
    for (const frame of graphics(canvasElement)) {
      const box = frame.getBoundingClientRect()
      for (const item of frame.querySelectorAll('li, [data-slot="social-graphic-note"]')) {
        await expect(item.getBoundingClientRect().bottom).toBeLessThanOrEqual(box.bottom + 0.5)
      }
    }
  },
}

/** Herb i logo, których nie da się wczytać: w ich miejscu herb zastępczy i logo domyślne. */
export const ObrazSieNieWczytuje: Story = {
  name: 'Obraz się nie wczytuje',
  args: {
    sample: {
      ...footballSample,
      tournament: { ...footballSample.tournament, logoUrl: BROKEN_IMAGE },
      result: {
        ...footballSample.result,
        home: { name: 'Sokoły Ursus', logoUrl: BROKEN_IMAGE },
        away: { name: 'Orły Bielany', logoUrl: BROKEN_IMAGE },
      },
    },
    contents: undefined,
  },
  render: ({ sample, format }) => <Gallery sample={sample} format={format} contents={[{ kind: 'matchResult', data: sample.result }]} />,
  play: async ({ canvasElement }) => {
    const frame = graphic(canvasElement, 'matchResult')
    await waitFor(() => expect(frame.querySelectorAll('img')).toHaveLength(0))
    await expect(frame.querySelectorAll('[data-slot="crest-fallback"]')).toHaveLength(2)
    await expect(frame.querySelectorAll('[data-slot="tournament-logo-default"]')).toHaveLength(2)
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { BackTo } from './button'
import { Fact, PageHead, SectionHead } from './heads'
import { LiveTag } from './live'
import { ScoreCell } from './score-cell'

const meta = {
  title: 'Strona publiczna/Komponenty/Nagłówki',
  component: PageHead,
  parameters: { layout: 'padded' },
  args: {
    eyebrow: '3–4 października',
    title: 'Kolejka 5',
    meta: (
      <>
        <Fact value="1 z 4">rozegrane</Fact>
        <Fact value="14">kolejek</Fact>
      </>
    ),
  },
} satisfies Meta<typeof PageHead>

export default meta
type Story = StoryObj<typeof meta>

/** Nagłówek ekranu: podpis, tytuł tablicą i fakty po prawej, bez kropek między nimi. */
export const NaglowekEkranu: Story = { name: 'Nagłówek ekranu' }

/** Belka sekcji: tytuł zdaniem na grubej linii i odnośnik do pełnego widoku. */
export const BelkaSekcji: Story = {
  name: 'Belka sekcji',
  render: () => <SectionHead title="Tabela" link={{ label: 'Pełna tabela', href: '#' }} sub="Po 5 kolejkach" />,
}

/** Powrót ze strony meczu do zakładki. */
export const Powrot: Story = {
  name: 'Powrót',
  render: () => <BackTo href="#">Wyniki</BackTo>,
}

/** Okienko wyniku: cyfra na `--pub-sunken`, przegrany przygaszony, „–” bez wyniku. */
export const OkienkoWyniku: Story = {
  name: 'Okienko wyniku',
  render: () => (
    <div className="flex items-center gap-6">
      <span className="flex gap-1">
        <ScoreCell value={3} />
        <ScoreCell value={1} dim />
      </span>
      <span className="flex gap-1">
        <ScoreCell value={null} />
        <ScoreCell value={null} />
      </span>
      <LiveTag />
    </div>
  ),
}

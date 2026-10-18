/**
 * PROTOTYP S7 (#287) — shell i Przegląd strony publicznej w trzech wariantach
 * kierunku A „Tablica wyników”, na `.dark`. Gałąź `prototype/s7-kierunek`,
 * nie trafia do `main`.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useArgs } from 'storybook/preview-api'
import { ACCENT_SAMPLES } from './accent'
import { overviewData } from './demo'
import { Switcher, VARIANTS, STATES, type PrototypeArgs } from './switcher'
import { VariantA } from './variant-a'
import { VariantB } from './variant-b'
import { VariantC } from './variant-c'

function PrototypeOverview({ updateArgs, ...args }: PrototypeArgs & { updateArgs?: (next: Partial<PrototypeArgs>) => void }) {
  const data = overviewData(args.state)
  const accent = ACCENT_SAMPLES[args.accent].hex
  return (
    <>
      {args.variant === 'C' && <VariantC data={data} accent={accent} />}
      {args.variant !== 'C' && args.state === 'bez-terminarza' && (
        <div className="dark grid min-h-screen place-items-center bg-background p-6 text-center text-muted-foreground">
          Wariant {args.variant} odpadł w #287. Stan „Bez terminarza” ma tylko C.
        </div>
      )}
      {args.variant === 'A' && args.state !== 'bez-terminarza' && <VariantA data={data} accent={accent} />}
      {args.variant === 'B' && args.state !== 'bez-terminarza' && <VariantB data={data} accent={accent} photo={args.photo} />}
      {updateArgs && <Switcher args={args} update={updateArgs} />}
    </>
  )
}

const meta = {
  title: 'Strona publiczna/Prototyp S7/Przegląd',
  component: PrototypeOverview,
  parameters: { layout: 'fullscreen' },
  // `useArgs` działa tylko w funkcji story, nie w komponencie.
  render: function Render(args) {
    const [, updateArgs] = useArgs<PrototypeArgs>()
    return <PrototypeOverview {...args} updateArgs={updateArgs} />
  },
  args: { variant: 'C', state: 'w-trakcie', accent: 'zielen', photo: true },
  argTypes: {
    variant: { control: 'inline-radio', options: Object.keys(VARIANTS), labels: VARIANTS },
    state: { control: 'inline-radio', options: Object.keys(STATES), labels: STATES },
    accent: { control: 'inline-radio', options: Object.keys(ACCENT_SAMPLES) },
    photo: { control: 'boolean' },
  },
} satisfies Meta<typeof PrototypeOverview>

export default meta
type Story = StoryObj<typeof meta>

export const Warianty: Story = {}

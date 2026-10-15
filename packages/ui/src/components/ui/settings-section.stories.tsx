import type { Meta, StoryObj } from '@storybook/react-vite'
import { Trash2 } from 'lucide-react'
import { expect, within } from 'storybook/test'
import { desktop1280, phone375 } from '../../test/viewport'
import { Button } from './button'
import { Card, CardContent } from './card'
import { Input } from './input'
import { Label } from './label'
import { SettingsSection } from './settings-section'

const meta = {
  title: 'UI/SettingsSection',
  component: SettingsSection,
  tags: ['autodocs'],
} satisfies Meta<typeof SettingsSection>

export default meta
type Story = StoryObj<typeof meta>

/** Dwie karty jak na ekranie ustawień: sekcja z polami i sekcja z samą akcją. */
function Sections() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <SettingsSection title="Dane" description="Nazwa turnieju i adres jego strony publicznej.">
            <div className="space-y-2">
              <Label htmlFor="name">Nazwa</Label>
              <Input id="name" defaultValue="Liga Osiedlowa 2026" />
            </div>
          </SettingsSection>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <SettingsSection
            title="Usuwanie turnieju"
            description="Usunięcie turnieju kasuje drużyny, mecze i wyniki. Tego nie da się cofnąć."
            action={
              <Button variant="destructive">
                <Trash2 className="size-4" /> Usuń turniej
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}

function box(element: Element) {
  return element.getBoundingClientRect()
}

/** Sekcja, opis (nagłówek z akapitem) i pudełko z polami albo akcją. */
function parts(canvasElement: HTMLElement, title: string) {
  const heading = within(canvasElement).getByRole('heading', { name: title })
  const section = heading.closest<HTMLElement>('[data-slot="settings-section"]')!
  return { section, description: heading.parentElement!, content: section.lastElementChild!.firstElementChild! }
}

/** Od `lg`: opis po lewej, pola obok w kolumnie do 672 px, akcja przy prawym brzegu i w połowie wysokości. */
export const Komputer: Story = {
  ...desktop1280,
  args: { title: 'Dane' },
  render: () => <Sections />,
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBe(1280)

    const data = parts(canvasElement, 'Dane')
    await expect(box(data.content).left).toBeGreaterThan(box(data.description).right)
    await expect(box(data.content).top).toBe(box(data.description).top)
    await expect(box(data.content).width).toBeLessThanOrEqual(672)

    const deletion = parts(canvasElement, 'Usuwanie turnieju')
    const action = within(deletion.section).getByRole('button', { name: 'Usuń turniej' })
    const section = box(deletion.section)
    await expect(Math.round(box(action).right)).toBe(Math.round(section.right))
    await expect(Math.abs(box(action).top + box(action).height / 2 - (section.top + section.height / 2))).toBeLessThanOrEqual(1)
  },
}

/** Poniżej `lg` wszystko w jednej kolumnie: pola pod opisem, akcja pod nim przy lewej krawędzi. */
export const Telefon: Story = {
  ...phone375,
  args: { title: 'Dane' },
  render: () => <Sections />,
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBe(375)

    const data = parts(canvasElement, 'Dane')
    await expect(box(data.content).top).toBeGreaterThanOrEqual(box(data.description).bottom)
    await expect(box(data.content).left).toBe(box(data.description).left)

    const deletion = parts(canvasElement, 'Usuwanie turnieju')
    const action = within(deletion.section).getByRole('button', { name: 'Usuń turniej' })
    await expect(box(action).top).toBeGreaterThanOrEqual(box(deletion.description).bottom)
    await expect(box(action).left).toBe(box(deletion.section).left)
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  },
}

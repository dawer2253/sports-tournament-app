import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { ChoiceCards } from './choice-cards';

const OPTIONS = [
  { value: 'league', label: 'Liga' },
  { value: 'cup', label: 'Puchar' },
];

function renderCards(value: string | undefined) {
  const ref = createRef<HTMLInputElement>();
  render(
    <ChoiceCards
      legend="Format rozgrywek"
      name="format"
      options={OPTIONS}
      value={value}
      onChange={() => {}}
      errorMessage="Wybierz format rozgrywek."
      ref={ref}
    />,
  );
  return ref;
}

// Na ekranie zakładania turnieju zaznaczona grupa z błędem zdarza się tylko po
// 422 z API, a wtedy react-hook-form fokusu nie przenosi. Dlatego to, gdzie
// trafia ref, sprawdzamy na samym komponencie.
describe('ChoiceCards', () => {
  it('podpina ref do zaznaczonego radia', () => {
    const ref = renderCards('cup');

    expect(ref.current).toBe(screen.getByRole('radio', { name: 'Puchar' }));
  });

  it('bez zaznaczenia podpina ref do pierwszego radia', () => {
    const ref = renderCards(undefined);

    expect(ref.current).toBe(screen.getByRole('radio', { name: 'Liga' }));
  });
});

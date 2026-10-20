import type { TeamRegistrationCreate } from '@tournament/api-client';
import type { RegistrationDraft, RegistrationErrors } from '@tournament/ui/public';

const NUMBER_ERROR = 'Numer to liczba od 0 do 999.';

/**
 * Pola formularza zgłoszenia (#300) jako ciało `POST /public/t/{slug}/registrations`.
 * Jedyne, czego API nie przyjmie od ręki, to numer zawodnika: pole daje napis,
 * a kontrakt chce liczby albo `null`. Napis spoza 0–999 zostaje błędem pod
 * polem, zanim cokolwiek pójdzie do API — wysłany jako tekst odbiłby się od
 * typu, a nie od reguły z komunikatem.
 *
 * Reszty nie walidujemy: reguły zna API i oddaje je pod tymi samymi kluczami.
 */
export function registrationBody(draft: RegistrationDraft): { body: TeamRegistrationCreate } | { errors: RegistrationErrors } {
  const errors: Record<string, string> = {};

  const players = draft.players.map((player, index) => {
    const number = player.number.trim();
    if (number !== '' && !/^\d{1,3}$/.test(number)) errors[`players.${index}.number`] = NUMBER_ERROR;
    return { name: player.name, number: number === '' ? null : Number(number) };
  });

  if (Object.keys(errors).length > 0) return { errors };

  return {
    body: {
      teamName: draft.teamName,
      contactName: draft.contactName,
      contactEmail: draft.contactEmail,
      contactPhone: draft.contactPhone.trim() === '' ? null : draft.contactPhone,
      players,
      consent: draft.consent,
      // Pole-pułapka idzie tylko wypełnione: wtedy API udaje sukces (#300).
      ...(draft.website === '' ? {} : { website: draft.website }),
    },
  };
}

/** `errors` z odpowiedzi `422` → pierwszy komunikat pod każdym kluczem. */
export function firstErrors(errors: Record<string, string[]> | undefined): RegistrationErrors {
  return Object.fromEntries(Object.entries(errors ?? {}).map(([key, messages]) => [key, messages[0] ?? '']));
}

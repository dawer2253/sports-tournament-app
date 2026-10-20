import type { ApiValidationError } from '@tournament/api-client';
import {
  RegistrationClosed,
  RegistrationScreen,
  RegistrationSent,
  type RegistrationDraft,
  type RegistrationErrors,
} from '@tournament/ui/public';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { firstErrors, registrationBody } from '../lib/registration-body';
import { tabHref, useTournament } from './tournament-layout';

const SEND_FAILED = 'Nie udało się wysłać zgłoszenia. Spróbuj ponownie.';

/** Wynik wysłania: potwierdzenie albo błędy do pokazania na ekranie. */
type Outcome = { sent: string } | { errors: RegistrationErrors; formError?: string };

/**
 * Formularz zgłoszenia drużyny (#300) pod `/t/:slug/zgloszenie`. Przy
 * zamkniętych zapisach — także pod bezpośrednim adresem — ekran „Zapisy są
 * zamknięte”, a po wysłaniu potwierdzenie. Strona tylko wysyła zgłoszenie
 * i podaje ekranowi błędy z API.
 */
export function RegistrationPage() {
  const tournament = useTournament();
  const { slug } = tournament;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const back = { backHref: tabHref(slug, 'home'), onBack: () => void navigate(tabHref(slug, 'home')) };

  const send = useMutation({
    mutationFn: async (draft: RegistrationDraft): Promise<Outcome> => {
      const prepared = registrationBody(draft);
      if ('errors' in prepared) return { errors: prepared.errors };

      const { data, error, response } = await api.POST('/public/t/{slug}/registrations', {
        params: { path: { slug } },
        body: prepared.body,
      });
      if (data) return { sent: data.data.teamName };
      if (response.status === 422) {
        const errors = firstErrors((error as ApiValidationError).errors);
        // Zapisy zamknęły się, odkąd strona pobrała turniej: odświeżony
        // turniej zdejmie pasek i formularz.
        if ('registration' in errors) void queryClient.invalidateQueries({ queryKey: ['public', slug] });
        return { errors };
      }
      return { errors: {}, formError: error?.message ?? SEND_FAILED };
    },
    onSuccess: setOutcome,
    onError: () => setOutcome({ errors: {}, formError: SEND_FAILED }),
  });

  if (outcome && 'sent' in outcome) return <RegistrationSent teamName={outcome.sent} {...back} />;

  if (!tournament.registration.open) return <RegistrationClosed {...back} />;

  return (
    <RegistrationScreen
      deadline={tournament.registration.deadline}
      errors={outcome?.errors}
      formError={outcome?.formError}
      submitting={send.isPending}
      onSubmit={(draft) => send.mutate(draft)}
    />
  );
}

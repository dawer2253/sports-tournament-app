import type { PublicMatch } from '@tournament/api-client';
import { FixturesScreen, groupByRound, LoadError, MatchListLoading, ResultsScreen } from '@tournament/ui/public';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useFixtures, useResults } from '../lib/queries';
import { matchHref, tabHref, useTournament } from './tournament-layout';
import { useBracketRows } from './use-bracket';
import { useGroups } from './use-groups';

/**
 * Mecze pogrupowane po kolejce w kolejności faz z `stages` turnieju — ta sama
 * dla Terminarza, Wyników i Przeglądu, żeby „najbliższa” i „ostatnia”
 * kolejka znaczyły wszędzie to samo.
 */
export function useRounds(matches: PublicMatch[] | undefined, direction: 'asc' | 'desc') {
  const { stages } = useTournament();
  const { group } = useGroups();
  // W pucharze wiersze niosą etykietę pozycji, karne i podpisy pustych slotów (#234).
  const rows = useBracketRows(matches);
  return useMemo(() => {
    const stageOrder = new Map(stages.map((stage) => [stage.id, stage.order]));
    // Mecz grupy niesie nazwę grupy w miejscu etykiety pozycji (#268).
    const labelled = (rows ?? []).map((row) => {
      const name = group(row.groupId)?.name;
      return name ? { ...row, group: name } : row;
    });
    return groupByRound(labelled, { direction, stageOrder: (id) => stageOrder.get(id) ?? id });
  }, [rows, direction, stages, group]);
}

const SCREENS = { fixtures: FixturesScreen, results: ResultsScreen };
const LABELS = { fixtures: 'terminarza', results: 'wyników' };

/**
 * Terminarz albo Wyniki (#292): ekran z `@tournament/ui/public` na obu
 * listach naraz (`/fixtures` i `/results`, te same klucze co Przegląd), bo
 * Terminarz liczy postęp kolejki z całej kolejki, a obie zakładki rozróżniają
 * puste stany. Cały wiersz prowadzi na stronę meczu (#210). Godziny liczy
 * strefa przeglądarki (`Tournament.timezone` odłożone, #158).
 */
export function MatchRounds({ mode }: { mode: 'fixtures' | 'results' }) {
  const { slug } = useTournament();
  const navigate = useNavigate();
  const fixtures = useFixtures(slug);
  const results = useResults(slug);
  const fixtureRounds = useRounds(fixtures.data, 'asc');
  const resultRounds = useRounds(results.data, 'desc');

  // Dane wygrywają z błędem: nieudane odświeżenie w tle nie zdejmuje listy.
  if (!fixtures.data || !results.data) {
    const failed = fixtures.data ? null : fixtures.error;
    const error = failed ?? (results.data ? null : results.error);
    if (error) {
      return (
        <LoadError
          label={LABELS[mode]}
          message={error.message}
          onRetry={() => {
            if (!fixtures.data) void fixtures.refetch();
            if (!results.data) void results.refetch();
          }}
        />
      );
    }
    return <MatchListLoading label={LABELS[mode]} />;
  }

  const Screen = SCREENS[mode];
  return (
    <Screen
      fixtures={fixtureRounds}
      results={resultRounds}
      matchHref={(match) => matchHref(slug, match.id)}
      onMatchNavigate={(match) => void navigate(matchHref(slug, match.id))}
      navHref={(key) => tabHref(slug, key)}
      onNavigate={(key) => void navigate(tabHref(slug, key))}
    />
  );
}

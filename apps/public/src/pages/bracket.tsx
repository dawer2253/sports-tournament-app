import { BracketTree, EmptyState } from '@tournament/ui';
import { GitFork } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { QueryState } from './query-state';
import { TabLink } from './tab-link';
import { matchHref, useTournament } from './tournament-layout';
import { useBracket } from './use-bracket';

/** Parametr adresu z pierwszą rundą okna: jej `order`. */
const START_PARAM = 'od';

/**
 * Drabinka (#234, wariant B z #218): drzewo fazy pucharowej w oknie rund,
 * z kompletu meczów fazy (`/matches?stageId=`), odpytywane jak pozostałe
 * zakładki. Pierwsza runda okna siedzi w `?od=`; bez niego okno zaczyna się
 * od rundy z pierwszym niezakończonym meczem, a po finale kończy się na
 * finale. Kafel prowadzi na stronę meczu.
 *
 * Liga pod `/drabinka` ma pusty stan z odnośnikiem do Tabeli, a puchar bez
 * wygenerowanej drabinki — pusty stan bez odnośnika: aktywacja turnieju nie
 * wymaga drabinki.
 */
export function BracketPage() {
  const { slug } = useTournament();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { stage, matches, penaltySlot } = useBracket();

  if (!stage) {
    return (
      <EmptyState
        icon={<GitFork />}
        title="Ten turniej nie ma drabinki"
        description="Drabinkę ma faza pucharowa. Ten turniej gra w tabeli."
        action={<TabLink tab="standings">Przejdź do tabeli</TabLink>}
      />
    );
  }

  if (!matches.data) {
    return <QueryState error={matches.error} label="drabinki" onRetry={() => void matches.refetch()} />;
  }

  if (matches.data.length === 0) {
    return (
      <EmptyState
        icon={<GitFork />}
        title="Drabinki jeszcze nie ma"
        description="Pojawi się tu, gdy organizator rozstawi drużyny i ją wygeneruje."
      />
    );
  }

  const requested = Number(params.get(START_PARAM));

  return (
    <BracketTree
      matches={matches.data}
      start={Number.isInteger(requested) && requested > 0 ? requested : undefined}
      onStartChange={(order) =>
        setParams(
          (current) => {
            const next = new URLSearchParams(current);
            next.set(START_PARAM, String(order));
            return next;
          },
          { replace: true },
        )
      }
      penaltySlot={penaltySlot}
      matchHref={(match) => matchHref(slug, match.id)}
      onMatchNavigate={(match) => void navigate(matchHref(slug, match.id))}
    />
  );
}

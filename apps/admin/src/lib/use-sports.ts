import { useQuery } from '@tanstack/react-query';
import { api } from './api';

/**
 * Sporty z konfiguracją (`GET /sports`) pod kluczem `['sports']`. Kreator bierze
 * z nich listę do wyboru, a ustawienia turnieju — punktację domyślną, remisy
 * i etykiety tiebreaków, których `Tournament.sport` nie niesie.
 */
export function useSports() {
  return useQuery({
    queryKey: ['sports'],
    queryFn: async () => {
      const { data, error } = await api.GET('/sports');
      if (error) throw new Error(error.message);
      return data.data;
    },
    // Lista sportów jest predefiniowana w systemie i nie zmienia się w trakcie
    // pracy z panelem, więc nie ma po co odpytywać jej przy każdym wejściu.
    staleTime: Infinity,
  });
}

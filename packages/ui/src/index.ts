// Publiczne wejście pakietu. Aplikacje importują stąd, a nie z głębokich ścieżek.
// Style motywu doładowuje się osobno: import '@tournament/ui/styles.css'.

export { cn } from './lib/utils';
export * from './lib/contrast';
export * from './lib/kickoff';

export * from './components/ui/avatar';
export * from './components/ui/badge';
export * from './components/ui/brand-color-picker';
export * from './components/ui/button';
export * from './components/ui/card';
export * from './components/ui/checkbox';
export * from './components/ui/confirm-delete-dialog';
export * from './components/ui/dialog';
export * from './components/ui/dropdown-menu';
export * from './components/ui/empty-state';
export * from './components/ui/form-dialog';
export * from './components/ui/image-file-field';
export * from './components/ui/image-with-fallback';
export * from './components/ui/input';
export * from './components/ui/label';
export * from './components/ui/popover';
export * from './components/ui/progress';
export * from './components/ui/scroll-area';
export * from './components/ui/select';
export * from './components/ui/separator';
export * from './components/ui/sheet';
export * from './components/ui/skeleton';
export * from './components/ui/sonner';
export * from './components/ui/switch';
export * from './components/ui/table';
export * from './components/ui/tabs';
export * from './components/ui/textarea';
export * from './components/ui/tooltip';
export * from './components/ui/typography';

export * from './components/data/data-table';
export * from './components/data/live-match-tile';
export * from './components/data/match-row';
export * from './components/data/match-row-data';
export * from './components/data/match-event-data';
export * from './components/data/event-type-buttons';
export * from './components/data/player-number-grid';
export * from './components/data/match-timeline';
export * from './components/data/match-status-toggle';
export * from './components/data/player-row';
export * from './components/data/players-table';
export * from './components/data/round-list';
export * from './components/data/round-groups';
export * from './components/data/round-matches';
export * from './components/data/round-summary';
export * from './components/data/score-inputs';
export * from './components/data/standings-table';
export * from './components/data/standings-snippet';
export * from './components/data/standings-table-row';
export * from './components/data/team-row';
export * from './components/data/teams-table';
export * from './components/data/tiebreaker-editor';
export * from './components/data/tiebreaker-item';
export * from './components/data/tiebreaker-list';
export * from './components/data/tournament-row';
export * from './components/data/tournament-status-badge';
export * from './components/data/tournament-status-card';
export * from './components/data/tournaments-table';
export * from './components/data/venue-row';
export * from './components/data/venues-table';

export * from './components/layout/admin-shell';
export * from './components/layout/live-marker';
export * from './components/layout/meta-list';
export * from './components/layout/photo-panel';
export * from './components/layout/public-section';
export * from './components/layout/public-shell-tournament';
export * from './components/layout/team-crest';
export * from './components/layout/team-logo';
export * from './components/layout/tournament-logo';

// PublicShell celowo poza barrel-em: importuje zdjęcia hero, a Vite emituje
// zaimportowane assety niezależnie od tree-shakingu, więc panel admina wciągałby
// ponad 500 kB grafiki, której nigdy nie użyje. Strona publiczna bierze go ze ścieżki:
// import { PublicShell } from '@tournament/ui/components/layout/public-shell.tsx';

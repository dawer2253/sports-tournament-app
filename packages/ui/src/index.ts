// Publiczne wejście pakietu. Aplikacje importują stąd, a nie z głębokich ścieżek.
// Style motywu doładowuje się osobno: import '@tournament/ui/styles.css'.

export { cn } from './lib/utils';

export * from './components/ui/avatar';
export * from './components/ui/badge';
export * from './components/ui/button';
export * from './components/ui/card';
export * from './components/ui/checkbox';
export * from './components/ui/dialog';
export * from './components/ui/dropdown-menu';
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

export * from './components/layout/admin-shell';
export * from './components/layout/live-marker';
export * from './components/layout/meta-list';
export * from './components/layout/photo-panel';
export * from './components/layout/team-crest';

// PublicShell celowo poza barrel-em: importuje zdjęcia hero, a Vite emituje
// zaimportowane assety niezależnie od tree-shakingu, więc panel admina wciągałby
// 300 kB grafiki, której nigdy nie użyje. Strona publiczna bierze go ze ścieżki:
// import { PublicShell } from '@tournament/ui/components/layout/public-shell';

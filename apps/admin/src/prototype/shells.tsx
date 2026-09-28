// PROTOTYP (#85) — trzy warianty nawigacji. Nie do main.
//
// A: sidebar ma dwie sekcje. „Turnieje” zawsze, sekcja turnieju tylko wewnątrz
//    turnieju, z nazwą turnieju w nagłówku. Branding i Ustawienia to jedna
//    pozycja. Terminarz, Drabinka, Statystyki nieczynne z dopiskiem etapu.
// B: dzisiejszy `AdminShell` bez zmian w DS. Pozycje turnieju dostają adresy
//    tylko wewnątrz turnieju, poza nim są wyszarzone. Branding i Ustawienia to
//    dwie pozycje na jeden ekran (kotwica). Pod /tournaments/:id jest przegląd.
// C: sidebar to lista turniejów organizera (przełącznik). Sekcje turnieju są
//    kartami pod tytułem strony. Pozycje bez treści w S1 ukryte.
import { useQuery } from '@tanstack/react-query';
import type { Tournament } from '@tournament/api-client';
import {
  AdminShell,
  Avatar,
  AvatarFallback,
  Badge,
  Heading,
  TournamentStatusBadge,
  cn,
  type AdminNavKey,
  type AdminShellAccount,
} from '@tournament/ui';
import {
  BarChart3, CalendarDays, ChevronLeft, GitFork, LayoutGrid, LogOut, MapPin,
  Plus, Settings, Trophy, Users,
} from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import { api } from '../lib/api';
import { href, useGo, useVariant } from './variant';

/** Sekcja, na której stoi ekran. `overview` istnieje tylko w wariancie B. */
export type Section =
  | 'tournaments' | 'create' | 'overview' | 'teams' | 'venues' | 'settings'
  | 'schedule' | 'bracket' | 'stats';

export interface ProtoShellProps {
  section: Section;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  tournament?: Tournament;
  account: AdminShellAccount;
  onLogout: () => void;
}

type Item = { key: Section; label: string; icon: ElementType; stage?: string };

const TOURNAMENT_ITEMS: Item[] = [
  { key: 'teams', label: 'Drużyny', icon: Users },
  { key: 'venues', label: 'Obiekty', icon: MapPin },
  { key: 'settings', label: 'Ustawienia', icon: Settings },
  { key: 'schedule', label: 'Terminarz', icon: CalendarDays, stage: 'S2' },
  { key: 'bracket', label: 'Drabinka', icon: GitFork, stage: 'S4' },
  { key: 'stats', label: 'Statystyki', icon: BarChart3, stage: 'S3' },
];

export function ProtoShell(props: ProtoShellProps) {
  const variant = useVariant();
  if (variant === 'B') return <VariantB {...props} />;
  if (variant === 'C') return <VariantC {...props} />;
  return <VariantA {...props} />;
}

// ---------------------------------------------------------------- wspólne

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

function Brand() {
  return (
    <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
        <Trophy className="size-4" />
      </span>
      <span className="text-sm font-bold tracking-tight">
        Tournament<span className="text-primary">App</span>
      </span>
    </div>
  );
}

function AccountFooter({ account, onLogout }: { account: AdminShellAccount; onLogout: () => void }) {
  const name = account === null ? 'Konto nieustalone' : account === 'pending' ? 'Wczytywanie konta…' : account.name;
  return (
    <div className="flex items-center gap-2.5 border-t border-sidebar-border p-3">
      <Avatar className="size-8">
        <AvatarFallback className="rounded-md bg-primary text-xs font-semibold text-primary-foreground">
          {typeof account === 'object' && account ? initials(account.name) : '—'}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{name}</span>
      <button type="button" onClick={onLogout} aria-label="Wyloguj" className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent">
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

function NavLink({
  to, icon: Icon, label, active, disabled, hint,
}: { to?: string; icon: ElementType; label: string; active?: boolean; disabled?: boolean; hint?: string }) {
  const go = useGo();
  const variant = useVariant();
  return (
    <a
      href={to && !disabled ? href(to, variant) : undefined}
      onClick={(e) => {
        e.preventDefault();
        if (to && !disabled) go(to);
      }}
      aria-current={active ? 'page' : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      title={disabled && hint ? `Dostępne od ${hint}` : undefined}
      className={cn(
        'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        'before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary before:opacity-0',
        active
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground before:opacity-100'
          : 'cursor-pointer text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
        disabled && 'cursor-default opacity-50 hover:bg-transparent',
      )}
    >
      <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
      <span className="flex-1 truncate">{label}</span>
      {disabled && hint && <span className="text-[10px] font-semibold text-muted-foreground">{hint}</span>}
    </a>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function TitleBar({ title, subtitle, actions, below }: { title: string; subtitle?: string; actions?: ReactNode; below?: ReactNode }) {
  return (
    <div className="border-b bg-card px-4 pt-4 sm:px-6">
      <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <Heading>{title}</Heading>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 sm:ml-auto">{actions}</div>}
      </div>
      {below}
    </div>
  );
}

// ---------------------------------------------------------------- A

function VariantA({ section, title, subtitle, actions, children, tournament, account, onLogout }: ProtoShellProps) {
  const base = tournament ? `/tournaments/${tournament.id}` : '';
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <Brand />
        <nav className="flex-1 space-y-0.5 p-2">
          <NavLink to="/" icon={LayoutGrid} label="Turnieje" active={section === 'tournaments' || section === 'create'} />
          {tournament && (
            <>
              <div className="mx-1 mt-4 rounded-md border border-sidebar-border bg-background/60 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Turniej</div>
                <div className="mt-0.5 truncate text-sm font-semibold" title={tournament.name}>{tournament.name}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <TournamentStatusBadge status={tournament.status} />
                  {tournament.sport.name}
                </div>
              </div>
              <div className="pt-1" />
              {TOURNAMENT_ITEMS.map((item) => (
                <NavLink
                  key={item.key}
                  to={`${base}/${item.key}`}
                  icon={item.icon}
                  label={item.label}
                  active={section === item.key}
                  disabled={!!item.stage}
                  hint={item.stage}
                />
              ))}
            </>
          )}
        </nav>
        <AccountFooter account={account} onLogout={onLogout} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TitleBar title={title} subtitle={subtitle} actions={actions} />
        <main className="flex-1 overflow-auto p-4 pb-24 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- B

const B_KEYS: Partial<Record<Section, AdminNavKey>> = {
  tournaments: 'dashboard', create: 'dashboard', overview: 'dashboard',
  teams: 'teams', venues: 'venues', settings: 'settings',
};

function VariantB({ section, title, subtitle, actions, children, tournament, account, onLogout }: ProtoShellProps) {
  const go = useGo();
  const variant = useVariant();
  const base = tournament ? `/tournaments/${tournament.id}` : null;
  const routes: Partial<Record<AdminNavKey, string>> = { dashboard: '/' };
  if (base) {
    routes.teams = `${base}/teams`;
    routes.venues = `${base}/venues`;
    routes.settings = `${base}/settings`;
    routes.branding = `${base}/settings#branding`;
  }
  return (
    <AdminShell
      active={B_KEYS[section] ?? 'dashboard'}
      title={title}
      subtitle={subtitle ?? (tournament && section !== 'overview' ? tournament.name : undefined)}
      actions={actions}
      user={account}
      navHref={(key) => (routes[key] ? href(routes[key], variant) : undefined)}
      onNavigate={(key) => {
        const route = routes[key];
        if (route) go(route);
      }}
      onLogout={onLogout}
    >
      <div className="pb-20">{children}</div>
    </AdminShell>
  );
}

// ---------------------------------------------------------------- C

function VariantC({ section, title, subtitle, actions, children, tournament, account, onLogout }: ProtoShellProps) {
  const go = useGo();
  const list = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const { data, error } = await api.GET('/tournaments');
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const base = tournament ? `/tournaments/${tournament.id}` : '';
  const tabs = TOURNAMENT_ITEMS.filter((i) => !i.stage);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <Brand />
        <nav className="flex-1 space-y-0.5 overflow-auto p-2">
          <NavLink to="/" icon={LayoutGrid} label="Wszystkie turnieje" active={section === 'tournaments'} />
          <NavLink to="/tournaments/new" icon={Plus} label="Nowy turniej" active={section === 'create'} />
          <SectionLabel>Twoje turnieje</SectionLabel>
          {list.data?.data.map((t) => (
            <NavLink
              key={t.id}
              to={`/tournaments/${t.id}`}
              icon={Trophy}
              label={t.name}
              active={tournament?.id === t.id}
            />
          ))}
        </nav>
        <AccountFooter account={account} onLogout={onLogout} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TitleBar
          title={tournament ? tournament.name : title}
          subtitle={tournament ? `${tournament.sport.name} · /t/${tournament.slug}` : subtitle}
          actions={
            tournament ? (
              <div className="flex items-center gap-2">
                <TournamentStatusBadge status={tournament.status} />
                {actions}
              </div>
            ) : actions
          }
          below={
            tournament ? (
              <div className="-mb-px flex gap-1" role="tablist">
                <button
                  type="button"
                  onClick={() => go('/')}
                  className="mr-2 flex items-center gap-1 px-2 pb-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="size-3" /> Turnieje
                </button>
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={section === t.key}
                    onClick={() => go(`${base}/${t.key}`)}
                    className={cn(
                      'flex items-center gap-2 border-b-2 px-3 pb-2 text-sm',
                      section === t.key
                        ? 'border-primary font-medium text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <t.icon className="size-4" /> {t.label}
                  </button>
                ))}
                <Badge variant="outline" className="mb-2 ml-auto self-center text-[10px]">
                  Terminarz, drabinka, statystyki: od S2
                </Badge>
              </div>
            ) : undefined
          }
        />
        <main className="flex-1 overflow-auto p-4 pb-24 sm:p-6">
          {tournament && title !== tournament.name && <h2 className="mb-4 text-lg font-semibold">{title}</h2>}
          {children}
        </main>
      </div>
    </div>
  );
}

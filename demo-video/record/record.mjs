// Nagrywa ujęcia do filmu demo: prawdziwy panel (5173), strona publiczna (5174)
// i Laravel (8000) na koncie demo „Administrator” z seeda (TeamAdminsSeeder).
//
//   node demo-video/record/record.mjs            # wszystkie sceny poza „mcp”
//   node demo-video/record/record.mjs mcp        # tylko wybrane sceny
//
// Każda scena to osobny kontekst przeglądarki, więc osobny plik webm
// w demo-video/public/clips/. Obok ląduje clips/markers.json: sekundy od startu
// nagrania, w których zaczynają się kroki sceny (do cięcia w Remotion).
import { chromium } from 'playwright';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(ROOT, '../public/clips');
const TMP = path.resolve(ROOT, '../.tmp-video');
const ADMIN = 'http://localhost:5173';
const PUBLIC = 'http://localhost:5174';
const API = 'http://localhost:8000/api/v1';
// Konto demo z seeda (backend/database/seeders/TeamAdminsSeeder.php).
const ACCOUNT = { email: 'administrator@example.com', password: 'tajnehaslo123' };
const TOKEN_KEY = 'tournament.token';

export const DEMO = {
  name: 'Liga Podwórkowa 2026',
  slug: 'liga-podworkowa-2026',
  teams: ['Orły Bemowo', 'Sokoły Wola', 'Pantery Ursus', 'Wilki Mokotów'],
};
const MCP_NAME = 'Turniej Szkół 2026';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- API (dane poza kadrem) ----------
let token;
async function api(method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${text.slice(0, 300)}`);
  return json;
}
async function login() {
  token = (await api('POST', '/login', ACCOUNT)).data.token;
}
async function findTournament(name) {
  const list = await api('GET', '/tournaments?perPage=100');
  return list.data.find((t) => t.name === name);
}

/**
 * Usuwa turniej z poprzedniego przebiegu. API odmawia usunięcia turnieju
 * z rozegranymi meczami, więc najpierw kasujemy zdarzenia i cofamy mecze do
 * zaplanowanych (tak jak `clear_match_result` w serwerze MCP).
 */
async function removeTournament(id) {
  const matches = await api('GET', `/tournaments/${id}/matches?perPage=100`);
  for (const m of matches.data.filter((x) => x.status !== 'scheduled')) {
    const events = await api('GET', `/matches/${m.id}/events`);
    for (const e of events.data) await api('DELETE', `/match-events/${e.id}`);
    await api('PATCH', `/matches/${m.id}`, { status: 'scheduled', homeScore: null, awayScore: null });
  }
  await api('DELETE', `/tournaments/${id}`);
}

/** Gole do zakończonych meczów, zgodne z wynikiem — dla „Bramek” i klasyfikacji. */
async function seedGoals(tournamentId) {
  const matches = await api('GET', `/tournaments/${tournamentId}/matches?perPage=50`);
  const roster = async (teamId) => (await api('GET', `/teams/${teamId}/players`)).data;
  for (const m of matches.data.filter((x) => x.status === 'finished')) {
    const existing = await api('GET', `/matches/${m.id}/events`);
    if (existing.data.length) continue;
    let minute = 7;
    for (const [team, goals] of [[m.homeTeam, m.homeScore], [m.awayTeam, m.awayScore]]) {
      const players = await roster(team.id);
      for (let i = 0; i < goals; i++) {
        // Bez bramkarza (nr 1): lider klasyfikacji ma być napastnikiem.
        const field = players.filter((p) => p.number !== 1);
        const player = field[i % 2 === 0 ? 0 : Math.min(1, field.length - 1)];
        await api('POST', `/matches/${m.id}/events`, { type: 'goal', teamId: team.id, playerId: player.id, minute });
        minute += 13;
      }
    }
  }
}

// ---------- kursor i ruch „jak człowiek” ----------
const CURSOR_SCRIPT = `
(() => {
  if (window.__demoCursor) return; window.__demoCursor = true;
  const add = () => {
    const c = document.createElement('div');
    c.id = '__demo-cursor';
    c.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M5 3 L5 22 L10 17.5 L13.5 25 L17 23.5 L13.5 16 L20 16 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '-50px', top: '-50px', width: '28px', height: '28px',
      pointerEvents: 'none', zIndex: 2147483647, transition: 'transform 120ms ease', transformOrigin: '5px 3px',
      filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' });
    const ring = document.createElement('div');
    Object.assign(ring.style, { position: 'fixed', width: '36px', height: '36px', borderRadius: '50%',
      border: '3px solid rgba(31,122,69,.85)', pointerEvents: 'none', zIndex: 2147483646, opacity: 0,
      transform: 'translate(-50%,-50%) scale(.3)', transition: 'transform 380ms ease-out, opacity 380ms ease-out' });
    document.documentElement.append(ring, c);
    addEventListener('mousemove', (e) => { c.style.left = (e.clientX - 5) + 'px'; c.style.top = (e.clientY - 3) + 'px'; }, true);
    addEventListener('mousedown', (e) => {
      c.style.transform = 'scale(.82)';
      ring.style.transition = 'none'; ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
      ring.style.opacity = 1; ring.style.transform = 'translate(-50%,-50%) scale(.3)';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        ring.style.transition = 'transform 380ms ease-out, opacity 380ms ease-out';
        ring.style.opacity = 0; ring.style.transform = 'translate(-50%,-50%) scale(1.4)';
      }));
    }, true);
    addEventListener('mouseup', () => { c.style.transform = 'scale(1)'; }, true);
  };
  if (document.documentElement) add(); else addEventListener('DOMContentLoaded', add);
})();
`;

function human(page, settle, onNav = () => {}) {
  let pos = { x: 640, y: 400 };
  return {
    /**
     * Klik, który zmienia widok (zakładka, nowy ekran, okno meczu). Moment
     * kliknięcia trafia do `markers.json` pod `navs`: film puszcza go w tempie
     * 1×, żeby widz zobaczył, co zostało kliknięte.
     */
    async nav(locator, opts) {
      await this.move(locator, opts);
      onNav();
      await locator.click();
      await settle();
      await sleep(250);
    },
    async move(locator, { steps = 22, pause = 180 } = {}) {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      if (!box) throw new Error('brak boundingBox');
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y, { steps });
      pos = { x, y };
      await sleep(pause);
    },
    async click(locator, opts) {
      await this.move(locator, opts);
      await locator.click();
      await settle();
      await sleep(250);
    },
    async type(locator, text, { delay = 55, clear = false } = {}) {
      await this.click(locator);
      if (clear) {
        await locator.press('Control+A');
        await locator.press('Backspace');
      }
      await locator.pressSequentially(text, { delay });
      await sleep(200);
    },
    async wheel(dy, { steps = 12 } = {}) {
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, dy / steps);
        await sleep(30);
      }
      await sleep(300);
    },
    async park(x, y) {
      await page.mouse.move(x, y, { steps: 20 });
      pos = { x, y };
    },
  };
}

// ---------- scena = kontekst z nagraniem ----------
// Wideo Playwrighta zapisuje klatki w pikselach CSS (1280×720 wklejone w ramkę
// 1080p) i mocno kompresuje VP8. Zamiast tego bierzemy klatki screencastu CDP
// w pikselach urządzenia (deviceScaleFactor 1.5 → 1920×1080) i składamy je
// ffmpegiem z Remotion w MP4 o stałych 30 kl./s.
const FFMPEG = path.resolve(ROOT, '../node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe');
const markers = {};

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${err.slice(-800)}`))));
  });
}

/**
 * Turnieje ukryte w listach panelu. Turniej założony przez agenta (scena `mcp`)
 * istnieje już w bazie, ale w filmie powstaje dopiero na końcu — wcześniejsze
 * sceny nie mogą go pokazywać w liście turniejów ani w pasku bocznym.
 */
async function hideTournaments(context, names) {
  if (!names.length) return;
  await context.route(/\/api\/v1\/tournaments(\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    const json = await response.json().catch(() => null);
    if (!json || !Array.isArray(json.data)) return route.fulfill({ response });
    const data = json.data.filter((t) => !names.includes(t.name));
    const removed = json.data.length - data.length;
    const meta = json.meta?.total != null ? { ...json.meta, total: json.meta.total - removed } : json.meta;
    await route.fulfill({ response, json: { ...json, data, ...(meta ? { meta } : {}) } });
  });
}

async function scene(name, fn, { mobile = false, auth = true, hide = [MCP_NAME] } = {}) {
  await rm(TMP, { recursive: true, force: true });
  await mkdir(TMP, { recursive: true });
  const viewport = mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 };
  const scale = mobile ? 2 : 1.5;
  // Screencast headless-shella ignoruje deviceScaleFactor z emulacji, ale
  // honoruje wymuszony DPR całej przeglądarki — stąd osobna przeglądarka na
  // scenę, bez emulacji viewportu (rozmiar daje okno).
  const browser = await chromium.launch({
    args: [`--force-device-scale-factor=${scale}`, `--window-size=${viewport.width},${viewport.height}`],
  });
  const context = await browser.newContext({
    viewport: null,
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    acceptDownloads: true,
  });
  if (auth) await context.addInitScript(([k, v]) => localStorage.setItem(k, v), [TOKEN_KEY, token]);
  if (!mobile) await context.addInitScript(CURSOR_SCRIPT);
  await hideTournaments(context, hide);
  const page = await context.newPage();

  // Laravel w Sailu na dysku Windows potrafi pod obciążeniem odpowiadać po
  // 5–20 s, choć bez nagrywania odpowiada w 0,1–0,3 s. Czekanie na API nie
  // trafia więc do nagrania: na czas żądań do backendu nagranie stoi
  // (`hold`), a czas pauzy wypada z osi (`offset`) — w filmie to zwykłe cięcie.
  const inflight = new Set();
  const isApi = (r) => r.url().startsWith('http://localhost:8000');
  page.on('request', (r) => isApi(r) && inflight.add(r));
  page.on('requestfinished', (r) => inflight.delete(r));
  page.on('requestfailed', (r) => inflight.delete(r));

  const cdp = await context.newCDPSession(page);
  const frames = [];
  let paused = false;
  let offset = 0;
  const now = () => Date.now() / 1000;
  const fileFor = (i) => path.join(TMP, `f${String(i).padStart(6, '0')}.jpg`);
  // Klatki zostają w pamięci do końca sceny, żeby zapis JPEG-ów nie dokładał
  // obciążenia dysku w trakcie nagrania.
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    if (paused) return;
    frames.push({ file: fileFor(frames.length), t: metadata.timestamp - offset, data });
  });

  async function hold(work) {
    paused = true;
    const start = now();
    try {
      await work();
    } finally {
      await sleep(300);
      // Po pauzie ekran może stać, a screencast śle klatki tylko przy zmianie —
      // bez zrzutu do końca ujęcia wisiałby stan sprzed pauzy (spinner).
      const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
      offset += now() - start;
      frames.push({ file: fileFor(frames.length), t: now() - offset, data: shot.data });
      paused = false;
    }
  }
  async function settle() {
    await sleep(120);
    if (!inflight.size) return;
    await hold(async () => {
      const deadline = Date.now() + 90_000;
      // Dwa przebiegi: po odpowiedzi aplikacja zwykle dociąga unieważnione listy.
      for (let pass = 0; pass < 2; pass++) {
        while (inflight.size && Date.now() < deadline) await sleep(50);
        await sleep(200);
      }
    });
  }
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 82,
    maxWidth: viewport.width * scale,
    maxHeight: viewport.height * scale,
    everyNthFrame: 2,
  });

  const marks = [];
  const mark = (label) => marks.push({ label, wall: now() - offset });
  const navs = [];
  const h = human(page, settle, () => navs.push(now() - offset));
  console.log(`▶ ${name}`);
  try {
    await fn({ page, h, mark, hold, settle });
    mark('koniec');
  } catch (error) {
    await page.screenshot({ path: path.join(OUT, `${name}-BLAD.png`) });
    console.error(`✖ ${name}:`, error.message);
    throw error;
  } finally {
    // Ekran stoi, więc CDP nie śle klatek — ostatnia trwa do końca nagrania.
    const end = now() - offset;
    await cdp.send('Page.stopScreencast').catch(() => {});
    await context.close();
    await browser.close();
    for (const f of frames) await writeFile(f.file, Buffer.from(f.data, 'base64'));
    if (frames.length) {
      const t0 = frames[0].t;
      const lines = [];
      frames.forEach((f, i) => {
        const next = i + 1 < frames.length ? frames[i + 1].t : end;
        lines.push(`file '${f.file.replaceAll('\\', '/')}'`, `duration ${Math.max(next - f.t, 0.001).toFixed(4)}`);
      });
      lines.push(`file '${frames.at(-1).file.replaceAll('\\', '/')}'`);
      const list = path.join(TMP, 'list.txt');
      await writeFile(list, lines.join('\n'));
      const out = path.join(OUT, `${name}.mp4`);
      await run(FFMPEG, [
        '-y', '-f', 'concat', '-safe', '0', '-i', list,
        '-r', '30', '-pix_fmt', 'yuv420p',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-movflags', '+faststart', out,
      ]);
      markers[name] = {
        duration: +(end - t0).toFixed(2),
        size: [viewport.width * scale, viewport.height * scale],
        marks: Object.fromEntries(marks.map((m) => [m.label, +(m.wall - t0).toFixed(2)])),
        navs: navs.map((t) => +(t - t0).toFixed(2)),
      };
      console.log(`  ${frames.length} klatek, ${(end - t0).toFixed(1)} s`);
    }
  }
}

const nav = (page, name) =>
  page.getByRole('navigation', { name: 'Sekcje turnieju' }).getByRole('link', { name, exact: true });

// ---------- sceny ----------
const SCENES = {
  async logowanie() {
    // Lista turniejów w kadrze ma być bez śladu poprzedniego przebiegu. Turniej
    // agenta zostaje w bazie (jego panel nagrywa scena `mcp`), a z list
    // znika przez `hide` w `scene()`.
    const old = await findTournament(DEMO.name);
    if (old) await removeTournament(old.id);
    await scene(
      'logowanie',
      async ({ page, h, mark }) => {
        await page.goto(`${ADMIN}/login`);
        await page.getByLabel('E-mail').waitFor();
        await sleep(600);
        mark('start');
        await h.type(page.getByLabel('E-mail'), ACCOUNT.email, { clear: true, delay: 35 });
        await h.type(page.getByLabel('Hasło'), ACCOUNT.password, { clear: true, delay: 45 });
        await h.nav(page.getByRole('button', { name: 'Zaloguj' }));
        await page.getByRole('heading', { name: /turnieje/i }).waitFor();
        mark('lista');
        await sleep(900);
        // Ujęcie kończy się kursorem na „Nowy turniej”: następna scena zaczyna
        // w tym samym miejscu i dopiero tam klika.
        await h.move(page.getByRole('button', { name: 'Nowy turniej' }), { steps: 30, pause: 900 });
      },
      { auth: false },
    );
  },

  async nowy() {
    const old = await findTournament(DEMO.name);
    if (old) await removeTournament(old.id);
    await scene('nowy-turniej', async ({ page, h, mark }) => {
      await page.goto(ADMIN);
      const create = page.getByRole('button', { name: 'Nowy turniej' });
      await create.waitFor();
      // Kursor stoi już na przycisku, tak jak na końcu sceny logowania.
      const box = await create.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(700);
      mark('start');
      await h.nav(create);
      await h.type(page.getByLabel('Nazwa turnieju'), DEMO.name);
      const form = page.getByRole('main');
      await h.click(form.getByText('Piłka nożna', { exact: true }));
      await h.click(form.getByText('Liga każdy z każdym', { exact: true }));
      await sleep(300);
      await h.nav(page.getByRole('button', { name: 'Załóż turniej' }));
      mark('zalozony');
      const open = page.getByRole('button', { name: `Otwórz turniej ${DEMO.name}` });
      await open.waitFor();
      await sleep(700);
      await h.nav(open);
      await page.getByRole('heading', { name: DEMO.name }).waitFor();
      await sleep(1200);
    });
  },

  async druzyny() {
    const t = await findTournament(DEMO.name);
    await scene('druzyny', async ({ page, h, mark }) => {
      await page.goto(`${ADMIN}/tournaments/${t.id}/teams`);
      await page.getByRole('heading', { name: DEMO.name }).waitFor();
      await sleep(500);
      mark('start');
      for (const team of DEMO.teams) {
        await h.click(page.getByRole('button', { name: 'Dodaj drużynę' }).first(), { steps: 14 });
        const dialog = page.getByRole('dialog', { name: 'Nowa drużyna' });
        await h.type(dialog.getByLabel('Nazwa drużyny'), team, { delay: 40 });
        await h.click(dialog.getByRole('button', { name: 'Dodaj' }), { steps: 12 });
        await dialog.waitFor({ state: 'hidden' });
        await page.getByRole('link', { name: team }).waitFor();
        await sleep(250);
      }
      mark('sklad');
      await sleep(500);
      await h.nav(page.getByRole('link', { name: DEMO.teams[0] }));
      await page.getByRole('button', { name: 'Dodaj zawodnika' }).first().waitFor();
      await sleep(500);
      const players = [
        ['Jan Kowalski', '9', 'napastnik'],
        ['Piotr Nowak', '1', 'bramkarz'],
        ['Adam Wiśniewski', '7', 'pomocnik'],
      ];
      for (const [name, number, position] of players) {
        await h.click(page.getByRole('button', { name: 'Dodaj zawodnika' }).first(), { steps: 14 });
        const dialog = page.getByRole('dialog', { name: 'Nowy zawodnik' });
        await h.type(dialog.getByLabel('Imię i nazwisko'), name, { delay: 38 });
        await h.type(dialog.getByLabel('Numer'), number, { delay: 60 });
        await h.type(dialog.getByLabel('Pozycja'), position, { delay: 38 });
        await h.click(dialog.getByRole('button', { name: 'Dodaj' }), { steps: 12 });
        await dialog.waitFor({ state: 'hidden' });
        await sleep(300);
      }
      await sleep(1200);
    });
    // Reszta składów poza kadrem, żeby strona publiczna i grafiki miały kim grać.
    const detail = await api('GET', `/tournaments/${t.id}/teams`);
    const rosters = {
      'Sokoły Wola': ['Marek Zieliński', 'Tomasz Lewandowski', 'Kamil Wójcik'],
      'Pantery Ursus': ['Paweł Kamiński', 'Michał Dąbrowski', 'Jakub Kozłowski'],
      'Wilki Mokotów': ['Bartosz Jankowski', 'Mateusz Mazur', 'Krzysztof Krawczyk'],
    };
    for (const team of detail.data) {
      for (const [i, name] of (rosters[team.name] ?? []).entries()) {
        await api('POST', `/teams/${team.id}/players`, { name, number: [10, 1, 8][i] });
      }
    }
  },

  async terminarz() {
    const t = await findTournament(DEMO.name);
    await scene('terminarz', async ({ page, h, mark, hold }) => {
      await page.goto(`${ADMIN}/tournaments/${t.id}/teams`);
      await page.getByRole('heading', { name: DEMO.name }).waitFor();
      await sleep(500);
      mark('start');
      await h.nav(nav(page, 'Terminarz'));
      await h.click(page.getByRole('button', { name: 'Wygeneruj terminarz' }).first());
      const gen = page.getByRole('dialog', { name: 'Wygeneruj terminarz' });
      await h.click(gen.getByText('Raz', { exact: true }));
      await h.nav(gen.getByRole('button', { name: 'Wygeneruj' }));
      await gen.waitFor({ state: 'hidden' });
      mark('wygenerowany');
      await sleep(1400);
      await h.click(page.getByRole('button', { name: 'Rozłóż daty' }).first());
      const dates = page.getByRole('dialog', { name: 'Rozłóż daty' });
      const start = dates.getByLabel('Start (pierwsza kolejka)');
      await h.click(start);
      await start.fill('2026-11-28T10:00');
      await sleep(500);
      await h.click(dates.getByRole('button', { name: /^Rozłóż$|Tak, nadpisz terminy/ }));
      await dates.waitFor({ state: 'hidden' });
      mark('daty');
      await sleep(1400);
      const match = page.getByRole('button', { name: / – / }).first();
      const [home, away] = (await match.getAttribute('aria-label')).split(' – ');
      await h.nav(match);
      mark('wynik');
      const dialog = page.getByRole('dialog', { name: `${home} – ${away}` });
      await h.type(dialog.getByLabel(`Wynik ${home}`), '3', { clear: true });
      await h.type(dialog.getByLabel(`Wynik ${away}`), '1', { clear: true });
      await h.click(dialog.getByText('Zakończony', { exact: true }));
      await h.click(dialog.getByRole('button', { name: 'Zapisz' }));
      await dialog.waitFor({ state: 'hidden' });
      await sleep(1200);
      // Drugi mecz kolejki poza kadrem, żeby tabela miała cztery drużyny z punktami.
      await hold(async () => {
        const matches = await api('GET', `/tournaments/${t.id}/matches?perPage=50`);
        const other =
          matches.data.find((m) => m.round?.number === 1 && m.status !== 'finished' && m.homeTeam && m.awayTeam) ??
          matches.data.find((m) => m.status !== 'finished' && m.homeTeam && m.awayTeam);
        if (other) await api('PATCH', `/matches/${other.id}`, { status: 'finished', homeScore: 2, awayScore: 2 });
        await seedGoals(t.id);
      });
      mark('tabela');
      await h.nav(nav(page, 'Tabela'));
      await page.getByRole('table').waitFor();
      await sleep(2200);
    });
  },

  async ustawienia() {
    const t = await findTournament(DEMO.name);
    await scene('ustawienia', async ({ page, h, mark }) => {
      await page.goto(`${ADMIN}/tournaments/${t.id}/standings`);
      await page.getByRole('heading', { name: DEMO.name }).waitFor();
      await sleep(500);
      mark('start');
      await h.nav(nav(page, 'Ustawienia'));
      await page.getByLabel('Długość meczu (min)').waitFor();
      // Najpierw cały ekran ustawień, potem płynne przewinięcie do sekcji
      // wyglądu i rozgrywek (zamiast skoku przy wpisywaniu).
      await sleep(2200);
      mark('przewin');
      await h.park(820, 470);
      await h.wheel(520, { steps: 18 });
      await sleep(300);
      await h.type(page.getByLabel('Długość meczu (min)'), '60', { clear: true, delay: 90 });
      await sleep(300);
      mark('kolor');
      const picker = page.locator('[data-slot="brand-color-picker"]');
      await h.click(picker.getByText('Granat', { exact: true }));
      await sleep(700);
      await h.click(picker.getByText('Bordo', { exact: true }));
      await sleep(1000);
      await h.click(page.getByRole('button', { name: 'Zapisz zmiany' }));
      await sleep(1400);
      mark('publikacja');
      await page.mouse.wheel(0, -2000);
      await sleep(400);
      await h.nav(page.getByRole('button', { name: 'Opublikuj' }));
      await sleep(2500);
    });
  },

  async publiczna() {
    await scene(
      'publiczna',
      async ({ page, h, mark }) => {
        await page.goto(`${PUBLIC}/t/${DEMO.slug}`);
        await page.getByRole('heading', { name: DEMO.name }).first().waitFor();
        await sleep(800);
        mark('start');
        await h.park(700, 420);
        await sleep(800);
        await h.wheel(420);
        await sleep(900);
        await h.wheel(-420);
        mark('tabela');
        await h.nav(page.getByRole('link', { name: 'Tabela', exact: true }).first());
        await sleep(1800);
        mark('terminarz');
        await h.nav(page.getByRole('link', { name: 'Terminarz', exact: true }).first());
        await sleep(1600);
        await h.wheel(300);
        await sleep(1200);
      },
      { auth: false },
    );
  },

  async telefon() {
    await scene(
      'telefon',
      async ({ page, h, mark }) => {
        await page.goto(`${PUBLIC}/t/${DEMO.slug}`);
        await page.getByRole('heading', { name: DEMO.name }).first().waitFor();
        await sleep(1000);
        mark('start');
        for (let i = 0; i < 3; i++) {
          await page.mouse.wheel(0, 260);
          await sleep(900);
        }
        await h.click(page.getByRole('link', { name: 'Pełna tabela' }).first());
        mark('tabela');
        await sleep(2500);
      },
      { mobile: true, auth: false },
    );
  },

  async grafiki() {
    const t = await findTournament(DEMO.name);
    await scene('grafiki', async ({ page, h, mark }) => {
      await page.goto(`${ADMIN}/tournaments/${t.id}/settings`);
      await page.getByRole('heading', { name: DEMO.name }).waitFor();
      await sleep(500);
      mark('start');
      await h.nav(nav(page, 'Grafiki'));
      await sleep(800);
      await h.click(page.getByText('Wynik meczu', { exact: true }).first());
      await page.getByRole('img', { name: /Grafika: Wynik meczu/ }).waitFor();
      mark('wynik');
      await sleep(1800);
      mark('tabela');
      await h.click(page.getByText('Tabela', { exact: true }).last());
      await sleep(1800);
      mark('klasyfikacja');
      await h.click(page.getByText('Klasyfikacja', { exact: true }).last());
      await sleep(1800);
      const button = page.getByRole('button', { name: 'Pobierz PNG' });
      await button.waitFor();
      mark('pobierz');
      await h.move(button);
      const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
      await download.saveAs(path.join(OUT, 'grafika.png'));
      await sleep(1500);
    });
  },

  async mecz() {
    const t = await findTournament(DEMO.name);
    const matches = await api('GET', `/tournaments/${t.id}/matches?perPage=50`);
    // Najbliższy niezakończony mecz Orłów; po wcześniejszym przebiegu bywa
    // trwający, więc cofamy go do zaplanowanych bez zdarzeń.
    const match = matches.data.find(
      (m) => m.status !== 'finished' && [m.homeTeam?.name, m.awayTeam?.name].includes(DEMO.teams[0]),
    );
    if (!match) throw new Error('Brak niezakończonego meczu Orłów Bemowo');
    if (match.status !== 'scheduled') {
      const events = await api('GET', `/matches/${match.id}/events`);
      for (const e of events.data) await api('DELETE', `/match-events/${e.id}`);
      await api('PATCH', `/matches/${match.id}`, { status: 'scheduled', homeScore: null, awayScore: null });
    }
    const title = `${match.homeTeam.name} – ${match.awayTeam.name}`;
    const rival = match.homeTeam.name === DEMO.teams[0] ? match.awayTeam.name : match.homeTeam.name;

    await scene('mecz', async ({ page, h, mark }) => {
      await page.goto(`${ADMIN}/tournaments/${t.id}/schedule`);
      await page.getByRole('heading', { name: DEMO.name }).waitFor();
      await sleep(600);
      mark('start');
      await sleep(500);
      await h.nav(page.getByRole('button', { name: title }));
      const dialog = page.getByRole('dialog', { name: title });
      await sleep(600);
      mark('rozpocznij');
      await h.nav(dialog.getByRole('button', { name: 'Rozpocznij mecz' }));
      await sleep(1500);

      const event = async (team, type, minute, player) => {
        const group = dialog.getByRole('group', { name: `Zdarzenia: ${team}` });
        await h.click(group.getByRole('button', { name: type, exact: true }));
        await h.type(dialog.getByLabel('Minuta'), minute, { clear: true, delay: 110 });
        const button = player
          ? dialog.getByRole('button', { name: player })
          : dialog.getByRole('button', { name: /^\d+\. / }).first();
        await h.click(button);
        await sleep(1100);
      };
      mark('bramka');
      await event(DEMO.teams[0], 'Bramka', '12', /Kowalski/);
      mark('kartka');
      await event(rival, 'Żółta kartka', '27');
      mark('bramka2');
      await event(DEMO.teams[0], 'Bramka', '38', /Wiśniewski/);
      mark('przerwa');
      await h.nav(dialog.getByRole('button', { name: 'Przerwa' }));
      await sleep(2200);
    });

    // Kibic na stronie meczu: wynik, zegar części i oś zdarzeń.
    await scene(
      'mecz-kibic',
      async ({ page, h, mark }) => {
        await page.goto(`${PUBLIC}/t/${DEMO.slug}/mecze/${match.id}`);
        await page.getByRole('region', { name: `Mecz: ${title}` }).waitFor();
        await sleep(800);
        mark('start');
        await h.park(640, 300);
        await sleep(2500);
        await h.wheel(380);
        await sleep(2500);
      },
      { auth: false },
    );
  },

  async mcp() {
    const t = await findTournament(MCP_NAME);
    if (!t) throw new Error(`Brak turnieju „${MCP_NAME}” — najpierw założ go przez MCP.`);
    await scene('mcp-panel', async ({ page, h, mark }) => {
      await page.goto(ADMIN);
      await page.getByRole('button', { name: `Otwórz turniej ${MCP_NAME}` }).waitFor();
      await sleep(700);
      mark('start');
      await h.nav(page.getByRole('button', { name: `Otwórz turniej ${MCP_NAME}` }));
      await page.getByRole('heading', { name: MCP_NAME }).waitFor();
      await sleep(1500);
      mark('grupy');
      await h.nav(nav(page, 'Grupy'));
      await sleep(1800);
      mark('terminarz');
      await h.nav(nav(page, 'Terminarz'));
      await sleep(2200);
    }, { hide: [] });
  },
};

const DEFAULT = ['logowanie', 'nowy', 'druzyny', 'terminarz', 'ustawienia', 'publiczna', 'telefon', 'grafiki'];

await mkdir(OUT, { recursive: true });
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;
const markersFile = path.join(OUT, 'markers.json');
try {
  Object.assign(markers, JSON.parse(await readFile(markersFile, 'utf8')));
} catch {}
await login();
try {
  for (const name of wanted) await SCENES[name]();
} finally {
  await writeFile(markersFile, JSON.stringify(markers, null, 2));
  await rm(TMP, { recursive: true, force: true });
}
console.log('gotowe');

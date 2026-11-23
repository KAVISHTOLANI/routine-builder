import { useRef, useState, type ReactNode } from 'react';
import { DemoTag, EmptyState, Field, Landing, NotFound, Notice, PageHead, Shell, uid, useFlash, usePersistentState, useRoute } from './shared/ui';
import { DataTable, useTable, type Column } from './shared/table';
import { addDays, formatDay, todayISO } from './shared/dates';
import {
  SLOT_LABEL,
  TEMPLATES,
  completionRate,
  finishTime,
  formatTime,
  fromTemplate,
  hasErrors,
  history,
  isComplete,
  minutesDone,
  minutesPerDay,
  moveStep,
  nextStep,
  parseTime,
  runFor,
  schedule,
  streak,
  toggleStep,
  totalMinutes,
  validateRoutine,
  type Routine,
  type RoutineErrors,
  type Run,
  type Slot,
  type Step,
} from './lib/routines';

const KEY = 'dayweave:store';
const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/today', label: 'Today' },
  { to: '/routines', label: 'Routines' },
  { to: '/templates', label: 'Templates' },
  { to: '/history', label: 'History' },
];
const PALETTE = ['var(--accent)', '#b5651d', '#5b7f3a', '#8a4f9e'];

interface Store {
  routines: Routine[];
  runs: Run[];
}

export function demoStore(today: string): Store {
  let n = 0;
  const id = () => `demo-s${n++}`;
  const routines: Routine[] = [
    { id: 'demo-morning', ...fromTemplate(TEMPLATES[0], id), demo: true },
    { id: 'demo-evening', ...fromTemplate(TEMPLATES[1], id), demo: true },
    { id: 'demo-workout', ...fromTemplate(TEMPLATES[2], id), name: 'Tuesday & Thursday warm-up before the club training session', demo: true },
  ];
  const runs: Run[] = [];
  for (let i = 1; i <= 13; i++) {
    const date = addDays(today, -i);
    const m = routines[0], e = routines[1], w = routines[2];
    if (i % 5 !== 0) runs.push({ routineId: m.id, date, done: m.steps.map((s) => s.id) });
    else runs.push({ routineId: m.id, date, done: m.steps.slice(0, 2).map((s) => s.id) });
    if (i % 3 !== 1) runs.push({ routineId: e.id, date, done: (i % 4 === 0 ? e.steps.slice(0, 3) : e.steps).map((s) => s.id) });
    if (i % 3 === 0) runs.push({ routineId: w.id, date, done: w.steps.map((s) => s.id) });
  }
  runs.push({ routineId: routines[0].id, date: today, done: routines[0].steps.slice(0, 2).map((s) => s.id) });
  return { routines, runs };
}

export default function App() {
  const [route, navigate] = useRoute();
  const today = todayISO();
  const [store, setStore] = usePersistentState<Store>(KEY, () => demoStore(today));
  const ctx = { store, setStore, today, navigate };
  const edit = route.match(/^\/routine\/(.+)$/);
  let page: ReactNode;
  if (route === '/') page = <Home />;
  else if (route === '/today' || route.startsWith('/today/')) page = <Today {...ctx} selected={route.split('/')[2]} />;
  else if (route === '/routines') page = <Routines {...ctx} />;
  else if (route === '/new') page = <Editor {...ctx} />;
  else if (edit) page = <Editor {...ctx} id={edit[1]} />;
  else if (route === '/templates') page = <Templates {...ctx} />;
  else if (route === '/history') page = <History {...ctx} />;
  else page = <NotFound />;
  return (
    <Shell name="Dayweave" wordmark={['Day', 'weave']} nav={NAV} route={route} cta={{ to: '/today', label: 'Start a routine' }}>
      {page}
    </Shell>
  );
}

type Ctx = { store: Store; setStore: (s: Store) => void; today: string; navigate: (to: string) => void };
const sortByStart = (rs: Routine[]) => [...rs].sort((a, b) => a.start.localeCompare(b.start));
const mins = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} h ${n % 60 ? `${n % 60} min` : ''}`.trim() : `${n} min`);

/* ---------- Shared pieces ---------- */
function Ring({ value, label, size = 64 }: { value: number; label: string; size?: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg className="ring" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={label}>
      <circle cx="32" cy="32" r={r} className="ring-bg" />
      <circle cx="32" cy="32" r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - value)} transform="rotate(-90 32 32)" />
      <text x="32" y="37" textAnchor="middle">{Math.round(value * 100)}%</text>
    </svg>
  );
}

function Checklist({ routine, run, start, onToggle, compact }: { routine: Routine; run?: Run; start: string; onToggle?: (s: Step) => void; compact?: boolean }) {
  const next = nextStep(routine, run);
  return (
    <ol className={`checklist ${compact ? 'is-compact' : ''}`}>
      {schedule(routine.steps, start).map(({ step, from, to }, i) => {
        const done = !!run?.done.includes(step.id);
        return (
          <li key={step.id} className={`${done ? 'is-done' : ''} ${next?.id === step.id ? 'is-next' : ''}`} style={{ ['--i' as string]: i }}>
            <span className="cl-time mono">{from}</span>
            {onToggle ? (
              <button type="button" className="cl-tick" aria-pressed={done} aria-label={`${done ? 'Untick' : 'Tick'} ${step.title}`} onClick={() => onToggle(step)}>
                {done ? '✓' : ''}
              </button>
            ) : (
              <span className="cl-tick" aria-hidden="true">{done ? '✓' : ''}</span>
            )}
            <span className="cl-body">
              <span className="cl-title">{step.title}</span>
              <span className="small muted">
                {step.minutes} min · until {to}
                {step.note && <> · {step.note}</>}
              </span>
            </span>
            {next?.id === step.id && !compact && <span className="badge badge-accent">Now</span>}
            {done && <span className="sr-only">(done)</span>}
          </li>
        );
      })}
    </ol>
  );
}

function HeroPreview() {
  const today = todayISO();
  const s = demoStore(today);
  const r = s.routines[0];
  const run = runFor(s.runs, r.id, today);
  return (
    <div className="hero-dw">
      <div className="row-between">
        <div>
          <p className="eyebrow">{SLOT_LABEL[r.slot]} · {r.start}–{finishTime(r)}</p>
          <strong className="hero-dw-name">{r.name}</strong>
        </div>
        <Ring value={minutesDone(r, run) / totalMinutes(r.steps)} label={`${minutesDone(r, run)} of ${totalMinutes(r.steps)} minutes done`} />
      </div>
      <Checklist routine={r} run={run} start={r.start} compact />
    </div>
  );
}

function Home() {
  return (
    <Landing
      eyebrow="Routine planner · templates & history"
      title={<>Mornings that run <em>on rails.</em></>}
      lead="Put the steps of a routine in order, give each a few minutes, and Dayweave turns them into a timed checklist that tells you what to do now and when you’ll finish."
      primary={{ href: '#/today', label: 'Run today’s routine' }}
      secondary={{ href: '#/templates', label: 'Browse templates' }}
      previewLabel="Today — demo routine"
      preview={<HeroPreview />}
      steps={[
        { title: 'Build or borrow', body: 'Start from one of five templates or write your own steps, then reorder them with the arrow buttons.' },
        { title: 'Run it', body: 'Pick a start time and tick each step. Dayweave shows the clock time of every step and highlights what’s next.' },
        { title: 'Look back', body: 'History shows minutes per day, completion over two weeks and your current streak for each routine.' },
      ]}
      stepsIntro="Dayweave opens with three labelled demo routines and two weeks of history. Delete them whenever you like."
      features={[
        { title: 'Real clock times', body: 'Starting late? Change the start time and every step shifts. Routines can run past midnight.' },
        { title: 'Keyboard-first reordering', body: 'Move steps up and down with buttons rather than fiddly drag and drop.' },
        { title: 'Honest streaks', body: 'A day counts only when every step is ticked; today doesn’t break the streak until it’s over.' },
        { title: 'Templates', body: 'Calm morning, evening wind-down, workout warm-up, weekly reset and a study block.' },
      ]}
      note="Data stays in this browser. Dayweave has no reminders or notifications."
      closing={{ title: <>Five small steps <em>beat one big plan.</em></>, action: { href: '#/new', label: 'Build a routine' } }}
    />
  );
}

/* ---------- Today ---------- */
function Today({ store, setStore, today, navigate, selected }: Ctx & { selected?: string }) {
  const routines = sortByStart(store.routines);
  const current = routines.find((r) => r.id === selected) ?? routines.find((r) => !isComplete(r, runFor(store.runs, r.id, today))) ?? routines[0];
  const [starts, setStarts] = useState<Record<string, string>>({});
  const [flash, setFlash] = useFlash();
  if (!current)
    return (
      <EmptyState title="No routines yet" actions={<><a className="btn btn-primary" href="#/templates">Start from a template</a><button type="button" className="btn" onClick={() => setStore(demoStore(today))}>Load demo routines</button></>}>
        A routine is a short, ordered list of steps you repeat.
      </EmptyState>
    );
  const start = starts[current.id] ?? current.start;
  const startErr = parseTime(start) == null ? 'Use a time such as 07:30.' : null;
  const run = runFor(store.runs, current.id, today);
  const doneMin = minutesDone(current, run), total = totalMinutes(current.steps);
  const complete = isComplete(current, run);

  function toggle(s: Step) {
    const runs = toggleStep(store.runs, current.id, today, s.id);
    setStore({ ...store, runs });
    if (isComplete(current, runFor(runs, current.id, today))) setFlash({ kind: 'success', text: `“${current.name}” complete — ${mins(total)} done.` });
  }

  return (
    <div className="stack">
      <PageHead eyebrow={formatDay(today, { weekday: 'long', day: 'numeric', month: 'long' })} title={<>Today’s <em>routines.</em></>} />
      <div className="routine-tabs" role="tablist" aria-label="Routines">
        {routines.map((r) => {
          const rr = runFor(store.runs, r.id, today);
          return (
            <a key={r.id} role="tab" aria-selected={r.id === current.id} href={`#/today/${r.id}`} className="routine-tab">
              <span className="small muted mono">{r.start}</span>
              <span className="rt-name">{r.name}</span>
              <span className="small">{isComplete(r, rr) ? '✓ Done' : `${minutesDone(r, rr)}/${totalMinutes(r.steps)} min`}</span>
            </a>
          );
        })}
      </div>
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      <div className="layout-main">
        <section className="card stack" aria-labelledby="run-title">
          <div className="card-title-row">
            <h2 id="run-title" className="h3">{current.name}{current.demo && <> <DemoTag /></>}</h2>
            <a className="btn btn-sm btn-ghost" href={`#/routine/${current.id}`}>Edit</a>
          </div>
          {current.steps.length === 0 ? <p className="muted">This routine has no steps.</p> : <Checklist routine={current} run={run} start={startErr ? current.start : start} onToggle={toggle} />}
        </section>
        <aside className="card stack">
          <Ring value={total ? doneMin / total : 0} size={96} label={`${doneMin} of ${total} minutes done`} />
          <p className="small" data-testid="progress">{run?.done.length ? `${current.steps.filter((s) => run.done.includes(s.id)).length} of ${current.steps.length} steps · ${doneMin} of ${total} min` : `${current.steps.length} steps · ${mins(total)}`}</p>
          <Field label="Start time" error={startErr} hint={startErr ? undefined : `Finishes at ${finishTime(current, start)}`}>
            {(p) => <input {...p} className="mono" value={start} onChange={(e) => setStarts({ ...starts, [current.id]: e.target.value })} placeholder="07:00" />}
          </Field>
          <div className="row">
            <button type="button" className="btn btn-sm" onClick={() => { const d = new Date(); setStarts({ ...starts, [current.id]: formatTime(d.getHours() * 60 + d.getMinutes()) }); }}>Start now</button>
            {run && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setStore({ ...store, runs: store.runs.filter((r) => r !== run) })}>Reset today</button>}
          </div>
          <p className="small muted">Streak: <strong>{streak(current, store.runs, today)} days</strong>{complete ? ' — today counted.' : '. Tick every step to count today.'}</p>
          {complete && routines.some((r) => !isComplete(r, runFor(store.runs, r.id, today))) && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/today/${routines.find((r) => !isComplete(r, runFor(store.runs, r.id, today)))!.id}`)}>Next routine →</button>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ---------- Routines list ---------- */
function Routines({ store, setStore, today }: Ctx) {
  const [flash, setFlash] = useFlash();
  const columns: Column<Routine>[] = [
    { key: 'name', label: 'Routine', sort: (r) => r.name, render: (r) => <><a href={`#/routine/${r.id}`}>{r.name}</a>{r.demo && <> <DemoTag /></>}</> },
    { key: 'slot', label: 'When', sort: (r) => r.start, render: (r) => `${SLOT_LABEL[r.slot]} · ${r.start}` },
    { key: 'steps', label: 'Steps', num: true, sort: (r) => r.steps.length, render: (r) => r.steps.length },
    { key: 'len', label: 'Length', num: true, sort: (r) => totalMinutes(r.steps), render: (r) => mins(totalMinutes(r.steps)) },
    { key: 'rate', label: '14-day completion', num: true, sort: (r) => completionRate(r, store.runs, today), render: (r) => `${Math.round(completionRate(r, store.runs, today) * 100)}%` },
    { key: 'streak', label: 'Streak', num: true, sort: (r) => streak(r, store.runs, today), render: (r) => streak(r, store.runs, today) },
    { key: 'act', label: 'Actions', render: (r) => (
      <div className="row nowrap">
        <a className="btn btn-sm" href={`#/today/${r.id}`}>Run</a>
        <button type="button" className="btn btn-sm btn-ghost" aria-label={`Delete ${r.name}`} onClick={() => { if (window.confirm(`Delete “${r.name}” and its history?`)) { setStore({ routines: store.routines.filter((x) => x.id !== r.id), runs: store.runs.filter((x) => x.routineId !== r.id) }); setFlash({ kind: 'success', text: `Deleted “${r.name}”.` }); } }}>Delete</button>
      </div>
    ) },
  ];
  const table = useTable(store.routines, columns, { initialSort: 'slot' });
  return (
    <div className="stack">
      <PageHead eyebrow="Routines" title={<>Your <em>routines.</em></>} actions={<><a className="btn" href="#/templates">From a template</a><a className="btn btn-primary" href="#/new">New routine</a></>} />
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      {store.routines.length === 0 ? (
        <EmptyState title="No routines yet" actions={<><a className="btn btn-primary" href="#/new">Build a routine</a><button type="button" className="btn" onClick={() => setStore(demoStore(today))}>Load demo routines</button></>}>Start with three to six steps you already do most days.</EmptyState>
      ) : (
        <div className="card stack">
          <DataTable caption="Routines" columns={columns} table={table} rowKey={(r) => r.id} />
          {store.routines.some((r) => r.demo) && (
            <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => { const ids = store.routines.filter((r) => r.demo).map((r) => r.id); setStore({ routines: store.routines.filter((r) => !r.demo), runs: store.runs.filter((x) => !ids.includes(x.routineId)) }); setFlash({ kind: 'success', text: 'Demo routines removed.' }); }}>Clear demo routines</button></div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Editor ---------- */
function Editor({ store, setStore, navigate, id }: Ctx & { id?: string }) {
  const existing = id ? store.routines.find((r) => r.id === id) : undefined;
  const [draft, setDraft] = useState<Omit<Routine, 'id'>>(() => existing ?? { name: '', slot: 'morning', start: '07:00', steps: [{ id: uid('step'), title: '', minutes: 5, note: '' }] });
  const [minutesText, setMinutesText] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const errors: RoutineErrors | null = submitted ? validateRoutine(draft) : null; // live once the user has tried to save
  const listRef = useRef<HTMLOListElement>(null);
  if (id && !existing) return <EmptyState title="Routine not found" actions={<a className="btn btn-primary" href="#/routines">Back to routines</a>}>It may have been deleted.</EmptyState>;
  const setStep = (sid: string, patch: Partial<Step>) => setDraft({ ...draft, steps: draft.steps.map((s) => (s.id === sid ? { ...s, ...patch } : s)) });
  const focusStep = (sid: string, sel = 'input') => requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-step="${sid}"] ${sel}`)?.focus());

  function move(i: number, dir: -1 | 1) {
    const sid = draft.steps[i].id;
    setDraft({ ...draft, steps: moveStep(draft.steps, i, dir) });
    focusStep(sid, `[data-dir="${dir}"]`);
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors(validateRoutine(draft))) return;
    const clean = { ...draft, name: draft.name.trim(), steps: draft.steps.map((s) => ({ ...s, title: s.title.trim(), note: s.note.trim() })) };
    if (existing) setStore({ ...store, routines: store.routines.map((r) => (r.id === existing.id ? { ...existing, ...clean, demo: false } : r)) });
    else setStore({ ...store, routines: [...store.routines, { ...clean, id: uid('routine') }] });
    navigate('/routines');
  }

  const total = totalMinutes(draft.steps);
  return (
    <div className="stack">
      <PageHead eyebrow={existing ? 'Edit routine' : 'New routine'} title={existing ? <>Edit <em>{existing.name}</em></> : <>Build a <em>routine.</em></>} description="Keep steps short and concrete. You can reorder them at any time." />
      <form className="layout-main" onSubmit={save} noValidate>
        <div className="card stack">
          {errors && hasErrors(errors) && <Notice kind="error">Please fix the highlighted fields.</Notice>}
          <div className="form-grid">
            <Field label="Routine name" error={errors?.name}>{(p) => <input {...p} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={90} />}</Field>
            <Field label="Time of day">{(p) => <select {...p} value={draft.slot} onChange={(e) => setDraft({ ...draft, slot: e.target.value as Slot })}>{(Object.keys(SLOT_LABEL) as Slot[]).map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}</select>}</Field>
            <Field label="Usual start time" hint="24-hour, e.g. 07:00" error={errors?.start}>{(p) => <input {...p} className="mono" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />}</Field>
          </div>
          <fieldset className="stack">
            <legend className="label">Steps, in order</legend>
            {errors?.steps && <p className="error-text">{errors.steps}</p>}
            <ol className="step-editor" ref={listRef}>
              {draft.steps.map((s, i) => (
                <li key={s.id} data-step={s.id}>
                  <span className="step-num mono" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <Field label={`Step ${i + 1}`} className="grow" error={errors?.stepErrors[s.id]}>{(p) => <input {...p} value={s.title} onChange={(e) => setStep(s.id, { title: e.target.value })} placeholder="e.g. Stretch" />}</Field>
                  <Field label="Minutes" className="mins">
                    {(p) => <input {...p} inputMode="numeric" value={minutesText[s.id] ?? String(s.minutes)} onChange={(e) => { setMinutesText({ ...minutesText, [s.id]: e.target.value }); setStep(s.id, { minutes: e.target.value.trim() === '' ? NaN : Number(e.target.value) }); }} />}
                  </Field>
                  <Field label="Note" className="note">{(p) => <input {...p} value={s.note} onChange={(e) => setStep(s.id, { note: e.target.value })} placeholder="Optional" />}</Field>
                  <div className="step-actions">
                    <button type="button" className="icon-btn" data-dir="-1" aria-label={`Move ${s.title || `step ${i + 1}`} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button type="button" className="icon-btn" data-dir="1" aria-label={`Move ${s.title || `step ${i + 1}`} down`} disabled={i === draft.steps.length - 1} onClick={() => move(i, 1)}>↓</button>
                    <button type="button" className="icon-btn" aria-label={`Remove ${s.title || `step ${i + 1}`}`} onClick={() => setDraft({ ...draft, steps: draft.steps.filter((x) => x.id !== s.id) })}>✕</button>
                  </div>
                </li>
              ))}
            </ol>
            <div><button type="button" className="btn btn-sm" onClick={() => { const sid = uid('step'); setDraft({ ...draft, steps: [...draft.steps, { id: sid, title: '', minutes: 5, note: '' }] }); focusStep(sid); }}>+ Add step</button></div>
          </fieldset>
          <div className="row">
            <button className="btn btn-primary" type="submit">{existing ? 'Save changes' : 'Save routine'}</button>
            <a className="btn btn-ghost" href="#/routines">Cancel</a>
          </div>
        </div>
        <aside className="card stack" aria-live="polite">
          <p className="eyebrow">Preview</p>
          <p className="display-num">{Number.isFinite(total) ? mins(total) : '—'}</p>
          <p className="small muted">{draft.steps.length} step{draft.steps.length === 1 ? '' : 's'}{parseTime(draft.start) != null && Number.isFinite(total) ? ` · ${draft.start}–${formatTime(parseTime(draft.start)! + total)}` : ''}</p>
          {parseTime(draft.start) != null && draft.steps.every((s) => Number.isFinite(s.minutes)) && draft.steps.length > 0 && (
            <Checklist routine={{ ...draft, id: 'preview', steps: draft.steps.map((s) => ({ ...s, title: s.title || 'Untitled step' })) }} start={draft.start} compact />
          )}
        </aside>
      </form>
    </div>
  );
}

/* ---------- Templates ---------- */
function Templates({ store, setStore, navigate }: Ctx) {
  return (
    <div className="stack">
      <PageHead eyebrow="Templates" title={<>Start from <em>something good.</em></>} description="Using a template copies it into your routines. Edit the copy however you like." />
      <div className="grid-2">
        {TEMPLATES.map((t, i) => {
          const total = t.steps.reduce((s, x) => s + x[1], 0);
          return (
            <article key={t.key} className="card stack template" data-reveal style={{ ['--i' as string]: i }}>
              <div className="card-title-row"><h2 className="h3">{t.name}</h2><span className="badge">{SLOT_LABEL[t.slot]}</span></div>
              <p className="muted">{t.blurb}</p>
              <ol className="tpl-steps">{t.steps.map(([title, m]) => <li key={title}><span>{title}</span><span className="mono small">{m} min</span></li>)}</ol>
              <div className="row-between">
                <span className="small muted">{t.steps.length} steps · {mins(total)} · from {t.start}</span>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => { const nid = uid('routine'); setStore({ ...store, routines: [...store.routines, { id: nid, ...fromTemplate(t, () => uid('step')) }] }); navigate(`/routine/${nid}`); }}>
                  Use “{t.name}”
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- History ---------- */
function History({ store, today }: Ctx) {
  const [tip, setTip] = useState<{ x: number; text: string } | null>(null);
  const days = minutesPerDay(store.routines, store.runs, today, 14);
  const max = Math.max(30, ...days.map((d) => d.total));
  const routines = sortByStart(store.routines);
  if (routines.length === 0) return <EmptyState title="No history yet" actions={<a className="btn btn-primary" href="#/templates">Start from a template</a>}>History appears once you tick steps on the Today page.</EmptyState>;
  const ticks = [0, Math.round(max / 2), max];
  return (
    <div className="stack">
      <PageHead eyebrow="History" title={<>The last <em>two weeks.</em></>} description="Minutes of ticked steps per day, and how often each routine was fully completed." />
      <section className="card stack" aria-labelledby="chart-title">
        <h2 id="chart-title" className="h3">Minutes per day</h2>
        <div className="bars-wrap" onMouseLeave={() => setTip(null)}>
          <div className="bars-axis" aria-hidden="true">{ticks.slice().reverse().map((t) => <span key={t}>{t}</span>)}</div>
          <div className="bars" role="img" aria-label={`Bar chart of minutes per day for the last 14 days. Highest: ${Math.max(...days.map((d) => d.total))} minutes.`}>
            {days.map((d, i) => (
              <div key={d.date} className="bar-col" style={{ ['--i' as string]: i }} tabIndex={0}
                onMouseEnter={(e) => setTip({ x: (e.currentTarget as HTMLElement).offsetLeft + 12, text: `${formatDay(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}: ${d.total} min` })}
                onFocus={(e) => setTip({ x: (e.currentTarget as HTMLElement).offsetLeft + 12, text: `${formatDay(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}: ${d.total} min` })}
                onBlur={() => setTip(null)}
                aria-label={`${formatDay(d.date)}: ${d.total} minutes`}>
                <div className="bar-stack" style={{ height: `${(d.total / max) * 100}%` }}>
                  {d.per.filter((p) => p.minutes).map((p) => (
                    <span key={p.routine.id} style={{ flexGrow: p.minutes, background: PALETTE[routines.findIndex((r) => r.id === p.routine.id) % PALETTE.length] }} />
                  ))}
                </div>
                <span className="bar-label mono">{d.date === today ? 'Today' : formatDay(d.date, { day: 'numeric' })}</span>
              </div>
            ))}
            {tip && <span className="chart-tip" style={{ left: tip.x, top: 0 }}>{tip.text}</span>}
          </div>
        </div>
        <p className="legend">
          {routines.map((r, i) => <span key={r.id}><i style={{ background: PALETTE[i % PALETTE.length] }} />{r.name}</span>)}
          <span className="muted">· y-axis in minutes</span>
        </p>
      </section>
      <section className="card stack" aria-labelledby="dots-title">
        <h2 id="dots-title" className="h3">Completion by routine</h2>
        <ul className="list dots-list">
          {routines.map((r) => {
            const h = history(r, store.runs, today, 14);
            return (
              <li key={r.id} className="dots-row">
                <span className="dots-name">{r.name}</span>
                <span className="dots" role="img" aria-label={`${r.name}: ${h.filter((d) => d.state === 'full').length} of 14 days complete`}>
                  {h.map((d) => <i key={d.date} className={`dot ${d.state}`} title={`${formatDay(d.date)}: ${d.done} of ${d.total} steps`} />)}
                </span>
                <span className="small"><strong>{Math.round(completionRate(r, store.runs, today) * 100)}%</strong> · {streak(r, store.runs, today)}-day streak</span>
              </li>
            );
          })}
        </ul>
        <p className="legend"><span><i className="dot full" />All steps</span><span><i className="dot partial" />Some steps</span><span><i className="dot none" />None</span></p>
      </section>
    </div>
  );
}

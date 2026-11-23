import { addDays } from '../shared/dates';

export interface Step {
  id: string;
  title: string;
  minutes: number;
  note: string;
}

export type Slot = 'morning' | 'midday' | 'evening' | 'any';

export interface Routine {
  id: string;
  name: string;
  slot: Slot;
  /** Default start time, HH:MM 24-hour. */
  start: string;
  steps: Step[];
  demo?: boolean;
}

/** One routine on one day: which steps were ticked. */
export interface Run {
  routineId: string;
  date: string;
  done: string[];
}

export const SLOT_LABEL: Record<Slot, string> = { morning: 'Morning', midday: 'Midday', evening: 'Evening', any: 'Any time' };

export function totalMinutes(steps: Pick<Step, 'minutes'>[]): number {
  return steps.reduce((s, x) => s + x.minutes, 0);
}

export function parseTime(t: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function formatTime(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Start and end clock time of each step when the routine begins at `start`. Times wrap past midnight. */
export function schedule(steps: Step[], start: string) {
  let t = parseTime(start) ?? 0;
  return steps.map((s) => {
    const from = t;
    t += s.minutes;
    return { step: s, from: formatTime(from), to: formatTime(t), offset: from - (parseTime(start) ?? 0) };
  });
}

export function finishTime(r: Routine, start = r.start): string {
  return formatTime((parseTime(start) ?? 0) + totalMinutes(r.steps));
}

/** Moves a step up (-1) or down (+1); out-of-range moves return the same list. */
export function moveStep<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir;
  if (index < 0 || index >= list.length || j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[index], out[j]] = [out[j], out[index]];
  return out;
}

export interface RoutineErrors {
  name?: string;
  start?: string;
  steps?: string;
  stepErrors: Record<string, string>;
}

export function validateRoutine(r: Pick<Routine, 'name' | 'start' | 'steps'>): RoutineErrors {
  const e: RoutineErrors = { stepErrors: {} };
  if (!r.name.trim()) e.name = 'Give the routine a name.';
  if (parseTime(r.start) == null) e.start = 'Use a 24-hour time such as 07:30.';
  if (r.steps.length === 0) e.steps = 'Add at least one step.';
  for (const s of r.steps) {
    if (!s.title.trim()) e.stepErrors[s.id] = 'Name this step.';
    else if (!Number.isInteger(s.minutes) || s.minutes < 1 || s.minutes > 240) e.stepErrors[s.id] = 'Minutes must be a whole number from 1 to 240.';
  }
  if (totalMinutes(r.steps) > 24 * 60) e.steps = 'A routine can’t be longer than 24 hours.';
  return e;
}

export const hasErrors = (e: RoutineErrors) => !!(e.name || e.start || e.steps || Object.keys(e.stepErrors).length);

/* ---------- Runs ---------- */
export function runFor(runs: Run[], routineId: string, date: string): Run | undefined {
  return runs.find((r) => r.routineId === routineId && r.date === date);
}

export function toggleStep(runs: Run[], routineId: string, date: string, stepId: string): Run[] {
  const existing = runFor(runs, routineId, date);
  if (!existing) return [...runs, { routineId, date, done: [stepId] }];
  const done = existing.done.includes(stepId) ? existing.done.filter((d) => d !== stepId) : [...existing.done, stepId];
  const rest = runs.filter((r) => r !== existing);
  return done.length ? [...rest, { ...existing, done }] : rest;
}

/** Ticked steps that still exist in the routine (deleted steps don't count). */
export function doneSteps(r: Routine, run: Run | undefined): Step[] {
  return run ? r.steps.filter((s) => run.done.includes(s.id)) : [];
}

export function isComplete(r: Routine, run: Run | undefined): boolean {
  return r.steps.length > 0 && doneSteps(r, run).length === r.steps.length;
}

/** The first unticked step, i.e. what to do now. */
export function nextStep(r: Routine, run: Run | undefined): Step | undefined {
  return r.steps.find((s) => !run?.done.includes(s.id));
}

export function minutesDone(r: Routine, run: Run | undefined): number {
  return totalMinutes(doneSteps(r, run));
}

/** Completion over the last `days` days including today: full / partial / none per day. */
export function history(r: Routine, runs: Run[], today: string, days = 14) {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    const run = runFor(runs, r.id, date);
    const done = doneSteps(r, run).length;
    return { date, done, total: r.steps.length, state: done === 0 ? 'none' : done === r.steps.length ? 'full' : 'partial' } as const;
  });
}

export function completionRate(r: Routine, runs: Run[], today: string, days = 14): number {
  const h = history(r, runs, today, days);
  return h.filter((d) => d.state === 'full').length / days;
}

/** Consecutive fully completed days ending today (or yesterday if today isn't finished yet). */
export function streak(r: Routine, runs: Run[], today: string): number {
  let d = isComplete(r, runFor(runs, r.id, today)) ? today : addDays(today, -1);
  let n = 0;
  while (isComplete(r, runFor(runs, r.id, d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Minutes of ticked steps per day across all routines. */
export function minutesPerDay(routines: Routine[], runs: Run[], today: string, days = 14) {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    const per = routines.map((r) => ({ routine: r, minutes: minutesDone(r, runFor(runs, r.id, date)) }));
    return { date, per, total: per.reduce((s, p) => s + p.minutes, 0) };
  });
}

/* ---------- Templates ---------- */
export interface Template {
  key: string;
  name: string;
  slot: Slot;
  start: string;
  blurb: string;
  steps: [string, number, string?][];
}

export const TEMPLATES: Template[] = [
  { key: 'morning', name: 'Calm morning', slot: 'morning', start: '07:00', blurb: 'A gentle, phone-free first half hour.', steps: [['Glass of water', 2], ['Open the curtains and air the room', 3], ['Stretch', 10, 'Neck, shoulders, hamstrings'], ['Shower and dress', 15], ['Write today’s top three tasks', 5]] },
  { key: 'wind-down', name: 'Evening wind-down', slot: 'evening', start: '21:30', blurb: 'Lower the lights and close the day.', steps: [['Tidy the kitchen', 10], ['Lay out tomorrow’s clothes', 5], ['Screens off', 1], ['Read', 20], ['Lights out', 1]] },
  { key: 'workout', name: 'Workout warm-up', slot: 'any', start: '18:00', blurb: 'Raise the heart rate before training.', steps: [['Easy jog or skipping', 5], ['Leg swings', 3], ['Hip circles and lunges', 4], ['Arm circles', 2], ['Two build-up sprints', 3]] },
  { key: 'reset', name: 'Weekly reset', slot: 'any', start: '10:00', blurb: 'An hour that makes the next week easier.', steps: [['Empty bins and recycling', 10], ['Change bed linen', 15], ['Plan meals for the week', 15], ['Check the calendar for the next 7 days', 10], ['Clear the inbox to zero', 15]] },
  { key: 'study', name: 'Study block', slot: 'midday', start: '14:00', blurb: 'Two focused sessions with a real break.', steps: [['Clear the desk', 3], ['Review notes from last time', 10], ['Focused session one', 25], ['Break away from the desk', 5], ['Focused session two', 25], ['Write what to start with next time', 5]] },
];

export function fromTemplate(t: Template, makeId: () => string): Omit<Routine, 'id'> {
  return { name: t.name, slot: t.slot, start: t.start, steps: t.steps.map(([title, minutes, note]) => ({ id: makeId(), title, minutes, note: note ?? '' })) };
}

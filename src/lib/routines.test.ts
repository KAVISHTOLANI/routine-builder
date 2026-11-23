import { describe, expect, it } from 'vitest';
import { completionRate, finishTime, formatTime, fromTemplate, hasErrors, history, isComplete, minutesPerDay, moveStep, nextStep, parseTime, runFor, schedule, streak, TEMPLATES, toggleStep, totalMinutes, validateRoutine, type Routine, type Run } from './routines';

const r: Routine = {
  id: 'r1',
  name: 'Morning',
  slot: 'morning',
  start: '07:00',
  steps: [
    { id: 'a', title: 'Water', minutes: 5, note: '' },
    { id: 'b', title: 'Stretch', minutes: 10, note: '' },
    { id: 'c', title: 'Shower', minutes: 15, note: '' },
  ],
};

describe('times', () => {
  it('parses and formats 24-hour times', () => {
    expect(parseTime('07:30')).toBe(450);
    expect(parseTime('7:30')).toBeNull();
    expect(parseTime('24:00')).toBeNull();
    expect(formatTime(1500)).toBe('01:00');
    expect(formatTime(-30)).toBe('23:30');
  });
  it('schedules steps back to back and wraps past midnight', () => {
    expect(schedule(r.steps, '07:00').map((s) => `${s.from}-${s.to}`)).toEqual(['07:00-07:05', '07:05-07:15', '07:15-07:30']);
    expect(schedule(r.steps, '23:50').at(-1)!.to).toBe('00:20');
    expect(totalMinutes(r.steps)).toBe(30);
    expect(finishTime(r)).toBe('07:30');
    expect(finishTime(r, '08:10')).toBe('08:40');
  });
});

describe('editing', () => {
  it('moves steps within bounds only', () => {
    expect(moveStep(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveStep(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    const same = ['a', 'b'];
    expect(moveStep(same, 0, -1)).toBe(same);
    expect(moveStep(same, 1, 1)).toBe(same);
  });
  it('validates name, time and every step', () => {
    const e = validateRoutine({ name: ' ', start: '7am', steps: [{ id: 'x', title: '', minutes: 5, note: '' }, { id: 'y', title: 'Run', minutes: 0, note: '' }] });
    expect(e.name).toBeDefined();
    expect(e.start).toBeDefined();
    expect(e.stepErrors).toEqual({ x: 'Name this step.', y: expect.stringMatching(/1 to 240/) });
    expect(validateRoutine({ name: 'X', start: '07:00', steps: [] }).steps).toMatch(/at least one/);
    expect(hasErrors(validateRoutine(r))).toBe(false);
  });
  it('creates a routine from a template with fresh ids', () => {
    let n = 0;
    const made = fromTemplate(TEMPLATES[0], () => `s${n++}`);
    expect(made.steps.map((s) => s.id)).toEqual(['s0', 's1', 's2', 's3', 's4']);
    expect(made.steps[2].note).toBe('Neck, shoulders, hamstrings');
  });
});

describe('runs and history', () => {
  const today = '2026-11-23';
  it('toggles steps and drops empty runs', () => {
    let runs: Run[] = [];
    runs = toggleStep(runs, 'r1', today, 'a');
    runs = toggleStep(runs, 'r1', today, 'b');
    expect(runFor(runs, 'r1', today)!.done).toEqual(['a', 'b']);
    expect(nextStep(r, runFor(runs, 'r1', today))!.id).toBe('c');
    expect(isComplete(r, runFor(runs, 'r1', today))).toBe(false);
    runs = toggleStep(runs, 'r1', today, 'c');
    expect(isComplete(r, runFor(runs, 'r1', today))).toBe(true);
    runs = toggleStep(toggleStep(toggleStep(runs, 'r1', today, 'a'), 'r1', today, 'b'), 'r1', today, 'c');
    expect(runs).toEqual([]);
  });
  it('ignores ticks for deleted steps', () => {
    const run: Run = { routineId: 'r1', date: today, done: ['a', 'b', 'c', 'gone'] };
    expect(isComplete(r, run)).toBe(true);
    expect(isComplete({ ...r, steps: [...r.steps, { id: 'd', title: 'New', minutes: 1, note: '' }] }, run)).toBe(false);
  });
  const full = (date: string): Run => ({ routineId: 'r1', date, done: ['a', 'b', 'c'] });
  const runs: Run[] = [full('2026-11-20'), full('2026-11-21'), full('2026-11-22'), { routineId: 'r1', date: '2026-11-19', done: ['a'] }];
  it('counts the streak from yesterday while today is unfinished', () => {
    expect(streak(r, runs, today)).toBe(3);
    expect(streak(r, [...runs, full(today)], today)).toBe(4);
    expect(streak(r, [full('2026-11-20')], today)).toBe(0);
  });
  it('summarises history, rate and minutes per day', () => {
    const h = history(r, runs, today, 5);
    expect(h.map((d) => d.state)).toEqual(['partial', 'full', 'full', 'full', 'none']);
    expect(completionRate(r, runs, today, 5)).toBeCloseTo(0.6);
    const m = minutesPerDay([r], runs, today, 5);
    expect(m.map((d) => d.total)).toEqual([5, 30, 30, 30, 0]);
  });
});

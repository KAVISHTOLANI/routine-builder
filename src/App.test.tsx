import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const KEY = 'dayweave:store';

describe('Dayweave', () => {
  it('opens Today on the first unfinished demo routine', () => {
    window.location.hash = '/today';
    render(<App />);
    expect(screen.getAllByText('Demo data').length).toBeGreaterThan(0);
    expect(screen.getByTestId('progress')).toHaveTextContent('2 of 5 steps');
    expect(screen.getByText('Now')).toBeInTheDocument();
  });

  it('ticks the remaining steps and reports completion', async () => {
    window.location.hash = '/today/demo-morning';
    const user = userEvent.setup();
    render(<App />);
    for (const name of ['Stretch', 'Shower and dress', 'Write today’s top three tasks']) await user.click(screen.getByRole('button', { name: `Tick ${name}` }));
    expect(screen.getByText(/“Calm morning” complete/)).toBeInTheDocument();
    expect(screen.getByText(/today counted/)).toBeInTheDocument();
  });

  it('shows an empty state and builds a routine with validation and reordering', async () => {
    localStorage.setItem(KEY, JSON.stringify({ routines: [], runs: [] }));
    window.location.hash = '/new';
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Save routine' }));
    expect(screen.getByText('Give the routine a name.')).toBeInTheDocument();
    expect(screen.getByText('Name this step.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Routine name'), 'Lunch reset');
    await user.type(screen.getByLabelText('Step 1'), 'Walk');
    await user.click(screen.getByRole('button', { name: '+ Add step' }));
    await user.type(screen.getByLabelText('Step 2'), 'Eat');
    await user.click(screen.getByRole('button', { name: 'Move Eat up' }));
    expect(screen.getByLabelText('Step 1')).toHaveValue('Eat');
    await user.click(screen.getByRole('button', { name: 'Save routine' }));
    expect(await screen.findByRole('link', { name: 'Lunch reset' })).toBeInTheDocument();
  });

  it('uses a template and shows history', async () => {
    window.location.hash = '/templates';
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Use “Weekly reset”' }));
    expect(await screen.findByDisplayValue('Weekly reset')).toBeInTheDocument();
    unmount();
    window.location.hash = '/history';
    render(<App />);
    expect(screen.getByRole('img', { name: /Bar chart of minutes per day/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Calm morning: \d+ of 14 days complete/ })).toBeInTheDocument();
  });
});

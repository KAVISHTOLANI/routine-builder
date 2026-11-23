import { expect, test } from '@playwright/test';
import { checkMobile, snap } from './helpers';

test('build a routine, run it, see history', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mornings that run');
  await expect(page.locator('.hero .checklist li').first()).toBeVisible();
  await page.waitForTimeout(1000);
  await snap(page, 'landing');
  await checkMobile(page, 'landing-mobile');

  await page.getByRole('link', { name: 'Run today’s routine' }).click();
  await expect(page.getByTestId('progress')).toContainText('2 of 5 steps');
  await page.getByRole('button', { name: 'Tick Stretch' }).click();
  await expect(page.getByTestId('progress')).toContainText('3 of 5 steps');
  await page.getByLabel('Start time').fill('08:15');
  await expect(page.getByText('Finishes at 08:50')).toBeVisible();
  await snap(page, 'today');
  await checkMobile(page);
  await page.reload();
  await expect(page.getByTestId('progress')).toContainText('3 of 5 steps');

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Routines' }).click();
  await page.getByRole('link', { name: 'New routine' }).click();
  await page.getByRole('button', { name: 'Save routine' }).click();
  await expect(page.getByText('Give the routine a name.')).toBeVisible();
  await page.getByLabel('Routine name').fill('Desk shutdown');
  await page.getByLabel('Step 1', { exact: true }).fill('Close all tabs');
  await page.getByRole('button', { name: '+ Add step' }).click();
  await page.getByLabel('Step 2', { exact: true }).fill('Write tomorrow’s first task');
  await page.getByRole('button', { name: 'Move Write tomorrow’s first task up' }).click();
  await expect(page.getByLabel('Step 1', { exact: true })).toHaveValue('Write tomorrow’s first task');
  await snap(page, 'editor');
  await page.getByRole('button', { name: 'Save routine' }).click();
  await expect(page.getByRole('link', { name: 'Desk shutdown' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'History' }).click();
  await expect(page.getByRole('img', { name: /Bar chart/ })).toBeVisible();
  await snap(page, 'history');
  await checkMobile(page, 'history-mobile');
});

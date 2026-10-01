import { expect, test } from '@playwright/test';
test('mobile landing honors reduced motion and preserves market context', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const join = page.getByRole('link', { name: /Join the Network/i }).first();
  await expect(join).toBeVisible();
  await expect(join).toHaveAttribute('href', '/register');
  const durations = await page
    .locator('.landing-shell')
    .evaluate((el) => ({
      animation: getComputedStyle(el).animationDuration,
      transition: getComputedStyle(el).transitionDuration,
    }));
  expect(parseFloat(durations.animation)).toBeLessThan(0.01);
  expect(parseFloat(durations.transition)).toBeLessThan(0.01);
  await page.goto('/marketplace?market=India');
  await page.reload();
  await expect(page).toHaveURL(/market=India/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('missing pages offer a useful recovery path with security headers', async ({
  page,
}) => {
  const response = await page.goto('/a-page-that-does-not-exist');
  expect(response?.status()).toBe(404);
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Explore businesses' }),
  ).toHaveAttribute('href', '/marketplace');
});

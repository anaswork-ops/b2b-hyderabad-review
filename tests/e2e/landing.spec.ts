import { expect, test } from '@playwright/test';

test('landing hero presents aviation artwork and routes every marketplace card', async ({
  page,
}) => {
  await page.goto('/');
  const background = await page
    .locator('.landing-shell')
    .evaluate(
      (element) => getComputedStyle(element, '::before').backgroundImage,
    );
  expect(background).toContain('emirates-sky-hero.png');

  for (const [mode, heading] of [
    ['tourism', 'Tourism Packages Marketplace'],
    ['packages', 'Hajj & Umrah Marketplace'],
    ['visa', 'Visa Services Marketplace'],
    ['services', 'Ground Services Marketplace'],
  ] as const) {
    const card = page.locator(`.vertical-tile[href*="mode=${mode}"]`);
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(new RegExp(`mode=${mode}`));
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await page.goto('/');
  }
});

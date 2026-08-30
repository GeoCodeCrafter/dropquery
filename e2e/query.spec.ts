import { expect, test } from '@playwright/test';

/**
 * Everything interesting about this app only happens in a real browser: the
 * WebAssembly database, the canvas, and the row windowing. Unit tests cover the
 * maths behind those; this covers whether they're actually wired together.
 */

/** Drops a File on the dropzone the way a user would. */
async function drop(page: import('@playwright/test').Page, name: string, contents: string) {
  await page.evaluate(
    ({ name, contents }) => {
      const file = new File([contents], name, { type: 'text/csv' });
      const dt = new DataTransfer();
      dt.items.add(file);
      document
        .getElementById('dropzone')!
        .dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
    },
    { name, contents },
  );

  await expect(page.locator('#workspace')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#results tbody tr')).not.toHaveCount(0, { timeout: 30_000 });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('sniffs a csv, registers it, and runs real SQL over it', async ({ page }) => {
  await drop(
    page,
    'sales.csv',
    'region,revenue\nnorth,4373.28\nsouth,2810.10\neast,5120.00\nwest,1990.55\neast,900.00\n',
  );

  await expect(page.locator('#status')).toContainText("consistent ',' separation");
  await expect(page.locator('#status')).toContainText('Registered as sales');

  await page.locator('#sql').fill('SELECT region, SUM(revenue) AS total FROM sales GROUP BY region ORDER BY total DESC');
  await page.getByRole('button', { name: 'Run' }).click();

  await expect(page.locator('#meta')).toContainText('4 rows');
  // east appears twice in the source and has to be summed, not just picked.
  await expect(page.locator('#results tbody tr').first()).toContainText('6020');
});

test('semicolons win over the commas inside quoted prose', async ({ page }) => {
  await drop(
    page,
    'notes.csv',
    'name;note\nada;"born in London, England"\ngrace;"a compiler, and a rear admiral"\n',
  );

  await expect(page.locator('#status')).toContainText("';' separation");
  await expect(page.locator('#results th')).toHaveCount(2);
});

test('a big result renders a window of rows, not all of them', async ({ page }) => {
  const rows = Array.from({ length: 50_000 }, (_, i) => `${i},row-${i},${i * 3}`).join('\n');
  await drop(page, 'big.csv', `id,label,value\n${rows}\n`);

  await page.locator('#sql').fill('SELECT * FROM big');
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.locator('#meta')).toContainText('50000 rows');

  // The whole point: 50k rows in the result, nowhere near 50k in the document.
  const rendered = await page.locator('#results tbody tr:not(.spacer)').count();
  expect(rendered).toBeGreaterThan(0);
  expect(rendered).toBeLessThan(200);

  const firstBefore = await page.locator('#results tbody tr:not(.spacer)').first().textContent();

  await page.locator('#table-scroll').evaluate((el) => {
    el.scrollTop = 300_000;
  });
  await page.waitForTimeout(300);

  const firstAfter = await page.locator('#results tbody tr:not(.spacer)').first().textContent();
  expect(firstAfter).not.toBe(firstBefore);

  // Still windowed after scrolling, and the scrollbar still spans the result.
  expect(await page.locator('#results tbody tr:not(.spacer)').count()).toBeLessThan(200);
  expect(await page.locator('#table-scroll').evaluate((el) => el.scrollHeight)).toBeGreaterThan(1_000_000);
});

test('the chart gets drawn', async ({ page }) => {
  await drop(page, 'sales.csv', 'region,revenue\nnorth,4373\nsouth,2810\neast,5120\n');

  const painted = await page.locator('#chart').evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Any non-transparent pixel means something was actually drawn.
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
    return false;
  });

  expect(painted).toBe(true);
});

test('nothing reaches the network after load', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== new URL(page.url()).origin) external.push(request.url());
  });

  await drop(page, 'sales.csv', 'region,revenue\nnorth,4373\nsouth,2810\n');
  await page.locator('#sql').fill('SELECT * FROM sales');
  await page.getByRole('button', { name: 'Run' }).click();
  await page.waitForTimeout(500);

  expect(external).toEqual([]);
});

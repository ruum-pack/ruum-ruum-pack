const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

module.exports = async function lighthouseAuth(browser, context) {
  const statePath = resolve(process.cwd(), process.env.LIGHTHOUSE_AUTH_STATE || 'tests/.auth/conductor.json');
  if (!existsSync(statePath)) {
    throw new Error(`No existe el estado autenticado para Lighthouse: ${statePath}`);
  }

  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  const page = await browser.newPage();

  try {
    if (Array.isArray(state.cookies) && state.cookies.length > 0) {
      await page.setCookie(...state.cookies);
    }

    const targetOrigin = new URL(context.url).origin;
    const originState = state.origins?.find((origin) => origin.origin === targetOrigin);
    if (!originState?.localStorage?.length) return;

    await page.goto(targetOrigin, { waitUntil: 'domcontentloaded' });
    await page.evaluate((items) => {
      for (const item of items) {
        window.localStorage.setItem(item.name, item.value);
      }
    }, originState.localStorage);
  } finally {
    await page.close();
  }
};

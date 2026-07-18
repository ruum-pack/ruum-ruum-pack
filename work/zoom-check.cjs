const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pages = ['/login', '/registro'];
  const results = [];
  for (const path of pages) {
    const page = await context.newPage();
    await page.goto(`http://localhost:3001${path}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
      const doc = document.documentElement;
      const controls = [...document.querySelectorAll('input:not([type="hidden"]):not(.sr-only), select, textarea')].map((el) => {
        const style = getComputedStyle(el);
        return { tag: el.tagName.toLowerCase(), type: el.getAttribute('type'), fontSize: Number.parseFloat(style.fontSize) };
      });
      const undersizedControls = controls.filter((item) => item.fontSize < 16);
      const overflowing = [...document.body.querySelectorAll('*')]
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.right > window.innerWidth + 1;
        })
        .slice(0, 10)
        .map((el) => ({ tag: el.tagName.toLowerCase(), className: String(el.getAttribute('class') || '').slice(0, 120), text: String(el.textContent || '').trim().slice(0, 80) }));
      return {
        path: location.pathname,
        zoom: getComputedStyle(doc).zoom || doc.style.zoom,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        undersizedControls,
        overflowing
      };
    });
    results.push(result);
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})();

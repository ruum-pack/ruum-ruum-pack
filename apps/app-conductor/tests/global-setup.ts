import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Realizar login si es necesario para pruebas autenticadas
  // await page.goto(config.projects[0].use.baseURL || 'http://localhost:3001');
  // await page.fill('input[name="email"]', 'test@example.com');
  // await page.fill('input[name="password"]', 'password');
  // await page.click('button[type="submit"]');
  
  await page.close();
  await browser.close();
}

export default globalSetup;

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'screenshots');
const BASE = 'https://frontend-for-you.vercel.app';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const requests = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('data:')) requests.push(`${req.method()} ${url}`);
  });
  const responses = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('supabase') || url.includes('/api/')) {
      responses.push(`${res.status()} ${url}`);
    }
  });

  console.log('== Loading', BASE);
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('nav warn:', e.message));
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(OUT, '01-home.png'), fullPage: true });
  const html = await page.content();
  fs.writeFileSync(path.join(OUT, '01-home.html'), html);
  console.log('TITLE:', await page.title());
  console.log('URL:', page.url());

  // visible text
  const text = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(OUT, '01-home.txt'), text);
  console.log('--- TEXT ---');
  console.log(text.slice(0, 3000));

  // links & buttons
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a,button,[role="button"],input,form')).slice(0, 80).map(el => ({
      tag: el.tagName,
      href: el.href || null,
      type: el.type || null,
      text: (el.innerText || el.value || el.placeholder || '').trim().slice(0, 80),
    }))
  );
  console.log('--- LINKS/BUTTONS ---');
  console.log(JSON.stringify(links, null, 1));

  console.log('--- REQUESTS ---');
  requests.forEach(r => console.log(r));
  console.log('--- API RESPONSES ---');
  responses.forEach(r => console.log(r));

  await context.close();
  await browser.close();
})();

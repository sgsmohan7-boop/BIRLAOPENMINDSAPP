import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    console.log(`[BROWSER PAGE ERROR] ${error.message}`);
  });

  page.on('requestfailed', request => {
    console.log(`[BROWSER REQUEST FAILED] ${request.url()} - ${request.failure()?.errorText}`);
  });

  page.on('response', response => {
    if (!response.ok()) {
      console.log(`[BROWSER HTTP ERROR] ${response.status()} ${response.url()}`);
    }
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 5000 });
    const content = await page.content();
    console.log("HTML length:", content.length);
    console.log("Snippet:", content.substring(0, 500));
    console.log("Has App loaded?", await page.$('#root').then(el => el ? "Yes" : "No"));
    console.log("App children count:", await page.evaluate(() => document.getElementById('root')?.children.length));
  } catch (e) {
    console.error("Navigation error:", e);
  }

  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();

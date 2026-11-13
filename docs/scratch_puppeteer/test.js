const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));

  console.log('Navigating...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  console.log('Loaded.');

  // Find the button with text "كود بايثون"
  const buttons = await page.$$('button');
  let clicked = false;
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('كود بايثون')) {
      console.log('Found button, clicking...');
      await btn.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    console.log('Button not found!');
  }

  // Wait a bit to let any errors log
  await new Promise(r => setTimeout(r, 2000));

  await browser.close();
})();

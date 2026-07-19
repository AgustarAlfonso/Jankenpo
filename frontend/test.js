const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle0' });
  
  try {
    await page.click('#btnStartHome');
    console.log('Clicked btnStartHome successfully');
    await new Promise(r => setTimeout(r, 1000));
  } catch (e) {
    console.log('Error clicking button:', e.message);
  }

  await browser.close();
})();

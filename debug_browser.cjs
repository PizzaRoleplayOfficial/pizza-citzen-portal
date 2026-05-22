const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] \${msg.type()}: \${msg.text()}`);
  });
  
  page.on('pageerror', exception => {
    console.log(`[BROWSER EXCEPTION] \${exception.toString()}`);
  });

  try {
    console.log('Navigating to https://pizza-citzen-portal.pages.dev ...');
    await page.goto('https://pizza-citzen-portal.pages.dev', { waitUntil: 'networkidle' });
    console.log('Navigation completed. Waiting 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await page.screenshot({ path: 'screenshot.png' });
    console.log('Screenshot saved to screenshot.png');
  } catch (err) {
    console.error('Error during navigation:', err);
  } finally {
    await browser.close();
  }
})();

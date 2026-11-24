// Kullanım: node render.js  -> story-1.png ... story-5.png (1080x1920)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 2000 } });
  await p.goto('file://' + path.join(__dirname, 'stories.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  for (let i = 1; i <= 5; i++) {
    await p.locator('#s' + i).screenshot({ path: path.join(__dirname, `story-${i}.png`) });
  }
  await b.close();
})();

const { chromium } = require('C:/Users/Mijin/Desktop/project_city/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

const base = process.env.REPORT_BASE || 'http://127.0.0.1:8891/reports/walk-radius-area-20260919/';
const label = process.env.REPORT_LABEL || 'local';
const output = path.resolve(__dirname, '../outputs/walk-radius-area-20260919');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const findings = {};
  try {
    for (const [name, viewport] of Object.entries({
      desktop: { width: 1440, height: 1000 },
      mobile: { width: 390, height: 844 },
    })) {
      const page = await browser.newPage({ viewportSize: viewport });
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      const response = await page.goto(base, { waitUntil: 'networkidle' });
      if (!response || !response.ok()) throw new Error(`${name}: page HTTP ${response?.status()}`);
      const result = await page.evaluate(() => ({
        title: document.title,
        h1: document.querySelector('h1')?.textContent.trim(),
        images: [...document.images].map(image => ({ src: image.src, width: image.naturalWidth })),
        tables: document.querySelectorAll('table').length,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }));
      if (result.images.some(image => image.width === 0)) throw new Error(`${name}: broken image`);
      if (result.overflow) throw new Error(`${name}: horizontal page overflow`);
      if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`);
      await page.screenshot({ path: path.join(output, `${label}-${name}-webpage.png`), fullPage: true });
      findings[name] = result;
      await page.close();
    }
    const jsonResponse = await fetch(new URL('analysis.json', base));
    const zipResponse = await fetch(new URL('500m_area_analysis.zip', base));
    const data = await jsonResponse.json();
    if (!jsonResponse.ok || data.validation?.count !== 917 || data.validation?.missing_walkshed_count !== 3) {
      throw new Error('analysis.json validation failed');
    }
    if (!zipResponse.ok || Number(zipResponse.headers.get('content-length')) < 400000) throw new Error('ZIP validation failed');
    findings.downloads = { json: jsonResponse.status, zip: zipResponse.status };
    fs.writeFileSync(path.join(output, `${label}-webpage-check.json`), JSON.stringify(findings, null, 2));
    console.log(JSON.stringify(findings, null, 2));
  } finally {
    await browser.close();
  }
})().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });

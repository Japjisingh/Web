// usage: node test.js [ids comma-separated, default all] [outdir]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const DIST = path.resolve(__dirname, '..', process.env.DIST || 'dist');
const ids = (process.argv[2] || 'p-vor,p-ils,p-hold,p-globe,p-wing,p-engine,p-storm,p-pfd').split(',');
const OUT = process.argv[3] || path.join(__dirname, '..', 'shots'); fs.mkdirSync(OUT, { recursive: true });
const wrapHTML = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') + '</body></html>';
const types = { '.js': 'application/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.html': 'text/html' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/_t.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(wrapHTML); } const f = path.join(DIST, u); if (!f.startsWith(DIST) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await page.goto(`http://localhost:${port}/_t.html`); await page.waitForTimeout(800);
  for (const id of ids) {
    const el = await page.$('#' + id); if (!el) { console.log('missing', id); continue; }
    await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(6000);
    const t0 = Date.now(); const fps = await page.evaluate(() => new Promise(res => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
    const bb = await el.boundingBox(); await page.screenshot({ path: path.join(OUT, id + '.png'), clip: bb, timeout: 120000 });
    console.log(id, 'screenshot ok, approx fps in swiftshader:', fps);
  }
  console.log('console errors/warnings:', JSON.stringify(errs.slice(0, 15), null, 1));
  await browser.close(); srv.close();
});

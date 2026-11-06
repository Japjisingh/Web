const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const DIST = path.join(__dirname, '..', 'dist');
const wrapHTML = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') + '</body></html>';
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; if (u === '/_t.html') { r.writeHead(200, {'content-type':'text/html'}); return r.end(wrapHTML); } const f = path.join(DIST, u); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, {'content-type': u.endsWith('.js') ? 'application/javascript' : 'image/jpeg'}); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://localhost:${srv.address().port}/_t.html`);
  for (const id of ['p-vor','p-pfd']) { await (await p.$('#'+id)).scrollIntoViewIfNeeded(); await p.waitForTimeout(5000); }
  const bb = await (await p.$('#p-pfd')).boundingBox(); await p.screenshot({ path: path.join(__dirname, '..', 'shots','phone-pfd.png'), clip: bb, timeout: 120000 });
  console.log('scrollWidth', await p.evaluate(() => document.documentElement.scrollWidth), 'errors', JSON.stringify(errs));
  await b.close(); srv.close();
});

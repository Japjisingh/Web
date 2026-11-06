// bright overcast cockpit (ground), IMC entry, normal day cockpit
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const DIST = path.resolve(__dirname, '..', 'dist-model'), OUT = path.resolve(__dirname, '..', 'shots-model');
const wrapHTML = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') + '</body></html>';
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; if (u === '/_t.html') { r.writeHead(200, {'content-type':'text/html'}); return r.end(wrapHTML); } const f = path.join(DIST, u); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, {'content-type': u.endsWith('.js') ? 'application/javascript' : 'image/jpeg'}); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await p.goto(`http://localhost:${srv.address().port}/_t.html`); await (await p.$('#p-sim')).scrollIntoViewIfNeeded();
  await p.waitForFunction(() => document.querySelector('#p-sim').__sim, null, { timeout: 120000 }); await p.waitForTimeout(3000);
  const shot = async n => { const bb = await (await p.$('#p-sim .stage')).boundingBox(); await p.screenshot({ path: path.join(OUT, n + '.png'), clip: bb, timeout: 240000 }); console.log('shot', n); };
  const H = fn => p.evaluate(fn);
  await H(() => { const h = document.querySelector('#p-sim').__sim; h.todSeg.set('day'); h.wx.base = 1000; h.cloudSeg.set('OVC'); h.start('to'); h.setView('cockpit'); });
  await p.waitForTimeout(7000); await shot('8-ovc-low-base-cockpit');
  await H(() => { const h = document.querySelector('#p-sim').__sim; h.start('dw'); h.s.pos.y = h.clouds.state.base + 30; });
  await p.waitForTimeout(7000); await shot('9-ovc-imc-entry-cockpit');
  await H(() => { const h = document.querySelector('#p-sim').__sim; h.wx.base = 3500; h.cloudSeg.set('SCT'); h.start('to'); });
  await p.waitForTimeout(7000); await shot('10-day-cockpit');
  console.log('errors', JSON.stringify(errs)); await b.close(); srv.close();
});

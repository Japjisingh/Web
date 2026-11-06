// cockpit / chase / tower + side panel screenshots for the sim scene
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const DIST = path.resolve(__dirname, '..', process.env.DIST || 'dist-sim'), OUT = path.resolve(__dirname, '..', process.argv[2] || 'shots-sim'); fs.mkdirSync(OUT, { recursive: true });
const wrapHTML = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') + '</body></html>';
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/_t.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(wrapHTML); } const f = path.join(DIST, u); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'application/javascript' : 'image/jpeg' }); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); }); p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto(`http://localhost:${srv.address().port}/_t.html`);
  const art = await p.$('#p-sim'); await art.scrollIntoViewIfNeeded(); await p.waitForTimeout(5000);
  const stage = async n => { const bb = await (await p.$('#p-sim .stage')).boundingBox(); await p.screenshot({ path: path.join(OUT, n + '.png'), clip: bb, timeout: 120000 }); console.log('shot', n); };
  const click = async t => { await p.click(`#p-sim .controls button:text-is("${t}")`); await p.waitForTimeout(300); };
  await stage('1-cockpit');
  // take-off: focus stage, full power with keyboard, look at it rolling
  await p.click('#p-sim .stage canvas', { position: { x: 30, y: 30 } }); await p.evaluate(() => { const h = document.querySelector('#p-sim').__sim; h.c.throttle = 1; h.s.vel.set(0, 0, -24); }); await p.waitForTimeout(4000);
  const ro1 = await p.$eval('#p-sim .readout', e => e.innerText.slice(0, 400)); console.log('after power:', ro1.replace(/\n/g, ' | '));
  await click('Chase'); await p.waitForTimeout(4000); await stage('2-chase-takeoff');
  await click('Downwind'); await p.waitForTimeout(4000); await stage('3-chase-downwind');
  await click('Tower'); await p.waitForTimeout(4000); await stage('4-tower');
  await click('Cockpit'); await p.waitForTimeout(4000); await stage('5-cockpit-downwind');
  const side = await p.$('#p-sim .sim-side'); const bb = await side.boundingBox(); await p.screenshot({ path: path.join(OUT, '6-side.png'), clip: bb, timeout: 120000 });
  const ro = await p.$eval('#p-sim .readout', e => e.innerText.slice(0, 600)); console.log('readout:', ro.replace(/\n/g, ' | '));
  console.log('errors', JSON.stringify(errs.slice(0, 10)));
  await b.close(); srv.close();
});

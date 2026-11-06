// realism checks: clouds, IMC, night final, crosswind take-off, METAR
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const DIST = path.resolve(__dirname, '..', process.env.DIST || 'dist-sim'), OUT = path.resolve(__dirname, '..', process.argv[2] || 'shots-sim2'); fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[3] ? process.argv[3].split(',') : null;
const wrapHTML = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') + '</body></html>';
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/_t.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(wrapHTML); } const f = path.join(DIST, u); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'application/javascript' : 'image/jpeg' }); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); }); p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto(`http://localhost:${srv.address().port}/_t.html`);
  await (await p.$('#p-sim')).scrollIntoViewIfNeeded(); await p.waitForTimeout(6000);
  const H = fn => p.evaluate(fn);
  const shot = async n => { const bb = await (await p.$('#p-sim .stage')).boundingBox(); await p.screenshot({ path: path.join(OUT, n + '.png'), clip: bb, timeout: 180000 }); console.log('shot', n); };
  const want = n => !only || only.includes(n);
  if (want('day')) await shot('1-day-sct-cockpit');
  if (want('imc')) {
    await H(() => { const h = document.querySelector('#p-sim').__sim; h.cloudSeg.set('BKN'); h.start('dw'); h.setView('chase'); });
    await p.waitForTimeout(1500);
    const r = await H(() => { const h = document.querySelector('#p-sim').__sim, cl = h.clouds, st = cl.state; let best = null; for (let x = -3000; x <= 3000; x += 120) for (let z = -3000; z <= 3000; z += 120) { const y = st.base + 250; const d = cl.density(x, y, z); if (!best || d > best.d) best = { x, y, z, d }; } h.s.pos.set(best.x, best.y, best.z + 120); return best; });
    console.log('cloud found', JSON.stringify(r)); await p.waitForTimeout(5000);
    console.log('imc', await H(() => document.querySelector('#p-sim').__sim.imc.toFixed(2)));
    await shot('2-chase-in-cloud');
    await H(() => { const h = document.querySelector('#p-sim').__sim; h.s.pos.y = h.clouds.state.base - 200; }); await p.waitForTimeout(5000); await shot('3-chase-below-bkn');
  }
  if (want('night')) {
    await H(() => { const h = document.querySelector('#p-sim').__sim; h.cloudSeg.set('FEW'); h.todSeg.set('night'); h.start('fin'); h.setView('cockpit'); });
    await p.waitForTimeout(6000); await shot('4-night-final-cockpit');
    await H(() => { const h = document.querySelector('#p-sim').__sim; h.setView('chase'); }); await p.waitForTimeout(5000); await shot('5-night-final-chase');
    await H(() => { const h = document.querySelector('#p-sim').__sim; h.todSeg.set('dusk'); h.start('fin'); h.setView('cockpit'); }); await p.waitForTimeout(6000); await shot('6-dusk-final-cockpit');
  }
  if (want('xwind')) {
    await H(() => { const h = document.querySelector('#p-sim').__sim; h.preSeg.set('xwind'); h.start('to'); h.setView('chase'); h.c.throttle = 1; h.s.vel.set(0, 0, -14); });
    await p.waitForTimeout(6000); await shot('7-xwind-takeoff-chase');
    await H(() => { const h = document.querySelector('#p-sim').__sim; h.setView('tower'); h.S.camera.fov = 8; }); await p.waitForTimeout(4000);
  }
  const ro = await p.$eval('#p-sim .readout', e => e.innerText); console.log('READOUT:', ro.replace(/\n+/g, ' | ').slice(0, 900));
  console.log('errors', JSON.stringify(errs.slice(0, 12)));
  await b.close(); srv.close();
});

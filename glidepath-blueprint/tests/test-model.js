// model-quality screenshots: exterior close-ups (day, dusk), cockpit day/night, panel close-up
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const DIST = path.resolve(__dirname, '..', process.env.DIST || 'dist-model'), OUT = path.resolve(__dirname, '..', process.argv[2] || 'shots-model'); fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[3] ? process.argv[3].split(',') : null, want = n => !only || only.includes(n);
const wrapHTML = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') + '</body></html>';
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/_t.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(wrapHTML); } const f = path.join(DIST, u); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'application/javascript' : 'image/jpeg' }); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); }); p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto(`http://localhost:${srv.address().port}/_t.html`);
  const t0 = Date.now(); await (await p.$('#p-sim')).scrollIntoViewIfNeeded();
  await p.waitForFunction(() => document.querySelector('#p-sim').__sim, null, { timeout: 120000 }); console.log('sim ready in', Date.now() - t0, 'ms');
  await p.waitForTimeout(4000);
  const H = (fn, arg) => p.evaluate(fn, arg);
  const shot = async n => { const bb = await (await p.$('#p-sim .stage')).boundingBox(); await p.screenshot({ path: path.join(OUT, n + '.png'), clip: bb, timeout: 240000 }); console.log('shot', n); };
  const cam = (off, tgtOff = [0, 0, 0], fov = 40) => H(([o, t, f]) => { const h = document.querySelector('#p-sim').__sim, P = h.s.pos; h.setView('chase'); h.S.camera.position.set(P.x + o[0], P.y + o[1], P.z + o[2]); h.S.controls.target.set(P.x + t[0], P.y + t[1], P.z + t[2]); h.S.camera.fov = f; h.S.camera.updateProjectionMatrix(); }, [off, tgtOff, fov]);
  console.log('quality', JSON.stringify(await H(() => document.querySelector('#p-sim').__quality)));
  if (want('ext')) {
    await H(() => { const h = document.querySelector('#p-sim').__sim; h.cloudSeg.set('FEW'); h.todSeg.set('day'); h.start('to'); h.c.flap = 1; });
    await cam([5.2, 0.6, -6.2], [0, -0.2, 0], 38); await p.waitForTimeout(7000); await shot('1-ext-day-34front');
    await H(() => document.querySelector('#p-sim').__sim.qSeg.set('ultra')); await p.waitForTimeout(8000); await shot('1b-ext-day-34front-ultra'); console.log('quality now', JSON.stringify(await H(() => document.querySelector('#p-sim').__quality.level)));
    await H(() => document.querySelector('#p-sim').__sim.qSeg.set('medium'));
    await cam([9.5, -0.6, 0.3], [0, -0.2, 0.2], 40); await p.waitForTimeout(6000); await shot('2-ext-day-side');
    await cam([-4.5, 1.8, 7.5], [0, 0, 0.5], 40); await p.waitForTimeout(6000); await shot('3-ext-day-34rear');
  }
  if (want('dusk')) {
    await H(() => { const h = document.querySelector('#p-sim').__sim; h.todSeg.set('dusk'); h.start('to'); Object.assign(h.c.lights, { land: true, taxi: true, nav: true, strb: true, bcn: true }); });
    await cam([4.5, 0.9, -8], [0, -0.3, -1], 42); await p.waitForTimeout(7000); await shot('4-ext-dusk-runway');
  }
  if (want('ck')) {
    await H(() => { const h = document.querySelector('#p-sim').__sim; h.todSeg.set('day'); h.cloudSeg.set('SCT'); h.start('to'); h.setView('cockpit'); h.S.camera.fov = 62; h.S.camera.updateProjectionMatrix(); });
    await p.waitForTimeout(7000); await shot('5-cockpit-day');
    const vis = await H(() => { const h = document.querySelector('#p-sim').__sim, T = h.S.THREE, ray = new T.Raycaster(), out = new Set(); h.S.camera.updateMatrixWorld(true); for (let y = -1; y <= 1; y += 0.012) for (let x = -1; x <= 1; x += 0.008) { ray.setFromCamera(new T.Vector2(x, y), h.S.camera); const k = ray.intersectObjects(h.ck.hits, false)[0]?.object.userData.ctl?.key; if (k) out.add(k); } return [...out].sort().join(', '); });
    console.log('clickable in default cockpit view:', vis);
    await H(() => { const h = document.querySelector('#p-sim').__sim; h.S.camera.fov = 26; h.S.camera.updateProjectionMatrix(); }); await p.waitForTimeout(5000); await shot('6-panel-closeup');
    await H(() => { const h = document.querySelector('#p-sim').__sim; h.S.camera.fov = 62; h.S.camera.updateProjectionMatrix(); h.todSeg.set('night'); h.start('fin'); h.c.panelLt = 2; h.c.flood = 1; h.qSeg.set('high'); });
    await p.waitForTimeout(7000); await shot('7-cockpit-night');
  }
  console.log('errors', JSON.stringify(errs.slice(0, 12)));
  await b.close(); srv.close();
});

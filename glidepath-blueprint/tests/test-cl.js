// cloud captures: node test-cl.js outDir [only,list] ; env DIST, Q (quality), FULL=1 (no reprojection)
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const DIST = path.resolve(__dirname, '..', process.env.DIST || 'dist-cl'), OUT = path.resolve(__dirname, '..', process.argv[2] || 'shots-cl'); fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[3] ? process.argv[3].split(',') : null, want = n => !only || only.includes(n);
const Q = process.env.Q || 'medium', FULL = process.env.FULL === '1';
const wrapHTML = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') + '</body></html>';
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/_t.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(wrapHTML); } const f = path.join(DIST, u); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'application/javascript' : 'image/jpeg' }); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); else if (m.text().startsWith('CL:')) console.log(m.text()); }); p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto(`http://localhost:${srv.address().port}/_t.html`);
  await p.evaluate(([q, full]) => { for (const id of ['p-sim', 'p-storm']) { const h = document.getElementById(id); if (h) { h.__quality = q; h.__cloudFull = full; } } }, [Q, FULL]);
  const H = fn => p.evaluate(fn);
  const pauseSim = () => p.evaluate(() => document.querySelectorAll('#p-sim button').forEach(b => { if (b.textContent === 'Pause') b.click(); }));
  const waitReady = async () => { for (let i = 0; i < 240; i++) { const r = await H(() => { const h = document.querySelector('#p-sim').__sim; return h && h.clouds.vc.state.ready; }); if (r) break; await p.waitForTimeout(500); } console.log('noise ms', await H(() => document.querySelector('#p-sim').__sim.clouds.vc.state.noiseMs.toFixed(0))); };
  const shot = async (sel, n, wait = 9000) => { await p.waitForTimeout(wait); const bb = await (await p.$(sel)).boundingBox(); await p.screenshot({ path: path.join(OUT, n + '.png'), clip: bb, timeout: 240000 }); console.log('shot', n); };
  if (want('day') || want('chase') || want('dusk') || want('ovc') || want('shadow')) {
    await (await p.$('#p-sim')).scrollIntoViewIfNeeded(); await p.waitForTimeout(3000); await waitReady();
    const pause = () => H(() => { const h = document.querySelector('#p-sim').__sim; if (!h.paused) h.start; });
    if (want('day')) { await H(() => { const h = document.querySelector('#p-sim').__sim; h.cloudSeg.set('SCT'); h.todSeg.set('day'); h.start('to'); h.setView('cockpit'); }); await shot('#p-sim .stage', '1-day-sct-cockpit'); }
    if (want('chase')) {
      const r = await H(() => { const h = document.querySelector('#p-sim').__sim, cl = h.clouds, V = h.S.THREE.Vector3; h.preSeg.set('cavok'); h.cloudSeg.set('SCT'); h.todSeg.set('day'); h.start('dw'); h.setView('chase');
        const st = cl.state; let best = null; for (let x = -6000; x <= 6000; x += 200) for (let z = -6000; z <= 2500; z += 200) { const d = cl.density(x, st.base + 1100, z); if (d > 0.04 && (!best || d > best.d)) best = { x, z, d }; }
        if (!best) for (let x = -6000; x <= 6000; x += 200) for (let z = -6000; z <= 2500; z += 200) { const d = cl.density(x, st.base + 400, z); if (d > 0.04 && (!best || d > best.d)) best = { x, z, d }; }
        if (best) { for (const dz of [2400, 2800, 3200, 3600, 4200, 5000]) { const p = { x: best.x, y: st.base + 200, z: best.z + dz }; let clear = true; for (let k = 0; k < 14; k++) { if (cl.density(p.x, p.y + k * 30, p.z + 60) > 0 || cl.density(p.x, p.y, p.z + k * 60) > 0 || cl.density(p.x + 30, p.y + 20, p.z - k * 60) > 0) clear = false; } if (clear) { h.s.pos.set(p.x, p.y, p.z); best.dz = dz; break; } }
          h.S.camera.position.copy(h.s.pos).add(new V(12, 4, 50)); h.S.controls.target.copy(h.s.pos).add(new V(0, 14, 0)); }
        return best; });
      console.log('tcu', JSON.stringify(r)); await pauseSim(); await shot('#p-sim .stage', '2-chase-towering-cu'); await p.evaluate(() => document.querySelectorAll('#p-sim button').forEach(b => { if (b.textContent === 'Resume') b.click(); }));
    }
    if (want('dusk')) { await H(() => { const h = document.querySelector('#p-sim').__sim, T = h.S.THREE; h.cloudSeg.set('BKN'); h.todSeg.set('dusk'); h.start('dw'); h.setView('chase'); h.s.pos.set(0, h.clouds.state.base - 260, 2500); h.S.camera.position.copy(h.s.pos).add(new T.Vector3(55, -8, 12)); h.S.controls.target.copy(h.s.pos).add(new T.Vector3(0, 14, 0)); }); await pauseSim(); await shot('#p-sim .stage', '3-dusk-bkn-chase'); await p.evaluate(() => document.querySelectorAll('#p-sim button').forEach(b => { if (b.textContent === 'Resume') b.click(); })); }
    if (want('ovc')) { await H(() => { const h = document.querySelector('#p-sim').__sim; h.preSeg.set('low'); h.cloudSeg.set('OVC'); h.todSeg.set('day'); h.start('dw'); h.setView('cockpit'); h.s.pos.y = h.clouds.state.base - 60; }); await shot('#p-sim .stage', '4-ovc-low-base-cockpit');
      await H(() => { const h = document.querySelector('#p-sim').__sim; h.s.pos.y = h.clouds.state.base + 120; }); await shot('#p-sim .stage', '4b-ovc-imc-entry'); console.log('imc', await H(() => document.querySelector('#p-sim').__sim.imc.toFixed(2))); }
    if (want('shadow')) { await H(() => { const h = document.querySelector('#p-sim').__sim; h.preSeg.set('cavok'); h.cloudSeg.set('SCT'); h.todSeg.set('day'); h.start('dw'); h.setView('chase'); h.s.pos.set(0, h.clouds.state.base + 2400, 4500); h.S.camera.position.copy(h.s.pos).add(new h.S.THREE.Vector3(0, 40, 60)); h.S.controls.target.copy(h.s.pos); }); await pauseSim(); await shot('#p-sim .stage', '5-cloud-shadows-from-altitude', 14000); await p.evaluate(() => document.querySelectorAll('#p-sim button').forEach(b => { if (b.textContent === 'Resume') b.click(); })); }
  }
  if (want('storm')) { await (await p.$('#p-storm')).scrollIntoViewIfNeeded(); await p.waitForTimeout(4000); await shot('#p-storm .stage', '6-storm-mature', 30000); }
  console.log('shadowOn', await H(() => { const h = document.querySelector('#p-sim').__sim; return h ? h.clouds.vc.CLOUD_SHADOW.uCloudShadowOn.value : null; }).catch(() => null));
  console.log('errors', JSON.stringify(errs.slice(0, 12)));
  await b.close(); srv.close();
});

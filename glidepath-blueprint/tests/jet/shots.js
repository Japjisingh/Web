// node shots.js outDir [only,list]   env: DIST, DSF (device scale), W
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const B = path.resolve(__dirname, '../..'); const DIST = path.resolve(B, process.env.DIST || 'dist-jet');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'shots')); fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[3] ? process.argv[3].split(',') : null, want = n => !only || only.includes(n);
const wrapHTML = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') + '</body></html>';
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/_t.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(wrapHTML); } const f = path.join(DIST, u); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'application/javascript' : 'image/jpeg' }); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: +(process.env.W || 1280), height: 900 }, deviceScaleFactor: +(process.env.DSF || 1.5) });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); else if (m.text().startsWith('JET:')) console.log(m.text()); });
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await p.goto(`http://localhost:${srv.address().port}/_t.html`);
  const art = await p.$('#p-jet'); await art.scrollIntoViewIfNeeded(); await p.waitForTimeout(4000);
  const J = (fn, arg) => p.evaluate(([f, a]) => { const h = document.querySelector('#p-jet').__jet; return eval('(' + f + ')')(h, a); }, [fn.toString(), arg]);
  const ready = await p.evaluate(() => !!document.querySelector('#p-jet').__jet); console.log('ready', ready); if (!ready) { console.log(errs); process.exit(1); }
  const stage = async (n, wait = 3500) => { await p.waitForTimeout(wait); const bb = await (await p.$('#p-jet .stage')).boundingBox(); await p.screenshot({ path: path.join(OUT, n + '.png'), clip: bb, timeout: 180000 }); console.log('shot', n); };
  const side = async (n) => { await p.evaluate(() => document.querySelector('#p-jet .sim-side').scrollIntoView({ block: 'start' })); await p.waitForTimeout(600); const bb = await (await p.$('#p-jet .sim-side')).boundingBox(); await p.screenshot({ path: path.join(OUT, n + '.png'), clip: bb, timeout: 180000, fullPage: true }); console.log('shot', n); await p.evaluate(() => document.querySelector('#p-jet').scrollIntoView({ block: 'start' })); };
  const powerUp = () => J(h => { for (const [id, v] of [['batV1'], ['bat1', { to: true }], ['bat2', { to: true }], ['extPwr', { to: true }], ['irs1', { to: 'NAV' }], ['irs2', { to: 'NAV' }], ['irs3', { to: 'NAV' }]]) h.act(id, v); h.advance(2); });
  if (want('captain')) { await J(h => { h.setScenario('full'); h.setView('captain', true); }); await stage('01-captain-cold-dark', 5000); }
  if (want('flat')) { await J(h => { h.setScenario('full'); h.pose({ pos: [0, 1.06, 0.045], yaw: 0, pitch: 72 * Math.PI / 180, fov: 49 }); }); await stage('00-overhead-flat', 5000); }
  if (want('ovhcold')) { await J(h => h.setView('overhead', true)); await stage('02-overhead-cold-dark'); }
  if (want('ovhpow')) { await J(h => { h.setScenario('full'); h.setView('overhead', true); }); await powerUp(); await J(h => { h.act('crewOxy', { to: true }); h.act('apuMaster', { to: true }); h.advance(14); h.act('apuStart'); h.advance(10); }); await stage('03-overhead-powered'); }
  if (want('anntest')) { await J(h => { h.act('annLt', { to: 2 }); }); await stage('03b-overhead-ann-test'); await J(h => h.act('annLt', { to: 1 })); }
  if (want('captainpow')) { await J(h => h.setView('captain', true)); await stage('04-captain-powered'); }
  if (want('pedestal')) { await J(h => h.setView('pedestal', true)); await stage('05-pedestal'); }
  if (want('start')) {
    await J(h => { h.setScenario('start'); h.setMode('guided'); for (const [id, v] of [['beacon', { to: 1 }], ['parkBrk'], ['thr1'], ['pack1', { to: false }], ['pack2', { to: false }], ['apuBleed'], ['engMode', { to: 'IGN' }], ['master2', { to: true }]]) h.act(id, v); h.advance(30); h.setView('displays', true); });
    console.log('JET: eng2', await J(h => JSON.stringify({ n1: h.sys.st.eng[1].n1.toFixed(1), n2: h.sys.st.eng[1].n2.toFixed(1), egt: Math.round(h.sys.st.eng[1].egt), ign: h.sys.st.eng[1].ign, page: h.sys.st.sdPage })));
    await stage('06-displays-engine-start', 4500);
    await J(h => h.setView('pedestal', true)); await stage('06b-pedestal-during-start');
  }
  if (want('fire')) {
    await J(h => { h.setScenario('fire'); for (const [id, v] of [['beacon', { to: 1 }], ['parkBrk'], ['thr1'], ['pack1', { to: false }], ['pack2', { to: false }], ['apuBleed'], ['engMode', { to: 'IGN' }], ['master2', { to: true }]]) h.act(id, v); for (let i = 0; i < 120 && !h.sys.st.eng[1].fire; i++) h.advance(0.5); h.setView('captain', true); });
    await stage('07-fire-captain', 4000);
    await J(h => h.setView('overhead', true)); await stage('07b-fire-overhead');
    await J(h => h.setView('displays', true)); await stage('07c-fire-displays');
    // drill, with one step out of order (master off before silencing)
    await J(h => { h.act('master2', { to: false }); h.act('masterWarnL'); h.act('thr2'); h.act('firePb2'); h.act('firePb2'); h.advance(11); h.act('agent2_1'); h.advance(5); h.act('engMode', { to: 'NORM' }); h.confirm(); h.advance(0.5); });
    await stage('08-fire-drill-complete', 3000);
    await side('09-debrief-light');
    await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await side('10-debrief-dark');
    await p.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  }
  if (want('checklist')) { await J(h => { h.setScenario('full'); h.setMode('practice'); h.act('batV1'); h.act('bat1', { to: true }); h.act('pack1', { to: false }); }); await side('11-checklist-practice'); await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await side('11b-checklist-practice-dark'); await p.evaluate(() => document.documentElement.removeAttribute('data-theme')); }
  if (want('mobile')) { await J(h => { h.setScenario('full'); h.setMode('guided'); h.setView('captain', true); }); await stage('m1-stage-' + (process.env.W || 1280), 5000); await J(h => { h.act('batV1'); h.advance(0.3); h.act('bat1', { to: true }); h.dock(true); }); await stage('m2-stage-dock-' + (process.env.W || 1280), 3000); await J(h => h.dock(false)); await side('m3-side-' + (process.env.W || 1280)); }
  const st = await J(h => { const R = h.S.renderer; R.info.autoReset = false; R.info.reset(); h.S.composer.render(); const o = { calls: R.info.render.calls, tris: R.info.render.triangles }; R.info.autoReset = true; return o; });
  const st2 = await J(h => ({ calls: h.S.renderer.info.render.calls, tris: h.S.renderer.info.render.triangles, tex: h.S.renderer.info.memory.textures, geo: h.S.renderer.info.memory.geometries }));
  console.log('render info', JSON.stringify(st));
  const ov = await p.evaluate(() => { const a = document.querySelector('#p-jet'); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, side: a.querySelector('.sim-side').scrollWidth + '/' + a.querySelector('.sim-side').clientWidth }; });
  console.log('overflow', JSON.stringify(ov));
  console.log('errors', JSON.stringify(errs.slice(0, 20), null, 1));
  await b.close(); srv.close();
});

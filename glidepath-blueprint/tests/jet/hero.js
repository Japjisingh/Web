// Hero captures at 1920x1200: node hero.js [only,list]   env PR (render pixel ratio, default 2), FRAMES
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const B = path.resolve(__dirname, '../..'), DIST = path.join(B, 'dist-jet'), OUT = process.env.OUTDIR || path.join(B, 'shots-jet-hero'); fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2] ? process.argv[2].split(',') : null, want = n => !only || only.includes(n);
const PR = +(process.env.PR || 2), FR = +(process.env.FRAMES || 14);
const wrapHTML = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{color-scheme:dark}body{margin:0}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') + '</body></html>';
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/_t.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(wrapHTML); } const f = path.join(DIST, u); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'application/javascript' }); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1 })).newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); }); p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto(`http://localhost:${srv.address().port}/_t.html`); await (await p.$('#p-jet')).scrollIntoViewIfNeeded(); await p.waitForTimeout(3000);
  const J = (fn, arg) => p.evaluate(([f, a]) => { const h = document.querySelector('#p-jet').__jet; return eval('(' + f + ')')(h, a); }, [fn.toString(), arg]);
  await J((h, pr) => { h.hero(true, pr); h.deck.flashHold = true; }, PR);
  const frames = n => p.evaluate(n => new Promise(res => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const shot = async (name) => { const t0 = Date.now(); await frames(FR); await p.screenshot({ path: path.join(OUT, name + '.png'), timeout: 600000 }); console.log('hero', name, ((Date.now() - t0) / 1000).toFixed(0) + ' s'); };
  const prep = (h) => {
    for (const [id, v] of [['batV1'], ['bat1', { to: true }], ['bat2', { to: true }], ['extPwr', { to: true }], ['irs1', { to: 'NAV' }], ['irs2', { to: 'NAV' }], ['irs3', { to: 'NAV' }], ['crewOxy', { to: true }]]) { h.act(id, v); h.advance(0.3); }
    h.act('test1'); h.advance(3.5); h.act('masterWarnL'); h.act('testApu'); h.advance(3.5); h.act('test2'); h.advance(3.5); h.touch('HYD');
    for (const id of ['pL1', 'pL2', 'pC1', 'pC2', 'pR1', 'pR2']) { h.act(id, { to: true }); h.advance(0.2); }
    for (const a of ['ELEC', 'AIR', 'ANTIICE', 'PRESS']) h.touch(a);
    for (const [id, v] of [['navLogo', 1], ['seatBelts', 1], ['noSmoking', 1], ['emerExit', 1]]) { h.act(id, { to: v }); h.advance(0.3); } h.act('annLt', { to: 2 }); h.advance(0.5); h.act('annLt', { to: 1 }); h.touch('RCOL');
    h.act('apuMaster', { to: true }); h.advance(13); h.act('apuStart'); for (let i = 0; i < 120 && !h.sys.st.apu.avail; i++) h.advance(0.5); h.advance(2);
    h.sys.setSwitch('intLtOvhd', 2); h.sys.setSwitch('dome', 1);
  };
  const beforeStart = (h) => { for (const [id, v] of [['beacon', { to: 1 }], ['parkBrk'], ['thr1'], ['pack1', { to: false }], ['pack2', { to: false }], ['apuBleed'], ['engMode', { to: 'IGN' }], ['master2', { to: true }]]) { h.act(id, v); h.advance(0.3); } };
  if (want('a')) { await J((h, prep) => { h.setMode('guided'); h.setScenario('full'); h.setTOD('dusk'); eval('(' + prep + ')')(h); h.dock(true); h.pose({ pos: [-0.36, 1.24, 0.44], target: [-0.16, 1.44, -0.8], fov: 74 }); }, prep.toString()); await shot('a-captain-dusk-guided-apu-bleed'); }
  if (want('b')) { await J((h, prep) => { if (!h.sys.st.apu.avail) { h.setScenario('full'); h.setTOD('dusk'); eval('(' + prep + ')')(h); } h.act('apuBleed', { to: true }); h.advance(2); h.dock(false); h.pose({ pos: [-0.02, 1.04, 0.07], target: [0.0, 1.895, -0.27], fov: 56 }); }, prep.toString()); await shot('b-overhead-powered-lit'); }
  if (want('b2')) { await J(h => { h.setMode('guided'); h.setScenario('full'); h.setTOD('dusk'); for (const [id, v] of [['batV1'], ['bat1', { to: true }], ['bat2', { to: true }], ['extPwr', { to: true }], ['irs1', { to: 'NAV' }], ['irs2', { to: 'NAV' }], ['irs3', { to: 'NAV' }]]) { h.act(id, v); h.advance(0.3); } h.sys.setSwitch('apuMaster', true); h.advance(13); h.sys.press('apuStart'); h.advance(8); h.sys.setSwitch('intLtOvhd', 2); h.sys.setSwitch('dome', 1); h.dock(false); h.pose({ pos: [0.02, 1.40, -0.02], target: [0.03, 1.90, -0.33], fov: 42 }); }); await shot('b2-overhead-closeup-lit'); }
  if (want('c')) { await J((h, bs) => { h.setMode('guided'); h.setScenario('start'); h.setTOD('dusk'); eval('(' + bs + ')')(h); h.advance(22); h.dock(false); h.pose({ pos: [-0.26, 0.98, 0.20], target: [0.02, 0.46, -0.22], fov: 50 }); }, beforeStart.toString()); await shot('c-pedestal-masters-thrust'); }
  if (want('d')) { await J((h, bs) => { if (!h.sys.st.eng[1].lit) { h.setScenario('start'); h.setTOD('dusk'); eval('(' + bs + ')')(h); h.advance(22); } h.advance(4); h.dock(false); h.pose({ pos: [-0.30, 1.07, -0.24], target: [-0.17, 0.745, -0.9], fov: 46 }); }, beforeStart.toString()); await shot('d-displays-engine-start'); }
  if (want('e')) { await J((h, bs) => { h.setMode('guided'); h.setScenario('fire'); h.setTOD('dusk'); eval('(' + bs + ')')(h); for (let i = 0; i < 160 && !h.sys.st.eng[1].fire; i++) h.advance(0.5); h.advance(1); h.dock(true); h.pose({ pos: [-0.44, 1.2, 0.16], target: [-0.3, 1.02, -0.9], fov: 66 }); }, beforeStart.toString()); await shot('e-engine-fire-warning'); }
  if (want('e2')) { await J(h => { h.dock(false); h.pose({ pos: [0.06, 1.33, 0.56], target: [0.06, 2.0, 0.08], fov: 34 }); }); await shot('e2-fire-pushbutton-lit'); }
  if (want('f')) { await J(h => { if (!h.sys.st.eng[1].fire) return; h.act('master2', { to: false }); h.advance(0.3); h.act('masterWarnL'); h.advance(0.3); h.act('thr2'); h.act('firePb2'); h.act('firePb2'); h.advance(11); h.act('agent2_1'); h.advance(5); h.act('engMode', { to: 'NORM' }); h.confirm(); h.advance(0.5); h.dock(true); h.pose({ pos: [-0.44, 1.2, 0.16], target: [-0.3, 1.1, -0.9], fov: 66 }); }); await shot('f-debrief-overlay'); }
  // ---- captain-view set (premium pass): same engine-start state at three times of day, callout on the upper display ----
  const PFX = process.env.PFX || '';
  const capState = (h, bs, tod) => { h.setMode('guided'); h.setScenario('start'); h.setTOD(tod); eval('(' + bs + ')')(h); h.advance(20); h.dock(false); };
  const capPose = h => h.pose({ pos: [-0.53, 1.17, 0.14], target: [-0.45, 1.25, -1.0], fov: 70 });
  for (const tod of ['day', 'dusk', 'night']) if (want('cap-' + tod)) { await J((h, a) => { const [bs, tod, cs, cp] = a; eval('(' + cs + ')')(h, bs, tod); eval('(' + cp + ')')(h); }, [beforeStart.toString(), tod, capState.toString(), capPose.toString()]); await shot(PFX + 'cap-' + tod); }
  if (want('wide-raw')) { await J((h, a) => { const [bs, cs] = a; eval('(' + cs + ')')(h, bs, 'dusk'); h.hud.root.style.display = 'none'; h.pose({ pos: [-0.05, 1.58, 1.45], target: [-0.06, 1.0, -0.9], fov: 62 }); }, [beforeStart.toString(), capState.toString()]); await shot(PFX + 'wide-raw-dusk'); await J(h => { h.hud.root.style.display = ''; }); }
  if (want('wide-raw-day')) { await J((h, a) => { const [bs, cs] = a; eval('(' + cs + ')')(h, bs, 'day'); h.hud.root.style.display = 'none'; h.pose({ pos: [-0.05, 1.58, 1.45], target: [-0.06, 1.0, -0.9], fov: 62 }); }, [beforeStart.toString(), capState.toString()]); await shot(PFX + 'wide-raw-day'); await J(h => { h.hud.root.style.display = ''; }); }
  // ---- working avionics set (FCU, EFIS, ND, flight computers, radios, systems pages, AGENT 2 drill) ----
  const avState = (h) => {
    h.setMode('practice'); h.setScenario('start'); h.setTOD('dusk'); h.dock(false); h.hud.root.style.display = '';
    h.knob('spdKnob', 'set', 160); h.knob('spdKnob', 'pull'); h.knob('hdgKnob', 'set', 279); h.knob('hdgKnob', 'pull');
    h.knob('altKnob', 'set', 12000); h.knob('vsKnob', 'set', 1500); h.knob('vsKnob', 'pull');
    h.act('ap1'); h.act('athr'); h.act('loc'); h.act('lsL', { to: true }); h.act('cstrL'); h.act('ndRangeL', { to: 40 }); h.act('adf1L', { to: 'VOR' });
    h.act('f2_PERF'); h.act('f1_INIT'); h.type(1, 'GPX101');
    h.act('rmp1Outer', 2); h.act('rmp1Inner', -5); for (const k of ['x4', 'x7', 'x2', 'x1']) h.act(k); h.act('xpdr', { to: 2 });
    h.sys.setSwitch('intLtOvhd', 2); h.advance(1.5);
  };
  const AV = [
    ['g', 'g-fcu-selected-values', { pos: [-0.10, 1.15, -0.40], target: [0.0, 1.0, -0.775], fov: 44 }],
    ['h', 'h-efis-pfd-bugs-baro-fd', { pos: [-0.60, 1.07, -0.30], target: [-0.67, 0.92, -0.84], fov: 44 }],
    ['i', 'i-nd-arc-40-constraints', { pos: [-0.44, 0.96, -0.45], target: [-0.47, 0.85, -0.85], fov: 31 }],
    ['j', 'j-flight-computers-init-perf', { pos: [0.0, 0.92, -0.30], target: [0.0, 0.47, -0.62], fov: 44 }],
    ['k', 'k-radio-transponder', { pos: [-0.03, 0.97, 0.33], target: [-0.03, 0.44, 0.01], fov: 54 }]
  ];
  for (const [k, name, pose] of AV) if (want(k)) { await J((h, a) => { const [st, pose] = a; if (!h.__av) { eval('(' + st + ')')(h); h.__av = 1; } h.hud.root.style.display = 'none'; h.pose(pose); }, [avState.toString(), pose]); await shot(name); }
  if (want('l')) { // 2 x 3 grid of the systems pages, drawn at 1024 px each from the live systems state
    const url = await J(async h => {
      h.setScenario('start'); h.act('beacon', { to: 1 }); h.act('engMode', { to: 'IGN' }); h.act('master2', { to: true }); for (let i = 0; i < 160 && !h.sys.st.eng[1].running; i++) h.advance(0.5); h.advance(30); h.act('stickL'); h.act('stickL'); h.act('stickL'); h.advance(2);
      const G = document.createElement('canvas'); G.width = 1920; G.height = 1200; const g = G.getContext('2d'); g.fillStyle = '#0b1117'; g.fillRect(0, 0, 1920, 1200);
      const pages = ['PRESS', 'COND', 'DOOR', 'WHEEL', 'FCTL', 'STS'], S = 520;
      for (let i = 0; i < 6; i++) { h.act('sd' + pages[i]); h.advance(0.2); const c = document.createElement('canvas'); c.width = c.height = 1024; h.__drawSD(c.getContext('2d'), 1024, h.sys); const x = 90 + (i % 3) * (S + 90), y = 34 + Math.floor(i / 3) * (S + 66); g.fillStyle = '#1b232b'; g.fillRect(x - 8, y - 8, S + 16, S + 16); g.drawImage(c, x, y, S, S); g.fillStyle = '#9fb2bd'; g.font = '600 18px sans-serif'; g.fillText(pages[i].replace('FCTL', 'F/CTL') + ' page', x, y + S + 26); }
      return G.toDataURL('image/png');
    });
    fs.writeFileSync(path.join(OUT, 'l-systems-pages-grid.png'), Buffer.from(url.split(',')[1], 'base64')); console.log('hero l-systems-pages-grid (2D)');
  }
  if (want('m')) { await J(h => { h.setMode('guided'); h.setScenario('fire2'); h.setTOD('dusk'); for (const [id, v] of [['beacon', { to: 1 }], ['parkBrk'], ['thr1'], ['pack1', { to: false }], ['pack2', { to: false }], ['apuBleed'], ['engMode', { to: 'IGN' }], ['master2', { to: true }]]) { h.act(id, v); h.advance(0.3); }
      for (let i = 0; i < 160 && !h.sys.st.eng[1].fire; i++) h.advance(0.5); h.act('masterWarnL'); h.act('thr2'); h.act('master2', { to: false }); h.act('firePb2'); h.act('firePb2'); h.advance(10.5); h.act('agent2_1'); for (let i = 0; i < 80 && h.flow.current().id !== 'agent2'; i++) h.advance(0.5); h.advance(0.5);
      h.sys.setSwitch('intLtOvhd', 2); h.hud.root.style.display = ''; h.dock(false); h.pose({ pos: [0.02, 1.30, 0.50], target: [0.06, 1.98, 0.05], fov: 46 }); }); await shot('m-fire-agent2-callout'); }
  const perf = await J(h => { const R = h.S.renderer; R.info.autoReset = false; R.info.reset(); h.S.composer.render(); const o = { calls: R.info.render.calls, tris: R.info.render.triangles, q: h.quality.level }; R.info.autoReset = true; return o; }); console.log('perf', JSON.stringify(perf));
  console.log('errors', JSON.stringify(errs.slice(0, 10)));
  await b.close(); srv.close();
});

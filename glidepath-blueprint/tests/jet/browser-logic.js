// Drives the full flows through host.__jet in the real page (same code path as clicks) and checks the systems.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), http = require('http');
const DIST = path.resolve(__dirname, '../../dist-jet');
const wrapHTML = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(path.join(DIST, 'index.html'), 'utf8') + '</body></html>';
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/_t.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(wrapHTML); } const f = path.join(DIST, u); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'application/javascript' }); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto(`http://localhost:${srv.address().port}/_t.html`); await (await p.$('#p-jet')).scrollIntoViewIfNeeded(); await p.waitForTimeout(3000);
  const res = await p.evaluate(() => {
    const h = document.querySelector('#p-jet').__jet, s = () => h.sys.st, out = []; let ok = true;
    const check = (c, m) => { out.push((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
    const A = (id, v) => { h.act(id, v === undefined ? undefined : { to: v }); h.advance(0.3); };
    const T = a => { h.touch(a); h.advance(0.2); };
    const until = (c, max = 200) => { let t = 0; while (!c() && t < max) { h.advance(0.5); t += 0.5; } return t; };
    const f1 = x => Math.round(x * 10) / 10;
    // display helpers: force a display refresh, read pixels in 512-space, hash a canvas
    let tt = 1000; const refresh = () => { h.deck.update(h.sys, 0.3, tt += 0.3); };
    const D = k => h.deck.DSP[k];
    const rd = document.createElement('canvas'), rx = rd.getContext('2d', { willReadFrequently: true });
    const grab = k => { const c = D(k).c; if (rd.width !== c.width) { rd.width = c.width; rd.height = c.height; } rx.drawImage(c, 0, 0); return rx; };
    const pix = (k, X, Y) => { const c = D(k).c, sc = c.width / 512; const d = grab(k).getImageData(Math.round(X * sc), Math.round(Y * sc), 1, 1).data; return [d[0], d[1], d[2]]; };
    const count = (k, x0, y0, x1, y1, f) => { const c = D(k).c, sc = c.width / 512; const d = grab(k).getImageData(Math.round(x0 * sc), Math.round(y0 * sc), Math.round((x1 - x0) * sc), Math.round((y1 - y0) * sc)).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (f(d[i], d[i + 1], d[i + 2])) n++; return n; };
    const cyan = (r, g, b) => b > 200 && g > 170 && r < 120, mag = (r, g, b) => r > 200 && b > 170 && g < 120, yel = (r, g, b) => r > 220 && g > 200 && b < 110;
    const hash = k => { const c = D(k).c; const d = grab(k).getImageData(0, 0, c.width, c.height).data; let a = 0; for (let i = 0; i < d.length; i += 28) a = (a * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 1000000007; return a; };
    // read the current checklist through the card API like a careful trainee; set the baro if the checklist stops on it
    const CL0 = () => { for (let i = 0; i < 200; i++) { const c = h.flow.current(); if (!c || c.kind !== 'checklist') return; const C = h.cl; if (C.status === 'active') h.clAnswer(C.correctIndex()); else { if (C.cur() && C.cur().c === 'BARO REF') { h.knob('baroL', 'set', 1009); h.knob('baroR', 'set', 1009); } h.advance(0.3); } h.advance(0.05); } };
    // ---------------- cold & dark to engines running ----------------
    h.setMode('practice'); h.setScenario('full');
    check(!s().elec.dc && s().irs.every(r => r.mode === 'OFF') && s().apu.n === 0 && s().eng.every(e => e.n2 === 0), 'cold & dark: no power, IRS off, APU and engines stopped');
    A('batV1'); A('bat1', true); A('bat2', true); A('extPwr', true);
    check(s().elec.src1 === 'EXT PWR' && s().elec.src2 === 'EXT PWR', 'power-up: batteries on, EXT PWR feeds both AC buses');
    A('irs1', 'NAV'); A('irs2', 'NAV'); A('irs3', 'NAV'); A('crewOxy', true);
    A('test1'); h.advance(3.5); A('masterWarnL'); A('testApu'); h.advance(3.5); A('test2'); h.advance(3.5);
    T('HYD'); for (const id of ['pL1', 'pL2', 'pC1', 'pC2', 'pR1', 'pR2']) A(id, true);
    for (const a of ['ELEC', 'AIR', 'ANTIICE', 'PRESS']) T(a);
    A('navLogo', 1); A('seatBelts', 1); A('noSmoking', 1); A('emerExit', 1); A('annLt', 2); A('annLt', 1); T('RCOL');
    A('apuMaster', true); h.advance(13); A('apuStart');
    const ta = until(() => s().apu.avail);
    check(s().apu.avail && s().apu.n > 95, `APU running: AVAIL after ${ta} s, N ${f1(s().apu.n)} %, EGT ${Math.round(s().apu.egt)} °C`);
    A('apuBleed', true); A('extPwr', false); h.advance(4);
    check(s().elec.src1 === 'APU GEN' && s().bleed.duct[0] > 30, `APU GEN on line, APU bleed ${Math.round(s().bleed.duct[0])} psi`);
    until(() => s().irs.every(r => r.aligned));
    // flight computer with the keypad (same path as clicks)
    A('f1_INIT'); h.type(1, 'ZZAA/ZZBB'); A('f1_R1'); h.type(1, 'GPX101'); A('f1_L3'); h.type(1, '1009'); A('f1_R3'); h.type(1, '30'); A('f1_L5'); h.type(1, 'FL350'); A('f1_R5');
    A('f1_FPLN'); h.type(1, '27R'); A('f1_L1'); h.type(1, '09'); A('f1_L5');
    A('f1_PERF'); h.type(1, '135'); A('f1_L1'); h.type(1, '140'); A('f1_L2'); h.type(1, '13'); A('f1_L3');
    check(h.state().av.fms.u[0].msg === 'INVALID ENTRY' && !h.state().av.fms.v2, 'flight computer rejects V2 "13": ' + h.state().av.fms.u[0].msg);
    A('f1_CLR'); A('f1_CLR'); A('f1_CLR'); h.type(1, '145'); A('f1_L3'); h.type(1, '45'); A('f1_R4');
    const fm = h.state().av.fms;
    check(fm.from === 'ZZAA' && fm.to === 'ZZBB' && fm.depRwy === '27R' && fm.arrRwy === '09' && fm.v1 === 135 && fm.vr === 140 && fm.v2 === 145 && fm.flex === 45 && h.flow.steps.find(x => x.id === 'fms').state === 'done', 'flight computer INIT, F-PLN, PERF set through the keypad; flow step done');
    refresh(); check(count('pfd', 48, 114, 114, 166, cyan) > 40 && count('pfd', 48, 114, 114, 166, mag) > 10, 'V1 / VR / V2 on the PFD speed tape');
    until(() => s().irs.every(r => r.aligned));
    check(s().irs.every(r => r.aligned), 'IRS 1, 2, 3 aligned');
    A('beacon', 1); A('parkBrk'); A('thr1'); A('pack1', false); A('pack2', false); A('apuBleed'); CL0(); check(h.cl.isDone('beforeStart'), 'BEFORE START checklist read on the card (' + h.cl.log.map(l => l.kind + ' ' + l.item).join(', ') + ')'); A('engMode', 'IGN'); A('master2', true);
    until(() => s().eng[1].running); h.advance(8);
    const e2 = s().eng[1];
    check(e2.running && e2.n1 > 19 && e2.n1 < 21 && e2.n2 > 58 && e2.n2 < 60 && e2.egt > 400 && e2.egt < 450, `ENG 2 stable at idle: N1 ${f1(e2.n1)} %, N2 ${f1(e2.n2)} %, EGT ${Math.round(e2.egt)} °C, FF ${Math.round(e2.ff)} kg/h`);
    A('master1', true); until(() => s().eng[0].running); h.advance(8);
    const e1 = s().eng[0];
    check(e1.running && e1.n1 > 19 && e1.n1 < 21 && e1.n2 > 58 && e1.n2 < 60 && e1.egt > 400 && e1.egt < 450, `ENG 1 stable at idle: N1 ${f1(e1.n1)} %, N2 ${f1(e1.n2)} %, EGT ${Math.round(e1.egt)} °C`);
    A('engMode', 'NORM'); A('apuBleed', false); A('pack1', true); A('pack2', true); A('apuMaster', false); h.advance(3);
    check(s().elec.genOn[0] && s().elec.genOn[1] && s().elec.src1 === 'GEN 1' && s().elec.src2 === 'GEN 2', 'GEN 1 and GEN 2 on line');
    check(s().hyd.p.every(p => p > 2800), 'HYD 1/2/3: ' + s().hyd.p.map(Math.round).join(' / ') + ' psi');
    A('sd'); A('flaps', 1); h.advance(1); CL0(); h.advance(0.5);
    let r = h.result();
    check(h.flow.finished && r.score === 100, `full flow scored ${r.score}/100: ${r.inOrder}/${r.total} in order, ${r.late.length} late, ${r.missed.length} missed, ${r.wrong.length} wrong, ${Math.round(r.time)} s`);
    // ---------------- engine fire during start ----------------
    h.setScenario('fire');
    A('beacon', 1); A('parkBrk'); A('thr1'); A('pack1', false); A('pack2', false); A('apuBleed'); A('engMode', 'IGN'); A('master2', true);
    until(() => s().eng[1].fire);
    const L = h.sys.lights();
    check(s().eng[1].fire && s().master.warn && s().master.crc && L.firePb2.t && L.engFire2.t, `ENG 2 FIRE at N2 ${f1(s().eng[1].n2)} %: master warning, chime, fire pb and ENG panel FIRE lights`);
    A('masterWarnL'); check(!s().master.crc, 'chime silenced');
    A('thr2'); A('master2', false); A('firePb2'); A('firePb2');
    check(h.sys.sw.firePb2 && h.sys.lights().agent2_1.t, 'fire pb pushed (guard lifted first), agents armed');
    h.advance(10.5); A('agent2_1'); h.advance(5);
    check(!s().eng[1].fire && !s().alerts.some(a => a.lvl === 'W') && !h.sys.lights().firePb2.t, 'fire out after AGENT 1, warning cleared, FIRE light out');
    A('engMode', 'NORM'); h.confirm(); h.advance(0.5);
    r = h.result();
    check(h.flow.finished && r.score === 100, `fire drill scored ${r.score}/100 in ${Math.round(r.time)} s`);
    // ---------------- engine fire: second bottle ----------------
    h.setScenario('fire2');
    A('beacon', 1); A('parkBrk'); A('thr1'); A('pack1', false); A('pack2', false); A('apuBleed'); A('engMode', 'IGN'); A('master2', true);
    until(() => s().eng[1].fire); A('masterWarnL'); A('thr2'); A('master2', false); A('firePb2'); A('firePb2'); h.advance(10.5); A('agent2_1'); h.advance(12);
    check(s().eng[1].fire && h.flow.current().id === 'fireStill', 'fire persists after AGENT 1; drill waits ~30 s');
    until(() => h.flow.current() && h.flow.current().id === 'agent2', 40); A('agent2_2'); h.advance(5);
    check(!s().eng[1].fire, 'fire out after AGENT 2');
    A('engMode', 'NORM'); h.confirm(); h.advance(0.5); r = h.result();
    check(h.flow.finished && r.score === 100 && r.notes.length === 1, `AGENT 2 drill scored ${r.score}: ${r.notes[0]}`);
    h.hud.debrief(h.flow, r, x => x); check(/Timing/.test(h.hud.deb.innerHTML) && /AGENT 2/.test(h.hud.deb.innerHTML), 'debrief shows the AGENT 2 timing'); h.hud.hideDebrief();
    // ---------------- manual start: success and abort ----------------
    h.setScenario('manual');
    A('beacon', 1); A('parkBrk'); A('thr1'); A('pack1', false); A('pack2', false); A('apuBleed'); A('engMode', 'IGN'); A('manStart2', true);
    h.advance(3); check(s().eng[1].sv && s().eng[1].man && !s().eng[1].fuelOn, 'MAN START 2: start valve open, no fuel');
    until(() => s().eng[1].n2 >= 20, 60); A('master2', true); until(() => s().eng[1].running, 120);
    check(s().eng[1].running, `manual start: ENG 2 stable at N2 ${f1(s().eng[1].n2)} %`);
    A('manStart2', false); A('engMode', 'NORM'); A('apuBleed', false); A('pack1', true); A('pack2', true); h.advance(0.5); r = h.result();
    check(h.flow.finished && r.score === 100, `manual start flow scored ${r.score}`);
    A('engMode', 'IGN'); A('manStart1', true); until(() => s().eng[0].n2 >= 20, 60); A('master1', true); until(() => s().eng[0].lit, 20);
    A('master1', false); A('manStart1', false); h.advance(2);
    check(!s().eng[0].fuelOn && !s().eng[0].sv && s().eng[0].phase !== 'START', 'manual start abort: MASTER OFF and MAN START OFF stop fuel and air');
    // ---------------- FCU, EFIS, radios, transponder on the displays ----------------
    h.setScenario('start'); refresh();
    const hd0 = hash('pfd');
    h.knob('hdgKnob', 'set', 314); h.knob('hdgKnob', 'pull'); refresh();
    check(count('pfd', 262, 362, 288, 380, cyan) > 15 && h.state().av.fcu.hdgMan === false, 'FCU heading 314 pulled (aircraft heading 309): cyan heading bug on the PFD heading tape');
    check(count('nd', 0, 60, 512, 440, cyan) > count('nd', 0, 0, 1, 1, cyan), 'heading bug on the ND');
    h.knob('spdKnob', 'set', 160); h.knob('spdKnob', 'pull'); refresh(); check(count('pfd', 60, 88, 104, 108, cyan) > 20, 'selected speed 160 shown in cyan above the speed tape');
    check(count('pfd', 380, 88, 426, 108, mag) > 20, 'selected altitude (managed: magenta) above the altitude tape'); h.knob('altKnob', 'pull'); refresh(); check(count('pfd', 380, 88, 426, 108, cyan) > 20, 'selected altitude pulled: cyan');
    check(hash('pfd') !== hd0, 'PFD changed with the FCU');
    check(count('pfd', 377, 355, 430, 383, yel) < 5, 'baro QNH: no STD box'); h.knob('baroL', 'push'); refresh();
    check(h.state().av.baro[0].std && count('pfd', 375, 355, 431, 383, yel) > 40, 'baro STD pushed: boxed STD on the captain PFD');
    h.knob('baroL', 'pull'); A('fdL', false); refresh(); check(count('pfd', 170, 216, 310, 230, (r, g, b) => g > 200 && r < 120 && b < 150) < 30, 'FD off: no flight director bars'); A('fdL', true); refresh(); check(count('pfd', 170, 216, 310, 230, (r, g, b) => g > 200 && r < 120 && b < 150) > 60, 'FD on: green flight director bars');
    A('lsL', true); refresh(); check(count('pfd', 4, 430, 80, 484, mag) > 30, 'LS on: ILS frequency and scales on the PFD');
    const modes = new Set(); for (const m of ['LS', 'VOR', 'NAV', 'ARC', 'PLAN']) { A('ndModeL', m); refresh(); modes.add(hash('nd')); }
    const ranges = new Set(); for (const rg of [10, 20, 40, 80, 160, 320]) { A('ndRangeL', rg); refresh(); ranges.add(hash('nd')); }
    check(modes.size === 5 && ranges.size === 6, `ND renders 5 distinct modes and 6 distinct ranges (${modes.size}/${ranges.size})`);
    A('ndModeL', 'ARC'); A('ndRangeL', 160); const n0 = hash('nd'); A('arptL', true); refresh(); const n1 = hash('nd'); A('vordL'); refresh(); const n2 = hash('nd');
    check(n0 !== n1 && n1 !== n2 && h.sys.sw.ovlL === 'VORD', 'ND overlays ARPT and VOR.D change the map');
    const rv = h.state().av.radio.VHF1; h.knob('rmp1Outer', 'turn', 2); h.knob('rmp1Inner', 'turn', 1); A('rmpXfer1'); const rd2 = h.state().av.radio.VHF1;
    check(rd2.act === rv.sby + 2025 && rd2.sby === rv.act, `RMP 1: standby tuned and swapped (active ${(rd2.act / 1000).toFixed(3)})`);
    for (const k of ['x1', 'x2', 'x0', 'x0']) A(k); A('xpdr', 2); A('xIdent'); const X = h.state().av.xpdr;
    check(X.code === '1200' && h.sys.sw.xpdr === 2 && X.identT > 0, 'transponder squawk 1200, mode ON, IDENT');
    // ---------------- six systems pages render ----------------
    const pages = new Set();
    for (const pg of ['PRESS', 'COND', 'DOOR', 'WHEEL', 'FCTL', 'STS']) { A('sd' + pg); refresh(); const lit = count('sd', 10, 10, 240, 44, (r, g, b) => r + g + b > 500); check(s().sdPage === pg && lit > 40, `SYSTEMS page ${pg} drawn`); pages.add(hash('sd')); }
    check(pages.size === 6, 'six distinct pages');
    A('stickL'); A('stickL'); A('stickL'); A('sdFCTL'); check(h.sys.sw.stickL === 'LEFT', 'sidestick at full left (flight control check)');
    // ---------------- Taxi and take-off, driven through host.__jet ----------------
    h.setScenario('taxi'); h.setMode('practice'); h.setScenario('taxi');
    const Lx = h.layout, F = () => h.fdm, wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    const step = (sec, each) => { const n = Math.round(sec / 0.1); for (let i = 0; i < n; i++) { if (each && each() === true) return true; h.advance(0.1); } return false; };
    const inp = o => h.input(o);
    const CLR = (title, key, part = 'all') => { const C = h.sys.cl; step(30, () => { const c = h.flow.current(); if (!c || c.kind !== 'checklist') return true; if (C.status === 'active') h.clAnswer(C.correctIndex()); return false; }); check(C.isDone(key, part) && h.flow.current().kind !== 'checklist', title + ' checklist read through the card API and complete'); };
    function drive(tgtKt, stopAtHold) {
      const fd = F(), sn = Lx.toSN(fd.x, fd.z), nr = Lx.nearest(Lx.TAXI_PATH, sn.s, sn.n); let k = nr.i, acc = 0;
      while (k < Lx.TAXI_PATH.length - 1 && acc < 16 + fd.gs * 0.6) { acc += Math.hypot(Lx.TAXI_PATH[k + 1].s - Lx.TAXI_PATH[k].s, Lx.TAXI_PATH[k + 1].n - Lx.TAXI_PATH[k].n); k++; }
      const pt = Lx.TAXI_PATH[k], err = wrap(Math.atan2(pt.n - sn.n, pt.s - sn.s) - (Lx.YAW_RWY - fd.yaw));
      let tgt = Math.abs(err) > 0.25 ? 9 : tgtKt; const nose = h.sys.st.mon.nose;
      if (stopAtHold && Math.abs(nose.s - Lx.HOLD.s) < 30 && nose.n > Lx.HOLD.n - 40) tgt = nose.n > Lx.HOLD.n - 9 ? 0 : 6;
      const L = fd.gs < tgt - 1 ? (fd.gs < 3 ? 0.32 : 0.2) : 0; h.sys.setSwitch('thr1', L); h.sys.setSwitch('thr2', L);
      const b = fd.gs > tgt + 2 || tgt === 0 ? (tgt === 0 ? 0.7 : 0.3) : 0; inp({ tiller: Math.max(-1, Math.min(1, err * 2.2)), brakeL: b, brakeR: b });
    }
    A('parkBrk', false); A('push'); step(70, () => F().push && F().push.gone);
    check(F().push && F().push.gone && Math.abs(F().hdg - 4) < 6, `pushback with the tug: heading ${Math.round(F().hdg)}, flow at ${h.flow.current().id}`);
    A('parkBrk', true); CLR('AFTER START', 'afterStart'); A('flaps', 1); A('spdBrk', 1); A('autoBrkMax');
    for (const [p2, r2] of [[1, 0], [-1, 0], [0, -1], [0, 1], [0, 0]]) { inp({ pitch: p2, roll: r2 }); h.advance(2); }
    A('toConfig'); A('parkBrk', false);
    check(h.flow.current().id === 'taxiHold', 'before taxi: flaps 1, spoilers armed, autobrake MAX, flight controls checked, T.O CONFIG normal');
    step(320, () => { drive(16, true); return h.sys.st.mon.atHold && h.sys.st.mon.held > 1; });
    check(h.sys.st.mon.atHold && !h.sys.st.mon.stopBarRun && h.sys.st.mon.taxiMax < 30, `taxied to the stop bar and stopped (max ${f1(h.sys.st.mon.taxiMax)} kt)`);
    refresh(); h.hud.cl.render(h.cl, h.sys, 0); check(h.hud.root.querySelector('.jh-cl').classList.contains('show') && /BEFORE TAKE-OFF/.test(h.hud.root.querySelector('.jh-cl').textContent) && h.hud.root.querySelector('.jh-cl .sep'), 'BEFORE TAKE-OFF checklist card at the holding point, with the line'); CLR('BEFORE TAKE-OFF (to the line)', 'beforeTO', 'above');
    step(6, () => h.sys.st.mon.cleared); check(!h.sys.st.stopBar, 'stop bar out: cleared to line up');
    for (const [id, v] of [['strobe', 2], ['landL', 2], ['landR', 2], ['nose', 2], ['xpdr', 2]]) A(id, v);
    step(140, () => { drive(10, false); const sn = Lx.toSN(F().x, F().z); if (h.sys.st.mon.lined && sn.s > -515) { inp({ brakeL: 1, brakeR: 1 }); h.sys.setSwitch('thr1', 0); h.sys.setSwitch('thr2', 0); } return h.sys.st.mon.lined && F().gs < 0.5; });
    inp({}); A('chrono'); CLR('BEFORE TAKE-OFF (below the line)', 'beforeTO', 'below'); refresh();
    check(h.flow.current().id === 'thrustSet' && h.af.vert === 'SRS' && h.af.lat === 'RWY', `lined up; FMA on the ground: ${h.af.vert} | ${h.af.lat}, armed ${h.af.vertArm} ${h.af.latArm}`);
    A('thr1', 2); A('thr2', 2); h.advance(1); refresh();
    check(h.af.thr === 'MAN FLX +45' && h.sys.sw.athr, 'take-off thrust: FMA MAN FLX +45, A/THR armed');
    const pfd0 = hash('pfd'); step(60, () => { const fd = F(); inp({ rudder: Math.max(-1, Math.min(1, -(Lx.toSN(fd.x, fd.z).n - Lx.RWY.n) * 0.15 - wrap((fd.hdg - 274) * Math.PI / 180) * 3)) }); return fd.ias > 120; }); refresh();
    check(F().ias > 118 && hash('pfd') !== pfd0 && count('pfd', 46, 112, 116, 348, (r, g, b) => r > 200 && g > 200 && b > 200) > 30, `take-off roll at ${Math.round(F().ias)} kt: speed tape moving, callouts ${Object.keys(h.sys.st.callouts).join(', ')}`);
    step(60, () => { const fd = F(); inp({ pitch: fd.ias >= 140 && fd.pitch < 15 * Math.PI / 180 ? 0.6 : 0, rudder: fd.onGround ? Math.max(-1, Math.min(1, -(Lx.toSN(fd.x, fd.z).n - Lx.RWY.n) * 0.15)) : 0 }); return fd.ra > 60; });
    inp({}); h.advance(3); A('gear', 'UP'); h.advance(1); A('ap1'); h.advance(2); refresh();
    check(h.sys.sw.ap1 && h.af.vert === 'SRS' && h.af.lat === 'NAV', `after lift-off: AP1 on, FMA ${h.af.thr} | ${h.af.vert} | ${h.af.lat}; RA ${Math.round(F().ra)} ft`);
    step(90, () => h.af.thr === 'LVR CLB'); check(h.af.thr === 'LVR CLB', `LVR CLB at ${Math.round(F().alt)} ft`);
    A('thr1', 1); A('thr2', 1); h.advance(2); check(h.af.athrActive && h.af.thr === 'THR CLB' && h.af.vert === 'CLB', `A/THR active: ${h.af.thr} | ${h.af.vert}`);
    step(60, () => F().ias > 200); A('flaps', 0); step(16); CLR('AFTER TAKE-OFF', 'afterTO'); step(240, () => h.flow.finished);
    r = h.result(); check(h.flow.finished && r.score >= 90 && h.af.vert === 'ALT', `Taxi and take-off finished at ${Math.round(F().alt)} ft (FMA ${h.af.thr} | ${h.af.vert}): score ${r.score}; ${r.notes.join(' · ')}`);
    // ---------------- checklist trainer with injected faults ----------------
    h.setScenario('cltrain'); h.advance(0.3); refresh(); let sawStop = false, sawSep = false;
    for (let i = 0; i < 400 && !h.flow.finished; i++) {
      const C = h.cl, card = h.hud.root.querySelector('.jh-cl');
      if (card.querySelector('.sep')) sawSep = true;
      if (C.status === 'active') h.clAnswer(C.correctIndex());
      else if (C.status === 'stopped') { h.hud.cl.render(C, h.sys, 1e9); if (/CHECKLIST STOPPED/.test(card.querySelector('.clstop').textContent) && !card.querySelector('.clstop').hidden) sawStop = true; h.flow.current().fault.fix(h.sys); h.advance(0.4); }
      h.advance(0.05);
    }
    r = h.result();
    check(h.flow.finished && sawStop && sawSep && r.notes.filter(n => /Good catch/.test(n)).length === 5, `checklist trainer: 5 stations, every injected fault caught (card showed CHECKLIST STOPPED and the line), score ${r.score}`);
    h.setMode('guided'); h.setScenario('taxi'); A('parkBrk', false); A('push'); step(70, () => F().push && F().push.gone); A('parkBrk', true);
    const blk = h.act('flaps', { to: 1 }); check(blk === 'blocked' && h.flow.current().id === 'clAfterStart' && h.sys.sw.flaps === 0, 'guided mode: flaps held back until the AFTER START checklist is read');
    h.setMode('practice');
    // ---------------- rejected take-off ----------------
    h.setScenario('rto');
    A('thr1', 2); A('thr2', 2); step(60, () => h.sys.st.rtoInject.fired); h.advance(1.5); A('thr1', 0); A('thr2', 0);
    check(F().abActive && F().spoiler > 0.3, `RTO: warning at ${Math.round(h.sys.st.mon.reject ? h.sys.st.mon.reject.ias : 0)} kt, levers idle: autobrake RTO, ground spoilers`);
    step(60, () => F().gs < 0.4); A('parkBrk', true); h.confirm(); h.advance(0.5); r = h.result();
    check(h.flow.finished && r.score >= 90 && h.sys.st.mon.stopRemain && h.sys.st.mon.stopRemain.on, `RTO stopped on the runway (${Math.round(h.sys.st.mon.stopRemain.s)} m remaining), score ${r.score}: ${r.notes.join(' · ')}`);
    // ---------------- order errors ----------------
    h.setScenario('prep'); A('batV1'); A('bat2', true); A('bat1', true); A('pack1', false); h.flow.finish(); r = h.result();
    check(r.late.length === 1 && r.wrong.length === 1 && r.missed.length > 0, `debrief flags out-of-order (${r.late.map(x => x.id)}), not-in-flow (${r.wrong.map(w => w.ctl)}) and missed (${r.missed.length})`);
    return { ok, out };
  });
  // ---------------- real pointer input on a knob: shift+click pulls, click pushes, wheel and drag turn ----------------
  const knobAt = async id => { await p.evaluate(id => { const h = document.querySelector('#p-jet').__jet; h.setScenario('start'); h.lookAt(id, 30); }, id); await p.waitForTimeout(1500);
    return p.evaluate(id => { const h = document.querySelector('#p-jet').__jet; const v = h.deck.ctlWorld(id).pos.clone().project(h.S.camera); const r = h.S.renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }, id); };
  const F = () => p.evaluate(() => document.querySelector('#p-jet').__jet.state().av.fcu);
  const pt = await knobAt('altKnob'); const out2 = []; let ok2 = true; const chk = (c, m) => { out2.push((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok2 = false; };
  await p.keyboard.down('Shift'); await p.mouse.click(pt.x, pt.y); await p.keyboard.up('Shift'); await p.waitForTimeout(300);
  let f = await F(); chk(!f.altMan, 'pointer: Shift+click pulls the ALT knob (selected)');
  await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(300); f = await F(); chk(f.altMan, 'pointer: click pushes it (managed)');
  const a0 = f.alt; await p.mouse.move(pt.x, pt.y); await p.mouse.wheel(0, -120); await p.waitForTimeout(400); f = await F(); chk(f.alt === a0 + 1000, `pointer: wheel turns the ALT knob one detent (${a0} → ${f.alt})`);
  await p.mouse.move(pt.x, pt.y); await p.mouse.down(); for (let i = 1; i <= 5; i++) await p.mouse.move(pt.x, pt.y - i * 10); await p.mouse.up(); await p.waitForTimeout(300); f = await F();
  chk(f.alt === a0 + 4000 && f.altMan, `pointer: dragging up 50 px turns it three detents (${f.alt}), no push`);
  console.log(out2.join('\n'));
  // ---------------- touch controls at phone width ----------------
  const pp = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
  pp.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await pp.goto(`http://localhost:${srv.address().port}/_t.html`); await pp.evaluate(() => document.querySelector('#p-jet').scrollIntoView()); await pp.waitForFunction(() => document.querySelector('#p-jet').__jet, null, { timeout: 120000 }); await pp.waitForTimeout(1500);
  const tc = await pp.evaluate(() => { const h = document.querySelector('#p-jet').__jet; h.setScenario('taxi'); const el = h.hud.root.querySelector('.jh-fly'); const r = el.getBoundingClientRect(), wr = h.S.renderer.domElement.getBoundingClientRect(); return { on: el.classList.contains('on'), w: wr.width, inside: r.left >= wr.left - 1 && r.right <= wr.right + 1 && r.width > 200, parts: ['.pad', '.thr', '.brk', '[data-f="push"]'].every(q => el.querySelector(q).getBoundingClientRect().width > 20), scroll: document.documentElement.scrollWidth }; });
  chk(tc.on && tc.inside && tc.parts && tc.w < 600 && tc.scroll <= 390, `touch controls on a ${Math.round(tc.w)} px stage: stick (also steers at taxi speed), thrust, brake, push (page width ${tc.scroll})`);
  const box2 = await pp.evaluate(() => { const el = document.querySelector('#p-jet').__jet.hud.root.querySelector('.jh-fly .brk').getBoundingClientRect(); return { x: el.left + el.width / 2, y: el.top + el.height / 2 }; });
  await pp.touchscreen.tap(box2.x, box2.y); const brk = await pp.evaluate(() => document.querySelector('#p-jet').__jet.inputs.touch.brake);
  chk(brk === 0, 'brake button releases after a tap');
  const cl390 = await pp.evaluate(() => { const h = document.querySelector('#p-jet').__jet; h.setScenario('cltrain'); h.advance(0.3); h.hud.cl.render(h.cl, h.sys, 0); const el = h.hud.root.querySelector('.jh-cl'), r = el.getBoundingClientRect(), wr = h.S.renderer.domElement.getBoundingClientRect(); const b = el.querySelector('.clopts button'); return { show: el.classList.contains('show'), sheet: Math.abs(r.bottom - wr.bottom) < 3 && r.width > wr.width - 4, btn: b && b.getBoundingClientRect().height >= 26, scroll: document.documentElement.scrollWidth }; });
  chk(cl390.show && cl390.sheet && cl390.btn && cl390.scroll <= 390, 'checklist card at 390 px: bottom sheet across the stage, response buttons tappable, no page overflow'); console.log(out2.slice(-3).join('\n'));
  res.ok = res.ok && ok2;
  console.log(res.out.join('\n')); console.log(res.ok ? 'ALL BROWSER LOGIC TESTS PASSED' : 'SOME FAILED');
  console.log('console errors/warnings:', JSON.stringify(errs));
  await b.close(); srv.close();
});

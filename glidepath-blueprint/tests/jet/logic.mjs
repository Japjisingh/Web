// Headless logic test of the systems model + flows (Node). Drives the flow like a trainee would.
import { createSystems, REF } from '../../src/jet/systems.js';
import { createFlow, SCENARIOS } from '../../src/jet/flows.js';
import { CTL, operate } from '../../src/jet/controls.js';
const sys = createSystems({ fast: false });
let ok = true; const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
const fmt = x => Math.round(x * 10) / 10;
function run(key) {
  const sc = SCENARIOS[key]; sys.reset(sc.init); if (sc.fire) sys.fireInject = { ...sc.fire };
  const F = createFlow(sys, key, 'practice');
  const op = (id, v) => { if (!CTL[id]) throw new Error('no control ' + id); if (F.touch(id)) return; if (CTL[id].k === 'ind') return; const r = operate(sys, id, v === undefined ? undefined : { to: v }); if (r.did) F.operated(id); };
  const touchArea = a => F.touch('area:' + a, a);
  const wait = (sec, cond) => { const t0 = sys.t; while (sys.t - t0 < sec) { sys.advance(0.5); F.update(); if (cond && cond()) break; } return sys.t - t0; };
  return { F, op, touchArea, wait };
}
// ---------- full scenario ----------
{
  const { F, op, touchArea, wait } = run('full');
  const s = sys.st;
  check(!s.elec.dc && s.elec.extAvail, 'cold & dark: no DC, ground power AVAIL');
  op('batV1'); op('bat1', true); op('bat2', true); wait(1);
  check(s.elec.dcBat && !s.elec.ac, 'batteries on: DC only, BAT V ' + s.elec.batV.map(fmt));
  op('extPwr', true); wait(1);
  check(s.elec.ac && s.elec.src1 === 'EXT PWR', 'EXT PWR on: AC from ' + s.elec.src1);
  op('irs1', 'NAV'); op('irs2', 'NAV'); op('irs3', 'NAV'); wait(1);
  check(s.irs.every(r => r.mode === 'NAV') && !s.irs[0].aligned, 'IRS NAV, aligning, remaining ' + Math.round(sys.alignRemaining()) + ' s');
  op('crewOxy', true);
  op('test1'); wait(4); op('masterWarnL'); op('testApu'); wait(4); op('test2'); wait(4);
  check(s.testsDone.eng1 && s.testsDone.apu && s.testsDone.eng2, 'fire tests done');
  touchArea('HYD');
  for (const p of ['pL1', 'pL2', 'pC1', 'pC2', 'pR1', 'pR2']) op(p, true);
  touchArea('ELEC'); touchArea('AIR'); touchArea('ANTIICE'); touchArea('PRESS');
  op('navLogo', 1); op('seatBelts', 1); op('noSmoking', 1); op('emerExit', 1); op('annLt', 2); wait(1); op('annLt', 1); touchArea('RCOL');
  op('apuMaster', true); wait(3); op('apuStart');
  const tA = wait(120, () => s.apu.avail);
  check(s.apu.avail && s.apu.n > 95, `APU AVAIL after ~${Math.round(tA)} s, N ${fmt(s.apu.n)} %, EGT ${Math.round(s.apu.egt)} C`);
  op('apuBleed', true); op('extPwr', false); wait(6);
  check(s.elec.src1 === 'APU GEN' && s.elec.src2 === 'APU GEN', 'APU GEN powers both AC buses');
  check(s.bleed.duct[0] > 30, 'APU bleed duct pressure ' + fmt(s.bleed.duct[0]) + ' psi');
  wait(80, () => s.irs.every(r => r.aligned)); F.update();
  check(s.irs.every(r => r.aligned), 'IRS aligned at t=' + Math.round(sys.t) + ' s');
  check(F.steps.filter(x => x.ph !== 'before' && x.ph !== 'start' && x.ph !== 'after').every(x => x.state === 'done' || x.state === 'na'), 'cockpit prep steps all done in order');
  op('beacon', 1); op('parkBrk'); op('thr1'); op('pack1', false); op('pack2', false); op('apuBleed'); op('engMode', 'IGN');
  check(F.current() && F.current().id === 'm2on', 'before start complete, next: ' + (F.current() && F.current().id));
  op('master2', true);
  let peak = 0, sawIgn = false, svClose = -1;
  const t0 = sys.t; let tIgn = -1, tLit = -1;
  while (!s.eng[1].running && sys.t - t0 < 150) { sys.advance(0.1); F.update(); const e = s.eng[1]; peak = Math.max(peak, e.egt); if (e.ign && tIgn < 0) { tIgn = sys.t - t0; sawIgn = e.n2; } if (e.lit && tLit < 0) tLit = sys.t - t0; if (svClose < 0 && e.n2 > 45 && !e.sv) svClose = e.n2; }
  const e2 = s.eng[1];
  check(e2.running, `ENG 2 stable after ${Math.round(sys.t - t0)} s (ign at ${fmt(sawIgn)} % N2 @${fmt(tIgn)} s, light-off @${fmt(tLit)} s, start valve closed ~${fmt(svClose)} % N2, EGT peak ${Math.round(peak)} C)`);
  wait(8);
  check(e2.n1 > 19 && e2.n1 < 21 && e2.n2 > 58 && e2.n2 < 60 && e2.egt > 400 && e2.egt < 450, `ENG 2 idle N1 ${fmt(e2.n1)} N2 ${fmt(e2.n2)} EGT ${Math.round(e2.egt)} FF ${Math.round(e2.ff)}`);
  check(s.elec.genOn[1] && s.elec.src2 === 'GEN 2', 'GEN 2 on line (AC 2 from ' + s.elec.src2 + ')');
  check(s.hyd.p[2] > 2800, 'HYD 3 pressure ' + Math.round(s.hyd.p[2]) + ' psi; HYD 1 via PTU ' + Math.round(s.hyd.p[0]));
  op('master1', true); wait(150, () => s.eng[0].running); wait(8);
  const e1 = s.eng[0];
  check(e1.running && e1.n1 > 19 && e1.n1 < 21 && e1.n2 > 58 && e1.n2 < 60 && e1.egt > 400 && e1.egt < 450, `ENG 1 idle N1 ${fmt(e1.n1)} N2 ${fmt(e1.n2)} EGT ${Math.round(e1.egt)}`);
  op('engMode', 'NORM'); op('apuBleed', false); op('pack1', true); op('pack2', true); op('apuMaster', false); wait(5);
  check(s.elec.genOn[0] && s.elec.genOn[1] && s.elec.src1 === 'GEN 1' && s.elec.src2 === 'GEN 2', 'GEN 1 and GEN 2 on line');
  check(s.hyd.p.every(p => p > 2800), 'HYD 1/2/3 ' + s.hyd.p.map(Math.round).join('/') + ' psi');
  check(s.bleed.engValve[0] && s.bleed.engValve[1] && s.bleed.duct[0] > 30, 'engine bleeds open, duct ' + s.bleed.duct.map(fmt).join('/') + ' psi');
  op('sd'); op('flaps', 1); F.update();
  const r = F.result();
  check(F.finished && r.score === 100 && r.wrong.length === 0, `full flow finished: score ${r.score}, ${r.inOrder}/${r.total} in order, wrong ${r.wrong.length}, time ${Math.round(r.time)} s`);
  check(s.master.warn === false && s.alerts.filter(a => a.lvl === 'W').length === 0, 'no warnings at the end; memos: ' + s.memos.map(m => m.t).join(', '));
  wait(90); check(s.apu.phase === 'OFF' && s.apu.n === 0, 'APU stopped after cool-down');
}
// ---------- engine fire during start ----------
{
  const { F, op, wait } = run('fire');
  const s = sys.st;
  check(s.apu.avail && s.irs.every(r => r.aligned) && !s.elec.extAvail, 'before-start state: APU running, IRS aligned, GPU gone');
  op('beacon', 1); op('parkBrk'); op('thr1'); op('pack1', false); op('pack2', false); op('apuBleed'); op('engMode', 'IGN'); op('master2', true);
  wait(120, () => s.eng[1].fire);
  check(s.eng[1].fire && s.master.warn && s.master.crc, `ENG 2 FIRE at N2 ${fmt(s.eng[1].n2)} %: master warning + chime`);
  const L = sys.lights(); check(L.firePb2.t === 1 && L.engFire2.t === 1 && L.masterWarn.t === 1, 'fire pb, ENG panel FIRE and MASTER WARN lights on');
  check(s.alerts.some(a => a.title === 'ENG 2 FIRE'), 'upper display: ' + s.alerts.map(a => a.title).join(', '));
  op('masterWarnL'); check(!s.master.crc && !s.master.warn, 'warning silenced');
  op('thr2'); op('master2', false);
  op('firePb2'); op('firePb2');
  check(sys.lights()['agent2_1'].t === 1, 'agents armed (SQUIB lit)');
  wait(11); op('agent2_1'); wait(5);
  check(!s.eng[1].fire && sys.lights().firePb2.t === 0, 'fire out after AGENT 1; FIRE light out');
  op('engMode', 'NORM'); F.confirm(); F.update();
  const r = F.result();
  check(F.finished && r.score === 100, `fire drill finished: score ${r.score}, ${r.inOrder}/${r.total}, time ${Math.round(r.time)} s`);
  check(!s.alerts.some(a => a.lvl === 'W'), 'no warnings left');
}
// ---------- order errors are flagged ----------
{
  const { F, op } = run('prep');
  op('bat1', true); op('pack1', false); op('apuMaster', true);
  const r = F.result();
  check(r.wrong.length === 1 && F.steps.find(x => x.id === 'apuMaster').state === 'late', 'wrong control and out-of-order step flagged');
  F.finish(); const r2 = F.result(); check(r2.missed.length > 10 && r2.score < 20, `finish early: missed ${r2.missed.length}, score ${r2.score}`);
}
// ---------- packs on during start: higher EGT, low bleed: hot start abort with X BLEED shut ----------
{
  run('start'); const s = sys.st; sys.setSwitch('xbleed', 'SHUT'); sys.setSwitch('engMode', 'IGN'); sys.setSwitch('master2', true); sys.advance(30);
  check(s.eng[1].phase === 'ABORT' || s.eng[1].fault, 'ENG 2 start with X BLEED shut: no air, auto-abort (' + s.eng[1].fault + ')');
}
console.log(ok ? '\nALL LOGIC TESTS PASSED' : '\nSOME LOGIC TESTS FAILED');
process.exit(ok ? 0 : 1);

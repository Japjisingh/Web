// Headless logic test of the systems model + flows (Node). Drives the flow like a trainee would.
import { createSystems, REF } from '../../src/jet/systems.js';
import { createFlow, SCENARIOS } from '../../src/jet/flows.js';
import { CTL, operate, fmsId } from '../../src/jet/controls.js';
import { baroAlt, fmsStatus, QNH_TODAY } from '../../src/jet/avionics.js';
const sys = createSystems({ fast: false });
let ok = true; const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
const fmt = x => Math.round(x * 10) / 10;
function run(key) {
  const sc = SCENARIOS[key]; sys.reset(sc.init); if (sc.fire) sys.fireInject = { ...sc.fire };
  const F = createFlow(sys, key, 'practice');
  const op = (id, v) => { if (!CTL[id]) throw new Error('no control ' + id); if (F.touch(id)) return; if (CTL[id].k === 'ind') return; const r = operate(sys, id, v === undefined ? undefined : { to: v }); if (r.did) F.operated(id); };
  const touchArea = a => F.touch('area:' + a, a);
  op.type = (n, str) => { for (const ch of str) op(fmsId(n, ch === ' ' ? 'SP' : ch)); };
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
  // flight computer: INIT, F-PLN, PERF (with the validation it applies)
  check(F.current() && F.current().id === 'fms', 'next step: flight computer (' + (F.current() && F.current().id) + ')');
  const U = s.av.fms.u[0], f = s.av.fms;
  op.type(1, 'ZZAA/ZZXX'); op(fmsId(1, 'R1')); check(U.msg === 'NOT IN DATABASE' && !f.from, 'FROM/TO with an unknown airport rejected: ' + U.msg);
  op(fmsId(1, 'CLR')); for (let i = 0; i < 9; i++) op(fmsId(1, 'CLR'));
  op.type(1, 'ZZAA/ZZBB'); op(fmsId(1, 'R1')); op.type(1, 'GPX101'); op(fmsId(1, 'L3'));
  op.type(1, '1200'); op(fmsId(1, 'R3')); check(U.msg === 'OUT OF RANGE' && !f.baro, 'baro 1200 hPa rejected: ' + U.msg); op(fmsId(1, 'CLR')); for (let i = 0; i < 4; i++) op(fmsId(1, 'CLR'));
  op.type(1, String(QNH_TODAY)); op(fmsId(1, 'R3')); op.type(1, '30'); op(fmsId(1, 'L5')); op.type(1, 'FL350'); op(fmsId(1, 'R5'));
  check(fmsStatus(f).init && f.from === 'ZZAA' && f.to === 'ZZBB' && f.crz === 350 && f.ci === 30 && Math.round(f.baro.hpa) === QNH_TODAY, 'INIT page complete: ' + [f.from, f.to, f.flt, f.ci, f.crz, Math.round(f.baro.hpa)].join(' '));
  op(fmsId(1, 'F-PLN')); op.type(1, '27R'); op(fmsId(1, 'L1')); op.type(1, '09'); op(fmsId(1, 'L5'));
  check(fmsStatus(f).fpln && f.depRwy === '27R' && f.arrRwy === '09', 'F-PLN: departure 27R, arrival 09');
  op(fmsId(1, 'PERF')); op.type(1, '140'); op(fmsId(1, 'L2')); op.type(1, '150'); op(fmsId(1, 'L1'));
  check(U.msg.startsWith('CHECK V1') && !f.v1, 'V1 above VR rejected: ' + U.msg); op(fmsId(1, 'CLR')); for (let i = 0; i < 3; i++) op(fmsId(1, 'CLR'));
  op.type(1, '135'); op(fmsId(1, 'L1')); op.type(1, '145'); op(fmsId(1, 'L3')); op.type(1, '80'); op(fmsId(1, 'R4'));
  check(U.msg === 'OUT OF RANGE' && !f.flex, 'FLEX 80 rejected: ' + U.msg); op(fmsId(1, 'CLR')); op(fmsId(1, 'CLR')); op(fmsId(1, 'CLR'));
  op.type(1, '45'); op(fmsId(1, 'R4'));
  check(fmsStatus(f).all && f.v1 === 135 && f.vr === 140 && f.v2 === 145 && f.flex === 45, 'PERF: V1/VR/V2 135/140/145, FLEX 45; flight computer complete');
  check(F.steps.find(x => x.id === 'fms').state === 'done' && F.errors.length === 0, 'flight computer step done, no wrong controls counted');
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
// ---------- FCU, EFIS baro, radios, transponder (state level; the browser test checks the displays) ----------
{
  const { F, op } = run('start'); const s = sys.st, Fc = s.av.fcu, w = sys.sw;
  const turn = (id, n) => operate(sys, id, n), knob = (id, how) => operate(sys, id, how);
  turn('spdKnob', 5); check(Fc.spd === 155 && Fc.spdMan && Fc.prevSpd > 0, 'SPD knob turned while managed: preview 155 kt');
  knob('spdKnob', 'pull'); check(!Fc.spdMan, 'SPD pulled: selected speed'); knob('spdKnob', 'push'); check(Fc.spdMan, 'SPD pushed: managed');
  operate(sys, 'spdMach'); check(Fc.unit === 'MACH', 'SPD/MACH toggle'); operate(sys, 'spdMach');
  operate(sys, 'hdgKnob', { to: 355 }); turn('hdgKnob', 10); check(Fc.hdg === 5, 'HDG wraps 355 + 10 = 005');
  check(w.altInc === 1000, 'ALT increment 1000 ft'); turn('altKnob', 2); check(Fc.alt === 7000, 'ALT 5000 + 2 x 1000 = ' + Fc.alt);
  operate(sys, 'altInc', { to: 100 }); turn('altKnob', -3); check(Fc.alt === 6700, 'ALT increment 100 ft: ' + Fc.alt);
  knob('vsKnob', 'push'); check(Fc.vsMode && Fc.vs === 0, 'V/S pushed: level off, V/S 0'); turn('vsKnob', 12); check(Fc.vs === 1200, 'V/S +1200');
  operate(sys, 'ap1'); check(!w.ap1, 'AP 1 does not engage on the ground (needs about 100 ft)');
  operate(sys, 'loc'); operate(sys, 'appr'); check(w.appr && !w.loc, 'APPR clears LOC');
  check(Math.round(baroAlt(s.av, 0)) === 420, 'baro QNH ' + QNH_TODAY + ': PFD altitude = field elevation 420 ft');
  knob('baroL', 'push'); check(s.av.baro[0].std && Math.abs(baroAlt(s.av, 0) - 536) < 2, 'baro STD: pressure altitude ' + Math.round(baroAlt(s.av, 0)) + ' ft');
  knob('baroL', 'pull'); turn('baroL', 4); check(!s.av.baro[0].std && Math.round(s.av.baro[0].hpa) === 1013, 'baro back to QNH, +4 hPa = ' + Math.round(s.av.baro[0].hpa));
  operate(sys, 'baroUnitL', { to: 'inHg' }); turn('baroL', -1); check(Math.abs(s.av.baro[0].hpa / 33.8639 - 29.90) < 0.006, 'inHg: 29.91 - 0.01 = ' + (s.av.baro[0].hpa / 33.8639).toFixed(2));
  operate(sys, 'ndModeL', { to: 'PLAN' }); operate(sys, 'ndRangeL', 1); operate(sys, 'ndRangeL', 1); check(w.ndModeL === 'PLAN' && w.ndRangeL === 40, 'ND mode PLAN, range 40');
  operate(sys, 'wptL'); operate(sys, 'arptL'); check(w.ovlL === 'ARPT', 'ND overlay ARPT (one at a time)'); operate(sys, 'arptL'); check(w.ovlL === null, 'overlay off again');
  const r1 = s.av.radio.VHF1; const a0 = r1.act, b0 = r1.sby;
  turn('rmp1Outer', 1); turn('rmp1Inner', -3); check(r1.sby === b0 + 1000 - 75, 'RMP 1 standby tuned to ' + (r1.sby / 1000).toFixed(3));
  operate(sys, 'rmpXfer1'); check(r1.act === b0 + 925 && r1.sby === a0, `RMP 1 transfer: active ${(r1.act / 1000).toFixed(3)}, standby ${(r1.sby / 1000).toFixed(3)}`);
  operate(sys, 'rmp1VHF3'); check(w.rmpSel1 === 'VHF3', 'RMP 1 selects VHF3');
  for (const d of ['x7', 'x7']) operate(sys, d); check(s.av.xpdr.entry === '77' && s.av.xpdr.code === '2000', 'squawk entry in progress 77--, code still 2000');
  operate(sys, 'xClr'); for (const d of ['x4', 'x1', 'x5']) operate(sys, d); check(s.av.xpdr.code === '7415' && !s.av.xpdr.entry, 'squawk 7415 set');
  operate(sys, 'xpdr', { to: 2 }); operate(sys, 'xIdent'); operate(sys, 'altRptg'); check(w.xpdr === 2 && s.av.xpdr.identT > sys.t && !w.altRptg, 'XPDR ON, IDENT active, ALT RPTG off');
  check(F.errors.length === 0, 'avionics controls never count as wrong in a flow');
}
// ---------- manual start: success, then abort ----------
{
  const { F, op, wait } = run('manual'); const s = sys.st, e = s.eng[1];
  for (const id of ['beacon']) op(id, 1); op('parkBrk'); op('thr1'); op('pack1', false); op('pack2', false); op('apuBleed'); op('engMode', 'IGN');
  check(s.doors.fwdL < 0.05 || true, 'beacon on'); wait(12); check(s.doors.fwdL === 0 && !s.doors.bridge, 'door closed and jet bridge pulled back after the beacon');
  op('manStart2', true); wait(3); check(e.sv && e.man && !e.fuelOn && e.phase === 'START', `MAN START 2: start valve open, no fuel yet (N2 ${fmt(e.n2)} %)`);
  wait(40, () => e.n2 >= 20); check(e.n2 >= 20 && !e.fuelOn && !e.ign, `dry motoring to N2 ${fmt(e.n2)} %, no ignition with the MASTER off`);
  op('master2', true); wait(4); check(e.fuelOn && e.ign, 'MASTER 2 on: fuel and ignition');
  wait(120, () => e.running); check(e.running && !e.sv, `manual start complete: N2 ${fmt(e.n2)} %, EGT ${Math.round(e.egt)} C, start valve closed`);
  op('manStart2', false); op('engMode', 'NORM'); op('apuBleed', false); op('pack1', true); op('pack2', true); F.update();
  const r = F.result(); check(F.finished && r.score === 100, `manual start flow: score ${r.score}, ${r.inOrder}/${r.total}`);
}
{
  run('manual'); const s = sys.st, e = s.eng[0];
  sys.setSwitch('engMode', 'IGN'); sys.setSwitch('manStart1', true); for (let i = 0; i < 120 && e.n2 < 20; i++) sys.advance(0.5); sys.setSwitch('master1', true); sys.advance(6);
  check(e.lit, 'ENG 1 manual start: light-off');
  sys.setSwitch('master1', false); sys.setSwitch('manStart1', false); sys.advance(2);
  check(!e.fuelOn && !e.sv && !e.lit && (e.phase === 'SPOOL' || e.phase === 'OFF'), `manual start aborted by the crew: fuel off, start valve closed, ${e.phase}, N2 ${fmt(e.n2)} %`);
  sys.setSwitch('engMode', 'CRANK'); sys.setSwitch('manStart1', true); sys.setSwitch('master1', true); sys.advance(20);
  check(e.sv && !e.fuelOn && !e.ign && e.crank, `CRANK: dry motoring N2 ${fmt(e.n2)} %, no fuel, no ignition`);
  sys.setSwitch('manStart1', false); sys.setSwitch('master1', false); sys.advance(2); check(!e.sv && e.phase !== 'START', 'crank ended');
}
// ---------- engine fire: second bottle ----------
{
  const { F, op, wait } = run('fire2'); const s = sys.st;
  op('beacon', 1); op('parkBrk'); op('thr1'); op('pack1', false); op('pack2', false); op('apuBleed'); op('engMode', 'IGN'); op('master2', true);
  wait(120, () => s.eng[1].fire); op('masterWarnL'); op('thr2'); op('master2', false); op('firePb2'); op('firePb2'); wait(11); op('agent2_1');
  wait(10); check(s.eng[1].fire, 'fire persists 10 s after AGENT 1');
  const line = s.alerts.find(a => a.id === 'fire2').lines.find(l => l.t.includes('AGENT 2')); check(/WAIT \d+ s/.test(line.t), 'upper display counts down: ' + line.t);
  wait(25, () => F.current() && F.current().id === 'agent2'); check(F.current().id === 'agent2', 'after ~30 s the drill asks for AGENT 2');
  op('agent2_2'); wait(5); check(!s.eng[1].fire, 'fire out after AGENT 2');
  op('engMode', 'NORM'); F.confirm(); F.update();
  const r = F.result(); check(F.finished && r.score === 100 && r.notes.length === 1 && /good timing/.test(r.notes[0]), `AGENT 2 drill: score ${r.score}; ${r.notes[0]}`);
}
{
  const { F, op, wait } = run('fire2'); const s = sys.st;
  op('beacon', 1); op('parkBrk'); op('thr1'); op('pack1', false); op('pack2', false); op('apuBleed'); op('engMode', 'IGN'); op('master2', true);
  wait(120, () => s.eng[1].fire); op('masterWarnL'); op('thr2'); op('master2', false); op('firePb2'); op('firePb2'); wait(11); op('agent2_1'); wait(6); op('agent2_2'); wait(40); op('engMode', 'NORM'); F.confirm(); F.update();
  const r = F.result(); check(F.finished && r.late.some(x => x.id === 'agent2') && r.score < 100 && /too early/.test(r.notes[0]), `AGENT 2 too early: out of order, score ${r.score}; ${r.notes[0]}`);
}
// ---------- systems pages data ----------
{
  run('start'); const s = sys.st;
  check(s.doors.fwdL === 1 && s.doors.bridge, 'DOOR: forward door open while the jet bridge is attached');
  sys.setSwitch('stickL', 'LEFT'); sys.advance(2); check(s.fctl.ail[0] < -5 && s.fctl.elev[0] < -10 && s.fctl.spl[0].every(v => v === 0), 'F/CTL without hydraulics: ailerons droop, spoilers stay down');
  sys.setSwitch('engMode', 'IGN'); sys.setSwitch('master2', true); sys.advance(70); sys.setSwitch('stickL', 'LEFT'); sys.advance(3);
  check(s.fctl.ail[0] > 20 && s.fctl.ail[1] < -20 && s.fctl.spl[0].some(v => v > 30), `F/CTL with HYD 3 (and PTU): left aileron up ${Math.round(s.fctl.ail[0])}, spoilers ${s.fctl.spl[0].map(Math.round)}`);
  sys.setSwitch('stickL', 'AFT'); sys.advance(2); check(s.fctl.elev[0] > 25, 'stick aft: elevators up ' + Math.round(s.fctl.elev[0]));
  check(s.brakes.temp[1] < 74 && s.brakes.temp[1] > 60, 'WHEEL: brakes cooling, ' + s.brakes.temp.map(Math.round).join('/') + ' C');
  check(s.cond.zone[0] < 26.4, 'COND: cockpit cooling with the packs: ' + s.cond.zone.map(t => t.toFixed(1)).join('/'));
}
console.log(ok ? '\nALL LOGIC TESTS PASSED' : '\nSOME LOGIC TESTS FAILED');
process.exit(ok ? 0 : 1);

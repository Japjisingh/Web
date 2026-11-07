// Headless tests of the ground and flight dynamics, autopilot and autothrust (Node).
import { createSystems } from '../../src/jet/systems.js';
import { createFlow, SCENARIOS } from '../../src/jet/flows.js';
import { operate } from '../../src/jet/controls.js';
import { toSN, RWY, TAXI_PATH, nearest, HOLD, YAW_RWY } from '../../src/jet/layout.js';
const sys = createSystems({ fast: false });
let ok = true; const check = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
const f0 = x => Math.round(x), f1 = x => Math.round(x * 10) / 10;
const s = () => sys.st, F = () => sys.st.fdm, w = () => sys.sw, I = () => sys.st.inp;
const run = (sec, each) => { const n = Math.round(sec * 30); for (let i = 0; i < n; i++) { if (each && each() === true) return true; sys.update(1 / 30); } return false; };

// ---------- idle creep and taxi ----------
{
  sys.reset('stand'); sys.setSwitch('parkBrk', false); run(30);
  const gs = F().gs; check(gs > 2 && gs < 20, `idle thrust alone creeps forward: ${f1(gs)} kt after 30 s`);
  run(60); check(F().gs < 22, `idle taxi speed settles: ${f1(F().gs)} kt after 90 s`);
  sys.setSwitch('thr1', 0.3); sys.setSwitch('thr2', 0.3); run(25, () => F().gs > 22); sys.setSwitch('thr1', 0); sys.setSwitch('thr2', 0);
  const v0 = F().gs, T0 = Math.max(...F().brakeT); I().brakeL = I().brakeR = 0.5; let t = 0; run(40, () => { t += 1 / 30; return F().gs < 0.3; });
  check(v0 > 20 && F().gs < 0.3 && t < 15, `taxi braking: ${f1(v0)} kt to a stop in ${f1(t)} s`);
  check(Math.max(...F().brakeT) > T0 + 2, `brakes heat up: ${f0(T0)} → ${f0(Math.max(...F().brakeT))} °C`);
  I().brakeL = I().brakeR = 0;
  // turn radius at about 10 kt with full tiller
  sys.setSwitch('thr1', 0.12); sys.setSwitch('thr2', 0.12); I().tiller = 1; let yaw0 = null, tt = 0, speeds = [];
  run(80, () => { const g = F().gs; sys.setSwitch('thr1', g < 10 ? 0.2 : 0); sys.setSwitch('thr2', g < 10 ? 0.2 : 0); I().brakeL = I().brakeR = g > 11 ? 0.15 : 0; if (Math.abs(g - 10) < 1.5) { if (yaw0 == null) { yaw0 = F().yaw; tt = 0; } tt += 1 / 30; speeds.push(F().u); } return yaw0 != null && tt > 6; });
  const rate = Math.abs(F().yaw - yaw0) / tt, v = speeds.reduce((a, b) => a + b, 0) / speeds.length, R = v / rate;
  check(R > 12 && R < 45, `turn radius at ${f1(v / 0.5144)} kt with full tiller: ${f0(R)} m (main gear)`);
  I().tiller = 0; sys.setSwitch('thr1', 0); sys.setSwitch('thr2', 0);
}
// ---------- take-off roll: TOGA and FLX ----------
function takeoff(lever, label) {
  sys.reset('lineup'); const s0 = toSN(F().x, F().z).s; let tVR = -1, dVR = 0, tLO = -1, dLO = 0, t = 0;
  sys.setSwitch('thr1', lever); sys.setSwitch('thr2', lever);
  run(80, () => { t += 1 / 30; const fd = F(); if (tVR < 0 && fd.ias >= 140) { tVR = t; dVR = toSN(fd.x, fd.z).s - s0; } I().pitch = tVR > 0 && fd.pitch < 15 * Math.PI / 180 ? 0.65 : 0; if (tLO < 0 && !fd.onGround) { tLO = t; dLO = toSN(fd.x, fd.z).s - s0; } return fd.ra > 50; });
  check(tVR > 22 && tVR < 45 && dVR > 650 && dVR < 1600, `${label}: VR after ${f1(tVR)} s and ${f0(dVR)} m`);
  check(tLO > tVR && dLO < RWY.s1 - RWY.s0 - 600 && !F().tailstrike, `${label}: lift-off after ${f1(tLO)} s and ${f0(dLO)} m (pitch ${f1(s().mon.liftoff.pitch)}°, ${f1(s().mon.liftoff.rate)}°/s), no tail strike`);
  return { tVR, dVR };
}
{
  const a = takeoff(3, 'TOGA'), b = takeoff(2, 'FLX 45');
  check(b.dVR > a.dVR && b.tVR > a.tVR, 'FLX take-off roll longer than TOGA');
  check(s().callouts['100'] && s().callouts.v1 && s().callouts.vr && s().af.thr.startsWith('MAN FLX') && s().af.vert === 'SRS', `callouts 100 kt / V1 / rotate; FMA ${s().af.thr} | ${s().af.vert} | ${s().af.lat}`);
  // positive climb, gear up, AP 1, thrust reduction, flaps up, level off at the FCU altitude
  run(10, () => s().callouts.pos); check(s().callouts.pos, 'positive climb callout');
  operate(sys, 'gear', { to: 'UP' }); run(12); check(F().gear === 0, 'gear up and locked in ' + '12 s');
  I().pitch = 0; operate(sys, 'ap1'); run(1); check(w().ap1 && s().af.ap, `AP 1 engaged at ${f0(F().ra)} ft`);
  run(90, () => s().af.thr === 'LVR CLB'); check(s().af.thr === 'LVR CLB' && F().alt > 1800, `LVR CLB at ${f0(F().alt)} ft`);
  sys.setSwitch('thr1', 1); sys.setSwitch('thr2', 1); run(2);
  check(s().af.athrActive && s().af.thr === 'THR CLB' && s().af.vert === 'CLB', `A/THR active: ${s().af.thr} | ${s().af.vert} | ${s().af.lat}`);
  run(25, () => F().ias > 205); operate(sys, 'flaps', { to: 0 }); run(15);
  check(F().flap < 0.05 && s().mon.flapOver === 0, `flaps retracted at ${f0(F().ias)} kt, no flap overspeed`);
  run(10); const vs = F().vs / 0.3048 * 60; check(vs > 1200 && vs < 4500, `climb rate ${f0(vs)} ft/min at ${f0(F().alt)} ft, ${f0(F().ias)} kt`);
  run(200, () => s().af.vert === 'ALT' && Math.abs(F().alt - 5000) < 30);
  run(20); check(s().af.vert === 'ALT' && Math.abs(F().alt - 5000) < 60 && Math.abs(F().vs) < 1.5, `AP levels off at the FCU altitude: ${f0(F().alt)} ft, ${s().af.thr}, ${f0(F().ias)} kt`);
  sys.sw.athr && run(40); check(Math.abs(F().ias - 250) < 8, `A/THR holds 250 kt in level flight: ${f0(F().ias)} kt`);
  check(s().mon.gearOver === 0 && s().mon.taxiMax < 31, 'no gear overspeed');
}
// ---------- rejected take-off ----------
{
  sys.reset('lineup'); sys.st.rtoInject = { ias: 95 }; const s0 = toSN(F().x, F().z).s;
  sys.setSwitch('thr1', 2); sys.setSwitch('thr2', 2);
  run(60, () => s().rtoInject.fired); check(s().rtoInject.fired && s().master.warn, `warning before V1 at ${f0(F().ias)} kt`);
  run(1.5); sys.setSwitch('thr1', 0); sys.setSwitch('thr2', 0); run(1);
  check(F().abActive && F().spoiler > 0.5, 'autobrake RTO and ground spoilers');
  run(60, () => F().gs < 0.3); const sn = toSN(F().x, F().z);
  check(F().gs < 0.3 && sn.s < RWY.s1 && Math.abs(sn.n - RWY.n) < RWY.w / 2, `RTO stops on the runway: ${f0(sn.s - s0)} m from brake release, ${f0(RWY.s1 - sn.s)} m remaining, reject at ${f0(s().mon.reject.ias)} kt`);
  check(Math.max(...F().brakeT) > 150, `brakes hot after the RTO: ${F().brakeT.map(f0).join('/')} °C`);
}
// ---------- the whole “Taxi and take-off” scenario through the flow ----------
{
  const sc = SCENARIOS.taxi; sys.reset(sc.init); const Fl = createFlow(sys, 'taxi', 'practice');
  const op = (id, v) => { if (Fl.touch(id)) return; const r = operate(sys, id, v === undefined ? undefined : { to: v }); if (r.did) Fl.operated(id); };
  const step = (sec, each) => { const n = Math.round(sec * 30); for (let i = 0; i < n; i++) { if (each && each() === true) { Fl.update(); return true; } sys.update(1 / 30); Fl.update(); } return false; };
  // simple taxi driver: look-ahead steering on the green line, speed by thrust and brakes, stop at the stop bar
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  function drive(tgtKt, stopAtHold) {
    const fd = F(), sn = toSN(fd.x, fd.z), nr = nearest(TAXI_PATH, sn.s, sn.n);
    let k = nr.i, acc = 0; while (k < TAXI_PATH.length - 1 && acc < 16 + fd.gs * 0.6) { acc += Math.hypot(TAXI_PATH[k + 1].s - TAXI_PATH[k].s, TAXI_PATH[k + 1].n - TAXI_PATH[k].n); k++; }
    const pt = TAXI_PATH[k], err = wrap(Math.atan2(pt.n - sn.n, pt.s - sn.s) - (YAW_RWY - fd.yaw));
    I().tiller = Math.max(-1, Math.min(1, err * 2.2)); I().rudder = 0;
    let tgt = Math.abs(err) > 0.25 ? 9 : tgtKt; const nose = s().mon.nose;
    if (stopAtHold && Math.abs(nose.s - HOLD.s) < 30 && nose.n > HOLD.n - 40) tgt = nose.n > HOLD.n - 9 ? 0 : 6;
    const L = fd.gs < tgt - 1 ? (fd.gs < 3 ? 0.32 : 0.2) : 0; sys.setSwitch('thr1', L); sys.setSwitch('thr2', L);
    I().brakeL = I().brakeR = fd.gs > tgt + 2 || tgt === 0 ? (tgt === 0 ? 0.7 : 0.3) : 0;
  }
  op('parkBrk', false); op('push'); step(70, () => F().push && F().push.gone);
  check(F().push && F().push.gone && Fl.current().id === 'parkSetPush', `pushback done: main gear at s ${f0(toSN(F().x, F().z).s)}, n ${f0(toSN(F().x, F().z).n)}, heading ${f0(F().hdg)}`);
  op('parkBrk', true); op('flaps', 1); op('spdBrk', 1); op('autoBrkMax');
  for (const [p, r] of [[1, 0], [-1, 0], [0, -1], [0, 1], [0, 0]]) { I().pitch = p; I().roll = r; step(2); }
  op('toConfig'); step(1);
  check(Fl.current().id === 'parkOffTaxi', 'before-taxi steps done (flaps, spoilers, autobrake, flight controls, T.O CONFIG): next ' + Fl.current().id);
  op('parkBrk', false);
  step(300, () => { drive(16, true); return s().mon.atHold && s().mon.held > 1; });
  check(s().mon.atHold && !s().mon.stopBarRun && s().mon.taxiMax < 30, `taxied to the holding point and stopped before the stop bar (max ${f1(s().mon.taxiMax)} kt)`);
  step(5, () => s().mon.cleared); check(s().mon.cleared && !s().stopBar, 'cleared: stop bar out');
  op('strobe', 2); op('landL', 2); op('landR', 2); op('nose', 2); op('xpdr', 2);
  step(120, () => { drive(10, false); const sn = toSN(F().x, F().z); if (s().mon.lined && sn.s > -515) { I().brakeL = I().brakeR = 1; sys.setSwitch('thr1', 0); sys.setSwitch('thr2', 0); I().tiller = 0; } return s().mon.lined && F().gs < 0.5; });
  I().brakeL = I().brakeR = 0; I().tiller = 0; step(1);
  check(s().mon.lined && Fl.current().id === 'chrono', `lined up on the runway centre line (offset ${f1(toSN(F().x, F().z).n - RWY.n)} m, heading ${f0(F().hdg)})`);
  op('chrono'); op('thr1', 2); op('thr2', 2);
  step(80, () => { const fd = F(); I().rudder = Math.max(-1, Math.min(1, -(toSN(fd.x, fd.z).n - RWY.n) * 0.15 - wrap((fd.hdg - 274) * Math.PI / 180) * 3)); I().pitch = fd.ias >= 140 && fd.pitch < 15 * Math.PI / 180 ? 0.6 : 0; return fd.ra > 60; });
  I().rudder = 0; I().pitch = 0; step(3);
  op('gear', 'UP'); step(1); op('ap1'); step(2);
  check(Fl.current().id === 'thrCL', 'take-off steps done; next: ' + Fl.current().id + ' — FMA ' + [s().af.thr, s().af.vert, s().af.lat].join(' | '));
  step(80, () => s().af.thr === 'LVR CLB'); op('thr1', 1); op('thr2', 1);
  step(60, () => F().ias > 200); op('flaps', 0);
  step(240, () => Fl.finished);
  const r = Fl.result();
  check(Fl.finished && r.score >= 90 && r.wrong.length === 0, `Taxi and take-off finished: score ${r.score}, ${r.inOrder}/${r.total}; ${r.notes.join(' · ')}`);
}
console.log(ok ? '\nALL FDM TESTS PASSED' : '\nSOME FDM TESTS FAILED');
process.exit(ok ? 0 : 1);

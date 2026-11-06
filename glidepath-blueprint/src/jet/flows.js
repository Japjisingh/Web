/* Flows for the generic twin-jet procedure trainer. Written by us in plain generic wording from general
   public knowledge; not any manufacturer's or operator's procedures. No three.js (runs in Node for tests).
   Step kinds: set (operate a control), check (touch the panel / indicator to confirm), wait (monitor; completes
   by itself), confirm (press Done). A 'set' step that is already satisfied when it comes up becomes a touch-check. */

import { CTL, fmsId } from './controls.js';
import { fmsStatus, fmsNext } from './avionics.js';

export const PHASES = { power: 'Power-up', scan: 'Overhead scan', apu: 'APU start', fms: 'Flight computer', before: 'Before start', start: 'Engine start', man: 'Manual start', after: 'After start', fire: 'Engine fire drill' };
const FMS_KEYS = Object.keys(CTL).filter(id => CTL[id].k === 'key');

const all = (...ids) => s => ids.every(id => s.sw[id]);
const none = (...ids) => s => ids.every(id => !s.sw[id]);

export const STEPS = {
  // ---------- power-up ----------
  batv: { ph: 'power', kind: 'check', t: 'Battery voltage — CHECK above 25.5 V', where: 'Overhead · ELEC · BAT voltage windows', ctl: ['batV1', 'batV2'], any: true, tip: 'Touch a BAT voltage window. The readouts work even with the batteries off.' },
  bat1: { ph: 'power', kind: 'set', t: 'BAT 1 — ON', where: 'Overhead · ELEC', ctl: ['bat1'], done: all('bat1'), tip: 'Push in: the white OFF light goes out.' },
  bat2: { ph: 'power', kind: 'set', t: 'BAT 2 — ON', where: 'Overhead · ELEC', ctl: ['bat2'], done: all('bat2') },
  ext: { ph: 'power', kind: 'set', t: 'EXT PWR — ON (when AVAIL is lit)', where: 'Overhead · ELEC', ctl: ['extPwr'], done: s => s.sw.extPwr && s.st.elec.extOn, when: s => s.gpu, tip: 'Green AVAIL changes to blue ON. The displays come alive.' },
  // ---------- overhead scan: left column, centre column top to bottom, right column ----------
  irs: { ph: 'scan', kind: 'set', t: 'IRS 1, 2 and 3 — NAV', where: 'Overhead · IRS (left column, top)', ctl: ['irs1', 'irs2', 'irs3'], want: { irs1: 'NAV', irs2: 'NAV', irs3: 'NAV' }, done: s => ['irs1', 'irs2', 'irs3'].every(k => s.sw[k] === 'NAV'), tip: 'Turn each selector to NAV. ALIGN lights come on; ON BAT lights briefly during the self-test.' },
  crewOxy: { ph: 'scan', kind: 'set', t: 'CREW OXY SUPPLY — ON', where: 'Overhead · OXYGEN (left column)', ctl: ['crewOxy'], done: all('crewOxy') },
  fireTest: { ph: 'scan', kind: 'set', t: 'Fire tests — ENG 1, APU, ENG 2: TEST', where: 'Overhead · FIRE (centre, top)', ctl: ['test1', 'testApu', 'test2'], done: s => s.st.testsDone.eng1 && s.st.testsDone.apu && s.st.testsDone.eng2, tip: 'Each test: FIRE light, SQUIB and DISCH lights, master warning and chime.' },
  hydChk: { ph: 'scan', kind: 'check', t: 'HYD panel — CHECK pumps on, no OFF lights', where: 'Overhead · HYD', area: 'HYD' },
  fuelPumps: { ph: 'scan', kind: 'set', t: 'Fuel pumps (6) — ON', where: 'Overhead · FUEL', ctl: ['pL1', 'pL2', 'pC1', 'pC2', 'pR1', 'pR2'], want: { pL1: true, pL2: true, pC1: true, pC2: true, pR1: true, pR2: true }, done: all('pL1', 'pL2', 'pC1', 'pC2', 'pR1', 'pR2'), tip: 'All six OFF lights out. X FEED stays closed.' },
  elecChk: { ph: 'scan', kind: 'check', t: 'ELEC panel — CHECK: GENs, APU GEN, BUS TIE on, no FAULT', where: 'Overhead · ELEC', area: 'ELEC' },
  airChk: { ph: 'scan', kind: 'check', t: 'AIR panel — CHECK: PACKs and ENG BLEEDs on, X BLEED AUTO', where: 'Overhead · AIR', area: 'AIR' },
  antiIce: { ph: 'scan', kind: 'check', t: 'ANTI ICE off, PROBE/WINDOW HEAT AUTO — CHECK', where: 'Overhead · ANTI ICE', area: 'ANTIICE' },
  press: { ph: 'scan', kind: 'check', t: 'CABIN PRESS — CHECK: MODE SEL AUTO, LDG ELEV AUTO', where: 'Overhead · CABIN PRESS', area: 'PRESS' },
  navLt: { ph: 'scan', kind: 'set', t: 'NAV & LOGO lights — ON', where: 'Overhead · EXT LT (front row)', ctl: ['navLogo'], done: s => s.sw.navLogo >= 1 },
  belts: { ph: 'scan', kind: 'set', t: 'SEAT BELTS sign — ON', where: 'Overhead · SIGNS (front row)', ctl: ['seatBelts'], done: s => s.sw.seatBelts >= 1 },
  noSmk: { ph: 'scan', kind: 'set', t: 'NO SMOKING sign — ON or AUTO', where: 'Overhead · SIGNS', ctl: ['noSmoking'], done: s => s.sw.noSmoking >= 1 },
  emerExit: { ph: 'scan', kind: 'set', t: 'EMER EXIT LT — ARM', where: 'Overhead · SIGNS', ctl: ['emerExit'], done: s => s.sw.emerExit === 1 },
  annTest: { ph: 'scan', kind: 'set', t: 'ANN LT — TEST (all lights on), then BRT', where: 'Overhead · INT LT (front row, right)', ctl: ['annLt'], done: s => s.st.annTestDone && s.sw.annLt === 1, tip: 'Move up to TEST, check every light, then back down to BRT.' },
  rightCol: { ph: 'scan', kind: 'check', t: 'Right column — CHECK: ENG MAN START off, no lights', where: 'Overhead · right column', area: 'RCOL' },
  // ---------- APU ----------
  apuMaster: { ph: 'apu', kind: 'set', t: 'APU MASTER SW — ON', where: 'Overhead · APU (front row)', ctl: ['apuMaster'], done: all('apuMaster'), tip: 'Blue ON. The APU air intake flap starts to open.' },
  apuStart: { ph: 'apu', kind: 'set', t: 'APU START — ON', where: 'Overhead · APU', ctl: ['apuStart'], done: s => s.st.apu.startReq || s.st.apu.phase === 'START' || s.st.apu.avail },
  apuAvail: { ph: 'apu', kind: 'wait', t: 'APU — wait for AVAIL (watch N and EGT on the SYSTEMS display)', where: 'Lower display · APU page', look: 'sd', done: s => s.st.apu.avail },
  apuBleed: { ph: 'apu', kind: 'set', t: 'APU BLEED — ON', where: 'Overhead · AIR', ctl: ['apuBleed'], done: all('apuBleed') },
  extOff: { ph: 'apu', kind: 'set', t: 'EXT PWR — OFF (APU GEN takes the load)', where: 'Overhead · ELEC', ctl: ['extPwr'], done: s => !s.sw.extPwr, when: s => s.gpu },
  fms: { ph: 'fms', kind: 'set', t: 'Flight computer — INIT, F-PLN, PERF set', where: 'Pedestal · flight computer 1 (left keypad)', ctl: FMS_KEYS, done: s => fmsStatus(s.st.av.fms).all,
    guide: s => { const g = fmsNext(s, 0); return { ...(g.key === 'keys' ? { area: 'FMSK1' } : g.key ? { ctl: fmsId(1, g.key) } : {}), text: g.text }; },
    tip: 'INIT: ZZAA/ZZBB, flight GPX101, baro 1009, cost index 30, FL350. F-PLN: runway 27R, arrival 09. PERF: V1 135, VR 140, V2 145, FLEX 45. Type into the scratchpad, then press the line key next to the field.' },
  irsAligned: { ph: 'apu', kind: 'wait', t: 'IRS — wait until aligned (ALIGN lights out)', where: 'Overhead · IRS', look: 'irs1', done: s => s.st.irs.every(r => r.aligned) },
  // ---------- before start ----------
  beacon: { ph: 'before', kind: 'set', t: 'BEACON — ON', where: 'Overhead · EXT LT', ctl: ['beacon'], done: s => s.sw.beacon >= 1 },
  parkBrk: { ph: 'before', kind: 'set', t: 'PARKING BRAKE — SET, check brake pressure', where: 'Pedestal · PARK BRK', ctl: ['parkBrk', 'brakeGauge'], any: true, done: all('parkBrk') },
  thrIdle: { ph: 'before', kind: 'set', t: 'THRUST LEVERS — IDLE', where: 'Pedestal', ctl: ['thr1', 'thr2'], want: { thr1: 0, thr2: 0 }, done: s => s.sw.thr1 === 0 && s.sw.thr2 === 0 },
  packsOff: { ph: 'before', kind: 'set', t: 'PACK 1 and PACK 2 — OFF (more air for the start)', where: 'Overhead · AIR', ctl: ['pack1', 'pack2'], want: { pack1: false, pack2: false }, done: none('pack1', 'pack2') },
  apuBleedChk: { ph: 'before', kind: 'set', t: 'APU BLEED — ON', where: 'Overhead · AIR', ctl: ['apuBleed'], done: all('apuBleed') },
  ignStart: { ph: 'before', kind: 'set', t: 'ENG MODE selector — IGN/START', where: 'Pedestal · ENG', ctl: ['engMode'], done: s => s.sw.engMode === 'IGN', tip: 'The SYSTEMS display changes to the ENG page.' },
  // ---------- engine start (engine 2 first) ----------
  m2on: { ph: 'start', kind: 'set', t: 'ENG 2 MASTER — ON', where: 'Pedestal · ENG', ctl: ['master2'], done: all('master2'), tip: 'Lift the lever over the detent and move it up.' },
  e2ign: { ph: 'start', kind: 'wait', t: 'ENG 2 — start valve open, N2 rising, ignition at about 16 % N2', where: 'Displays · ENG', look: 'ewd', done: s => s.st.eng[1].fuelOn || s.st.eng[1].running },
  e2lit: { ph: 'start', kind: 'wait', t: 'ENG 2 — fuel flow, light-off, EGT and N1 rising', where: 'Upper display', look: 'ewd', done: s => (s.st.eng[1].lit && s.st.eng[1].n1 > 4) || s.st.eng[1].running },
  e2idle: { ph: 'start', kind: 'wait', t: 'ENG 2 — start valve closed, stable at idle (N1 ≈ 20 %, N2 ≈ 59 %, EGT ≈ 420 °C)', where: 'Upper display', look: 'ewd', done: s => s.st.eng[1].running },
  m1on: { ph: 'start', kind: 'set', t: 'ENG 1 MASTER — ON', where: 'Pedestal · ENG', ctl: ['master1'], done: all('master1') },
  e1start: { ph: 'start', kind: 'wait', t: 'ENG 1 — monitor: N2, ignition, fuel flow, light-off, EGT, N1', where: 'Displays · ENG', look: 'ewd', done: s => (s.st.eng[0].lit && s.st.eng[0].n1 > 4) || s.st.eng[0].running },
  e1idle: { ph: 'start', kind: 'wait', t: 'ENG 1 — stable at idle', where: 'Upper display', look: 'ewd', done: s => s.st.eng[0].running },
  modeNorm: { ph: 'start', kind: 'set', t: 'ENG MODE selector — NORM', where: 'Pedestal · ENG', ctl: ['engMode'], done: s => s.sw.engMode === 'NORM' },
  // ---------- after start ----------
  apuBleedOff: { ph: 'after', kind: 'set', t: 'APU BLEED — OFF', where: 'Overhead · AIR', ctl: ['apuBleed'], done: none('apuBleed') },
  packsOn: { ph: 'after', kind: 'set', t: 'PACK 1 and PACK 2 — ON', where: 'Overhead · AIR', ctl: ['pack1', 'pack2'], want: { pack1: true, pack2: true }, done: all('pack1', 'pack2') },
  apuOff: { ph: 'after', kind: 'set', t: 'APU MASTER SW — OFF (as required)', where: 'Overhead · APU', ctl: ['apuMaster'], done: none('apuMaster') },
  sdCheck: { ph: 'after', kind: 'check', t: 'SYSTEMS display — CHECK: GEN 1 and GEN 2 on line, HYD pressures normal', where: 'Lower display (use the page buttons)', ctl: ['sd'], done: s => s.st.elec.genOn[0] && s.st.elec.genOn[1] },
  flaps: { ph: 'after', kind: 'set', t: 'FLAPS — take-off position (1)', where: 'Pedestal · FLAPS', ctl: ['flaps'], done: s => s.sw.flaps === 1 },
  // ---------- manual start (engine 2) ----------
  man2on: { ph: 'man', kind: 'set', t: 'ENG 2 MAN START — ON (start valve opens, N2 rises)', where: 'Overhead · right column · ENG MAN START', ctl: ['manStart2'], done: s => s.sw.manStart2, tip: 'Blue ON. With the mode selector at IGN/START the start valve opens; no fuel or ignition until you set the MASTER.' },
  man2n2: { ph: 'man', kind: 'wait', t: 'ENG 2 — wait for N2 above about 20 % (maximum motoring is about 25 %)', where: 'Upper display · N2', look: 'ewd', done: s => s.st.eng[1].n2 >= 20 || s.st.eng[1].fuelOn || s.st.eng[1].running },
  man2master: { ph: 'man', kind: 'set', t: 'ENG 2 MASTER — ON (fuel and ignition)', where: 'Pedestal · ENG', ctl: ['master2'], done: all('master2'), tip: 'From here you protect the engine: no light-off within about 15 s, or EGT running towards the limit, means MASTER OFF.' },
  man2lit: { ph: 'man', kind: 'wait', t: 'ENG 2 — light-off, EGT and N1 rising (abort if the EGT runs away)', where: 'Upper display', look: 'ewd', done: s => (s.st.eng[1].lit && s.st.eng[1].n1 > 4) || s.st.eng[1].running },
  man2idle: { ph: 'man', kind: 'wait', t: 'ENG 2 — start valve closed, stable at idle', where: 'Upper display', look: 'ewd', done: s => s.st.eng[1].running },
  man2off: { ph: 'man', kind: 'set', t: 'ENG 2 MAN START — OFF', where: 'Overhead · right column', ctl: ['manStart2'], done: s => !s.sw.manStart2 },
  // ---------- engine fire during start ----------
  e2mon: { ph: 'start', kind: 'wait', t: 'ENG 2 — monitor: light-off, EGT and N1 rising', where: 'Upper display', look: 'ewd', done: s => s.st.eng[1].fire || s.st.eng[1].running },
  mwSil: { ph: 'fire', kind: 'set', t: 'MASTER WARNING — press to silence; read ENG 2 FIRE', where: 'Glareshield', ctl: ['masterWarnL', 'masterWarnR'], any: true, done: s => s.st.ackFire },
  thr2Idle: { ph: 'fire', kind: 'set', t: 'THRUST LEVER 2 — IDLE (confirm)', where: 'Pedestal', ctl: ['thr2'], done: s => s.sw.thr2 === 0 },
  m2off: { ph: 'fire', kind: 'set', t: 'ENG 2 MASTER — OFF', where: 'Pedestal · ENG', ctl: ['master2'], done: none('master2') },
  fire2pb: { ph: 'fire', kind: 'set', t: 'ENG 2 FIRE pb — lift the guard and PUSH', where: 'Overhead · FIRE', ctl: ['firePb2'], done: all('firePb2'), tip: 'First touch lifts the guard, the second pushes the button. SQUIB lights show the agents are armed.' },
  wait10: { ph: 'fire', kind: 'wait', t: 'Wait about 10 s while the engine spools down', where: 'Upper display', look: 'ewd', done: s => s.st.firePbT >= 0 && s.t - s.st.firePbT >= 10 },
  agent1: { ph: 'fire', kind: 'set', t: 'AGENT 1 (ENG 2) — DISCH', where: 'Overhead · FIRE', ctl: ['agent2_1'], done: s => s.st.eng[1].agents[0].disch, tip: 'DISCH light comes on when the bottle is empty.' },
  fireOut: { ph: 'fire', kind: 'wait', t: 'FIRE light — check out (if still on after ~30 s: AGENT 2)', where: 'Overhead · FIRE', look: 'firePb2', done: s => !s.st.eng[1].fire },
  fireStill: { ph: 'fire', kind: 'wait', t: 'FIRE light still on — keep monitoring for about 30 s after AGENT 1', where: 'Overhead · FIRE', look: 'firePb2', done: s => { const a = s.st.eng[1].agents[0]; return !s.st.eng[1].fire || (a.disch && s.t - a.t >= 30); } },
  agent2: { ph: 'fire', kind: 'set', t: 'AGENT 2 (ENG 2) — DISCH (fire still on after about 30 s)', where: 'Overhead · FIRE', ctl: ['agent2_2'], done: s => s.st.eng[1].agents[1].disch, tip: 'The second bottle. Only after giving the first one about 30 s to work.',
    note: s => { const [a, b] = s.st.eng[1].agents; if (!a.disch || !b.disch) return ''; const d = Math.round(b.t - a.t); return `AGENT 2 discharged ${d} s after AGENT 1` + (d < 25 ? ' — too early: give the first bottle about 30 s (−15).' : ' — good timing.'); },
    penalty: s => { const [a, b] = s.st.eng[1].agents; return a.disch && b.disch && b.t - a.t < 25 ? 15 : 0; } },
  fireOut2: { ph: 'fire', kind: 'wait', t: 'FIRE light — check out after AGENT 2', where: 'Overhead · FIRE', look: 'firePb2', done: s => !s.st.eng[1].fire },
  modeNormF: { ph: 'fire', kind: 'set', t: 'ENG MODE selector — NORM', where: 'Pedestal · ENG', ctl: ['engMode'], done: s => s.sw.engMode === 'NORM' },
  inform: { ph: 'fire', kind: 'confirm', t: 'Tell ATC and the cabin crew; consider an evacuation', where: 'Press Done' }
};

const PREP = ['batv', 'bat1', 'bat2', 'ext', 'irs', 'crewOxy', 'fireTest', 'hydChk', 'fuelPumps', 'elecChk', 'airChk', 'antiIce', 'press', 'navLt', 'belts', 'noSmk', 'emerExit', 'annTest', 'rightCol', 'apuMaster', 'apuStart', 'apuAvail', 'apuBleed', 'extOff', 'fms', 'irsAligned'];
const BEFORE = ['beacon', 'parkBrk', 'thrIdle', 'packsOff', 'apuBleedChk', 'ignStart'];
const FIRE_A = [...BEFORE, 'm2on', 'e2ign', 'e2mon', 'mwSil', 'thr2Idle', 'm2off', 'fire2pb', 'wait10', 'agent1'];
const START = ['beacon', 'parkBrk', 'thrIdle', 'packsOff', 'apuBleedChk', 'ignStart', 'm2on', 'e2ign', 'e2lit', 'e2idle', 'm1on', 'e1start', 'e1idle', 'modeNorm', 'apuBleedOff', 'packsOn', 'apuOff', 'sdCheck', 'flaps'];
export const SCENARIOS = {
  prep: { title: 'Cockpit preparation', init: 'cold', steps: PREP },
  start: { title: 'Engine start', init: 'beforeStart', steps: START },
  full: { title: 'Cold & dark to engines running', init: 'cold', steps: [...PREP, ...START] },
  fire: { title: 'Engine fire during start', init: 'beforeStart', fire: { eng: 1, n2: 36 }, steps: [...FIRE_A, 'fireOut', 'modeNormF', 'inform'] },
  fire2: { title: 'Engine fire: second bottle', init: 'beforeStart', fire: { eng: 1, n2: 36, persist: true }, steps: [...FIRE_A, 'fireStill', 'agent2', 'fireOut2', 'modeNormF', 'inform'] },
  manual: { title: 'Manual engine start', init: 'beforeStart', steps: [...BEFORE, 'man2on', 'man2n2', 'man2master', 'man2lit', 'man2idle', 'man2off', 'modeNorm', 'apuBleedOff', 'packsOn'] }
};
// controls that never count as wrong (silencing, display pages, lighting)
export const FREE = new Set(['masterWarn', 'masterCaut', 'masterWarnL', 'masterWarnR', 'masterCautL', 'masterCautR', 'sdENG', 'sdBLEED', 'sdPRESS', 'sdELEC', 'sdHYD', 'sdFUEL', 'sdAPU', 'sdCOND', 'sdDOOR', 'sdWHEEL', 'sdFCTL', 'sdSTS', 'dome', 'intLtOvhd', 'sd', 'ewd', 'pfd', 'nd', 'stby', 'clock', 'brakeGauge', 'batV1', 'batV2']);

export function createFlow(sys, key, mode = 'guided') {
  const sc = SCENARIOS[key];
  const F = { key, title: sc.title, mode, steps: sc.steps.map((id, i) => ({ id, i, ...STEPS[id], state: 'pending', touch: false, at: -1, order: -1 })), cur: 0, errors: [], t0: sys.t, tEnd: -1, finished: false, seq: 0, last: null };
  const n = () => F.steps.length;
  const cur = () => F.steps[F.cur] || null;
  const fb = (type, step, msg) => (F.last = { type, step, msg, t: sys.t });
  function complete(st, how) { st.state = how; st.at = sys.t; st.order = F.seq++; }
  function settle() {
    // move the pointer over finished steps; resolve n/a, waits and already-satisfied set steps
    for (let guard = 0; guard < 200; guard++) {
      const s = cur();
      if (!s) { finish(); return; }
      if (s.state !== 'pending' && s.state !== 'current') { F.cur++; continue; }
      if (s.when && !s.when(sys)) { s.state = 'na'; F.cur++; continue; }
      if (s.state === 'pending') { s.state = 'current'; s.since = sys.t; s.touch = s.kind === 'set' && s.done(sys); }
      if ((s.kind === 'wait' || (s.kind === 'set' && s.engaged)) && s.done(sys)) { complete(s, 'done'); F.cur++; continue; }
      return;
    }
  }
  function finish() {
    if (F.finished) return;
    F.finished = true; F.tEnd = sys.t;
    for (const s of F.steps) if (s.state === 'pending' || s.state === 'current') s.state = 'missed';
  }
  F.finish = finish;
  F.current = cur;
  /** Called before a control is operated. Returns true if the touch was a check (control must NOT be operated). */
  F.touch = (ctl, area) => {
    if (F.finished) return false;
    const s = cur(); if (!s) return false;
    const areas = Array.isArray(area) ? area : area ? [area] : [];
    const hit = (s.ctl && s.ctl.includes(ctl)) || (s.area && (areas.includes(s.area) || ctl === 'area:' + s.area));
    if (!hit) return false;
    if (s.kind === 'check' || (s.kind === 'set' && s.touch)) {
      if (s.kind === 'check' && s.done && !s.done(sys)) { fb('hint', s, 'Not yet: ' + s.t); return true; }
      complete(s, 'done'); fb('ok', s, 'Checked'); F.cur++; settle(); return true;
    }
    return false;
  };
  /** Called after a control was operated. */
  F.operated = (ctl) => {
    if (F.finished) return null;
    const s = cur();
    if (s && s.ctl && s.ctl.includes(ctl) && s.kind === 'set') {
      s.touch = false; s.engaged = true;
      if (s.done(sys)) { complete(s, 'done'); F.cur++; settle(); return fb('ok', s, 'Done'); }
      return fb('partial', s, 'Keep going: ' + s.t);
    }
    // a later step done early?
    for (let j = F.cur + 1; j < n(); j++) {
      const q = F.steps[j];
      if (q.state !== 'pending' || q.kind !== 'set' || !q.ctl || !q.ctl.includes(ctl)) continue;
      if (q.when && !q.when(sys)) continue;
      if (q.done(sys)) { complete(q, 'late'); q.early = { atStep: F.cur, atText: s ? s.t : '' }; return fb('early', q, `Out of order: “${q.t}” is step ${j + 1}; next is step ${F.cur + 1}`); }
      q.engaged = true;
      return fb('partial', q, 'Out of order: that control belongs to step ' + (j + 1));
    }
    if (FREE.has(ctl) || (CTL[ctl] && CTL[ctl].free)) return null;
    F.errors.push({ ctl, atStep: F.cur, atText: s ? s.t : '', t: sys.t });
    return fb('wrong', s, s ? `Not part of this step. Next: ${s.t}` : 'Not expected now');
  };
  F.confirm = () => { const s = cur(); if (s && s.kind === 'confirm') { complete(s, 'done'); F.cur++; settle(); fb('ok', s, 'Done'); return true; } return false; };
  F.update = () => { if (!F.finished) settle(); };
  F.result = () => {
    const counted = F.steps.filter(s => s.state !== 'na');
    const inOrder = counted.filter(s => s.state === 'done').length, late = counted.filter(s => s.state === 'late').length, missed = counted.filter(s => s.state === 'missed');
    const wrong = F.errors.length;
    const pen = F.steps.reduce((t, s) => t + (s.penalty ? s.penalty(sys) : 0), 0);
    const score = Math.max(0, Math.round(100 * (inOrder + 0.5 * late) / Math.max(1, counted.length)) - Math.min(20, wrong * 2) - pen);
    const notes = F.steps.filter(s => s.note).map(s => s.note(sys)).filter(Boolean);
    return { score, total: counted.length, inOrder, late: counted.filter(s => s.state === 'late'), missed, wrong: F.errors, notes, time: (F.tEnd >= 0 ? F.tEnd : sys.t) - F.t0 };
  };
  F.progress = () => { const c = F.steps.filter(s => s.state === 'done' || s.state === 'late').length; return { done: c, total: F.steps.filter(s => s.state !== 'na').length }; };
  settle();
  return F;
}

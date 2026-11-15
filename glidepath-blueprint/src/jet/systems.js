/* Generic twin-jet systems model for the procedure trainer.
   Deterministic, fixed timestep, no three.js (runs in Node for tests).
   Every figure is approximate and generic: written from general public knowledge, not any manufacturer's data. */

import { createAvionics, presetAvionics, presetArrival, avUpdate, fcuRule, FIELD_ELEV, apprSpeeds } from './avionics.js';
import { createFDM, thrustOf, AF, KT, FT } from './fdm.js';
import { createAutoflight, autoflight, leverN1 } from './autoflight.js';
import { createChecklists } from './checklists.js';
import { toSN, RWY, HOLD, TAXI_PATH, TAXI_IN, STAND14, EXIT, nearest, ELEV_FT, WIND, ilsDev, finalPoint, TDZ } from './layout.js';

export const DT = 1 / 30;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lag = (x, t, tau, dt) => x + (t - x) * (1 - Math.exp(-dt / Math.max(1e-3, tau)));
const towards = (x, t, rate, dt) => x + clamp(t - x, -rate * dt, rate * dt);
const D2R = Math.PI / 180;
export const OAT = 15; // deg C, ISA sea level day

/* Approximate reference figures shown in the UI */
export const REF = {
  apuStart: 40, apuStartFast: 16, irsAlign: 45, irsAlignFast: 15, irsReal: '6–10 min',
  idleN1: [19.6, 20.2], idleN2: [58.6, 59.3], idleEGT: [418, 436], idleFF: [292, 304],
  startEGTLimit: 725, startValveCut: 50, ignN2: 16, fuelN2: 18, revMaxN1: 72
};

/* switch positions for a secured ("cold & dark") aircraft at the stand */
export function coldSwitches() {
  return {
    bat1: false, bat2: false, extPwr: false, gen1: true, gen2: true, apuGen: true, busTie: true, acEssFeed: true, galy: true, idg1: true, idg2: true, commercial: true,
    irs1: 'OFF', irs2: 'OFF', irs3: 'OFF', ir1: true, ir2: true, ir3: true,
    pL1: false, pL2: false, pC1: false, pC2: false, pR1: false, pR2: false, xfeed: false, fuelMode: true,
    hEng1: true, hEng2: true, hElec: true, ptu: true, ratMan: false,
    pack1: true, pack2: true, apuBleed: false, eBleed1: true, eBleed2: true, xbleed: 'AUTO', ramAir: false, hotAir: true, packFlow: 1,
    apuMaster: false,
    fireGuard1: false, fireGuardApu: false, fireGuard2: false, firePb1: false, firePbApu: false, firePb2: false,
    beacon: 0, navLogo: 0, strobe: 0, wingLt: 0, landL: 0, landR: 0, nose: 0, rwyTurn: 0,
    seatBelts: 0, noSmoking: 0, emerExit: 0,
    wingAI: false, eng1AI: false, eng2AI: false, probeHeat: false,
    pressMan: false, ditching: false, ldgElev: 0,
    crewOxy: false, paxOxy: false, maskMan: false,
    annLt: 1, dome: 0, wiperL: 0, wiperR: 0, intLtOvhd: 1,
    manStart1: false, manStart2: false,
    master1: false, master2: false, engMode: 'NORM', thr1: 0, thr2: 0, parkBrk: true, flaps: 0, spdBrk: 0,
    sdManual: null, xpdr: 1, autoBrk: 0,
    // glareshield autopilot panel (FCU) and EFIS control panels
    ap1: false, ap2: false, athr: false, loc: false, appr: false, exped: false, altInc: 1000,
    fdL: true, fdR: true, lsL: false, lsR: false, ovlL: null, ovlR: null, ndModeL: 'ARC', ndModeR: 'ARC', ndRangeL: 10, ndRangeR: 10,
    baroUnitL: 'hPa', baroUnitR: 'hPa', adf1L: 'OFF', adf2L: 'OFF', adf1R: 'OFF', adf2R: 'OFF',
    // radio panels, transponder, sidestick (flight control check)
    rmpOn1: true, rmpOn2: true, rmpSel1: 'VHF1', rmpSel2: 'VHF2', altRptg: true, stickL: 'NEUTRAL',
    gearLever: 'DN'
  };
}

function engState(i) {
  return { i, n1: 0, n2: 0, egt: OAT + 8, ff: 0, oilP: 0, oilT: OAT + 5, oilQ: 15.5 - i * 0.6, sv: false, ign: '', phase: 'OFF', fuelOn: false, lit: false, running: false,
    fadec: false, fire: false, firePersist: false, man: false, crank: false, fireOutT: -1, fault: '', startT: 0, fuelT: 0, abortT: 0, noAirT: 0, vib1: 0, vib2: 0, egtMax: 0, agents: [{ disch: false }, { disch: false }], pbT: -1 };
}

export function createSystems(opt = {}) {
  const sys = { t: 0, fast: !!opt.fast, gpu: opt.gpu !== false, acc: 0, events: [], sw: coldSwitches(), st: null, fireInject: null };

  function freshState() {
    return {
      elec: { dcBat: false, dc1: false, dc2: false, dcEss: false, dc: false, ac1: false, ac2: false, acEss: false, ac: false, src1: '', src2: '', batV: [25.7, 25.6], batA: [0, 0], extAvail: sys.gpu, extOn: false, apuGenOn: false, apuGenAvail: false, genOn: [false, false], gpuGoneT: -1, essInv: false },
      apu: { n: 0, egt: OAT + 4, flap: 0, phase: 'OFF', avail: false, startReq: false, t: 0, availT: -1, bleedUsed: 0, cool: 0, fault: '', ff: 0, fireOut: false, agent: { disch: false } },
      irs: [0, 1, 2].map(() => ({ mode: 'OFF', test: 0, prog: 0, aligned: false, att: false, attT: 0 })),
      onBat: false,
      fuel: { L: 3650, C: 1850, R: 3650, run: {}, pressL: false, pressR: false, xOpen: 0, used: [0, 0], apuUsed: 0 },
      hyd: { p: [0, 0, 0], ptu: false, accu: 2900, brakeL: 2000, brakeR: 2000 },
      bleed: { apuValve: 0, apuP: 0, xValve: 0, engValve: [false, false], engP: [0, 0], duct: [0, 0], pack: [0, 0] },
      eng: [engState(0), engState(1)],
      fireTest: { eng1: 0, apu: 0, eng2: 0 }, testsDone: { eng1: false, apu: false, eng2: false }, annTestDone: false,
      alerts: [], memos: [], master: { warn: false, caut: false, crc: false }, ack: new Set(), seen: new Set(),
      sdPage: 'ELEC', sdAuto: 'ELEC', sdLastAuto: '',
      ignAlt: 0, fireT: -1, firePbT: -1, ackFire: false,
      av: createAvionics(),
      press: { cabAlt: FIELD_ELEV, dp: 0, vs: 0, outflow: 1, safety: 0 },
      cond: { sel: [22, 23, 23], zone: [26.4, 25.2, 25.8], duct: [26.4, 25.2, 25.8], packOut: [OAT + 4, OAT + 4], hotValve: 0 },
      doors: { fwdL: 1, bridge: true, t: -1 },
      brakes: { temp: [68, 74, 61, 70] },
      fctl: { elev: [-12, -12], ail: [-6, -6], spl: [[0, 0, 0, 0], [0, 0, 0, 0]], rud: 0, seen: {} },
      fdm: null, af: createAutoflight(), inp: { pitch: 0, roll: 0, rudder: 0, tiller: 0, brakeL: 0, brakeR: 0 },
      toCfg: { testT: -99, faults: [], warn: false }, chronoT: -1, stopBar: true, rtoInject: null, callouts: {},
      mon: { taxiMax: 0, taxiOverT: 0, stopBarRun: false, held: 0, atHold: false, cleared: false, toCl: { max: 0, sum: 0, n: 0 }, rot: null, liftoff: null, flapOver: 0, gearOver: 0, reject: null, stopRemain: null, onRunway: false, lined: false,
        app: { gates: {}, maxLoc: 0, maxGs: 0, below: false, raLast: 9999, apLow: false, p50: null, p30: null }, td: null, roll: null, ga: null, tin: { max: 0, overT: 0, atStand: false, vacated: false } },
      ils: null, gaInject: null
    };
  }
  sys.st = freshState();
  const fdm = createFDM(); sys.st.fdm = fdm; sys.st.brakes = { temp: fdm.brakeT };
  const emit = (type, data = {}) => sys.events.push({ type, ...data, t: sys.t });

  /* ---------------- initial states ---------------- */
  sys.reset = (kind = 'cold', opts = {}) => {
    if (sys.cl && !opts.keepChecklists) { sys.cl.reset(); sys.clGate = null; }
    sys.t = 0; sys.acc = 0; sys.events.length = 0; sys.fireInject = null;
    sys.sw = coldSwitches(); sys.st = freshState();
    sys.wx = { from: WIND.from, kt: WIND.kt, wet: false, temp: OAT, ...(opts.wx || {}) };
    sys.st.fdm = fdm; fdm.reset(kind === 'lineup' ? 'lineup' : 'park'); sys.st.brakes = { temp: fdm.brakeT };
    if (kind === 'beforeStart' || kind === 'stand' || kind === 'lineup' || kind === 'approach') beforeStart();
    if (kind === 'stand' || kind === 'lineup' || kind === 'approach') enginesRunning(kind);
    if (kind === 'approach') inTheAir(opts.air || {});
    sys.kind = kind;
    update(0);
  };
  function beforeStart() {
    const w = sys.sw, s = sys.st;
    Object.assign(w, { bat1: true, bat2: true, extPwr: false, irs1: 'NAV', irs2: 'NAV', irs3: 'NAV', crewOxy: true, pL1: true, pL2: true, pC1: true, pC2: true, pR1: true, pR2: true,
      navLogo: 1, seatBelts: 1, noSmoking: 1, emerExit: 1, apuMaster: true, apuBleed: true });
    s.irs.forEach(r => { r.mode = 'NAV'; r.prog = 1; r.aligned = true; r.att = true; });
    Object.assign(s.apu, { n: 100, egt: 470, flap: 1, phase: 'RUN', avail: true, availT: -99, bleedUsed: 1 });
    s.elec.extAvail = false; s.elec.gpuGoneT = 0; s.elec.dcOnT = -100;
    Object.assign(s.bleed, { apuValve: 1, apuP: 36, xValve: 1 });
    s.testsDone = { eng1: true, apu: true, eng2: true }; s.annTestDone = true;
    s.fuel.L = 3560; s.fuel.R = 3600; s.fuel.C = 1850;
    s.eng.forEach(e => { e.oilT = OAT + 6; });
    presetAvionics(s.av);
    Object.assign(w, { fdL: true, fdR: true, athr: false });
  }

  /* engines running at the stand (taxi scenario) or lined up on the runway (rejected take-off) */
  function enginesRunning(kind) {
    const w = sys.sw, s = sys.st;
    Object.assign(w, { apuMaster: false, apuBleed: false, pack1: true, pack2: true, engMode: 'NORM', master1: true, master2: true, beacon: 1, xbleed: 'AUTO' });
    Object.assign(s.apu, { n: 0, egt: OAT + 40, phase: 'OFF', avail: false, bleedUsed: 0 }); Object.assign(s.bleed, { apuValve: 0, apuP: 0, xValve: 0 });
    s.eng.forEach((e, i) => Object.assign(e, { n1: REF.idleN1[i], n2: REF.idleN2[i], egt: REF.idleEGT[i], ff: REF.idleFF[i], oilP: 6 + REF.idleN2[i] * 0.42, oilT: 72, oilQ: 13.3 - i * 0.6, phase: 'RUN', running: true, lit: true, fuelOn: true, fadec: true, vib1: 0.3, vib2: 0.6 }));
    s.hyd.p = [3000, 3000, 3000]; s.hyd.accu = 3000; s.doors.fwdL = 0; s.doors.bridge = false; s.doors.t = -50;
    if (kind === 'lineup') {
      Object.assign(w, { flaps: 1, spdBrk: 1, autoBrk: 3, parkBrk: false, strobe: 2, landL: 2, landR: 2, nose: 2, xpdr: 2, navLogo: 1 });
      s.fdm.flap = 1; s.stopBar = false; s.mon.cleared = true; s.toCfg.testT = -20; s.chronoT = 0;
    }
    for (let i = 0; i < 5; i++) update(DT);
    s.fdm.u = 0;
  }

  /* airborne on the extended centre line of runway 27R (approach scenarios). o: { dist (NM), alt (ft), ias, flap, gear, ap, spdBrk, autoBrk, appr } */
  function inTheAir(o) {
    const w = sys.sw, s = sys.st, Fd = s.fdm, fp = finalPoint(o.dist ?? 12), alt = o.alt ?? 3000;
    Fd.setAir({ x: fp.x, z: fp.z, h: (alt - ELEV_FT) * FT, yaw: fp.yaw, ias: o.ias ?? 220, flap: o.flap || 0, gear: !!o.gear, gamma: o.gamma || 0 });
    Object.assign(w, { parkBrk: false, flaps: o.flap || 0, gearLever: o.gear ? 'DN' : 'UP', spdBrk: o.spdBrk || 0, autoBrk: o.autoBrk || 0, strobe: 2, landL: 2, landR: 2, nose: 0, xpdr: 2, seatBelts: 1,
      thr1: 1, thr2: 1, athr: o.athr !== false, ap1: !!(o.ap ?? true), fdL: o.fd !== false, fdR: o.fd !== false, lsL: !!o.ls, lsR: !!o.ls, appr: !!o.appr, ndModeL: o.ls ? 'LS' : 'ARC' });
    presetArrival(s.av, o);
    const F = s.av.fcu; Object.assign(F, { alt: o.fcuAlt ?? Math.round(alt / 100) * 100, altMan: true, hdg: 274, hdgMan: false, spd: Math.round(o.ias ?? 220), spdMan: o.managed !== false, vsMode: false });
    s.af.phase = o.phase || 'APPR'; s.af.vert = o.vert || 'ALT'; s.af.lat = 'HDG';
    s.stopBar = false; s.mon.cleared = true; s.doors.fwdL = 0; s.doors.bridge = false; s.toCfg.testT = -100; s.chronoT = -1;
    s.eng.forEach((e, i) => { e.n1 = 52; e.n2 = REF.idleN2[i] + (52 - REF.idleN1[i]) * 0.52; });
  }
  sys.inTheAir = inTheAir;

  /* ---------------- momentary actions ---------------- */
  sys.press = (id) => {
    const s = sys.st, w = sys.sw, dc = s.elec.dc;
    if (id === 'apuStart') { if (w.apuMaster && dc && !s.apu.avail && s.apu.phase !== 'COOL' && s.apu.phase !== 'SPOOL') { s.apu.startReq = true; emit('apuStartReq'); } return; }
    if (id === 'masterWarn') { for (const a of s.alerts) if (a.lvl === 'W') s.ack.add(a.id); s.master.warn = false; s.master.crc = false; if (s.eng.some(e => e.fire)) s.ackFire = true; return; }
    if (id === 'masterCaut') { for (const a of s.alerts) if (a.lvl === 'C') s.ack.add(a.id); s.master.caut = false; return; }
    if (id === 'toConfig') { if (!s.elec.ac) return; s.toCfg.testT = sys.t; s.toCfg.faults = toConfigFaults(); s.toCfg.tested = true; emit(s.toCfg.faults.length ? 'toConfigBad' : 'toConfigOk'); return; }
    if (id === 'push') { if (w.beacon && s.fdm.startPush()) { s.mon.pushCalled = true; } else emit('pushRefused', { why: w.beacon ? 'not now' : 'beacon off' }); return; }
    if (id === 'chrono') { s.chronoT = sys.t; return; }
    if (id === 'test1' || id === 'testApu' || id === 'test2') { if (!dc) return; const k = id === 'test1' ? 'eng1' : id === 'test2' ? 'eng2' : 'apu'; s.fireTest[k] = 3.2; return; }
    const m = /^agent(1|2|Apu)_(\d)$/.exec(id);
    if (m) {
      if (!dc) return;
      if (m[1] === 'Apu') { if (w.firePbApu && !s.apu.agent.disch) { s.apu.agent.disch = true; emit('agent', { which: 'APU' }); } return; }
      const e = s.eng[+m[1] - 1], ag = e.agents[+m[2] - 1];
      if (w['firePb' + m[1]] && !ag.disch) {
        ag.disch = true; ag.t = sys.t; emit('agent', { which: id });
        if (e.fire) e.agentHit = (e.agentHit || 0) + 1;
      }
    }
  };
  sys.setSwitch = (id, v) => {
    const w = sys.sw, s = sys.st;
    if (!(id in w)) return false;
    const old = w[id]; w[id] = v;
    if (id === 'firePb1' || id === 'firePb2' || id === 'firePbApu') {
      if (v && !old) { s.firePbT = sys.t; s.master.crc = false; if (id !== 'firePbApu') s.eng[id === 'firePb1' ? 0 : 1].pbT = sys.t; for (const a of s.alerts) if (a.lvl === 'W') s.ack.add(a.id); s.master.warn = false; if (s.eng.some(e => e.fire)) s.ackFire = true; }
    }
    if (id === 'annLt' && v === 2 && s.elec.dc) s.annTestDone = true;
    if (id === 'apuMaster' && !v) s.apu.startReq = false;
    if (['ap1', 'ap2', 'athr', 'loc', 'appr'].includes(id) && !fcuRule(sys, id, v)) { w[id] = old; emit('reject', { id }); return false; }
    return true;
  };

  /* ---------------- step ---------------- */
  sys.update = (dt) => {
    sys.acc += dt; let n = 0;
    while (sys.acc >= DT && n < 40) { update(DT); sys.acc -= DT; n++; }
    if (n >= 40) sys.acc = 0;
  };
  sys.advance = (sec) => { const N = Math.round(sec / DT); for (let i = 0; i < N; i++) update(DT); };
  const K = () => (sys.fast ? 0.4 : 1);

  function update(dt) {
    sys.t += dt;
    electrics(dt); irs(dt); apu(dt); bleed(dt); engines(dt); fuel(dt); hyd(dt); fire(dt); motion(dt); cabin(dt); fctl(dt); avUpdate(sys); monitor(dt); alerts(dt); pages(); if (sys.cl) sys.cl.update();
  }

  function electrics(dt) {
    const w = sys.sw, s = sys.st, E = s.elec, A = s.apu;
    // ground power: crew removes it ~10 s after the beacon goes on, once the aircraft no longer uses it
    if (E.extAvail && w.beacon && !w.extPwr) { if (E.gpuGoneT < 0) E.gpuGoneT = sys.t + 10; if (sys.t >= E.gpuGoneT) { E.extAvail = false; emit('gpuOff'); } }
    else if (E.extAvail) E.gpuGoneT = -1;
    E.extOn = w.extPwr && E.extAvail;
    for (const i of [0, 1]) { const e = s.eng[i]; E.genOn[i] = w['gen' + (i + 1)] && e.n2 > 55 && e.lit && !w['firePb' + (i + 1)]; }
    E.apuGenAvail = A.avail && A.n > 95 && !w.firePbApu;
    E.apuGenOn = false;
    const tie = w.busTie;
    const pick = (own) => {
      if (E.genOn[own]) return 'GEN ' + (own + 1);
      if (!tie) return '';
      if (E.extOn) return 'EXT PWR';
      if (E.apuGenAvail && w.apuGen) return 'APU GEN';
      if (E.genOn[1 - own]) return 'GEN ' + (2 - own);
      return '';
    };
    E.src1 = pick(0); E.src2 = pick(1);
    E.apuGenOn = E.src1 === 'APU GEN' || E.src2 === 'APU GEN';
    E.ac1 = !!E.src1; E.ac2 = !!E.src2; E.ac = E.ac1 || E.ac2; E.acEss = E.ac;
    E.dc1 = E.ac1; E.dc2 = E.ac2;
    const batOn = w.bat1 || w.bat2;
    E.dcBat = batOn || E.ac; E.dcEss = E.dcBat; E.dc = E.dcBat || E.dc1 || E.dc2;
    E.essInv = batOn && !E.ac;
    if (E.dc && E.dcOnT == null) E.dcOnT = sys.t; if (!E.dc) E.dcOnT = null; // essential displays from the batteries through the static inverter (generic)
    // batteries: open-circuit ~25.6 V; charging ~28 V; discharging under load, deep dip while the APU starter turns on batteries
    for (const i of [0, 1]) {
      const on = i === 0 ? w.bat1 : w.bat2, oc = 25.7 - i * 0.12;
      let vT = oc, aT = 0;
      if (on && E.ac) { vT = 28.1; aT = 6 + 30 * Math.exp(-(sys.t - (E['chgT' + i] ?? sys.t)) / 25); }
      else if (on) { aT = -(18 + (A.phase === 'START' && A.n < 60 ? 170 : 0) + (s.eng.some(e => e.phase === 'START') ? 40 : 0)); vT = oc - 0.6 + aT * 0.012; }
      if (on && E.ac && E['chgT' + i] == null) E['chgT' + i] = sys.t;
      if (!(on && E.ac)) E['chgT' + i] = null;
      E.batV[i] = lag(E.batV[i], vT, 0.8, dt); E.batA[i] = lag(E.batA[i], aT, 0.5, dt);
    }
  }

  function irs(dt) {
    const w = sys.sw, s = sys.st, E = s.elec;
    const powered = E.dcBat || E.ac;
    const T = (sys.fast ? REF.irsAlignFast : REF.irsAlign);
    s.irs.forEach((r, i) => {
      const mode = w['irs' + (i + 1)];
      if (mode === 'OFF' || !powered) { if (r.mode !== 'OFF') emit('irsOff', { i }); Object.assign(r, { mode: 'OFF', prog: 0, aligned: false, att: false, test: 0, attT: 0 }); return; }
      if (r.mode === 'OFF') r.test = 4; // self-test, runs on the battery first
      r.mode = mode;
      if (r.test > 0) { r.test -= dt; return; }
      if (mode === 'NAV') { if (!r.aligned) { r.prog = Math.min(1, r.prog + dt / T); if (r.prog >= 1) { r.aligned = true; emit('irsAligned', { i }); } } r.att = r.prog > 0.35 || r.aligned; }
      else { r.attT += dt; r.att = r.attT > 20 * K() || r.aligned; }
    });
    s.onBat = powered && s.irs.some(r => r.mode !== 'OFF' && (r.test > 0 || !E.ac));
  }

  function apu(dt) {
    const w = sys.sw, s = sys.st, A = s.apu, E = s.elec;
    const dc = E.dcBat;
    const k = K();
    const flapT = 12 * k, startT = (sys.fast ? REF.apuStartFast : REF.apuStart);
    const wantRun = w.apuMaster && dc && !w.firePbApu;
    // intake flap
    const flapTarget = (w.apuMaster && dc) || A.n > 7 ? 1 : 0;
    A.flap = towards(A.flap, flapTarget, 1 / flapT, dt);
    switch (A.phase) {
      case 'OFF':
        A.avail = false;
        if (wantRun) A.phase = 'FLAP';
        break;
      case 'FLAP':
        if (!wantRun) { A.phase = A.n > 1 ? 'SPOOL' : 'OFF'; A.startReq = false; break; }
        if (A.startReq && A.flap >= 1) { A.phase = 'START'; A.t = 0; A.availT = -1; emit('apuStarter'); }
        break;
      case 'START': {
        if (!wantRun) { A.phase = 'SPOOL'; A.startReq = false; break; }
        A.t += dt; const p = clamp(A.t / startT, 0, 1);
        const curve = p < 0.1 ? p / 0.1 * 8 : 8 + 92 * (1 - Math.pow(1 - (p - 0.1) / 0.9, 1.7));
        A.n = Math.max(A.n, curve);
        if (A.n >= 95) { if (A.availT < 0) A.availT = sys.t + 2 * k; if (sys.t >= A.availT) { A.phase = 'RUN'; A.avail = true; A.startReq = false; A.availAt = sys.t; emit('apuAvail'); } }
        break;
      }
      case 'RUN':
        A.n = lag(A.n, 100, 1.2, dt);
        if (!wantRun) { A.avail = false; A.phase = A.bleedUsed > 0 && !w.firePbApu ? 'COOL' : 'SPOOL'; A.cool = 60 * k; emit('apuStop'); }
        break;
      case 'COOL':
        A.cool -= dt; A.n = lag(A.n, 100, 1, dt);
        if (w.firePbApu || A.cool <= 0) A.phase = 'SPOOL';
        if (w.apuMaster && dc && !w.firePbApu && A.cool > 0) { /* re-selected during cooldown: keep running */ A.phase = 'RUN'; A.avail = true; }
        break;
      case 'SPOOL':
        A.avail = false;
        A.n = Math.max(0, A.n - dt * (A.n / 7 + 0.4));
        if (A.n <= 0.01) { A.n = 0; A.phase = 'OFF'; A.bleedUsed = 0; A.availT = -1; }
        if (wantRun && A.n < 1) A.phase = 'FLAP';
        break;
    }
    // EGT: light-off around 7 % N, peak during acceleration, settles ~ 450 C (approximate)
    let egtT = OAT + 4;
    const burning = (A.phase === 'START' && A.n > 7) || A.phase === 'RUN' || A.phase === 'COOL';
    if (A.phase === 'START' && A.n > 7) egtT = OAT + 400 * (A.n / 100) + 700 * Math.exp(-Math.pow((A.n - 38) / 20, 2));
    else if (burning) egtT = 425 + (s.bleed.apuValve > 0.5 ? 25 + 12 * s.bleed.pack.reduce((a, b) => a + b, 0) : 0) + (E.apuGenOn ? 20 : 0);
    else if (A.n > 1) egtT = Math.max(OAT + 4, A.egt - 30);
    A.egt = lag(A.egt, egtT, burning ? 1.6 : 6, dt);
    A.ff = burning ? (A.phase === 'START' ? 40 + A.n * 0.9 : 115 + (s.bleed.apuValve > 0.5 ? 35 : 0)) : 0;
    if (s.bleed.apuValve > 0.5) A.bleedUsed = 1;
    E.apuGenAvail = A.avail && A.n > 95 && !w.firePbApu;
  }

  function bleed(dt) {
    const w = sys.sw, s = sys.st, B = s.bleed, A = s.apu;
    const apuOk = w.apuBleed && A.avail && A.n > 95 && !w.firePbApu && s.elec.dc;
    B.apuValve = towards(B.apuValve, apuOk ? 1 : 0, 0.6, dt);
    const xT = w.xbleed === 'OPEN' || (w.xbleed === 'AUTO' && B.apuValve > 0.5) ? 1 : 0;
    B.xValve = towards(B.xValve, s.elec.dc ? xT : B.xValve, 0.5, dt);
    for (const i of [0, 1]) {
      const e = s.eng[i];
      B.engValve[i] = w['eBleed' + (i + 1)] && e.n2 > 45 && e.lit && !w['firePb' + (i + 1)] && B.apuValve < 0.5;
      B.engP[i] = B.engValve[i] ? 42 * clamp((e.n2 - 40) / 18, 0, 1) + 0.15 * Math.max(0, e.n2 - 58) : 0;
    }
    const xo = B.xValve > 0.5;
    const packOn = [0, 1].map(i => w['pack' + (i + 1)]);
    // supply pressure per side before pack/starter consumption
    const srcL = Math.max(B.engP[0], B.apuValve > 0.5 ? 40 * B.apuValve : 0, xo ? B.engP[1] : 0);
    const srcR = Math.max(B.engP[1], xo ? Math.max(B.engP[0], B.apuValve > 0.5 ? 40 * B.apuValve : 0) : 0);
    const apuFed = B.apuValve > 0.5 && B.engP[0] < 30 && B.engP[1] < 30;
    // consumption: packs and open start valves pull pressure down (strongly when only the APU supplies)
    const draw = (packOn[0] && srcL > 10 ? 1 : 0) + (packOn[1] && srcR > 10 ? 1 : 0);
    const sv = s.eng.filter(e => e.sv).length;
    const drop = apuFed ? draw * 3.6 + sv * 2.5 : draw * 1 + sv * 1.5;
    const tL = Math.max(0, srcL - (srcL > 0 ? drop : 0)), tR = Math.max(0, srcR - (srcR > 0 ? drop : 0));
    B.duct[0] = lag(B.duct[0], tL, 1.2, dt); B.duct[1] = lag(B.duct[1], tR, 1.2, dt);
    B.apuP = B.apuValve > 0.5 ? B.duct[0] : lag(B.apuP, A.avail ? 40 : 0, 1, dt) * (A.avail ? 1 : 0);
    for (const i of [0, 1]) B.pack[i] = lag(B.pack[i], packOn[i] && B.duct[i] > 12 && s.elec.dc ? 1 : 0, 1.5, dt);
  }

  function engines(dt) {
    const w = sys.sw, s = sys.st, B = s.bleed, E = s.elec;
    const k = K(), spd = sys.fast ? 2 : 1;
    s.eng.forEach((e, i) => {
      const n = i + 1, master = w['master' + n], pbOut = w['firePb' + n];
      const fuelAvail = master && !pbOut;
      e.fadec = E.dc && (w.engMode !== 'NORM' || master || e.n2 > 5);
      // N1 command from the thrust lever (or the autothrust within the lever limit); thrust follows N1 with spool-up lag
      const Fd = s.fdm, af = s.af, L = w['thr' + n];
      let n1Cmd = leverN1(Math.max(0, L), REF.idleN1[i], s.av.fms.flex, Fd.alt);
      if (af.athrActive && af.n1c != null) n1Cmd = Math.max(REF.idleN1[i], Math.min(n1Cmd, af.n1c + (REF.idleN1[i] - 20) * 0));
      // thrust reverser: lever below idle, on the ground only; the doors take about 1.5 s, then reverse N1 follows the lever
      const revTgt = L < -0.02 && (Fd.onGround || Fd.ra < 3) && e.running ? 1 : 0, rev0 = e.rev || 0;
      e.rev = towards(rev0, revTgt, 1 / 1.5, dt);
      if (rev0 < 1 && e.rev >= 1) emit('revDeployed', { i }); if (rev0 === 0 && e.rev > 0) emit('revUnlock', { i });
      if (L < -0.02) n1Cmd = e.rev >= 0.98 ? REF.idleN1[i] + (REF.revMaxN1 - REF.idleN1[i]) * Math.min(1, -L) : REF.idleN1[i];
      else if (e.rev > 0.02) n1Cmd = REF.idleN1[i];
      e.n1Cmd = n1Cmd;
      const tl = clamp((e.n1 - REF.idleN1[i]) / (92 - REF.idleN1[i]), 0, 1.05);
      const duct = B.duct[i];
      const f = clamp((duct - 14) / 22, 0.25, 1.1);
      const idleN2 = REF.idleN2[i], idleN1 = REF.idleN1[i];
      // phase machine
      // manual start: MAN START pb with the mode selector at IGN/START (or CRANK: dry motoring) opens the start valve;
      // the crew sets the MASTER on by hand. Limited automatic protection: the crew monitors and aborts.
      const manSel = w['manStart' + n] && (w.engMode === 'IGN' || w.engMode === 'CRANK');
      if (e.phase === 'OFF' || e.phase === 'SPOOL') {
        const auto = fuelAvail && w.engMode === 'IGN' && !w['manStart' + n];
        if ((manSel || auto) && E.dc && e.n2 < 25 && !e.fault) { e.phase = 'START'; e.man = !auto; e.startT = 0; e.fuelT = 0; e.lit = false; e.fuelOn = false; e.noAirT = 0; e.egtMax = e.egt; e.ignCh = (s.ignAlt++ % 2) ? 'B' : 'A'; emit('engStart', { i, man: e.man }); }
      }
      if (e.phase === 'START') {
        e.startT += dt; e.crank = e.man && w.engMode === 'CRANK';
        const stop = e.man ? (!manSel && !e.lit) || (e.lit && !fuelAvail) || (!fuelAvail && e.fuelOn) : !fuelAvail;
        if (stop) { e.phase = 'SPOOL'; e.sv = false; e.fuelOn = false; e.ign = ''; e.lit = false; e.man = false; emit('engStop', { i }); }
        else {
          e.sv = (!e.man || manSel) && e.n2 < REF.startValveCut && duct > 18 && E.dc;
          if (!e.man) { if (!e.sv && e.n2 < 10) { e.noAirT += dt; if (e.noAirT > 20) { abort(e, 'NO START AIR'); } } else e.noAirT = 0; }
          e.ign = !e.crank && fuelAvail && (e.man || e.n2 >= REF.ignN2) && e.n2 < REF.startValveCut ? e.ignCh : '';
          if (fuelAvail && !e.crank && e.n2 >= REF.fuelN2 && !e.fuelOn) { e.fuelOn = true; e.fuelT = 0; emit('engFuel', { i }); }
          if (e.fuelOn) { e.fuelT += dt; if (!e.lit && e.fuelT > 2.6 * k && e.ign) { e.lit = true; emit('engLightOff', { i }); } if (!e.lit && e.fuelT > 15) { if (e.man) e.fault = 'NO LIGHT-OFF'; else abort(e, 'NO LIGHT-OFF'); } }
          if (e.phase === 'START' && e.lit && e.n2 >= idleN2 - 0.8) { e.phase = 'RUN'; e.running = true; e.ign = ''; e.sv = false; e.fault = ''; emit('engStable', { i }); }
          if (e.egt > REF.startEGTLimit) { if (e.man) e.fault = 'EGT OVER LIMIT'; else abort(e, 'EGT OVER LIMIT'); }
        }
      } else if (e.phase === 'RUN') {
        e.sv = false; e.ign = ''; e.man = false;
        if (!fuelAvail) { e.phase = 'SPOOL'; e.running = false; e.fuelOn = false; e.lit = false; emit('engStop', { i }); }
      } else if (e.phase === 'ABORT') {
        e.abortT -= dt; e.sv = e.abortT > 0 && duct > 18; e.fuelOn = false; e.lit = false; e.ign = '';
        if (e.abortT <= 0) e.phase = 'SPOOL';
      }
      if (e.phase === 'SPOOL' || e.phase === 'OFF') { e.sv = false; e.ign = ''; e.fuelOn = false; e.lit = false; e.running = false; }
      if (!master && e.fault) e.fault = '';
      // spool dynamics
      if (e.sv && !e.lit) e.n2 += dt * spd * 1.75 * f * Math.max(0, 1 - e.n2 / 27);
      else if (e.lit && e.phase === 'START') {
        if (e.n2 < REF.startValveCut) e.n2 += dt * spd * 1.25 * (0.55 + 0.45 * (e.sv ? f : 0.3)) * Math.pow(Math.max(0.02, 1 - e.n2 / 62), 0.75) * 1.9;
        else e.n2 = lag(e.n2, idleN2, 3.6 / spd, dt);
      } else if (e.phase === 'RUN') { const up = e.n1Cmd > e.n1; e.n1 = up ? Math.min(e.n1Cmd, e.n1 + dt * (2.4 + 0.11 * (e.n1 - 20))) : lag(e.n1, e.n1Cmd, 1.6, dt); e.n2 = lag(e.n2, idleN2 + (e.n1 - idleN1) * 0.52, 0.6, dt); }
      else e.n2 = Math.max(0, e.n2 - dt * (e.n2 / 9 + 0.25));
      if (e.n2 < 0.05 && e.phase === 'SPOOL') { e.n2 = 0; e.phase = 'OFF'; }
      // N1 follows N2 once the core is burning
      const n1T = e.lit ? (e.phase === 'RUN' ? idleN1 + tl * 64 : idleN1 * Math.pow(clamp((e.n2 - 20) / (idleN2 - 20), 0, 1), 1.5)) : Math.max(0, e.n2 * 0.05 - 0.3);
      if (e.phase !== 'RUN') e.n1 = lag(e.n1, n1T, e.lit ? 1.6 : 5, dt);
      e.thrust = e.running || e.phase === 'SPOOL' ? thrustOf(e.n1, ELEV_FT * FT + Fd.h, Fd.tas * KT / 340) * (e.n1 > idleN1 - 3 ? 1 : 0.3) * (1 - 1.45 * (e.rev || 0)) : 0;
      // EGT: rise at light-off, start peak, then idle (approximate)
      const peak = 595 + (1 - clamp(f, 0, 1)) * 230;
      let egtT;
      if (e.lit) {
        if (e.phase === 'START') { const sN = clamp((e.n2 - 18) / 40, 0, 1); const base = (OAT + 150) + (REF.idleEGT[i] - OAT - 150) * sN; const at34 = (OAT + 150) + (REF.idleEGT[i] - OAT - 150) * 0.4; egtT = base + (peak - at34) * Math.exp(-Math.pow((e.n2 - 34) / 10, 2)); }
        else egtT = REF.idleEGT[i] + tl * 420;
      } else egtT = Math.max(OAT + 6, OAT + (e.egt - OAT) * 0.0);
      e.egt = lag(e.egt, egtT, e.lit ? 2.2 : 14, dt);
      e.egtMax = Math.max(e.egtMax, e.egt);
      // fuel flow
      const ffT = e.fuelOn ? (e.lit ? (e.phase === 'RUN' ? REF.idleFF[i] + Math.pow(tl, 1.4) * 2900 : 240 + clamp(e.n2 - 20, 0, 40) * 2.2) : 200) : 0;
      e.ff = lag(e.ff, ffT, 0.8, dt);
      e.oilP = lag(e.oilP, e.n2 > 3 ? 6 + e.n2 * 0.42 : 0, 1.5, dt);
      e.oilT = lag(e.oilT, e.running ? 72 : e.n2 > 5 ? e.oilT + 2 : OAT + 6, e.running ? 120 : 400, dt);
      e.oilQ = lag(e.oilQ, (15.5 - i * 0.6) - (e.n2 > 20 ? 2.2 : 0), 8, dt);
      e.vib1 = e.n1 > 5 ? 0.3 + i * 0.1 : 0; e.vib2 = e.n2 > 10 ? 0.6 + i * 0.1 : 0;
      // fire injection (training fault)
      const fi = sys.fireInject;
      if (fi && fi.eng === i && !fi.done && e.phase === 'START' && e.n2 >= fi.n2) { e.fire = true; e.firePersist = !!fi.persist; fi.done = true; s.fireT = sys.t; s.ackFire = false; emit('fire', { i }); }
    });
    function abort(e, why) { e.phase = 'ABORT'; e.fault = why; e.abortT = 12 * k; e.fuelOn = false; e.lit = false; e.ign = ''; emit('engAbort', { i: e.i, why }); }
  }

  function fuel(dt) {
    const w = sys.sw, s = sys.st, F = s.fuel, E = s.elec;
    const ac = E.ac;
    for (const p of ['pL1', 'pL2', 'pC1', 'pC2', 'pR1', 'pR2']) F.run[p] = !!(w[p] && ac && (p[1] !== 'C' || F.C > 20));
    F.xOpen = towards(F.xOpen, w.xfeed && E.dc ? 1 : 0, 0.5, dt);
    const ctr = F.run.pC1 || F.run.pC2;
    F.pressL = F.run.pL1 || F.run.pL2 || ctr; F.pressR = F.run.pR1 || F.run.pR2 || ctr;
    const burn = [s.eng[0].ff, s.eng[1].ff].map(x => x * dt / 3600), apuB = s.apu.ff * dt / 3600;
    const take = (side, kg) => { if (ctr && F.C > 0) { F.C = Math.max(0, F.C - kg); return; } if (F.xOpen > 0.5) { F.L -= kg / 2; F.R -= kg / 2; } else F[side] -= kg; };
    take('L', burn[0]); take('R', burn[1]); take('L', apuB);
    F.used[0] += burn[0]; F.used[1] += burn[1]; F.apuUsed += apuB;
  }

  function hyd(dt) {
    const w = sys.sw, s = sys.st, H = s.hyd, E = s.elec;
    const edp = i => { const e = s.eng[i]; return w['hEng' + (i + 1)] && !w['firePb' + (i + 1)] && e.n2 > 10 ? 3000 * clamp((e.n2 - 10) / 26, 0, 1) : 0; };
    const anyRun = s.eng.some(e => e.running);
    const t = [edp(0), w.hElec && E.ac && anyRun ? 3000 : 0, edp(1)];
    // PTU: transfers power between HYD 1 and HYD 3 when they differ by more than ~500 psi
    const d = H.p[2] - H.p[0];
    const ptuWas = H.ptu;
    H.ptu = w.ptu && E.dc && Math.max(H.p[0], H.p[2]) > 1500 && (Math.abs(d) > 500 || (ptuWas && Math.abs(d) > 150));
    if (H.ptu && !ptuWas) emit('ptu');
    if (H.ptu) { if (d > 0) t[0] = Math.max(t[0], 2950); else t[2] = Math.max(t[2], 2950); }
    for (let i = 0; i < 3; i++) H.p[i] = H.p[i] < t[i] ? lag(H.p[i], t[i], H.ptu ? 0.9 : 0.7, dt) : lag(H.p[i], t[i], 3.5, dt);
    if (H.p[2] > H.accu) H.accu = lag(H.accu, Math.min(3000, H.p[2]), 1, dt);
    const bT = w.parkBrk ? Math.min(H.accu, 2000) : 0;
    H.brakeL = lag(H.brakeL, bT, 0.4, dt); H.brakeR = lag(H.brakeR, bT, 0.4, dt);
  }

  function fire(dt) {
    const w = sys.sw, s = sys.st;
    for (const k of ['eng1', 'apu', 'eng2']) if (s.fireTest[k] > 0) { s.fireTest[k] -= dt; if (s.fireTest[k] <= 0) { s.fireTest[k] = 0; s.testsDone[k] = true; emit('testDone', { k }); } }
    s.eng.forEach((e, i) => {
      if (!e.fire) return;
      const fuelCut = !w['master' + (i + 1)] || w['firePb' + (i + 1)];
      // an agent discharged with the fire pb pushed and the fuel cut puts the fire out a few seconds later (generic training model)
      // (training variant: a persistent fire needs the second bottle)
      const enough = e.firePersist ? e.agents[1].disch : e.agents.some(a => a.disch);
      if (fuelCut && w['firePb' + (i + 1)] && enough && e.fireOutT < 0) e.fireOutT = sys.t + 3;
      if (e.fireOutT > 0 && sys.t >= e.fireOutT) { e.fire = false; e.fireOutT = -1; emit('fireOut', { i }); }
    });
  }

  /* cabin: pressure (on the ground the outflow valve stays open), air conditioning, doors and jet bridge, brakes */
  function cabin(dt) {
    const w = sys.sw, s = sys.st, B = s.bleed, P = s.press, C = s.cond, Dr = s.doors, k = K();
    const flow = B.pack[0] + B.pack[1];
    if (!w.pressMan) P.outflow = lag(P.outflow, s.elec.dc ? 1 : P.outflow, 2, dt);
    const dp = flow * (Dr.fwdL < 0.05 ? 0.012 : 0.003) * (1.15 - P.outflow * 0.5);
    P.dp = lag(P.dp, dp, 4, dt);
    const alt = FIELD_ELEV - P.dp * 2000, vs = (alt - P.cabAlt) / Math.max(dt, 1e-3) * 60;
    P.vs = lag(P.vs, vs, 2, dt); P.cabAlt = alt;
    for (const i of [0, 1]) C.packOut[i] = lag(C.packOut[i], B.pack[i] > 0.5 ? 7 + (w.packFlow === 2 ? -2 : 0) : OAT + 4, 25, dt);
    C.hotValve = towards(C.hotValve, flow > 0.5 && w.hotAir && s.elec.dc ? 1 : 0, 0.4, dt);
    for (let z = 0; z < 3; z++) {
      const tgt = flow > 0.5 ? (C.hotValve > 0.5 ? C.sel[z] : 15) : 27 - z * 0.4, tau = flow > 0.5 ? 220 * k : 1800;
      C.zone[z] = lag(C.zone[z], tgt, tau, dt);
      C.duct[z] = lag(C.duct[z], flow > 0.5 ? (C.hotValve > 0.5 ? C.sel[z] - 4 + (C.sel[z] - C.zone[z]) * 2 : 10) : C.zone[z], 12, dt);
    }
    // the ground crew closes the forward door and pulls the jet bridge back once the beacon is on
    if (w.beacon && Dr.bridge && Dr.t < 0) Dr.t = sys.t;
    if (Dr.t >= 0) { Dr.fwdL = clamp(1 - (sys.t - Dr.t - 2) / 3, 0, 1); if (Dr.bridge && sys.t - Dr.t > 9) { Dr.bridge = false; emit('bridgeOff'); } }

  }
  /* flight controls: surfaces follow the captain's sidestick when hydraulic pressure is there (simplified) */
  function fctl(dt) {
    const s = sys.st, H = s.hyd.p, Fc = s.fctl;
    const ok = i => H[i] > 1450, any = (...ix) => ix.some(ok);
    const { pitch, roll } = sys.stick();
    if (any(0, 1, 2)) { if (pitch > 0.85) Fc.seen.aft = true; if (pitch < -0.85) Fc.seen.fwd = true; if (roll < -0.85) Fc.seen.left = true; if (roll > 0.85) Fc.seen.right = true; }
    Fc.checked = !!(Fc.seen.aft && Fc.seen.fwd && Fc.seen.left && Fc.seen.right);
    const mv = (cur, tgt, pw) => towards(cur, tgt, pw ? 40 : 6, dt);
    const el = pitch > 0 ? 30 * pitch : 15 * pitch;
    Fc.elev[0] = mv(Fc.elev[0], any(0, 1) ? el : -12, any(0, 1)); Fc.elev[1] = mv(Fc.elev[1], any(0, 2) ? el : -12, any(0, 2));
    Fc.ail[0] = mv(Fc.ail[0], any(0, 1) ? -roll * 25 : -6, any(0, 1)); Fc.ail[1] = mv(Fc.ail[1], any(0, 1) ? roll * 25 : -6, any(0, 1));
    for (const sd of [0, 1]) for (let j = 0; j < 4; j++) { const sysI = [0, 2, 1, 2][j], up = (sd === 0 ? roll < 0 : roll > 0) ? 35 * Math.abs(roll) : 0; Fc.spl[sd][j] = mv(Fc.spl[sd][j], ok(sysI) ? up : 0, true); }
    Fc.rud = mv(Fc.rud, (s.inp.rudder || 0) * 25, any(0, 1, 2));
    if (s.fdm.spoiler > 0.05) for (const sd of [0, 1]) for (let j = 0; j < 4; j++) Fc.spl[sd][j] = Math.max(Fc.spl[sd][j], 40 * s.fdm.spoiler);
  }

  /** effective stick: continuous pilot input, or the clicked check positions of the 3D stick */
  sys.stick = () => { const i = sys.st.inp, v = sys.sw.stickL; if (Math.abs(i.pitch) > 0.02 || Math.abs(i.roll) > 0.02) return { pitch: i.pitch, roll: i.roll }; return { pitch: v === 'AFT' ? 1 : v === 'FWD' ? -1 : 0, roll: v === 'LEFT' ? -1 : v === 'RIGHT' ? 1 : 0 }; };
  function toConfigFaults() {
    const w = sys.sw, s = sys.st, f = [];
    if (w.flaps < 1 || w.flaps > 3) f.push('FLAPS NOT IN T.O CONFIG');
    if (w.spdBrk > 1) f.push('SPD BRK NOT RETRACTED');
    if (Math.max(...s.fdm.brakeT) > 300) f.push('BRAKES HOT');
    if (w.parkBrk && s.toCfg.atThrust) f.push('PARK BRK ON');
    return f;
  }
  /* aircraft motion: pilot inputs + autoflight → flight model; gear and flaps follow their levers */
  function motion(dt) {
    const w = sys.sw, s = sys.st, Fd = s.fdm, i = s.inp;
    const g = autoflight(sys, dt);
    const st = sys.stick();
    const thrIdle = w.thr1 < 0.05 && w.thr2 < 0.05;
    Fd.step(dt, { T: [s.eng[0].thrust || 0, s.eng[1].thrust || 0], pitch: st.pitch, roll: st.roll, rudder: i.rudder, tiller: i.tiller, brakeL: i.brakeL, brakeR: i.brakeR,
      park: w.parkBrk && s.hyd.accu > 500, flapLever: w.flaps, gearDown: w.gearLever !== 'UP', spoilerArmed: w.spdBrk === 1, sbLever: w.spdBrk >= 2 ? (w.spdBrk - 1) / 2 : 0, autoBrk: w.autoBrk, thrIdle, ap: g.ap,
      wind: sys.wx || WIND, wet: !!(sys.wx && sys.wx.wet), toga: Math.max(w.thr1, w.thr2) >= 1.94 });
    for (const e of Fd.events) emit(e.type, e); Fd.events.length = 0;
    if (w.gearLever === 'UP' && Fd.onGround) w.gearLever = 'DN';      // gear lever is locked down on the ground
    // take-off thrust with a wrong configuration: red T.O CONFIG warning
    s.toCfg.atThrust = Fd.onGround && Math.min(w.thr1, w.thr2) >= 1.94;
    s.toCfg.live = s.toCfg.atThrust ? toConfigFaults() : [];
  }
  /* scoring and guidance data: taxi speed, stop bar, centre-line, rotation, limits, rejected take-off; callouts */
  function monitor(dt) {
    const w = sys.sw, s = sys.st, Fd = s.fdm, M = s.mon, sn = toSN(Fd.x, Fd.z), C = s.callouts;
    const onRwy = Math.abs(sn.n - RWY.n) < RWY.w / 2 + 3 && sn.s > RWY.s0 - 30 && sn.s < RWY.s1;
    M.onRunway = onRwy; M.sn = sn;
    M.lined = onRwy && Math.abs(sn.n - RWY.n) < 4 && Math.abs(((Fd.hdg - 274 + 540) % 360) - 180) < 6;
    if (Fd.onGround && !onRwy) { M.taxiMax = Math.max(M.taxiMax, Fd.gs); if (Fd.gs > 30) M.taxiOverT += dt; }
    // nose gear position against the stop bar
    const nose = { x: Fd.x - Math.sin(Fd.yaw) * 12.6, z: Fd.z - Math.cos(Fd.yaw) * 12.6 }, ns = toSN(nose.x, nose.z);
    M.nose = ns;
    const nearHold = Math.abs(ns.s - HOLD.s) < 14;
    if (nearHold && ns.n > HOLD.n - 25 && ns.n < HOLD.n) { M.atHold = Fd.gs < 1; M.held = M.atHold ? M.held + dt : 0; } else { M.atHold = false; M.held = 0; }
    if (s.stopBar && nearHold && ns.n >= HOLD.n && ns.n < HOLD.n + 20 && !M.stopBarRun) { M.stopBarRun = true; emit('stopBarRun'); }
    if (s.stopBar && M.held > 2 && (!sys.clGate || sys.clGate())) { s.stopBar = false; M.cleared = true; emit('cleared'); }   // cleared once stopped (and, in checklist scenarios, the BEFORE TAKE-OFF checklist is done to the line)
    const route = nearest(TAXI_PATH, sn.s, sn.n); M.route = route;
    // take-off roll: centre-line, callouts, rotation, lift-off, limits
    const v1 = s.av.fms.v1 || 135, vr = s.av.fms.vr || 140, toRoll = Fd.onGround && onRwy && Math.min(w.thr1, w.thr2) >= 0.9;
    if (Fd.onGround && onRwy && Fd.gs > 30) { const d = Math.abs(sn.n - RWY.n); M.toCl.max = Math.max(M.toCl.max, d); M.toCl.sum += d * d; M.toCl.n++; }
    if (!Fd.landed && (toRoll || (Fd.onGround && onRwy && Fd.ias > 60 && !M.reject))) {
      const co = (k, v, t) => { if (!C[k] && Fd.ias >= v) { C[k] = true; emit('callout', { text: t }); } };
      if (!M.reject) { co('100', 100, '100 knots'); co('v1', v1, 'V1'); co('vr', vr, 'Rotate'); }
    }
    if (Fd.onGround && Fd.pitch > 0.5 * Math.PI / 180 && !M.rot) M.rot = { t: sys.t, ias: Fd.ias };
    if (!Fd.onGround && !M.liftoff) { M.liftoff = { t: sys.t, ias: Fd.ias, pitch: Fd.pitch * 180 / Math.PI, rate: M.rot ? Fd.pitch * 180 / Math.PI / Math.max(0.5, sys.t - M.rot.t) : 0, s: sn.s - RWY.s0 }; }
    if (M.liftoff && !C.pos && Fd.vs > 1.5 && Fd.ra > 30) { C.pos = true; emit('callout', { text: 'Positive climb' }); }
    if (!Fd.onGround) { M.maxPitch = Math.max(M.maxPitch || 0, Fd.pitch * 180 / Math.PI); }
    const vfe = AF.VFE[Math.round(Fd.flap)] ?? 350; if (Fd.flap > 0.2 && Fd.ias > vfe + 3) M.flapOver = Math.max(M.flapOver, Fd.ias - vfe);
    if (Fd.gear > 0.02 && Fd.gear < 0.98 && Fd.ias > AF.VLO + 3) M.gearOver = Math.max(M.gearOver, Fd.ias - AF.VLO);
    if (Fd.gear >= 0.98 && Fd.ias > AF.VLE + 3) M.gearOver = Math.max(M.gearOver, Fd.ias - AF.VLE);
    // rejected take-off: injected warning before V1, then the levers to idle
    const R = s.rtoInject;
    if (R && !R.fired && Fd.onGround && Fd.ias >= R.ias) { R.fired = true; R.t = sys.t; emit('rtoWarn'); }
    if (R && R.fired && !M.reject && w.thr1 < 0.05 && w.thr2 < 0.05) M.reject = { ias: Fd.ias, t: sys.t, dt: sys.t - R.t, v1 };
    if (M.reject && Fd.gs < 0.5 && M.stopRemain == null) M.stopRemain = { s: RWY.s1 - sn.s, on: onRwy, t: sys.t };
    approach(dt, sn, onRwy);
  }
  /* approach and landing: radio-altitude callouts, minimum, RETARD, stabilised-approach gates, touchdown, roll-out, go-around, taxi in */
  const RA_CALLS = [[2500, 'Twenty five hundred'], [1000, 'One thousand'], [500, 'Five hundred'], [100, 'One hundred'], [50, 'Fifty'], [40, 'Forty'], [30, 'Thirty'], [20, 'Twenty'], [10, 'Ten']];
  function approach(dt, sn, onRwy) {
    const w = sys.sw, s = sys.st, Fd = s.fdm, M = s.mon, P = M.app, C = s.callouts, A = s.af, fm = s.av.fms, ils = s.ils;
    const co = (k, text, extra = {}) => { if (!C[k]) { C[k] = true; emit('callout', { text, kind: 'ra', ...extra }); } };
    const ra = Fd.ra, vsF = Fd.vs / FT * 60, appr = A.phase === 'APPR' && !Fd.onGround && Fd.gear > 0.5;
    if (appr && vsF < 0) {
      for (const [h, t] of RA_CALLS) if (P.raLast > h && ra <= h) { if (h === 20 && Math.max(w.thr1, w.thr2) > 0.04) co('ra20', 'Retard', { retard: true }); else co('ra' + h, t); }
      // minimum: decision height (radio) or minimum descent altitude (baro)
      const above = fm.dh != null ? ra - fm.dh : fm.mda ? Fd.alt - fm.mda : null;
      if (above != null && above <= 100 && above > 0 && P.lastAbove > 100) co('hundredAbove', 'Hundred above');
      if (above != null && above <= 0 && P.lastAbove > 0) { co('minimum', 'Minimum'); P.minT = sys.t; }
      P.lastAbove = above;
      // autopilot still engaged below about 100 ft (no autoland)
      if ((w.ap1 || w.ap2) && ra < 90) P.apLow = true;
      // stabilised-approach gates at 1000 ft and 500 ft above the runway
      for (const g of [1000, 500]) if (P.raLast > g && ra <= g && !P.gates[g]) {
        const vapp = apprSpeeds(fm).vapp, dv = Fd.ias - vapp, conf = Math.round(Fd.flap) >= (fm.ldgConf === 3 ? 3 : 4) && Fd.gear > 0.99;
        const G = { ias: Math.round(Fd.ias), vapp, dv: Math.round(dv), loc: ils ? ils.loc : null, gs: ils ? ils.gs : null, conf, flap: Math.round(Fd.flap), gear: Fd.gear > 0.99, fpm: Math.round(-vsF) };
        G.ok = { spd: dv >= -5 && dv <= 10, gs: G.gs == null || Math.abs(G.gs) <= 1, loc: G.loc == null || Math.abs(G.loc) <= 1, conf, sink: -vsF < 1000 };
        G.stable = Object.values(G.ok).every(Boolean); P.gates[g] = G; emit('gate', { h: g, stable: G.stable });
      }
      if (ra < 1000 && ils) { P.maxLoc = Math.max(P.maxLoc, Math.abs(ils.loc)); if (ils.gsValid) P.maxGs = Math.max(P.maxGs, Math.abs(ils.gs)); }
      if (ra < 50 && !P.p50) P.p50 = { s: sn.s, t: sys.t, ias: Fd.ias };
      if (ra < 30 && !P.p30) P.p30 = { s: sn.s, t: sys.t, ias: Fd.ias, pitch: Fd.pitch / D2R };
      if (ra < 30 && P.p30) P.maxPitchFlare = Math.max(P.maxPitchFlare || 0, Fd.pitch / D2R);
    }
    if (!Fd.onGround) P.raLast = ra;
    // the injected go-around (runway incursion) below about 200 ft
    const GI = s.gaInject; if (GI && !GI.fired && appr && ra < GI.ra) { GI.fired = true; GI.t = sys.t; emit('gaCall', { ra }); emit('callout', { text: 'Go around — runway incursion', kind: 'atc', warn: true }); }
    // touchdown, roll-out, reverse and braking, nose gear, stop
    if (Fd.td && !M.td) {
      const T = Fd.td; M.td = { ...T, tdz: T.s - RWY.s0, cl: T.n - RWY.n, float: P.p50 ? T.s - P.p50.s : null, flareT: P.p30 ? sys.t - P.p30.t : null, onRwy, apLow: P.apLow, vapp: apprSpeeds(fm).vapp };
      M.roll = { s0: T.s, maxRev: 0, revKt: null, revIdleKt: null, maxDecel: 0, ab: w.autoBrk, stopS: null, maxCl: 0, spoilers: false, noseT: null, t0: sys.t };
    }
    const R = M.roll;
    if (R && Fd.onGround) {
      const rev = Math.max(...s.eng.map(e => e.rev || 0)), revN1 = Math.max(...s.eng.map(e => (e.rev || 0) > 0.9 ? e.n1 : 0));
      if (rev > 0.9 && R.revKt == null) R.revKt = Fd.ias; R.maxRev = Math.max(R.maxRev, revN1);
      if (R.maxRev > 50 && R.revIdleKt == null && revN1 < 40 && rev > 0.5) R.revIdleKt = Fd.ias;
      if (R.revIdleKt == null && R.maxRev > 50 && Fd.ias < 60 && revN1 > 50) R.revLow = true;
      if (Fd.spoiler > 0.8) R.spoilers = true;
      if (Fd.noseT >= 0 && R.noseT == null) R.noseT = Fd.noseT;
      if (Fd.gs > 30) R.maxDecel = Math.max(R.maxDecel, Fd.decel);
      if (onRwy && R.stopS == null) R.maxCl = Math.max(R.maxCl, Math.abs(sn.n - RWY.n));
      if (R.stopS == null && (Fd.gs < 3 || !onRwy)) { R.stopS = sn.s; R.dist = sn.s - R.s0; R.t = sys.t - R.t0; R.left = RWY.s1 - sn.s; R.offRwy = !onRwy && Fd.gs >= 3; }
    }
    // go-around execution
    if (A.phase === 'GA' && !M.ga) M.ga = { t: sys.t, ra, ias: Fd.ias, call: GI && GI.fired ? sys.t - GI.t : null, minRa: ra, maxPitch: 0, posT: null, gearT: null, flapT: null, flap0: w.flaps, fma: false };
    const GA = M.ga;
    if (GA && !Fd.onGround) {
      GA.minRa = Math.min(GA.minRa, ra); GA.maxPitch = Math.max(GA.maxPitch, Fd.pitch / D2R);
      if (GA.posT == null && Fd.vs > 1.5 && ra > GA.minRa + 30) GA.posT = sys.t - GA.t;
      if (GA.gearT == null && w.gearLever === 'UP') GA.gearT = sys.t - GA.t;
      if (GA.flapT == null && w.flaps < GA.flap0) GA.flapT = sys.t - GA.t;
      if (A.vert === 'SRS' && A.lat === 'GA TRK') GA.fma = true;
    }
    if (GI && GI.fired && !GA && Fd.onGround && !M.gaMissed) M.gaMissed = true;
    // taxi in: speed off the runway, vacated, at the stand (main gear on the stop mark, nose to the terminal)
    if (M.td && Fd.onGround) {
      const T = M.tin; if (!onRwy && Fd.gs > 0.5) { T.vacated = true; T.max = Math.max(T.max, Fd.gs); if (Fd.gs > 30) T.overT += dt; }
      const rt = nearest(TAXI_IN, sn.s, sn.n); T.route = rt;
      const hdgOk = Math.abs(((Fd.hdg - 184) + 540) % 360 - 180) < 8;
      T.standD = Math.hypot(sn.s - STAND14.s, sn.n - STAND14.n);
      T.atStand = T.standD < 2.5 && Fd.gs < 0.5 && hdgOk;
    }
  }

  function alerts(dt) {
    const w = sys.sw, s = sys.st, E = s.elec;
    const A = [], M = [];
    if (E.dc) {
      s.eng.forEach((e, i) => {
        const n = i + 1;
        if (e.fire) {
          const ag1 = e.agents[0], since = s.firePbT >= 0 && w['firePb' + n] ? sys.t - s.firePbT : -1;
          const wait = since < 0 ? '' : ag1.disch ? '' : since < 10 ? ` (WAIT ${Math.ceil(10 - since)} s)` : ' (NOW)';
          A.push({ id: 'fire' + n, lvl: 'W', title: `ENG ${n} FIRE`, lines: [
            { t: `THRUST LEVER ${n} → IDLE`, done: w['thr' + n] === 0 },
            { t: `ENG MASTER ${n} → OFF`, done: !w['master' + n] },
            { t: `FIRE PB ENG ${n} → PUSH`, done: w['firePb' + n] },
            { t: `AGENT 1 → DISCHARGE${wait}`, done: ag1.disch },
            { t: 'STILL ON FIRE AFTER ~30 s: AGENT 2 → DISCHARGE' + (ag1.disch && !e.agents[1].disch ? (sys.t - ag1.t < 30 ? ` (WAIT ${Math.ceil(30 - (sys.t - ag1.t))} s)` : ' (NOW)') : ''), done: e.agents[1].disch, cond: !ag1.disch || sys.t - ag1.t < 30 },
            { t: 'ATC AND CABIN CREW → INFORM', done: false }] });
        }
        if (e.fault) A.push({ id: 'sf' + n, lvl: 'C', title: `ENG ${n} START FAULT`, lines: e.man ? [{ t: e.fault + ' – MANUAL START' }, { t: `ENG MASTER ${n} → OFF`, done: !w['master' + n] }, { t: `MAN START ${n} → OFF`, done: !w['manStart' + n] }] : [{ t: e.fault + ' – AUTO START ABORTED' }, { t: `ENG MASTER ${n} → OFF`, done: !w['master' + n] }] });
      });
      if (s.toCfg.live && s.toCfg.live.length) A.push({ id: 'cfg', lvl: 'W', title: 'CONFIG', lines: s.toCfg.live.map(t => ({ t })) });
      else if (s.toCfg.faults.length && sys.t - s.toCfg.testT < 20) A.push({ id: 'cfgt', lvl: 'C', title: 'T.O CONFIG', lines: s.toCfg.faults.map(t => ({ t })) });
      if (s.rtoInject && s.rtoInject.fired && s.fdm.onGround) A.push({ id: 'ovht', lvl: 'W', title: 'ENG 1 OVERHEAT', lines: [{ t: 'BEFORE V1: REJECT (THRUST IDLE, BRAKE)', done: s.mon.reject != null }] });
      for (const [k, name] of [['eng1', 'ENG 1'], ['apu', 'APU'], ['eng2', 'ENG 2']]) if (s.fireTest[k] > 0) A.push({ id: 'test' + k, lvl: 'W', title: `${name} FIRE (TEST)`, lines: [] });
      if (s.eng[0].running && !s.fuel.pressL && !(s.fuel.xOpen > 0.5 && s.fuel.pressR)) A.push({ id: 'fpL', lvl: 'C', title: 'FUEL L TANK PUMPS LO PRESS', lines: [{ t: 'L TK PUMPS → ON' }] });
      if (s.eng[1].running && !s.fuel.pressR && !(s.fuel.xOpen > 0.5 && s.fuel.pressL)) A.push({ id: 'fpR', lvl: 'C', title: 'FUEL R TANK PUMPS LO PRESS', lines: [{ t: 'R TK PUMPS → ON' }] });
      for (const i of [0, 1]) if (s.eng[i].running && w['hEng' + (i + 1)] && s.hyd.p[i === 0 ? 0 : 2] < 1450 && !s.hyd.ptu) A.push({ id: 'hyd' + i, lvl: 'C', title: `HYD ${i === 0 ? 1 : 3} ENG ${i + 1} PUMP LO PRESS`, lines: [] });
      if (s.eng.some(e => e.running) && !E.ac) A.push({ id: 'acoff', lvl: 'C', title: 'ELEC AC BUSES OFF', lines: [] });
      if (s.apu.fault) A.push({ id: 'apuf', lvl: 'C', title: 'APU AUTO SHUTDOWN', lines: [] });
      // memos (our wording)
      const al = s.irs.filter(r => r.mode === 'NAV' && !r.aligned);
      if (al.length) { const rem = Math.max(...al.map(r => r.test > 0 ? 1 : (1 - r.prog))) * (sys.fast ? REF.irsAlignFast : REF.irsAlign); M.push({ t: `IRS ALIGNING ${fmtT(rem)}`, c: 'w' }); }
      if (s.irs.some(r => r.mode === 'ATT')) M.push({ t: 'IRS IN ATT MODE', c: 'a' });
      if (s.apu.phase === 'FLAP' || s.apu.phase === 'START') M.push({ t: s.apu.phase === 'START' ? 'APU STARTING' : 'APU FLAP OPENING', c: 'g' });
      if (s.apu.avail) M.push({ t: 'APU AVAIL', c: 'g' });
      if (s.apu.phase === 'COOL') M.push({ t: 'APU COOLING DOWN', c: 'g' });
      if (s.bleed.apuValve > 0.5) M.push({ t: 'APU BLEED ON', c: 'g' });
      if (E.extOn) M.push({ t: 'GROUND POWER IN USE', c: 'g' });
      if (w.engMode === 'IGN') M.push({ t: 'IGNITION SELECTED', c: 'g' });
      s.eng.forEach((e, i) => { if (e.phase === 'START') M.push({ t: e.crank ? `ENG ${i + 1} DRY CRANK` : e.man ? `ENG ${i + 1} MANUAL START` : `ENG ${i + 1} START IN PROGRESS`, c: 'g' }); else if (w['manStart' + (i + 1)]) M.push({ t: `ENG ${i + 1} MAN START ON`, c: 'g' }); });
      if (s.doors.fwdL > 0.05) M.push({ t: 'FWD CABIN DOOR OPEN', c: 'w' });
      if (!s.toCfg.faults.length && sys.t - s.toCfg.testT < 12 && s.toCfg.tested) M.push({ t: 'T.O CONFIG NORMAL', c: 'g' });
      if (w.autoBrk === 3 && s.fdm.onGround) M.push({ t: s.fdm.abActive ? 'AUTO BRK RTO' : 'AUTO BRK MAX', c: 'g' });
      if (w.spdBrk && !s.fdm.onGround) M.push({ t: 'SPEED BRAKE ARMED', c: 'a' });
      if (w.seatBelts) M.push({ t: 'BELTS SIGN ON', c: 'g' });
      if (w.noSmoking) M.push({ t: 'NO SMOKING SIGN ON', c: 'g' });
      if (w.parkBrk) M.push({ t: 'PARKING BRAKE SET', c: 'g' });
      if (!w.crewOxy) M.push({ t: 'CREW OXY SUPPLY OFF', c: 'a' });
      if (w.spdBrk === 1) M.push({ t: 'GROUND SPOILERS ARMED', c: 'g' });
      if (w.spdBrk >= 2 && !s.fdm.onGround) M.push({ t: 'SPEED BRAKE', c: s.fdm.flap > 2.5 || Math.max(w.thr1, w.thr2) > 1.06 ? 'a' : 'g' });
      if ((w.autoBrk === 1 || w.autoBrk === 2) && !(s.fdm.onGround && !s.fdm.landed)) M.push({ t: w.autoBrk === 1 ? 'AUTO BRK LO' : 'AUTO BRK MED', c: 'g' });
      if (s.eng.some(e => (e.rev || 0) > 0.05)) M.push({ t: 'REVERSE', c: s.eng.every(e => (e.rev || 0) > 0.98) ? 'g' : 'a' });
      // landing memo below 2000 ft on the approach (our wording): blue items still to do, green when done
      if (!s.fdm.onGround && s.fdm.ra < 2000 && s.af.phase === 'APPR') { const L = ldgMemo(); M.unshift({ t: 'LDG MEMO', c: 'w', items: L }); }
    }
    // master warning / caution latch
    const ids = new Set(A.map(a => a.id));
    for (const id of [...s.ack]) if (!ids.has(id)) s.ack.delete(id);
    for (const a of A) {
      if (!s.seen.has(a.id)) { s.seen.add(a.id); if (!s.ack.has(a.id)) { if (a.lvl === 'W') { s.master.warn = true; s.master.crc = true; emit('warn', { id: a.id }); } else { s.master.caut = true; emit('caut', { id: a.id }); } } }
    }
    for (const id of [...s.seen]) if (!ids.has(id)) s.seen.delete(id);
    if (!A.some(a => a.lvl === 'W' && !s.ack.has(a.id))) { s.master.warn = false; s.master.crc = false; }
    if (!A.some(a => a.lvl === 'C' && !s.ack.has(a.id))) s.master.caut = false;
    s.alerts = A; s.memos = M;
  }

  /** landing memo items: { t, done } (generic wording) */
  function ldgMemo() { const w = sys.sw, Fd = sys.st.fdm, conf = sys.st.av.fms.ldgConf === 3 ? 3 : 4;
    return [{ t: 'GEAR DN', done: Fd.gear > 0.99 && w.gearLever === 'DN' }, { t: 'SIGNS ON', done: w.seatBelts >= 1 && w.noSmoking >= 1 }, { t: 'SPLRS ARM', done: w.spdBrk === 1 }, { t: conf === 4 ? 'FLAPS FULL' : 'FLAPS 3', done: w.flaps === conf }]; }
  sys.ldgMemo = ldgMemo;
  function pages() {
    const w = sys.sw, s = sys.st;
    let auto = 'ELEC';
    if (w.engMode !== 'NORM' || s.eng.some(e => e.phase === 'START' || e.phase === 'ABORT' || e.fire)) auto = 'ENG';
    else if ((s.apu.phase === 'FLAP' || s.apu.phase === 'START') || (s.apu.availAt != null && sys.t - s.apu.availAt < 10)) auto = 'APU';
    else if (s.eng.every(e => e.running)) auto = 'ENG';
    if (auto !== s.sdLastAuto) { s.sdLastAuto = auto; if (s.sdLastAuto && sys.t > 0.1) w.sdManual = null; }
    s.sdAuto = auto; s.sdPage = w.sdManual || auto;
  }

  /* ---------------- annunciator lights (0 off, 1 on); computed for the 3D panel ---------------- */
  sys.lights = () => {
    const w = sys.sw, s = sys.st, E = s.elec, on = E.dc, L = {};
    const lv = (c) => (on && c ? 1 : 0);
    const off = id => lv(!w[id]);
    for (const id of ['bat1', 'bat2', 'gen1', 'gen2', 'apuGen', 'busTie', 'pL1', 'pL2', 'pC1', 'pC2', 'pR1', 'pR2', 'hEng1', 'hEng2', 'hElec', 'ptu', 'pack1', 'pack2', 'eBleed1', 'eBleed2', 'crewOxy', 'galy', 'ir1', 'ir2', 'ir3']) L[id] = { t: 0, b: off(id) };
    for (const i of [1, 2]) {
      const e = s.eng[i - 1];
      L['gen' + i].t = lv(w['gen' + i] && e.running && !E.genOn[i - 1]);
      L['hEng' + i].t = lv(w['hEng' + i] && e.running && s.hyd.p[i === 1 ? 0 : 2] < 1450);
    }
    for (const [p, side] of [['pL1', 'L'], ['pL2', 'L'], ['pR1', 'R'], ['pR2', 'R'], ['pC1', 'C'], ['pC2', 'C']]) L[p].t = lv(w[p] && E.ac && !s.fuel.run[p] && side !== 'C');
    L.ir1.b = L.ir2.b = L.ir3.b = 0;
    s.irs.forEach((r, i) => { L['ir' + (i + 1)] = { t: 0, b: lv(r.mode !== 'OFF' && !r.aligned && (r.mode === 'NAV' || r.attT < 20)) }; });
    L.onBat = { t: lv(s.onBat), b: 0 };
    L.extPwr = { t: E.extAvail && !E.extOn ? 1 : 0, b: E.extOn ? 1 : 0 };
    L.apuMaster = { t: lv(!!s.apu.fault), b: lv(w.apuMaster) };
    L.apuStart = { t: lv(s.apu.avail), b: lv(s.apu.startReq || (s.apu.phase === 'START')) };
    L.apuBleed = { t: 0, b: lv(w.apuBleed) };
    L.xfeed = { t: lv(s.fuel.xOpen > 0.95), b: lv(w.xfeed) };
    L.fuelMode = { t: 0, b: 0 };
    for (const id of ['wingAI', 'eng1AI', 'eng2AI', 'probeHeat']) L[id] = { t: 0, b: lv(w[id]) };
    L.pressMan = { t: 0, b: lv(w.pressMan) }; L.ditching = { t: 0, b: lv(w.ditching) }; L.ramAir = { t: 0, b: lv(w.ramAir) }; L.hotAir = { t: 0, b: lv(!w.hotAir) };
    L.paxOxy = { t: 0, b: lv(w.paxOxy) }; L.maskMan = { t: 0, b: 0 }; L.ratMan = { t: 0, b: 0 };
    L.acEssFeed = { t: 0, b: lv(!w.acEssFeed) }; L.commercial = { t: 0, b: lv(!w.commercial) }; L.idg1 = { t: 0, b: 0 }; L.idg2 = { t: 0, b: 0 };
    L.manStart1 = { t: 0, b: lv(w.manStart1) }; L.manStart2 = { t: 0, b: lv(w.manStart2) };
    // FCU and EFIS pushbuttons (lit bars), radio selector keys
    for (const id of ['ap1', 'ap2', 'athr', 'loc', 'appr', 'exped', 'fdL', 'fdR', 'lsL', 'lsR']) L[id] = { t: 0, b: lv(w[id]) };
    for (const sd of ['L', 'R']) for (const o of ['CSTR', 'WPT', 'VORD', 'NDB', 'ARPT']) L[o.toLowerCase() + sd] = { t: 0, b: lv(w['ovl' + sd] === o) };
    for (const n of [1, 2]) for (const r of ['VHF1', 'VHF2', 'VHF3']) L[`rmp${n}${r}`] = { t: 0, b: lv(w['rmpOn' + n] && w['rmpSel' + n] === r) };
    // fire panel
    const T = s.fireTest;
    const fl = (i) => { const e = s.eng[i - 1], tst = T['eng' + i] > 0; return lv(e.fire || tst); };
    L.firePb1 = { t: fl(1), b: 0 }; L.firePb2 = { t: fl(2), b: 0 }; L.firePbApu = { t: lv(T.apu > 0), b: 0 };
    for (const i of [1, 2]) for (const j of [1, 2]) { const e = s.eng[i - 1], ag = e.agents[j - 1], tst = T['eng' + i] > 0; L[`agent${i}_${j}`] = { t: lv(tst || (w['firePb' + i] && !ag.disch)), b: lv(tst || ag.disch) }; }
    L.agentApu_1 = { t: lv(T.apu > 0 || (w.firePbApu && !s.apu.agent.disch)), b: lv(T.apu > 0 || s.apu.agent.disch) };
    // pedestal ENG panel: FIRE / FAULT next to each master
    for (const i of [1, 2]) { const e = s.eng[i - 1]; L['engFire' + i] = { t: fl(i), b: 0 }; L['engFault' + i] = { t: lv(!!e.fault), b: 0 }; }
    // glareshield
    L.masterWarn = { t: lv(s.master.warn), b: 0, flash: true }; L.masterCaut = { t: lv(s.master.caut), b: 0 };
    // display page buttons (need AC)
    for (const p of ['ENG', 'BLEED', 'PRESS', 'ELEC', 'HYD', 'FUEL', 'APU', 'COND', 'DOOR', 'WHEEL', 'FCTL', 'STS']) L['sd' + p] = { t: E.ac && s.sdPage === p ? 1 : 0, b: 0 };
    // landing gear: green DN when down and locked; autobrake ON (blue) and DECEL (green)
    const gd = s.fdm.gear >= 0.999; L.gearL = { t: lv(gd), b: 0 }; L.gearN = { t: lv(gd), b: 0 }; L.gearR = { t: lv(gd), b: 0 };
    for (const [id, v] of [['autoBrkLo', 1], ['autoBrkMed', 2], ['autoBrkMax', 3]]) L[id] = { t: lv(w.autoBrk === v && s.fdm.abDecel), b: lv(w.autoBrk === v) };
    if (on && w.annLt === 2) for (const k in L) { L[k] = { t: 1, b: 1, flash: L[k].flash }; }
    const dim = w.annLt === 0 ? 0.45 : 1;
    if (dim !== 1) for (const k in L) { L[k].t *= dim; L[k].b *= dim; }
    return L;
  };

  sys.emit = emit;
  sys.cl = createChecklists(sys);
  sys.alignRemaining = () => { const al = sys.st.irs.filter(r => r.mode === 'NAV' && !r.aligned); if (!al.length) return 0; return Math.max(...al.map(r => (r.test > 0 ? 1 : 1 - r.prog))) * (sys.fast ? REF.irsAlignFast : REF.irsAlign); };
  sys.reset('cold');
  return sys;
}
export function fmtT(sec) { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }

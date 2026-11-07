/* Written NORMAL CHECKLISTS (challenge and response) for the generic twin-jet trainer, read after the flows to
   confirm nothing was missed. Wording, items and order are our own and generic, not any manufacturer's or operator's.
   Each item: challenge (c), expected response (r), one plausible wrong response (alt), a predicate on the live
   systems / flight-model state (ok), what the pilot monitoring says when it is not (why) and the control to fix it.
   Also: the runner (reads, checks, stops on a discrepancy, resumes once fixed) and the checklist-trainer stations.
   No three.js (runs in Node for tests). */
import { fmsStatus, QNH_TODAY } from './avionics.js';
import { P, RWY, HOLD, yawOfA } from './layout.js';

const baroOk = s => s.st.av.baro.every(b => !b.std && Math.abs(b.hpa - QNH_TODAY) < 0.6);
const fob = s => s.st.fuel.L + s.st.fuel.C + s.st.fuel.R;
const kg = v => String(Math.round(v / 100) * 100).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' KG';
export const STOP = 'STOP — not as required';

export const CHECKLISTS = {
  beforeStart: { title: 'BEFORE START', items: [
    { c: 'COCKPIT PREPARATION', r: 'COMPLETED (BOTH)', alt: 'IN PROGRESS', ok: s => s.sw.bat1 && s.sw.bat2 && ['irs1', 'irs2', 'irs3'].every(k => s.sw[k] === 'NAV') && fmsStatus(s.st.av.fms).all, why: 'Cockpit preparation not complete', ctl: 'bat1' },
    { c: 'FUEL QUANTITY', r: s => kg(fob(s)) + ', CHECKED', alt: s => kg(fob(s) + 2400) + ', CHECKED', ok: s => fob(s) > 6000, why: 'Fuel quantity low', ctl: 'ewd' },
    { c: 'SIGNS', r: 'ON / AUTO', alt: 'OFF', ok: s => s.sw.seatBelts >= 1 && s.sw.noSmoking >= 1, why: 'Signs not on', ctl: 'seatBelts' },
    { c: 'IRS', r: 'NAV, ALIGNED', alt: 'ATT', ok: s => ['irs1', 'irs2', 'irs3'].every(k => s.sw[k] === 'NAV') && s.st.irs.every(r => r.aligned), why: 'IRS not in NAV or not aligned', ctl: 'irs1' },
    { c: 'TAKE-OFF DATA', r: s => { const f = s.st.av.fms; return `V1 ${f.v1 || '---'}, VR ${f.vr || '---'}, V2 ${f.v2 || '---'}, FLEX ${f.flex || '--'}`; }, alt: 'V1 140, VR 135, V2 145, FLEX 60', ok: s => fmsStatus(s.st.av.fms).perf, why: 'Take-off data not set', ctl: 'f1_PERF' },
    { c: 'BARO REF', r: `QNH ${QNH_TODAY} SET (BOTH)`, alt: 'STD (BOTH)', ok: baroOk, why: `Baro reference not set to ${QNH_TODAY}`, ctl: 'baroL' },
    { c: 'BEACON', r: 'ON', alt: 'OFF', ok: s => s.sw.beacon >= 1, why: 'Beacon off', ctl: 'beacon', below: true },
    { c: 'WINDOWS / DOORS', r: 'CLOSED (BOTH)', alt: 'OPEN', ok: s => s.st.doors.fwdL < 0.05, why: 'Forward door still open', ctl: 'sdDOOR', below: true },
    { c: 'THRUST LEVERS', r: 'IDLE', alt: 'CL', ok: s => s.sw.thr1 < 0.05 && s.sw.thr2 < 0.05, why: 'Thrust levers not at idle', ctl: 'thr1', below: true },
    { c: 'PARKING BRAKE', r: 'SET', alt: 'RELEASED', ok: s => s.sw.parkBrk, why: 'Parking brake not set', ctl: 'parkBrk', below: true }
  ] },
  afterStart: { title: 'AFTER START', items: [
    { c: 'ANTI ICE', r: 'OFF (AS REQUIRED)', alt: 'ENG AND WING ON', ok: s => !s.sw.wingAI && !s.sw.eng1AI && !s.sw.eng2AI, why: 'Anti ice on with no icing', ctl: 'wingAI' },
    { c: 'SYSTEM DISPLAY STATUS', r: 'CHECKED, NO CAUTION', alt: 'CAUTION, CONTINUE', ok: s => !s.st.alerts.some(a => a.lvl === 'C' || a.lvl === 'W'), why: 'A caution is showing on the upper display', ctl: 'ewd' },
    { c: 'PITCH TRIM', r: '0.0, SET FOR TAKE-OFF', alt: '2.5 UP', ok: () => true, why: '', ctl: 'sdFCTL' },
    { c: 'RUDDER TRIM', r: 'ZERO', alt: 'L 2.0', ok: () => true, why: '', ctl: null }
  ] },
  beforeTO: { title: 'BEFORE TAKE-OFF', items: [
    { c: 'FLIGHT CONTROLS', r: 'CHECKED (BOTH)', alt: 'NOT CHECKED', ok: s => !!s.st.fctl.checked, why: 'Flight controls not checked', ctl: 'stickL' },
    { c: 'FLIGHT INSTRUMENTS', r: 'CHECKED (BOTH)', alt: 'FLAG ON CAPTAIN SIDE', ok: s => s.st.irs.every(r => r.aligned) && s.sw.fdL && s.sw.fdR, why: 'Flight director or attitude not available', ctl: 'fdL' },
    { c: 'BRIEFING', r: 'CONFIRMED', alt: 'TO BE DONE', ok: () => true, why: '', ctl: null },
    { c: 'FLAP SETTING', r: 'CONF 1 (BOTH)', alt: 'CONF 2', ok: s => s.sw.flaps === 1 && Math.abs(s.st.fdm.flap - 1) < 0.05, why: 'Flaps not set', ctl: 'flaps' },
    { c: 'V1, VR, V2 / FLEX TEMP', r: s => { const f = s.st.av.fms; return `${f.v1 || '---'}, ${f.vr || '---'}, ${f.v2 || '---'} / FLEX ${f.flex || '--'}`; }, alt: '145, 140, 135 / FLEX 45', ok: s => fmsStatus(s.st.av.fms).perf, why: 'Take-off speeds not set', ctl: 'f1_PERF' },
    { c: 'ATC CLEARANCE', r: 'CONFIRMED, SQUAWK SET', alt: 'NOT RECEIVED', ok: s => !!s.st.av.xpdr.code && !s.st.av.xpdr.entry, why: 'Transponder code entry not finished', ctl: 'xClr' },
    { c: 'T.O MEMO', r: 'NO BLUE', alt: 'BLUE ITEMS LEFT', ok: s => s.sw.autoBrk === 3 && s.sw.seatBelts >= 1 && s.sw.noSmoking >= 1 && s.sw.spdBrk === 1 && s.sw.flaps >= 1 && s.sw.flaps <= 3 && s.st.toCfg.tested && !s.st.toCfg.faults.length, why: 'T.O memo not all done (autobrake, signs, spoilers, flaps or T.O CONFIG)', ctl: 'autoBrkMax' },
    { c: 'TAKE-OFF RUNWAY', r: '27R, CONFIRMED', alt: '09L', ok: s => s.st.av.fms.depRwy === '27R' && Math.abs(((s.st.fdm.hdg - 274 + 540) % 360) - 180) < 15, why: 'Not lined up on runway 27R', ctl: 'nd', below: true },
    { c: 'CABIN CREW', r: 'ADVISED', alt: 'NOT ADVISED', ok: () => true, why: '', ctl: null, below: true },
    { c: 'TCAS', r: 'TA / RA (TRANSPONDER ON)', alt: 'STBY', ok: s => s.sw.xpdr === 2, why: 'Transponder not ON', ctl: 'xpdr', below: true },
    { c: 'ENGINE MODE', r: 'NORM', alt: 'IGN / START', ok: s => s.sw.engMode === 'NORM', why: 'Engine mode selector not NORM', ctl: 'engMode', below: true },
    { c: 'PACKS', r: 'ON (BOTH)', alt: 'OFF', ok: s => s.sw.pack1 && s.sw.pack2, why: 'A pack is off', ctl: 'pack1', below: true }
  ] },
  afterTO: { title: 'AFTER TAKE-OFF / CLIMB', items: [
    { c: 'LANDING GEAR', r: 'UP', alt: 'DOWN', ok: s => s.sw.gearLever === 'UP' && s.st.fdm.gear < 0.02, why: 'Gear not up', ctl: 'gear' },
    { c: 'FLAPS', r: 'RETRACTED', alt: 'CONF 1', ok: s => s.sw.flaps === 0, why: 'Flaps not retracted', ctl: 'flaps' },
    { c: 'PACKS', r: 'ON (BOTH)', alt: 'OFF', ok: s => s.sw.pack1 && s.sw.pack2, why: 'A pack is off', ctl: 'pack1' },
    { c: 'BARO REF', r: 'QNH, STD AT TRANSITION', alt: 'NOT CHECKED', ok: s => s.st.fdm.alt < 4900 ? baroOk(s) : s.st.av.baro.every(b => b.std), why: 'Baro reference not set for this altitude', ctl: 'baroL' }
  ] }
};
export const respText = (s, it) => typeof it.r === 'function' ? it.r(s) : it.r;
const altText = (s, it) => typeof it.alt === 'function' ? it.alt(s) : it.alt;
const inPart = (it, part) => part === 'all' || (part === 'below' ? !!it.below : !it.below);

/* ---------- runner: one per systems instance; survives trainer station resets ---------- */
export function createChecklists(sys) {
  const C = { key: null, part: 'all', status: 'idle', idx: -1, mode: 'guided', items: [], log: [], done: {}, stopT: -1 };
  const emit = (type, d = {}) => sys.emit && sys.emit(type, d);
  C.reset = () => { Object.assign(C, { key: null, part: 'all', status: 'idle', idx: -1, items: [], log: [], done: {} }); };
  C.def = () => C.key && CHECKLISTS[C.key];
  C.isDone = (key, part = 'all') => !!C.done[key + ':' + part] || (part !== 'all' && !!C.done[key + ':all']);
  C.start = (key, part = 'all') => {
    if (C.key === key && C.part === part && C.status !== 'idle' && C.status !== 'done') return;
    const D = CHECKLISTS[key]; C.key = key; C.part = part; C.status = 'active';
    if (!C.items.length || C.items.key !== key) { C.items = D.items.map(() => ({ state: 'pending', resp: '' })); C.items.key = key; }
    C.idx = -1; next(); emit('clStart', { title: D.title + (part === 'below' ? ' — below the line' : '') });
  };
  function next() {
    const D = C.def(); const order = D.items.map((it, i) => i).filter(i => inPart(D.items[i], C.part));
    const n = order.find(i => i > C.idx && C.items[i].state === 'pending') ?? order.find(i => C.items[i].state === 'pending');
    if (n == null) { C.status = 'done'; C.idx = -1; C.done[C.key + ':' + C.part] = true; emit('clComplete', { title: D.title, part: C.part }); return; }
    C.idx = n; C.status = 'active'; emit('clRead', { text: D.items[n].c });
  }
  C.cur = () => (C.status === 'active' || C.status === 'stopped') && C.idx >= 0 ? C.def().items[C.idx] : null;
  /** the 2–3 response options for the current item: expected, one plausible wrong value, and STOP (discrepancy) */
  C.options = () => { const it = C.cur(); if (!it) return []; const o = [respText(sys, it), altText(sys, it)]; const h = (C.key.length * 7 + C.idx * 13) % 2; if (h) o.reverse(); if (it.why) o.push(STOP); return o; };
  const log = (kind, it, extra = '') => C.log.push({ kind, key: C.key, title: C.def().title, item: it.c, extra, t: sys.t });
  /** respond with an option index or text. Returns 'ok' | 'stopped' | 'wrong' | 'caught' */
  C.answer = (o) => {
    const it = C.cur(); if (!it || C.status !== 'active') return null;
    const opts = C.options(); const txt = typeof o === 'number' ? opts[o] : String(o); const exp = respText(sys, it), good = it.ok(sys);
    C.items[C.idx].resp = txt;
    if (txt === STOP) { if (!good) { log('caught', it, it.why); return stop(it, true); } log('wrong', it, 'stopped although it was as required'); emit('clWrong', { text: 'Check again: ' + it.c }); return 'wrong'; }
    if (txt === exp) { if (good) { C.items[C.idx].state = 'done'; next(); return 'ok'; } log('missed', it, it.why); return stop(it, false); }
    log('wrong', it, `answered “${txt}”`); emit('clWrong', { text: 'Check again: ' + it.c }); return 'wrong';
  };
  function stop(it, caught) { C.status = 'stopped'; C.items[C.idx].state = 'stopped'; C.stopT = sys.t; emit('clStop', { why: it.why, caught }); return caught ? 'caught' : 'stopped'; }
  /** memory mode: the student recalls the response, reveals it and grades it */
  C.recall = (grade) => { const it = C.cur(); if (!it) return null; if (grade === 'stop') return C.answer(STOP); if (grade === 'missed') { log('wrong', it, 'not recalled'); C.items[C.idx].recallMiss = true; return C.answer(respText(sys, it)); } return C.answer(respText(sys, it)); };
  /** read a later item first (allowed, but logged as out of order) */
  C.jump = (i) => { const D = C.def(); if (!D || C.status !== 'active' || i === C.idx || !inPart(D.items[i], C.part) || C.items[i].state !== 'pending') return false; if (i > C.idx) log('order', D.items[i], `read before “${D.items[C.idx].c}”`); C.idx = i; emit('clRead', { text: D.items[i].c }); return true; };
  /** each systems step: a stopped checklist resumes by itself once the state is fixed */
  C.update = () => { if (C.status !== 'stopped') return; const it = C.cur(); if (it && it.ok(sys)) { C.items[C.idx].state = 'done'; emit('clResume', { item: it.c }); next(); } };
  C.correctIndex = () => { const it = C.cur(); if (!it) return -1; const o = C.options(); return it.ok(sys) ? o.indexOf(respText(sys, it)) : o.indexOf(STOP); };
  return C;
}
/** debrief entries for the checklists of a flow: wrong responses, discrepancies caught (praise) or missed, out of order */
export function checklistNotes(C) {
  const out = [];
  for (const l of C.log) {
    if (l.kind === 'caught') out.push({ text: `${l.title}: discrepancy caught — ${l.extra}. Good catch.`, pen: 0 });
    else if (l.kind === 'missed') out.push({ text: `${l.title}: discrepancy missed at ${l.item} — ${l.extra}`, pen: 5 });
    else if (l.kind === 'wrong') out.push({ text: `${l.title}: wrong response at ${l.item} (${l.extra})`, pen: 2 });
    else if (l.kind === 'order') out.push({ text: `${l.title}: ${l.item} ${l.extra} (read out of order)`, pen: 2 });
  }
  return out;
}

/* ---------- checklist trainer: stations in the state where each list is read, with one random fault each ---------- */
export const STATIONS = [
  { key: 'beforeStart', part: 'all', init: 'beforeStart', where: 'At the stand, before engine start',
    setup(s) { Object.assign(s.sw, { beacon: 1, parkBrk: true }); s.st.doors.fwdL = 0; s.st.doors.bridge = false; s.st.doors.t = -50; },
    faults: [{ name: 'Signs off', item: 'SIGNS', apply: s => { s.sw.seatBelts = 0; }, fix: s => { s.sw.seatBelts = 1; } }, { name: 'Baro on STD', item: 'BARO REF', apply: s => { s.st.av.baro[0].std = true; }, fix: s => { s.st.av.baro[0].std = false; } },
      { name: 'Parking brake released', item: 'PARKING BRAKE', apply: s => { s.sw.parkBrk = false; }, fix: s => { s.sw.parkBrk = true; } }, { name: 'Thrust lever 2 at CL', item: 'THRUST LEVERS', apply: s => { s.sw.thr2 = 1; }, fix: s => { s.sw.thr2 = 0; } }] },
  { key: 'afterStart', part: 'all', init: 'stand', where: 'Engines running, at the stand',
    setup() {}, faults: [{ name: 'Wing anti ice left on', item: 'ANTI ICE', apply: s => { s.sw.wingAI = true; }, fix: s => { s.sw.wingAI = false; } }, { name: 'Left and centre tank pumps off (caution)', item: 'SYSTEM DISPLAY STATUS', apply: s => { for (const k of ['pL1', 'pL2', 'pC1', 'pC2']) s.sw[k] = false; }, fix: s => { for (const k of ['pL1', 'pL2', 'pC1', 'pC2']) s.sw[k] = true; } }] },
  { key: 'beforeTO', part: 'above', init: 'stand', where: 'At the holding point',
    setup(s) { const p = P(HOLD.s, HOLD.n - 30); Object.assign(s.st.fdm, { x: p.x, z: p.z, yaw: yawOfA(Math.PI / 2) }); Object.assign(s.sw, { flaps: 1, spdBrk: 1, autoBrk: 3, parkBrk: true }); s.st.fdm.flap = 1; s.st.fctl.seen = { aft: true, fwd: true, left: true, right: true }; s.st.fctl.checked = true; s.st.toCfg.tested = true; s.st.toCfg.faults = []; s.st.toCfg.testT = s.t; },
    faults: [{ name: 'Flaps not set', item: 'FLAP SETTING', apply: s => { s.sw.flaps = 0; s.st.fdm.flap = 0; }, fix: s => { s.sw.flaps = 1; } }, { name: 'Autobrake not armed', item: 'T.O MEMO', apply: s => { s.sw.autoBrk = 0; }, fix: s => { s.sw.autoBrk = 3; } }, { name: 'Flight controls not checked', item: 'FLIGHT CONTROLS', apply: s => { s.st.fctl.seen = {}; s.st.fctl.checked = false; }, fix: s => { s.st.fctl.seen = { aft: true, fwd: true, left: true, right: true }; } }] },
  { key: 'beforeTO', part: 'below', init: 'lineup', where: 'Lined up on runway 27R',
    setup(s) { s.sw.parkBrk = true; }, faults: [{ name: 'Transponder on STBY', item: 'TCAS', apply: s => { s.sw.xpdr = 0; }, fix: s => { s.sw.xpdr = 2; } }, { name: 'Pack 2 off', item: 'PACKS', apply: s => { s.sw.pack2 = false; }, fix: s => { s.sw.pack2 = true; } }, { name: 'Engine mode left at IGN/START', item: 'ENGINE MODE', apply: s => { s.sw.engMode = 'IGN'; }, fix: s => { s.sw.engMode = 'NORM'; } }] },
  { key: 'afterTO', part: 'all', init: 'stand', where: 'Climbing through about 3000 ft',
    setup(s) { const F = s.st.fdm, p = P(RWY.s1 + 4000, RWY.n); Object.assign(F, { x: p.x, z: p.z, yaw: yawOfA(0), onGround: false, h: 780, V: 108, gamma: 0.07, pitch: 0.12, gear: 0, flap: 0, airT: 60 }); Object.assign(s.sw, { gearLever: 'UP', flaps: 0, parkBrk: false, thr1: 1, thr2: 1, ap1: true, athr: true, strobe: 2, xpdr: 2 }); s.st.af.phase = 'CLIMB'; s.st.af.vert = 'CLB'; s.st.af.lat = 'NAV'; s.st.mon.liftoff = { t: s.t, ias: 150, pitch: 8, rate: 3, s: 1000 }; },
    faults: [{ name: 'Pack 1 off', item: 'PACKS', apply: s => { s.sw.pack1 = false; }, fix: s => { s.sw.pack1 = true; } }, { name: 'Baro on STD below transition', item: 'BARO REF', apply: s => { s.st.av.baro.forEach(b => { b.std = true; }); }, fix: s => { s.st.av.baro.forEach(b => { b.std = false; }); } }, { name: 'Flaps still at 1', item: 'FLAPS', apply: s => { s.sw.flaps = 1; s.st.fdm.flap = 1; }, fix: s => { s.sw.flaps = 0; } }] }
];
/** put the systems into a station's state (keeping the clock) and inject one fault; returns the fault */
export function setupStation(sys, st, rnd = Math.random) {
  const t = sys.t; sys.reset(st.init, { keepChecklists: true }); sys.t = t;
  st.setup(sys);
  const f = st.faults[Math.floor(rnd() * st.faults.length) % st.faults.length]; f.apply(sys);
  for (let i = 0; i < 3; i++) sys.advance(1 / 30);
  return f;
}

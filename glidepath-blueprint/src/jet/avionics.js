/* Generic avionics for the trainer: glareshield autopilot panel (FCU), EFIS baro reference, radio panels,
   transponder and a deliberately simplified flight computer (keypad, scratchpad, INIT / F-PLN / PERF pages).
   Our own simplified design and wording, not any manufacturer's system. No three.js (runs in Node for tests). */
import { AIRPORTS } from './navdata.js';

const OAT = 15;                  // deg C, same as the systems model
export const QNH_TODAY = 1009;   // sea-level pressure at the fictional departure field today (hPa)
export const FIELD_ELEV = AIRPORTS.ZZAA.elev;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const HPA_PER_INHG = 33.8639;

export function createAvionics() {
  return {
    fcu: { spd: 150, mach: 0.78, unit: 'SPD', spdMan: true, hdg: 274, hdgMan: true, trk: false, alt: 5000, altMan: true, vs: 0, fpa: 0, vsMode: false, prevSpd: -1, prevHdg: -1, prevVs: -1 },
    baro: [{ hpa: 1013.25, std: false }, { hpa: 1013.25, std: false }],
    radio: { VHF1: { act: 121800, sby: 118700 }, VHF2: { act: 131725, sby: 123450 }, VHF3: { act: 136975, sby: 131550 } },
    xpdr: { code: '2000', entry: '', identT: -1 },
    fms: { from: '', to: '', flt: '', ci: null, crz: null, baro: null, depRwy: '', arrRwy: '', v1: null, vr: null, v2: null, flex: null, u: [{ page: 'INIT', sp: '', msg: '' }, { page: 'INIT', sp: '', msg: '' }] },
    turns: {}, // knob detent counters for the 3D animation
    kick: {}   // last push / pull per knob { t, dir }
  };
}
/* set up as a crew would have it before engine start */
export function presetAvionics(av) {
  Object.assign(av.fms, { from: 'ZZAA', to: 'ZZBB', flt: 'GPX101', ci: 30, crz: 350, baro: { hpa: QNH_TODAY, unit: 'hPa' }, depRwy: '27R', arrRwy: '09', v1: 135, vr: 140, v2: 145, flex: 45 });
  av.fms.u.forEach(u => { u.page = 'PERF'; });
  av.baro.forEach(b => { b.hpa = QNH_TODAY; b.std = false; });
}
export const fmsStatus = f => {
  const init = !!(f.from && f.to && f.flt && f.ci != null && f.crz && f.baro), fpln = !!(f.from && f.to && f.depRwy && f.arrRwy), perf = !!(f.v1 && f.vr && f.v2 && f.flex);
  return { init, fpln, perf, all: init && fpln && perf };
};
/* indicated altitude from the baro setting (about 27 ft per hPa near sea level) */
export function baroAlt(av, side) { const b = av.baro[side]; const set = b.std ? 1013.25 : b.hpa; return FIELD_ELEV + (set - QNH_TODAY) * 27.3; }
export function baroText(av, side, unit) { const b = av.baro[side]; return unit === 'inHg' ? (b.hpa / HPA_PER_INHG).toFixed(2) : String(Math.round(b.hpa)); }
export const freqText = k => (k / 1000).toFixed(3);

/** turn / push / pull a knob. op: 'turn' (n detents, + clockwise), 'push', 'pull', 'set' (n = value) */
export function avKnob(sys, knob, op, n = 1) {
  const av = sys.st.av, F = av.fcu, w = sys.sw, t = sys.t;
  if (op === 'turn') av.turns[knob] = (av.turns[knob] || 0) + n;
  if (op === 'push' || op === 'pull') av.kick[knob] = { t, dir: op === 'push' ? -1 : 1 };
  switch (knob) {
    case 'spd':
      if (op === 'turn' || op === 'set') { if (F.unit === 'SPD') F.spd = op === 'set' ? clamp(Math.round(n), 100, 399) : clamp(F.spd + n, 100, 399); else F.mach = op === 'set' ? clamp(n, 0.1, 0.99) : clamp(Math.round((F.mach + n * 0.01) * 100) / 100, 0.1, 0.99); if (F.spdMan) F.prevSpd = t + 10; }
      else if (op === 'push') { F.spdMan = true; F.prevSpd = -1; } else if (op === 'pull') { F.spdMan = false; F.prevSpd = -1; }
      return true;
    case 'hdg':
      if (op === 'turn' || op === 'set') { F.hdg = op === 'set' ? ((Math.round(n) % 360) + 360) % 360 : ((F.hdg + n) % 360 + 360) % 360; if (F.hdgMan) F.prevHdg = t + 10; }
      else if (op === 'push') { F.hdgMan = true; F.prevHdg = -1; } else if (op === 'pull') { F.hdgMan = false; F.prevHdg = -1; }
      return true;
    case 'alt':
      if (op === 'set') F.alt = clamp(Math.round(n / 100) * 100, 100, 49000);
      else if (op === 'turn') { const inc = w.altInc === 1000 ? 1000 : 100; const base = inc === 1000 ? Math.round(F.alt / 1000) * 1000 : F.alt; F.alt = clamp(base + n * inc, 100, 49000); }
      else if (op === 'push') F.altMan = true; else if (op === 'pull') F.altMan = false;
      return true;
    case 'vs':
      if (op === 'turn' || op === 'set') { if (F.trk) F.fpa = op === 'set' ? clamp(n, -9.9, 9.9) : clamp(Math.round((F.fpa + n * 0.1) * 10) / 10, -9.9, 9.9); else F.vs = op === 'set' ? clamp(Math.round(n / 100) * 100, -6000, 6000) : clamp(F.vs + n * 100, -6000, 6000); if (!F.vsMode) F.prevVs = t + 10; }
      else if (op === 'push') { F.vsMode = true; F.vs = 0; F.fpa = 0; F.prevVs = -1; } else if (op === 'pull') { F.vsMode = true; F.prevVs = -1; }
      return true;
    case 'baroL': case 'baroR': {
      const side = knob === 'baroL' ? 0 : 1, b = av.baro[side], unit = w['baroUnit' + (side ? 'R' : 'L')];
      if (op === 'set') { b.hpa = n; b.std = false; }
      else if (op === 'turn') { if (unit === 'inHg') { const ih = Math.round(b.hpa / HPA_PER_INHG * 100) / 100 + n * 0.01; b.hpa = clamp(ih, 27, 32) * HPA_PER_INHG; } else b.hpa = clamp(Math.round(b.hpa) + n, 900, 1100); }
      else if (op === 'push') b.std = !b.std; else if (op === 'pull') b.std = false;
      return true;
    }
    default: {
      const m = /^rmp(\d)(Outer|Inner)$/.exec(knob); if (!m) return false;
      if (op !== 'turn' && op !== 'set') return true;
      const r = av.radio[w['rmpSel' + m[1]]]; if (!r) return true;
      if (op === 'set') { r.sby = Math.round(n * 1000); return true; }
      let mhz = Math.floor(r.sby / 1000), khz = r.sby % 1000;
      if (m[2] === 'Outer') mhz = 118 + (((mhz - 118 + n) % 19) + 19) % 19;
      else khz = (((Math.round(khz / 25) + n) % 40) + 40) % 40 * 25;
      r.sby = mhz * 1000 + khz; return true;
    }
  }
}

/** momentary buttons on the FCU, radio panels and transponder */
export function avPress(sys, id) {
  const av = sys.st.av, F = av.fcu, w = sys.sw, E = sys.st.elec;
  if (id === 'spdMach') { if (F.unit === 'SPD') { F.unit = 'MACH'; F.mach = clamp(Math.round(F.spd / 600 * 100) / 100, 0.1, 0.99); } else { F.unit = 'SPD'; F.spd = clamp(Math.round(F.mach * 600), 100, 399); } return true; }
  if (id === 'hdgTrk') { F.trk = !F.trk; return true; }
  const x = /^rmpXfer(\d)$/.exec(id); if (x) { if (!E.dc || !w['rmpOn' + x[1]]) return false; const r = av.radio[w['rmpSel' + x[1]]]; if (r) [r.act, r.sby] = [r.sby, r.act]; return true; }
  if (id === 'xIdent') { if (E.dc && w.xpdr !== 0) av.xpdr.identT = sys.t + 18; return true; }
  if (id === 'xClr') { av.xpdr.entry = av.xpdr.entry.slice(0, -1); return true; }
  const d = /^x([0-7])$/.exec(id); if (d) { if (!E.dc) return false; const X = av.xpdr; X.entry += d[1]; if (X.entry.length >= 4) { X.code = X.entry; X.entry = ''; } return true; }
  return false;
}

/* ---------------- simplified flight computer ---------------- */
const MSG = { fmt: 'INVALID ENTRY', range: 'OUT OF RANGE', db: 'NOT IN DATABASE', na: 'NOT ALLOWED', notTrainer: 'NOT IN THIS TRAINER', order: 'CHECK V1 / VR / V2 ORDER' };
const FIELDS = {
  INIT: {
    R1(f, sp) { const m = /^([A-Z]{4})\/([A-Z]{4})$/.exec(sp); if (!m) return MSG.fmt; if (!AIRPORTS[m[1]] || !AIRPORTS[m[2]]) return MSG.db; if (m[1] === m[2]) return MSG.fmt; if (f.from !== m[1] || f.to !== m[2]) { f.depRwy = ''; f.arrRwy = ''; } f.from = m[1]; f.to = m[2]; },
    L3(f, sp) { if (!/^[A-Z0-9]{2,8}$/.test(sp)) return MSG.fmt; f.flt = sp; },
    R3(f, sp) { if (/^\d{3,4}$/.test(sp)) { const v = +sp; if (v < 900 || v > 1100) return MSG.range; f.baro = { hpa: v, unit: 'hPa' }; return; } if (/^\d{2}\.\d{2}$/.test(sp)) { const v = +sp; if (v < 27 || v > 32) return MSG.range; f.baro = { hpa: v * HPA_PER_INHG, unit: 'inHg', ih: v }; return; } return MSG.fmt; },
    L5(f, sp) { if (!/^\d{1,3}$/.test(sp)) return MSG.fmt; f.ci = +sp; },
    R5(f, sp) { const m = /^(FL)?(\d{2,3})$/.exec(sp); if (!m) return MSG.fmt; const v = +m[2]; if (v < 10 || v > 410) return MSG.range; f.crz = v; },
    L1() { return MSG.notTrainer; }
  },
  'F-PLN': {
    L1(f, sp) { if (!f.from) return MSG.na; if (!AIRPORTS[f.from].rwys[sp]) return MSG.db; f.depRwy = sp; },
    L5(f, sp) { if (!f.to) return MSG.na; if (!AIRPORTS[f.to].rwys[sp]) return MSG.db; f.arrRwy = sp; }
  },
  PERF: {
    L1: (f, sp) => vspd(f, 'v1', sp), L2: (f, sp) => vspd(f, 'vr', sp), L3: (f, sp) => vspd(f, 'v2', sp),
    R4(f, sp) { if (!/^\d{1,2}$/.test(sp)) return MSG.fmt; const v = +sp; if (v <= OAT || v > 70) return MSG.range; f.flex = v; }
  }
};
function vspd(f, k, sp) {
  if (!/^\d{3}$/.test(sp)) return MSG.fmt; const v = +sp; if (v < 100 || v > 200) return MSG.range;
  const o = { v1: f.v1, vr: f.vr, v2: f.v2, [k]: v };
  if ((o.v1 && o.vr && o.v1 > o.vr) || (o.vr && o.v2 && o.vr > o.v2) || (o.v1 && o.v2 && o.v1 > o.v2)) return MSG.order;
  f[k] = v;
}
export const FMS_PAGES = ['INIT', 'F-PLN', 'PERF'];
/** a key on flight computer `unit` (0 captain, 1 first officer). Returns true if the key did something. */
export function fmsKey(sys, unit, key) {
  if (!sys.st.elec.ac) return false;
  const f = sys.st.av.fms, U = f.u[unit];
  if (FMS_PAGES.includes(key)) { U.page = key; return true; }
  if (['DIR', 'PROG', 'DATA', 'RAD NAV', 'FUEL PRED', 'SEC F-PLN', 'ATC COMM', 'MENU'].includes(key)) { U.msg = MSG.notTrainer; return true; }
  if (key === 'CLR') { if (U.msg) U.msg = ''; else U.sp = U.sp.slice(0, -1); return true; }
  if (/^[LR][1-6]$/.test(key)) {
    const h = (FIELDS[U.page] || {})[key];
    if (!h) { if (U.sp) U.msg = MSG.na; return true; }
    if (!U.sp && !(U.page === 'INIT' && key === 'L1')) return true;
    const err = h(f, U.sp.trim()); if (err) U.msg = err; else { U.sp = ''; U.msg = ''; }
    return true;
  }
  U.msg = '';
  if (key === 'SP') U.sp += ' '; else if (key === '+/-') U.sp = U.sp.endsWith('-') ? U.sp.slice(0, -1) + '+' : U.sp + '-'; else if (key.length === 1) U.sp += key;
  if (U.sp.length > 22) U.sp = U.sp.slice(-22);
  return true;
}
/** the next thing to do on the flight computer (guided mode): { key, text } */
export function fmsNext(sys, unit = 0) {
  const f = sys.st.av.fms, U = f.u[unit], st = fmsStatus(f);
  const want = (page, key, value, text) => {
    if (U.page !== page) return { key: page, text: `Press ${page} on the flight computer keypad.` };
    if (U.msg) return { key: 'CLR', text: `“${U.msg}”: press CLR, then type ${value} again.` };
    if (U.sp.trim() === value) return { key, text: `Press the line key next to ${text} (${key[0] === 'L' ? 'left' : 'right'} side, line ${key[1]}).` };
    return { key: 'keys', text: `Type ${value} into the scratchpad${U.sp ? ' (CLR deletes a character)' : ''}, then press the line key next to ${text}.` };
  };
  if (!f.from || !f.to) return want('INIT', 'R1', 'ZZAA/ZZBB', 'FROM/TO');
  if (!f.flt) return want('INIT', 'L3', 'GPX101', 'FLT NBR');
  if (!f.baro) return want('INIT', 'R3', String(QNH_TODAY), 'BARO REF');
  if (f.ci == null) return want('INIT', 'L5', '30', 'COST INDEX');
  if (!f.crz) return want('INIT', 'R5', 'FL350', 'CRZ FL');
  if (!f.depRwy) return want('F-PLN', 'L1', '27R', 'the departure runway');
  if (!f.arrRwy) return want('F-PLN', 'L5', '09', 'the arrival runway');
  if (!f.v1) return want('PERF', 'L1', '135', 'V1');
  if (!f.vr) return want('PERF', 'L2', '140', 'VR');
  if (!f.v2) return want('PERF', 'L3', '145', 'V2');
  if (!f.flex) return want('PERF', 'R4', '45', 'FLEX TO TEMP');
  return { key: st.all ? null : 'INIT', text: 'All three pages are complete.' };
}

/* timers */
export function avUpdate(sys) {
  const av = sys.st.av, F = av.fcu, t = sys.t;
  if (F.prevSpd > 0 && t > F.prevSpd) F.prevSpd = -1;
  if (F.prevHdg > 0 && t > F.prevHdg) F.prevHdg = -1;
  if (F.prevVs > 0 && t > F.prevVs) F.prevVs = -1;
  if (av.xpdr.identT > 0 && t > av.xpdr.identT) av.xpdr.identT = -1;
}
/* the AP / A/THR / LOC / APPR pushbuttons: rules applied when one is pressed (logic only on the ground) */
export function fcuRule(sys, id, v) {
  const w = sys.sw, s = sys.st;
  if (!v) return true;
  if (!s.elec.ac) return false;
  if (id === 'ap1' || id === 'ap2') { if (!s.irs.some(r => r.aligned) || !s.fdm || s.fdm.onGround || s.fdm.ra < 100) return false; const other = id === 'ap1' ? 'ap2' : 'ap1'; if (w[other] && !w.appr) w[other] = false; }
  if (id === 'loc' && w.appr) w.appr = false;
  if (id === 'appr' && w.loc) w.loc = false;
  return true;
}

/* ---------------- flight computer screen (canvas) ---------------- */
const LCDF = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const CC = { w: '#f2f6f8', c: '#36d6ff', g: '#35f27a', a: '#ffad1f', m: '#ff4fd8', grey: '#8a979e' };
export function fmsKeyState(sys, unit) { const f = sys.st.av.fms; return sys.st.elec.ac ? JSON.stringify([f, unit, sys.sw.flaps]) : 'off'; }
export function drawFMS(x, W, H, sys, unit) {
  x.fillStyle = '#05080a'; x.fillRect(0, 0, W, H);
  if (!sys.st.elec.ac) return;
  const f = sys.st.av.fms, U = f.u[unit];
  const rows = 14, lh = H / rows, cw = W / 24;
  const T = (t, col, c, r, big = true, al = 'left') => { x.font = `700 ${lh * (big ? 0.82 : 0.62)}px ${LCDF}`; x.fillStyle = col; x.textAlign = al; x.textBaseline = 'middle'; x.fillText(t, al === 'right' ? W - c * cw : c * cw, (r + 0.55) * lh); };
  const label = (side, line, t) => T(t, CC.w, side === 'L' ? 0.4 : 0.4, line * 2 - 1, false, side === 'L' ? 'left' : 'right');
  const data = (side, line, t, col) => T(t, col, 0.3, line * 2, true, side === 'L' ? 'left' : 'right');
  const box = n => '□'.repeat(n);
  T(U.page === 'PERF' ? 'TAKE OFF' : U.page === 'F-PLN' ? 'FLIGHT PLAN' : 'INIT', CC.w, 12, 0, true, 'center');
  if (U.page === 'INIT') {
    label('L', 1, 'CO RTE'); data('L', 1, '----------', CC.w);
    label('R', 1, 'FROM/TO'); data('R', 1, f.from ? `${f.from}/${f.to}` : `${box(4)}/${box(4)}`, f.from ? CC.c : CC.a);
    label('L', 3, 'FLT NBR'); data('L', 3, f.flt || box(8), f.flt ? CC.c : CC.a);
    label('R', 3, 'BARO REF'); data('R', 3, f.baro ? (f.baro.unit === 'inHg' ? f.baro.ih.toFixed(2) : String(Math.round(f.baro.hpa))) : box(4), f.baro ? CC.c : CC.a);
    label('L', 5, 'COST INDEX'); data('L', 5, f.ci != null ? String(f.ci) : box(3), f.ci != null ? CC.c : CC.a);
    label('R', 5, 'CRZ FL'); data('R', 5, f.crz ? 'FL' + String(f.crz).padStart(3, '0') : box(5), f.crz ? CC.c : CC.a);
    const st = fmsStatus(f); T(`INIT ${st.init ? 'OK' : '--'}   F-PLN ${st.fpln ? 'OK' : '--'}   PERF ${st.perf ? 'OK' : '--'}`, st.all ? CC.g : CC.grey, 12, 11, false, 'center');
  } else if (U.page === 'F-PLN') {
    if (!f.from) { T('NO FLIGHT PLAN', CC.w, 12, 6, true, 'center'); T('ENTER FROM/TO ON INIT', CC.grey, 12, 8, false, 'center'); }
    else {
      label('L', 1, 'DEPARTURE RWY'); data('L', 1, f.from + (f.depRwy || box(3)), f.depRwy ? CC.g : CC.a);
      const R = f.from === 'ZZAA' && f.to === 'ZZBB' ? ['GPX01', 'GPX02', 'GPX03'] : f.from === 'ZZBB' && f.to === 'ZZAA' ? ['GPX05', 'GPX04', 'GPX03'] : ['(DIRECT)'];
      R.forEach((id, i) => { data('L', i + 2, id, CC.g); });
      [['5000', 'FL100', ''], ['', '', '']][f.from === 'ZZAA' ? 0 : 1].forEach((c, i) => { if (c) data('R', i + 2, c, CC.m); });
      label('L', 5, 'ARRIVAL RWY'); data('L', 5, f.to + (f.arrRwy || box(2)), f.arrRwy ? CC.g : CC.a);
      label('R', 5, 'DIST'); data('R', 5, f.from === 'ZZAA' && f.to === 'ZZBB' ? '196 NM' : '---', CC.g);
      label('L', 6, 'DEST'); data('L', 6, f.to + (f.arrRwy || ''), CC.w);
    }
  } else if (U.page === 'PERF') {
    label('L', 1, 'V1'); data('L', 1, f.v1 ? String(f.v1) : box(3), f.v1 ? CC.c : CC.a);
    label('L', 2, 'VR'); data('L', 2, f.vr ? String(f.vr) : box(3), f.vr ? CC.c : CC.a);
    label('L', 3, 'V2'); data('L', 3, f.v2 ? String(f.v2) : box(3), f.v2 ? CC.c : CC.a);
    label('R', 1, 'RWY'); data('R', 1, f.depRwy || '---', CC.g);
    label('R', 3, 'FLAPS'); data('R', 3, ['UP', '1', '2', '3', 'FULL'][sys.sw.flaps] || '-', CC.g);
    label('R', 4, 'FLEX TO TEMP'); data('R', 4, f.flex ? f.flex + '°' : box(2) + '°', f.flex ? CC.c : CC.a);
    label('L', 5, 'TRANS ALT'); data('L', 5, '5000', CC.g);
  }
  // scratchpad
  T(U.msg || U.sp, U.msg ? CC.a : CC.w, 0.3, 13);
  x.font = `600 ${lh * 0.48}px ${LCDF}`; x.textAlign = 'right'; x.fillStyle = '#1f6f86'; x.fillText('GENERIC · SIMPLIFIED', W - cw * 0.3, 12.5 * lh);
}

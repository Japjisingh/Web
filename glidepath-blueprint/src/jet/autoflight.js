/* Simplified generic autoflight for the trainer: flight directors, autopilot, autothrust and the flight mode
   annunciator. Our own simplified logic, clearly not any manufacturer's: take-off (SRS / RWY), climb (CLB / OP CLB),
   descent (DES / OP DES, idle thrust), altitude capture and hold, V/S, heading, a simple NAV along the flight-plan legs,
   the ILS approach (APPR arms LOC and G/S; capture LOC* → LOC, G/S* → G/S), managed approach speed, go-around
   (SRS | GA TRK) and the RETARD call. No autoland: the autopilot must be off by about 100 ft. No three.js. */
import { AF, KT, FT } from './fdm.js';
import { routePoints, brg, dist } from './navdata.js';
import { toEN, ELEV_FT, ilsDev, ILS } from './layout.js';
import { fmsStatus, apprSpeeds } from './avionics.js';

const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrap180 = d => ((d % 360) + 540) % 360 - 180;
export const THR_RED_FT = 1500, ACC_FT = 1500;

/** N1 command for a thrust lever position L (0 IDLE, 1 CL, 2 FLX/MCT, 3 TOGA; values between detents are linear) */
export function leverN1(L, idle, flex, alt = ELEV_FT) {
  const lapse = Math.max(0, (alt - ELEV_FT) / 1000) * 0.25;           // climb N1 limit creeps up a little with altitude
  const cl = 84 + lapse, flx = flex ? Math.min(92, 92 - (flex - 15) * 0.2) : 88, toga = 92;
  if (L <= 1) return idle + (cl - idle) * L;
  if (L <= 2) return cl + (flx - cl) * (L - 1);
  return flx + (toga - flx) * Math.min(1, L - 2);
}
export const clN1 = alt => leverN1(1, 20, 0, alt);
export const inDetent = (L, d) => Math.abs(L - d) < 0.06;

export function createAutoflight() {
  return { lat: '', latArm: '', vert: '', vertArm: '', thr: '', thrFlash: false, athrActive: false, spdTgt: 0, spdSrc: '',
    fdQ: 0, fdP: 0, fdPitch: 0, fdRoll: 0, ap: null, n1i: 60, lastIas: 0, trkHold: null, legI: 1, phase: 'PRE', capT: 0, lvrClb: false, alts: 0, gaLat: false, gaSpd: 0, retard: false, cap: '' };
}

/** one autoflight step: updates modes and returns { ap: {q, p} | null, n1: [N1 cmd, N1 cmd] | null } */
export function autoflight(sys, dt) {
  const s = sys.st, w = sys.sw, A = s.af, Fd = s.fdm, F = s.av.fcu, fm = s.av.fms;
  const onG = Fd.onGround, ra = Fd.ra, alt = Fd.alt, ias = Fd.ias;
  const L = Math.max(w.thr1, w.thr2), Lmin = Math.min(w.thr1, w.thr2);
  const v2 = fm.v2 || 145, fdOn = w.fdL || w.fdR;
  const acc = (ias - A.lastIas) / Math.max(dt, 1e-3); A.lastIas = ias; A.acc = (A.acc || 0) + (acc - (A.acc || 0)) * Math.min(1, dt * 1.5);
  // --- take-off thrust arms A/THR; reduction altitude asks for the levers to CL
  const toThrust = L >= 1.94;
  if (onG && toThrust && fdOn && !w.athr) sys.setSwitch('athr', true);
  const agl = alt - ELEV_FT;
  if (!onG && agl > THR_RED_FT && toThrust) A.lvrClb = true;
  if (L <= 1.06) A.lvrClb = false;
  A.athrActive = !!(w.athr && !onG && L > 0.04 && L <= 1.06 && A.phase !== 'PRE');
  // --- vertical / lateral modes
  if (onG) {
    if (toThrust || Fd.gs > 30) A.phase = 'TO';
    else if (A.phase !== 'TO') A.phase = 'PRE';
    A.vert = fdOn && fm.v2 ? 'SRS' : ''; A.vertArm = fdOn && fm.v2 ? (F.altMan ? 'CLB' : '') : '';
    A.lat = fdOn && fm.v2 ? 'RWY' : ''; A.latArm = fdOn && fm.v2 && fmsStatus(fm).fpln && F.hdgMan ? 'NAV' : '';
    A.trkHold = null;
  } else {
    if (A.phase === 'TO' || A.phase === 'PRE') A.phase = 'CLIMB';
    // vertical
    const tgtFt = F.alt, errFt = tgtFt - alt;
    if (A.vert === 'SRS' && agl > ACC_FT && A.phase !== 'GA') A.vert = F.vsMode ? 'V/S' : F.altMan ? 'CLB' : 'OP CLB';
    if (A.vert === 'SRS' && A.phase === 'GA' && L <= 1.06 && agl > 400) { A.vert = F.altMan ? 'CLB' : 'OP CLB'; }
    if (A.vert === '' && fdOn) A.vert = agl < ACC_FT ? 'SRS' : 'CLB';
    if (F.vsMode && A.vert !== 'SRS' && A.vert !== 'ALT' && A.vert !== 'ALT*' && A.vert !== 'G/S' && A.vert !== 'G/S*') A.vert = 'V/S';
    if ((A.vert === 'CLB' || A.vert === 'OP CLB') && !F.altMan) A.vert = 'OP CLB'; else if (A.vert === 'OP CLB' && F.altMan) A.vert = 'CLB';
    if ((A.vert === 'DES' || A.vert === 'OP DES') && !F.altMan) A.vert = 'OP DES'; else if (A.vert === 'OP DES' && F.altMan) A.vert = 'DES';
    const capWin = Math.max(150, Math.abs(Fd.vs / FT * 60) / 6), gsMode = A.vert === 'G/S' || A.vert === 'G/S*';
    if ((A.vert === 'CLB' || A.vert === 'OP CLB' || A.vert === 'V/S' || A.vert === 'SRS' || A.vert === 'DES' || A.vert === 'OP DES') && Math.abs(errFt) < capWin && agl > 400 && !(A.vert === 'V/S' && Math.sign(F.vs || 0) !== Math.sign(errFt) && Math.abs(errFt) > 60)) { A.vert = 'ALT*'; A.capT = 0; }
    if (A.vert === 'ALT*') { A.capT += dt; if (Math.abs(errFt) < 25 && Math.abs(Fd.vs / FT * 60) < 150) { A.vert = 'ALT'; if (A.phase === 'CLIMB' || A.phase === 'DES') A.phase = 'CRZ'; } }
    if (A.vert === 'ALT' && Math.abs(errFt) > 250 && !F.vsMode) { A.vert = errFt > 0 ? (F.altMan ? 'CLB' : 'OP CLB') : (F.altMan ? 'DES' : 'OP DES'); if (errFt < 0 && A.phase === 'CRZ') A.phase = 'DES'; }
    else if (A.vert === 'ALT' && Math.abs(errFt) > 250) A.vert = 'V/S';
    if (!gsMode) A.vertArm = (A.vert === 'SRS' && A.phase !== 'GA') || A.vert === 'CLB' || A.vert === 'OP CLB' || A.vert === 'V/S' || A.vert === 'DES' || A.vert === 'OP DES' ? 'ALT' : A.vertArm === 'G/S' ? 'G/S' : '';
    // lateral
    if ((ra > 30 || A.lat !== 'RWY') && A.lat !== 'LOC*' && A.lat !== 'LOC' && !(A.lat === 'GA TRK' && A.gaLat)) {
      if (!F.hdgMan) A.lat = F.trk ? 'TRK' : 'HDG';
      else if (A.latArm === 'NAV' || A.lat === 'NAV') A.lat = 'NAV';
      else { A.lat = 'RWY TRK'; if (A.trkHold == null) A.trkHold = Fd.trk; }
      if (A.lat !== 'RWY') A.latArm = '';
    }
  }
  // --- ILS: deviations from the 3D runway geometry (receivers tuned when an approach is selected on the ARRIVAL page)
  const ils = s.ils = fm.appr ? ilsDev(Fd.x, Fd.z, Fd.h) : null;
  if (!onG) {
    // go-around: TOGA in the air with flaps out (approach phase) → SRS | GA TRK, approach modes disarmed
    if (L >= 2.94 && Fd.flap > 0.5 && A.phase !== 'GA' && A.phase !== 'TO' && A.phase !== 'CLIMB') {
      A.phase = 'GA'; A.vert = 'SRS'; A.lat = 'GA TRK'; A.gaLat = true; A.trkHold = Fd.trk; A.latArm = ''; A.vertArm = ''; w.appr = false; w.loc = false; A.retard = false;
      A.gaSpd = Math.max(Math.round(ias), apprSpeeds(fm).vapp); sys.emit && sys.emit('goAround', { ra, ias });
    }
    if (A.phase === 'GA' && A.vert === 'SRS') A.vertArm = 'CLB';
    // approach modes: APPR arms LOC and G/S, LOC arms LOC only
    const armL = (w.appr || w.loc) && A.lat !== 'LOC*' && A.lat !== 'LOC', armG = w.appr && A.vert !== 'G/S*' && A.vert !== 'G/S';
    if (ils && ils.locValid) {
      const conv = Math.abs(ils.loc) < 0.4 || Math.sign(((Fd.trk - ILS.crs + 540) % 360) - 180) === -Math.sign(ils.loc);   // heading back towards the course
      if (armL && Math.abs(ils.loc) < 1.6 && conv) { A.lat = 'LOC*'; A.capT = 0; sys.emit && sys.emit('fma', { what: 'LOC*' }); }
      if (A.lat === 'LOC*' && Math.abs(ils.loc) < 0.25 && Math.abs(((Fd.trk - ILS.crs + 540) % 360) - 180) < 6) A.lat = 'LOC';
      if (armG && ils.gsValid && (A.lat === 'LOC*' || A.lat === 'LOC') && ils.gs < 0.9 && ils.gs > -0.45) { A.vert = 'G/S*'; sys.emit && sys.emit('fma', { what: 'G/S*' }); }
      if (A.vert === 'G/S*' && Math.abs(ils.gs) < 0.12) A.vert = 'G/S';
    }
    if (!w.appr && !w.loc && (A.lat === 'LOC*' || A.lat === 'LOC')) { A.lat = 'HDG'; F.hdgMan = false; F.hdg = Math.round(Fd.hdg); }   // approach mode disarmed: back to heading / vertical speed
    if (!w.appr && (A.vert === 'G/S*' || A.vert === 'G/S')) { A.vert = 'V/S'; F.vsMode = true; F.vs = Math.round(Fd.vs / FT * 60 / 100) * 100; }
    if (A.lat !== 'LOC*' && A.lat !== 'LOC' && A.lat !== 'GA TRK' && armL) A.latArm = 'LOC'; else if (A.lat === 'LOC*' || A.lat === 'LOC' || (!w.appr && !w.loc && A.latArm === 'LOC')) A.latArm = '';
    if (A.vert !== 'G/S*' && A.vert !== 'G/S' && armG) A.vertArm = 'G/S'; else if (A.vert === 'G/S*' || A.vert === 'G/S' || (!w.appr && A.vertArm === 'G/S')) A.vertArm = '';
    // approach phase: APPR armed or captured, or flaps out after the climb (managed speed then follows the configuration)
    if (A.phase !== 'GA' && A.phase !== 'TO' && (w.appr || A.lat === 'LOC' || (Fd.flap > 0.5 && A.phase !== 'CLIMB') || fm.apprPhase)) { if (A.phase !== 'APPR') sys.emit && sys.emit('apprPhase'); A.phase = 'APPR'; fm.apprPhase = true; }
    // capability (generic): CAT 1 with the approach armed or captured
    A.cap = w.appr || A.vert === 'G/S' ? (w.ap1 && w.ap2 ? 'CAT 1 DUAL' : 'CAT 1') : '';
  }
  // --- speed target
  const vfe = AF.VFE[Math.round(Fd.flap)] ?? 350, vmax = Math.min(vfe, Fd.gear > 0.05 ? AF.VLE : 999, AF.VMO);
  const SP = apprSpeeds(fm); A.sp = SP;
  if (!F.spdMan) { A.spdTgt = F.unit === 'SPD' ? F.spd : F.mach * 600; A.spdSrc = 'SEL'; }
  else if (A.phase === 'GA' && A.vert === 'SRS') { A.spdTgt = A.gaSpd; A.spdSrc = 'MAN'; }
  else if (A.vert === 'SRS' || onG) { A.spdTgt = v2 + 10; A.spdSrc = 'MAN'; }
  else if (A.phase === 'APPR' || A.phase === 'GA') { const c = Math.round(Fd.flap); A.spdTgt = c === 0 ? SP.gd : c === 1 ? SP.s : c === 2 ? SP.f : c === 3 && SP.conf === 4 ? SP.f - 10 : SP.vapp; A.spdTgt = Math.min(A.spdTgt, vmax - 5); A.spdSrc = 'MAN'; }
  else { A.spdTgt = Math.min(250, vmax - 5); A.spdSrc = 'MAN'; }
  A.vmax = vmax;
  // --- guidance: target flight path / bank → pitch and roll rate commands (also drive the flight director bars)
  let qc = 0, pc = 0, thC = Fd.pitch, phC = 0;
  if (!onG) {
    const alpha = Fd.pitch - Fd.gamma, V = Math.max(40, Fd.tas);
    let gc;
    if (A.vert === 'G/S*' || A.vert === 'G/S') { const tg = Math.tan(ILS.deg * D2R), gsm = Math.max(30, Fd.gs * KT); const vsc = clamp(-gsm * tg - ils.hErr * (A.vert === 'G/S' ? 0.16 : 0.1), -12, A.vert === 'G/S*' ? 0 : 3); gc = Math.asin(clamp(vsc / V, -0.25, 0.1)); }
    else if (A.vert === 'DES' || A.vert === 'OP DES') { gc = clamp(Math.asin(clamp(Math.sin(Fd.gamma) + A.acc * KT / 9.81, -0.3, 0.3)) + clamp(ias - A.spdTgt, -15, 15) * 0.18 * D2R, -6 * D2R, -0.5 * D2R); }
    else if (A.vert === 'SRS' || A.vert === 'CLB' || A.vert === 'OP CLB') { gc = clamp(Math.asin(clamp(Math.sin(Fd.gamma) + A.acc * KT / 9.81, -0.3, 0.3)) + clamp(ias - A.spdTgt, -15, 15) * 0.18 * D2R, 0.8 * D2R, 16 * D2R); } // speed on pitch: steady climb angle + speed error
    else if (A.vert === 'V/S') gc = Math.asin(clamp((F.trk ? Math.sin(F.fpa * D2R) * V : F.vs * FT / 60) / V, -0.25, 0.25));
    else if (A.vert === 'ALT*' || A.vert === 'ALT') { const vsc = clamp((F.alt - alt) * FT * (A.vert === 'ALT' ? 0.12 : 0.09), -12, 12); gc = Math.asin(clamp(vsc / V, -0.25, 0.25)); }
    else gc = Fd.gamma;
    thC = clamp(gc + alpha, -10 * D2R, (A.vert === 'SRS' ? 18 : 20) * D2R);
    qc = clamp((thC - Fd.pitch) * 0.9, -3 * D2R, 3 * D2R);
    let hdgT = null;
    if (A.lat === 'HDG' || A.lat === 'TRK') hdgT = F.hdg;
    else if (A.lat === 'RWY TRK' || A.lat === 'GA TRK') hdgT = A.trkHold ?? Fd.trk;
    else if ((A.lat === 'LOC*' || A.lat === 'LOC') && ils) { const yRate = Fd.gs * KT * Math.sin(((Fd.trk - ILS.crs + 540) % 360 - 180) * D2R); hdgT = ILS.crs + clamp(-ils.yErr * 0.035 - yRate * (A.lat === 'LOC' ? 0.5 : 0.25), -30, 30); }
    else if (A.lat === 'NAV') {
      const pts = routePoints(fm), pos = toEN(Fd.x, Fd.z);
      if (A.legI < 1) A.legI = 1;
      while (A.legI < pts.length - 1 && dist(pos, pts[A.legI]) < 1.2) A.legI++;
      const tgt = pts[A.legI]; hdgT = tgt ? brg(pos, tgt) : Fd.trk;
    }
    if (hdgT != null) { const ref = A.lat === 'HDG' ? Fd.hdg : Fd.trk; phC = clamp(wrap180(hdgT - ref) * 1.6, -25, A.lat === 'LOC' ? 15 : 25) * D2R; if (A.lat === 'LOC') phC = clamp(phC, -15 * D2R, 15 * D2R); }
    pc = clamp((phC - Fd.roll) * 0.9, -5 * D2R, 5 * D2R);
  } else if (A.lat === 'RWY') { phC = 0; }
  A.fdPitch = (thC - Fd.pitch) / D2R; A.fdRoll = (phC - Fd.roll) / D2R;
  // --- autopilot: engages above about 100 ft (logic in fcuRule); the stick moved hard disconnects it
  const apOn = (w.ap1 || w.ap2) && !onG;
  if (apOn && (Math.abs(s.inp.pitch) > 0.45 || Math.abs(s.inp.roll) > 0.45)) { w.ap1 = false; w.ap2 = false; sys.emit && sys.emit('apOff', { why: 'stick' }); }
  // no autoland in this trainer: below about 50 ft the autopilot disconnects itself (it should be off by about 100 ft)
  if (apOn && (w.ap1 || w.ap2) && ra < 50 && Fd.vs < 0 && A.phase === 'APPR') { w.ap1 = false; w.ap2 = false; sys.emit && sys.emit('apOff', { why: 'auto' }); }
  A.ap = (w.ap1 || w.ap2) && !onG ? { q: qc, p: pc } : null;
  // --- autothrust
  let n1 = null;
  if (A.athrActive) {
    const idle = 20, cl = clN1(alt), limit = clamp(Math.max(idle, cl * Math.min(1, L)), idle, cl);
    if (A.vert === 'SRS' || A.vert === 'CLB' || A.vert === 'OP CLB') { A.thr = 'THR CLB'; A.n1c = limit; A.n1i = limit; }
    else if (A.vert === 'DES' || A.vert === 'OP DES') { const lo = ias > A.spdTgt + 3 || A.acc > 0.6 ? idle : null; A.thr = lo != null ? 'THR IDLE' : 'SPEED'; const err = A.spdTgt - ias; if (lo != null) { A.n1c = idle; A.n1i = 40; } else { A.n1i = clamp(A.n1i + err * 0.35 * dt, 35, cl); A.n1c = clamp(A.n1i + err * 1.4 - A.acc * 5, idle, limit); } }
    else { A.thr = 'SPEED'; const err = A.spdTgt - ias; A.n1i = clamp(A.n1i + err * 0.35 * dt, 35, cl); A.n1c = clamp(A.n1i + err * 1.4 - A.acc * 5, idle, limit); }
    n1 = [A.n1c, A.n1c];
  } else if (w.athr && toThrust) A.thr = Lmin >= 2.94 ? 'MAN TOGA' : `MAN FLX ${fm.flex ? '+' + fm.flex : ''}`.trim();
  else if (toThrust) A.thr = Lmin >= 2.94 ? 'MAN TOGA' : 'MAN FLX';
  else A.thr = '';
  if (A.lvrClb) A.thr = 'LVR CLB';
  // RETARD: at about 20 ft on the approach the levers should come back to idle
  A.retard = !onG && ra < 21 && A.phase === 'APPR' && Fd.vs < 0 && L > 0.04 ? true : onG || L <= 0.04 ? false : A.retard;
  if (A.retard) A.thr = 'RETARD';
  if (onG && Fd.landed) { A.lat = ''; A.vert = ''; A.latArm = ''; A.vertArm = ''; }
  return { ap: A.ap, n1 };
}

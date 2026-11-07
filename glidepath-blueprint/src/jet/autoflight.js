/* Simplified generic autoflight for the trainer: flight directors, autopilot, autothrust and the flight mode
   annunciator. Our own simplified logic, clearly not any manufacturer's: take-off (SRS / RWY), climb (CLB / OP CLB),
   altitude capture and hold, V/S, heading and a simple NAV along the flight-plan legs. No three.js. */
import { AF, KT, FT } from './fdm.js';
import { routePoints, brg, dist } from './navdata.js';
import { toEN, ELEV_FT } from './layout.js';
import { fmsStatus } from './avionics.js';

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
    fdQ: 0, fdP: 0, fdPitch: 0, fdRoll: 0, ap: null, n1i: 60, lastIas: 0, trkHold: null, legI: 1, phase: 'PRE', capT: 0, lvrClb: false, alts: 0 };
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
    if (A.vert === 'SRS' && agl > ACC_FT) A.vert = F.vsMode ? 'V/S' : F.altMan ? 'CLB' : 'OP CLB';
    if (A.vert === '' && fdOn) A.vert = agl < ACC_FT ? 'SRS' : 'CLB';
    if (F.vsMode && A.vert !== 'SRS' && A.vert !== 'ALT' && A.vert !== 'ALT*') A.vert = 'V/S';
    if ((A.vert === 'CLB' || A.vert === 'OP CLB') && !F.altMan) A.vert = 'OP CLB'; else if (A.vert === 'OP CLB' && F.altMan) A.vert = 'CLB';
    const capWin = Math.max(150, Math.abs(Fd.vs / FT * 60) / 6);
    if ((A.vert === 'CLB' || A.vert === 'OP CLB' || A.vert === 'V/S' || A.vert === 'SRS') && Math.abs(errFt) < capWin && agl > 400) { A.vert = 'ALT*'; A.capT = 0; }
    if (A.vert === 'ALT*') { A.capT += dt; if (Math.abs(errFt) < 25 && Math.abs(Fd.vs / FT * 60) < 150) A.vert = 'ALT'; }
    if (A.vert === 'ALT' && Math.abs(errFt) > 250) A.vert = errFt > 0 ? (F.altMan ? 'CLB' : 'OP CLB') : 'V/S';
    A.vertArm = A.vert === 'SRS' || A.vert === 'CLB' || A.vert === 'OP CLB' || A.vert === 'V/S' ? 'ALT' : '';
    // lateral
    if (ra > 30 || A.lat !== 'RWY') {
      if (!F.hdgMan) A.lat = F.trk ? 'TRK' : 'HDG';
      else if (A.latArm === 'NAV' || A.lat === 'NAV') A.lat = 'NAV';
      else { A.lat = 'RWY TRK'; if (A.trkHold == null) A.trkHold = Fd.trk; }
      if (A.lat !== 'RWY') A.latArm = '';
    }
  }
  // --- speed target
  const vfe = AF.VFE[Math.round(Fd.flap)] ?? 350, vmax = Math.min(vfe, Fd.gear > 0.05 ? AF.VLE : 999, AF.VMO);
  if (!F.spdMan) { A.spdTgt = F.unit === 'SPD' ? F.spd : F.mach * 600; A.spdSrc = 'SEL'; }
  else if (A.vert === 'SRS' || onG) { A.spdTgt = v2 + 10; A.spdSrc = 'MAN'; }
  else { A.spdTgt = Math.min(250, vmax - 5); A.spdSrc = 'MAN'; }
  A.vmax = vmax;
  // --- guidance: target flight path / bank → pitch and roll rate commands (also drive the flight director bars)
  let qc = 0, pc = 0, thC = Fd.pitch, phC = 0;
  if (!onG) {
    const alpha = Fd.pitch - Fd.gamma, V = Math.max(40, Fd.tas);
    let gc;
    if (A.vert === 'SRS' || A.vert === 'CLB' || A.vert === 'OP CLB') { gc = clamp(Math.asin(clamp(Math.sin(Fd.gamma) + A.acc * KT / 9.81, -0.3, 0.3)) + clamp(ias - A.spdTgt, -15, 15) * 0.18 * D2R, 0.8 * D2R, 16 * D2R); } // speed on pitch: steady climb angle + speed error
    else if (A.vert === 'V/S') gc = Math.asin(clamp((F.trk ? Math.sin(F.fpa * D2R) * V : F.vs * FT / 60) / V, -0.25, 0.25));
    else if (A.vert === 'ALT*' || A.vert === 'ALT') { const vsc = clamp((F.alt - alt) * FT * (A.vert === 'ALT' ? 0.12 : 0.09), -12, 12); gc = Math.asin(clamp(vsc / V, -0.25, 0.25)); }
    else gc = Fd.gamma;
    thC = clamp(gc + alpha, -10 * D2R, (A.vert === 'SRS' ? 18 : 20) * D2R);
    qc = clamp((thC - Fd.pitch) * 0.9, -3 * D2R, 3 * D2R);
    let hdgT = null;
    if (A.lat === 'HDG' || A.lat === 'TRK') hdgT = F.hdg;
    else if (A.lat === 'RWY TRK') hdgT = A.trkHold ?? Fd.trk;
    else if (A.lat === 'NAV') {
      const pts = routePoints(fm), pos = toEN(Fd.x, Fd.z);
      if (A.legI < 1) A.legI = 1;
      while (A.legI < pts.length - 1 && dist(pos, pts[A.legI]) < 1.2) A.legI++;
      const tgt = pts[A.legI]; hdgT = tgt ? brg(pos, tgt) : Fd.trk;
    }
    if (hdgT != null) { const ref = A.lat === 'HDG' ? Fd.hdg : Fd.trk; phC = clamp(wrap180(hdgT - ref) * 1.6, -25, 25) * D2R; }
    pc = clamp((phC - Fd.roll) * 0.9, -5 * D2R, 5 * D2R);
  } else if (A.lat === 'RWY') { phC = 0; }
  A.fdPitch = (thC - Fd.pitch) / D2R; A.fdRoll = (phC - Fd.roll) / D2R;
  // --- autopilot: engages above about 100 ft (logic in fcuRule); the stick moved hard disconnects it
  const apOn = (w.ap1 || w.ap2) && !onG;
  if (apOn && (Math.abs(s.inp.pitch) > 0.45 || Math.abs(s.inp.roll) > 0.45)) { w.ap1 = false; w.ap2 = false; sys.emit && sys.emit('apOff'); }
  A.ap = (w.ap1 || w.ap2) && !onG ? { q: qc, p: pc } : null;
  // --- autothrust
  let n1 = null;
  if (A.athrActive) {
    const idle = 20, cl = clN1(alt), limit = clamp(Math.max(idle, cl * Math.min(1, L)), idle, cl);
    if (A.vert === 'SRS' || A.vert === 'CLB' || A.vert === 'OP CLB') { A.thr = 'THR CLB'; A.n1c = limit; A.n1i = limit; }
    else { A.thr = 'SPEED'; const err = A.spdTgt - ias; A.n1i = clamp(A.n1i + err * 0.35 * dt, 35, cl); A.n1c = clamp(A.n1i + err * 1.4 - A.acc * 5, idle, limit); }
    n1 = [A.n1c, A.n1c];
  } else if (w.athr && toThrust) A.thr = Lmin >= 2.94 ? 'MAN TOGA' : `MAN FLX ${fm.flex ? '+' + fm.flex : ''}`.trim();
  else if (toThrust) A.thr = Lmin >= 2.94 ? 'MAN TOGA' : 'MAN FLX';
  else A.thr = '';
  if (A.lvrClb) A.thr = 'LVR CLB';
  return { ap: A.ap, n1 };
}

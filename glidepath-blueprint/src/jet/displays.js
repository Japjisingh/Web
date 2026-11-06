/* Canvas-drawn flight deck displays for the generic twin-jet trainer. Generic layouts and our own wording. */
import { fmtT, REF, OAT } from './systems.js';
import { AIRPORTS, VORS, NDBS, WPTS, AC, routePoints, brg, dist } from './navdata.js';
import { baroAlt, baroText, fmsStatus } from './avionics.js';

const F = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
const C = { g: '#35f27a', w: '#f2f6f8', a: '#ffad1f', c: '#36d6ff', m: '#ff4fd8', r: '#ff3a2e', y: '#ffe23a', grey: '#7d8a92', dk: '#2a3238', sky: '#2e86d8', gnd: '#8a5428' };
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fmtK = n => Math.round(n).toLocaleString('en-GB').replace(/,/g, ' ');

function txt(x, t, X, Y, col = C.w, size = 18, align = 'center', w = 600) { x.font = `${w} ${size}px ${F}`; x.fillStyle = col; x.textAlign = align; x.textBaseline = 'middle'; x.fillText(t, X, Y); }
function box(x, X, Y, W, H, col = C.w, lw = 2) { x.strokeStyle = col; x.lineWidth = lw; x.strokeRect(X, Y, W, H); }
function ln(x, pts, col = C.g, lw = 3) { x.strokeStyle = col; x.lineWidth = lw; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); }
function blank(x, N, M = N) { x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#000'; x.fillRect(0, 0, N, M); }
function flag(x, t, X, Y, size = 26) { txt(x, t, X, Y, C.r, size, 'center', 700); }

/* ---------------- PFD ---------------- */
const wrap180 = d => ((d % 360) + 540) % 360 - 180;
export function drawPFD(x, N, sys, side = 0) {
  blank(x, N); const s = sys.st, w = sys.sw, av = s.av, Fc = av.fcu, fm = av.fms, sd = side ? 'R' : 'L';
  const ir = s.irs[side === 0 ? 0 : 1];
  const adr = ir.mode !== 'OFF';
  const att = ir.att, hdgOk = ir.aligned || false;
  const k = N / 512; x.save(); x.scale(k, k);
  // flight mode annunciator: five columns (generic, our own layout)
  for (const X of [104, 196, 288, 380]) ln(x, [[X, 8], [X, 62]], C.grey, 2);
  const fdOn = w['fd' + sd], anyFd = w.fdL || w.fdR, ap = w.ap1 || w.ap2;
  const apT = w.ap1 && w.ap2 ? 'AP1+2' : w.ap1 ? 'AP1' : w.ap2 ? 'AP2' : '';
  if (apT) txt(x, apT, 442, 18, C.w, 16, 'center', 700);
  if (anyFd) txt(x, `${w.fdL ? '1' : '-'} FD ${w.fdR ? '2' : '-'}`, 442, 36, C.w, 16, 'center', 700);
  if (w.athr) txt(x, 'A/THR', 442, 54, C.c, 16, 'center', 700);
  if (anyFd || ap) {
    if (w.athr && !Fc.spdMan) txt(x, 'SPEED', 56, 18, C.g, 16, 'center', 700);
    if (Fc.vsMode) txt(x, Fc.trk ? `FPA ${Fc.fpa >= 0 ? '+' : ''}${Fc.fpa.toFixed(1)}` : `V/S ${Fc.vs >= 0 ? '+' : ''}${Fc.vs}`, 150, 18, C.g, 15, 'center', 700);
    if (w.appr) txt(x, 'G/S', 150, 38, C.c, 16, 'center', 700); else if (Fc.vsMode) txt(x, 'ALT', 150, 38, C.c, 16, 'center', 700);
    if (!Fc.hdgMan) txt(x, Fc.trk ? 'TRK' : 'HDG', 242, 18, C.g, 16, 'center', 700);
    if (w.loc || w.appr) txt(x, 'LOC', 242, 38, C.c, 16, 'center', 700); else if (Fc.hdgMan && fm.from && fm.to) txt(x, 'NAV', 242, 38, C.c, 16, 'center', 700);
    if (w.appr) txt(x, 'APPR', 334, 18, C.c, 15, 'center', 700);
    if (w.exped) txt(x, 'EXPED', 334, 38, C.g, 14, 'center', 700);
  }
  // attitude
  const cx = 240, cy = 230, pitch = 0.6, bank = 0;
  x.save(); x.beginPath(); x.roundRect(146, 112, 188, 236, 26); x.clip();
  if (att) {
    x.translate(cx, cy); x.rotate(-bank * D2R); const pp = 4.2; // px per degree
    x.fillStyle = C.sky; x.fillRect(-300, -600 + pitch * pp, 600, 600); x.fillStyle = C.gnd; x.fillRect(-300, pitch * pp, 600, 600);
    ln(x, [[-300, pitch * pp], [300, pitch * pp]], C.w, 2);
    for (let p = -30; p <= 30; p += 2.5) { if (!p) continue; const Y = (pitch - p) * pp, L = p % 10 === 0 ? 46 : p % 5 === 0 ? 26 : 12; ln(x, [[-L, Y], [L, Y]], C.w, 2); if (p % 10 === 0) { txt(x, String(Math.abs(p)), -L - 16, Y, C.w, 15); txt(x, String(Math.abs(p)), L + 16, Y, C.w, 15); } }
  } else { x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512); }
  x.restore();
  if (att) {
    // bank scale + pointer
    x.save(); x.translate(cx, cy); for (const a of [-45, -30, -20, -10, 0, 10, 20, 30, 45]) { const r1 = 112, r2 = a % 30 === 0 || a === 0 ? 124 : 118; ln(x, [[Math.sin(a * D2R) * r1, -Math.cos(a * D2R) * r1], [Math.sin(a * D2R) * r2, -Math.cos(a * D2R) * r2]], C.w, 2); }
    x.fillStyle = C.y; x.beginPath(); x.moveTo(0, -110); x.lineTo(-8, -98); x.lineTo(8, -98); x.closePath(); x.fill(); x.restore();
    // flight director bars (centred: no flight path to follow on the ground)
    if (fdOn) { x.lineCap = 'round'; ln(x, [[cx - 64, cy - 6], [cx + 64, cy - 6]], '#0a0a0a', 7); ln(x, [[cx - 64, cy - 6], [cx + 64, cy - 6]], C.g, 4); ln(x, [[cx + 4, cy - 70], [cx + 4, cy + 62]], '#0a0a0a', 7); ln(x, [[cx + 4, cy - 70], [cx + 4, cy + 62]], C.g, 4); x.lineCap = 'butt'; }
    // aircraft symbol
    x.fillStyle = '#000'; x.strokeStyle = C.y; x.lineWidth = 3;
    for (const sd2 of [-1, 1]) { x.beginPath(); x.rect(cx + sd2 * 34 - (sd2 > 0 ? 0 : 42), cy - 4, 42, 8); x.fill(); x.stroke(); }
    x.fillStyle = C.y; x.fillRect(cx - 5, cy - 5, 10, 10);
    // landing system scales (no usable signal at the stand: localizer pegged, glide slope absent)
    if (w['ls' + sd]) {
      for (const d of [-60, -30, 30, 60]) { x.strokeStyle = C.w; x.lineWidth = 2; x.beginPath(); x.arc(cx + d, 336, 4, 0, 7); x.stroke(); x.beginPath(); x.arc(344, cy + d, 4, 0, 7); x.stroke(); }
      ln(x, [[cx, 328], [cx, 344]], C.y, 3); ln(x, [[338, cy], [350, cy]], C.y, 3);
      if (fm.depRwy === '27R') { x.fillStyle = C.m; x.beginPath(); x.moveTo(cx + 66, 336); x.lineTo(cx + 74, 330); x.lineTo(cx + 74, 342); x.closePath(); x.fill(); }
    }
  } else flag(x, 'ATT', cx, cy, 30);
  if (w['ls' + sd]) { const tuned = fm.depRwy === '27R'; txt(x, 'ILS1', 8, 440, C.m, 15, 'left', 700); txt(x, tuned ? '109.90' : '---.--', 8, 458, C.m, 15, 'left'); if (tuned) txt(x, 'IZZA', 8, 476, C.m, 15, 'left'); }
  // speed tape (on the ground below 30 kt: scale floor), target speed and take-off speeds
  x.fillStyle = '#3b4248'; x.fillRect(46, 112, 70, 236);
  if (adr) {
    x.save(); x.beginPath(); x.rect(46, 112, 70, 236); x.clip();
    const spd = 30, ppk = 3.4; for (let v = 30; v <= 120; v += 10) { const Y = cy - (v - spd) * ppk; ln(x, [[104, Y], [116, Y]], C.w, 2); if (v % 20 === 0) txt(x, String(v), 88, Y, C.w, 18, 'right'); }
    x.restore(); ln(x, [[118, cy], [138, cy]], C.y, 4);
    const selT = Fc.unit === 'SPD' ? String(Fc.spd) : '.' + String(Math.round(Fc.mach * 100)).padStart(2, '0');
    if (!Fc.spdMan || Fc.prevSpd > 0) txt(x, selT, 81, 98, C.c, 19, 'center', 700);
    else if (fm.v2) txt(x, String(fm.v2), 81, 98, C.m, 19, 'center', 700);
    if (fm.v1 || fm.vr || fm.v2) {
      x.fillStyle = '#15191c'; x.fillRect(48, 114, 66, 52);
      [['V1', fm.v1], ['VR', fm.vr], ['V2', fm.v2]].forEach(([l, v], i) => { if (!v) return; txt(x, l, 52, 124 + i * 16, C.c, 12, 'left', 700); txt(x, String(v), 112, 124 + i * 16, i === 2 ? C.m : C.c, 14, 'right', 700); });
    }
  } else flag(x, 'SPD', 81, cy);
  // altitude tape: altitude follows the baro reference; selected altitude above the tape
  x.fillStyle = '#3b4248'; x.fillRect(370, 112, 64, 236);
  const altRaw = baroAlt(av, side), alt = Math.round(altRaw / 10) * 10;
  if (adr) {
    x.save(); x.beginPath(); x.rect(370, 112, 64, 236); x.clip();
    const ppf = 0.55; for (let a = Math.floor((alt - 500) / 100) * 100; a <= alt + 500; a += 100) { const Y = cy - (a - alt) * ppf; ln(x, [[370, Y], [382, Y]], C.w, 2); if (a % 500 === 0) txt(x, String(Math.max(0, a) / 100).padStart(2, '0'), 400, Y, C.w, 18, 'left'); }
    x.restore();
    x.fillStyle = '#000'; x.fillRect(372, cy - 18, 70, 36); box(x, 372, cy - 18, 70, 36, C.y, 2); txt(x, String(alt).padStart(5, ' '), 438, cy, C.g, 22, 'right', 700);
    txt(x, String(Fc.alt), 402, 98, Fc.altMan ? C.m : C.c, 19, 'center', 700);
    const B = av.baro[side];
    if (B.std) { x.fillStyle = '#000'; x.fillRect(377, 357, 52, 24); box(x, 377, 357, 52, 24, C.y, 2); txt(x, 'STD', 403, 369, C.c, 18, 'center', 700); }
    else { const u = w['baroUnit' + sd]; txt(x, 'QNH', 403, 360, C.w, 13, 'center', 600); txt(x, baroText(av, side, u), 403, 379, C.c, 19, 'center', 700); }
  } else flag(x, 'ALT', 402, cy);
  // vertical speed scale
  x.fillStyle = '#2f353a'; x.beginPath(); x.moveTo(448, 140); x.lineTo(482, 170); x.lineTo(482, 290); x.lineTo(448, 320); x.closePath(); x.fill();
  if (adr) { for (const [v, Y] of [[0, cy], [1, cy - 30], [2, cy - 55], [6, cy - 80], [-1, cy + 30], [-2, cy + 55], [-6, cy + 80]]) { ln(x, [[452, Y], [462, Y]], C.w, 2); if (v && Math.abs(v) !== 1) txt(x, String(Math.abs(v)), 474, Y, C.w, 13); } ln(x, [[492, cy], [456, cy]], C.g, 3); } else flag(x, 'V/S', 466, cy, 18);
  // heading tape with the selected-heading bug
  x.fillStyle = '#3b4248'; x.fillRect(150, 376, 180, 40);
  if (hdgOk) {
    const hdg = AC.hdg, pph = 7;
    x.save(); x.beginPath(); x.rect(150, 376, 180, 40); x.clip();
    for (let h = 250; h <= 300; h += 5) { const X = 240 + (h - hdg) * pph; ln(x, [[X, 376], [X, h % 10 ? 384 : 390]], C.w, 2); if (h % 10 === 0) txt(x, String(h / 10).padStart(2, '0'), X, 402, C.w, 17); }
    x.restore(); ln(x, [[240, 370], [240, 392]], C.y, 4);
    if (!Fc.hdgMan || Fc.prevHdg > 0) {
      const d = wrap180(Fc.hdg - hdg);
      if (Math.abs(d) <= 12.5) { const X = 240 + d * pph; x.fillStyle = C.c; x.beginPath(); x.moveTo(X, 378); x.lineTo(X - 7, 366); x.lineTo(X + 7, 366); x.closePath(); x.fill(); }
      else txt(x, String(Fc.hdg).padStart(3, '0'), d < 0 ? 168 : 312, 362, C.c, 17, 'center', 700);
    }
  } else flag(x, 'HDG', 240, 396);
  if (ir.mode === 'NAV' && !ir.aligned && ir.mode !== 'OFF') txt(x, 'IRS ALIGN ' + fmtT(sys.alignRemaining()), 240, 448, C.w, 18);
  else if (ir.mode === 'ATT') txt(x, 'IRS ATT MODE', 240, 448, C.a, 18);
  x.restore();
}

/* ---------------- ND: ROSE LS / VOR / NAV, ARC, PLAN; ranges 10 to 320 NM; overlays ---------------- */
const ND_NAME = { LS: 'ROSE LS', VOR: 'ROSE VOR', NAV: 'ROSE NAV', ARC: 'ARC', PLAN: 'PLAN' };
function star(x, X, Y, r, col) { x.strokeStyle = col; x.lineWidth = 2; x.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.35 : r, b = i * Math.PI / 4; i ? x.lineTo(X + Math.cos(b) * rr, Y + Math.sin(b) * rr) : x.moveTo(X + Math.cos(b) * rr, Y + Math.sin(b) * rr); } x.closePath(); x.stroke(); }
export function drawND(x, N, sys, side = 0) {
  blank(x, N); const s = sys.st, w = sys.sw, av = s.av, Fc = av.fcu, fm = av.fms, sd = side ? 'R' : 'L';
  const ir = s.irs[side === 0 ? 0 : 1];
  const mode = w['ndMode' + sd] || 'ARC', range = w['ndRange' + sd] || 10, ovl = w['ovl' + sd];
  const rose = mode === 'LS' || mode === 'VOR' || mode === 'NAV', plan = mode === 'PLAN', arc = mode === 'ARC';
  const k = N / 512; x.save(); x.scale(k, k);
  txt(x, 'GS', 18, 22, C.w, 16, 'left'); txt(x, '0', 50, 22, C.g, 18, 'left'); txt(x, 'TAS', 82, 22, C.w, 16, 'left'); txt(x, '---', 122, 22, C.g, 18, 'left');
  txt(x, '---/---', 18, 44, C.g, 16, 'left');
  const cx = 256, cy = arc ? 440 : 272, R = arc ? 330 : 176, hdg = AC.hdg, sc = R / range;
  txt(x, `${ND_NAME[mode]}  ${range}`, 500, 498, C.grey, 13, 'right', 600);
  if (!ir.aligned) {
    x.strokeStyle = C.r; x.lineWidth = 2; x.beginPath(); if (arc) x.arc(cx, cy, R, Math.PI * 1.17, Math.PI * 1.83); else x.arc(cx, cy, R, 0, 7); x.stroke();
    flag(x, 'HDG', 256, arc ? 92 : 70, 26);
    txt(x, ir.mode === 'NAV' ? 'IRS ALIGNING ' + fmtT(sys.alignRemaining()) : 'MAP NOT AVAIL', 256, arc ? 260 : 272, ir.mode === 'NAV' ? C.w : C.r, 20, 'center', 700);
    x.restore(); return;
  }
  const h = hdg * D2R;
  const proj = p => { const de = p.e - AC.e, dn = p.n - AC.n; if (plan) return [cx + de * sc, cy - dn * sc]; const right = de * Math.cos(h) - dn * Math.sin(h), fwd = de * Math.sin(h) + dn * Math.cos(h); return [cx + right * sc, cy - fwd * sc]; };
  const pts = routePoints(fm);
  // compass
  x.save();
  if (arc) {
    x.strokeStyle = C.w; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, R, Math.PI * 1.17, Math.PI * 1.83); x.stroke();
    for (let hh = 0; hh < 360; hh += 5) { const a = wrap180(hh - hdg) * D2R; if (Math.abs(a) > 0.7) continue; const L = hh % 10 ? 9 : 16; ln(x, [[cx + Math.sin(a) * R, cy - Math.cos(a) * R], [cx + Math.sin(a) * (R + L), cy - Math.cos(a) * (R + L)]], C.w, 2); if (hh % 30 === 0) txt(x, String(hh / 10), cx + Math.sin(a) * (R + 30), cy - Math.cos(a) * (R + 30), C.w, 18); }
    x.setLineDash([6, 8]); x.beginPath(); x.arc(cx, cy, R / 2, Math.PI * 1.17, Math.PI * 1.83); x.stroke(); x.setLineDash([]);
    txt(x, String(range / 2), cx - R / 2 * 0.5 - 18, cy - R / 2 * 0.86 + 6, C.c, 14);
  } else {
    x.strokeStyle = C.w; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.stroke();
    const up = plan ? 0 : hdg;
    for (let hh = 0; hh < 360; hh += plan ? 30 : 5) { const a = (hh - up) * D2R; const L = plan ? 10 : hh % 10 ? 8 : 15; ln(x, [[cx + Math.sin(a) * R, cy - Math.cos(a) * R], [cx + Math.sin(a) * (R - L), cy - Math.cos(a) * (R - L)]], C.w, 2); if (!plan && hh % 30 === 0) txt(x, String(hh / 10), cx + Math.sin(a) * (R - 28), cy - Math.cos(a) * (R - 28), C.w, 16); }
    if (plan) for (const [t, a] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) txt(x, t, cx + Math.sin(a * D2R) * (R + 16), cy - Math.cos(a * D2R) * (R + 16), C.w, 18, 'center', 700);
    x.setLineDash([6, 8]); x.beginPath(); x.arc(cx, cy, R / 2, 0, 7); x.stroke(); x.setLineDash([]);
    txt(x, String(range / 2), cx + R / 2 * 0.71 + 14, cy - R / 2 * 0.71 - 8, C.c, 14);
  }
  // map content (clipped)
  x.beginPath(); x.arc(cx, cy, R - 1, 0, 7); x.clip(); if (arc) { x.beginPath(); x.rect(0, 58, 512, 420); x.clip(); }
  const vis = ([X, Y]) => X > -40 && X < 552 && Y > -40 && Y < 552;
  if (ovl === 'ARPT') for (const [id, a] of Object.entries(AIRPORTS)) { const q = proj(a); if (!vis(q)) continue; star(x, q[0], q[1], 9, C.m); if (Math.hypot(q[0] - (plan ? proj(AC)[0] : cx), q[1] - (plan ? proj(AC)[1] : cy)) > 30) txt(x, id, q[0] + 13, q[1] - 10, C.m, 14, 'left'); }
  if (ovl === 'VORD') for (const v of VORS) { const q = proj(v); if (!vis(q)) continue; x.strokeStyle = C.c; x.lineWidth = 2; x.beginPath(); x.arc(q[0], q[1], 8, 0, 7); x.stroke(); x.fillStyle = C.c; x.fillRect(q[0] - 2, q[1] - 2, 4, 4); txt(x, v.id, q[0] + 12, q[1] - 10, C.c, 14, 'left'); }
  if (ovl === 'NDB') for (const v of NDBS) { const q = proj(v); if (!vis(q)) continue; x.strokeStyle = C.m; x.lineWidth = 2; x.beginPath(); x.moveTo(q[0], q[1] - 9); x.lineTo(q[0] - 8, q[1] + 6); x.lineTo(q[0] + 8, q[1] + 6); x.closePath(); x.stroke(); txt(x, v.id, q[0] + 12, q[1] - 8, C.m, 14, 'left'); }
  if (ovl === 'WPT') for (const v of WPTS) { const q = proj(v); if (!vis(q)) continue; x.strokeStyle = C.m; x.lineWidth = 2; x.beginPath(); x.moveTo(q[0], q[1] - 7); x.lineTo(q[0] + 7, q[1]); x.lineTo(q[0], q[1] + 7); x.lineTo(q[0] - 7, q[1]); x.closePath(); x.stroke(); txt(x, v.id, q[0] + 11, q[1] - 9, C.m, 13, 'left'); }
  // runways of the departure airport (always) and destination
  for (const [ap, rw] of [[fm.from || 'ZZAA', fm.depRwy], [fm.to, fm.arrRwy]]) {
    const A = AIRPORTS[ap]; if (!A) continue;
    for (const [id, r] of Object.entries(A.rwys)) { if (+id.slice(0, 2) > 18) continue; const a = proj({ e: r.a[0], n: r.a[1] }), b = proj({ e: r.b[0], n: r.b[1] }); if (!vis(a) && !vis(b)) continue; const sel = rw && (rw === id || A.rwys[rw] && A.rwys[rw].a[0] === r.b[0]); const lw = Math.max(3, 0.03 * sc); ln(x, [a, b], sel ? C.w : C.grey, lw); }
  }
  // flight plan
  if (pts.length > 1) {
    const P = pts.map(proj);
    x.strokeStyle = C.g; x.lineWidth = 3; x.beginPath(); P.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.stroke();
    x.setLineDash([10, 8]); ln(x, [proj(AC), P[0]], C.g, 2); x.setLineDash([]);
    pts.forEach((p, i) => { const q = P[i]; if (!vis(q) || p.rwy) return; star(x, q[0], q[1], 10, i === 1 ? C.w : C.g); txt(x, p.id, q[0] + 14, q[1] - 12, i === 1 ? C.w : C.g, 15, 'left'); if (ovl === 'CSTR' && p.cstr) txt(x, p.cstr, q[0] + 14, q[1] + 8, C.m, 14, 'left'); });
    const acq = plan ? proj(AC) : [cx, cy];
    for (const p of pts) if (p.rwy) { const q = proj(p); if (vis(q) && Math.hypot(q[0] - acq[0], q[1] - acq[1]) > 40) txt(x, p.id, q[0] + 10, q[1] + 16, C.w, 14, 'left'); }
  }
  // bearing pointers 1 (single line) and 2 (double line)
  if (!plan) for (const n of [1, 2]) {
    const sel = w[`adf${n}${sd}`]; if (sel === 'OFF') continue;
    const st = sel === 'VOR' ? VORS[n === 1 ? 0 : 2] : NDBS[n === 1 ? 0 : 1];
    const a = (brg(AC, st) - hdg) * D2R, col = sel === 'VOR' ? C.w : C.g, r1 = R * 0.95;
    const tip = [cx + Math.sin(a) * r1, cy - Math.cos(a) * r1], tail = [cx - Math.sin(a) * r1, cy + Math.cos(a) * r1];
    if (n === 1) ln(x, [tail, tip], col, 2); else { const o = [Math.cos(a) * 3, Math.sin(a) * 3]; ln(x, [[tail[0] - o[0], tail[1] - o[1]], [tip[0] - o[0], tip[1] - o[1]]], col, 2); ln(x, [[tail[0] + o[0], tail[1] + o[1]], [tip[0] + o[0], tip[1] + o[1]]], col, 2); }
  }
  x.restore();
  if (!plan) for (const n of [1, 2]) { const sel = w[`adf${n}${sd}`]; if (sel === 'OFF') continue; const st = sel === 'VOR' ? VORS[n === 1 ? 0 : 2] : NDBS[n === 1 ? 0 : 1]; const col = sel === 'VOR' ? C.w : C.g; const X = n === 1 ? 14 : 380; txt(x, `${sel}${n}`, X, 462, col, 15, 'left', 700); txt(x, `${st.id}  ${dist(AC, st).toFixed(1)}`, X, 480, col, 14, 'left'); }
  // course pointer and deviation for ROSE LS / ROSE VOR
  if (mode === 'LS' || mode === 'VOR') {
    const ils = mode === 'LS', col = ils ? C.m : C.c, crs = 274, a = (crs - hdg) * D2R;
    let dev;
    if (ils) { const L = AIRPORTS.ZZAA.rwys['27R']; dev = wrap180(brg(AC, { e: L.b[0], n: L.b[1] }) - crs) / 1.25; } else dev = wrap180(brg(VORS[0], AC) - crs) / 5;
    dev = clamp(dev, -2.3, 2.3);
    x.save(); x.translate(cx, cy); x.rotate(a);
    ln(x, [[0, -R + 6], [0, -R * 0.42]], col, 4); ln(x, [[0, R * 0.42], [0, R - 6]], col, 4); x.fillStyle = col; x.beginPath(); x.moveTo(0, -R + 2); x.lineTo(-9, -R + 20); x.lineTo(9, -R + 20); x.closePath(); x.fill();
    for (const d of [-2, -1, 1, 2]) { x.strokeStyle = C.w; x.lineWidth = 2; x.beginPath(); x.arc(d * 34, 0, 5, 0, 7); x.stroke(); }
    ln(x, [[-dev * 34, -R * 0.38], [-dev * 34, R * 0.38]], col, 4);
    x.restore();
    if (ils) txt(x, 'ILS1  IZZA', 14, 412, C.m, 15, 'left', 700), txt(x, (fm.depRwy === '27R' ? '109.90' : '---.--') + '   CRS 274°', 14, 430, C.m, 14, 'left');
    else txt(x, 'VOR1  ZZV', 14, 412, C.c, 15, 'left', 700), txt(x, '115.70   CRS 274°', 14, 430, C.c, 14, 'left');
  }
  // selected heading bug on the compass
  if (!plan && (!Fc.hdgMan || Fc.prevHdg > 0)) {
    const d = wrap180(Fc.hdg - hdg), a = d * D2R;
    if (rose || Math.abs(d) < 38) { x.save(); x.translate(cx + Math.sin(a) * R, cy - Math.cos(a) * R); x.rotate(a); x.fillStyle = C.c; x.beginPath(); x.moveTo(0, 2); x.lineTo(-8, -14); x.lineTo(8, -14); x.closePath(); x.fill(); x.restore(); }
    else txt(x, String(Fc.hdg).padStart(3, '0'), d < 0 ? 40 : 472, 96, C.c, 18, 'center', 700);
  }
  // lubber line, aircraft symbol, heading readout, next waypoint
  if (!plan) { ln(x, [[cx, cy - R - 20], [cx, cy - R + 6]], C.y, 4); txt(x, 'HDG', 214, 22, C.g, 16); txt(x, String(hdg).padStart(3, '0'), 256, 22, C.g, 20, 'center', 700); }
  const ac = plan ? proj(AC) : [cx, cy];
  x.save(); x.translate(ac[0], ac[1]); if (plan) x.rotate(hdg * D2R);
  ln(x, [[-26, -6], [26, -6]], C.y, 4); ln(x, [[0, -24], [0, 22]], C.y, 4); ln(x, [[-10, 16], [10, 16]], C.y, 4); x.restore();
  if (pts.length > 1) { const nx = pts[1]; txt(x, nx.id, 380, 22, C.w, 16, 'left', 700); txt(x, String(Math.round(brg(AC, nx))).padStart(3, '0') + '°', 500, 22, C.g, 16, 'right'); txt(x, dist(AC, nx).toFixed(1), 470, 44, C.g, 17, 'right', 700); txt(x, 'NM', 500, 44, C.c, 13, 'right'); }
  x.restore();
}

/* ---------------- ENGINE & WARNING (upper) ---------------- */
function arcGauge(x, X, Y, R, v, max, opt = {}) {
  const a0 = 150 * D2R, sweep = 220 * D2R; const ang = f => a0 + clamp(f, 0, 1.05) * sweep;
  x.lineWidth = 3; x.strokeStyle = opt.dim ? C.dk : C.w; x.beginPath(); x.arc(X, Y, R, a0, a0 + sweep * (opt.redFrom ? opt.redFrom / max : 1)); x.stroke();
  if (opt.redFrom) { x.strokeStyle = C.r; x.lineWidth = 5; x.beginPath(); x.arc(X, Y, R, ang(opt.redFrom / max), a0 + sweep); x.stroke(); }
  for (const t of opt.ticks || []) { const a = ang(t / max); ln(x, [[X + Math.cos(a) * R, Y + Math.sin(a) * R], [X + Math.cos(a) * (R - 9), Y + Math.sin(a) * (R - 9)]], opt.dim ? C.dk : C.w, 2); if (opt.tickLabels) txt(x, opt.tickLabels(t), X + Math.cos(a) * (R - 22), Y + Math.sin(a) * (R - 22), opt.dim ? C.dk : C.w, 15); }
  if (opt.dim) return;
  const a = ang(v / max); x.strokeStyle = opt.needle || C.g; x.lineWidth = 4; x.beginPath(); x.moveTo(X + Math.cos(a) * R * 0.15, Y + Math.sin(a) * R * 0.15); x.lineTo(X + Math.cos(a) * (R + 4), Y + Math.sin(a) * (R + 4)); x.stroke();
}
export function drawEWD(x, N, sys) {
  blank(x, N); const s = sys.st, w = sys.sw; const k = N / 512; x.save(); x.scale(k, k);
  const cols = [138, 374];
  s.eng.forEach((e, i) => {
    const X = cols[i], dim = !e.fadec;
    // N1
    arcGauge(x, X, 92, 66, e.n1, 110, { ticks: [0, 50, 100], tickLabels: t => String(t / 10), redFrom: 104, dim });
    x.fillStyle = '#000'; x.fillRect(X + 2, 104, 92, 34); box(x, X + 2, 104, 92, 34, dim ? C.dk : C.grey, 2);
    if (dim) txt(x, 'XX', X + 48, 121, C.a, 24, 'center', 700); else txt(x, e.n1.toFixed(1), X + 88, 121, C.g, 26, 'right', 700);
    // EGT
    arcGauge(x, X, 222, 48, e.egt, 1000, { ticks: [0, 500, 1000], tickLabels: () => '', redFrom: REF.startEGTLimit + (e.running ? 300 : 0), dim, needle: e.egt > 680 && e.phase === 'START' ? C.a : C.g });
    if (dim) txt(x, 'XX', X + 4, 248, C.a, 22, 'center', 700); else txt(x, String(Math.round(e.egt)), X + 34, 250, e.egt > 680 && e.phase === 'START' ? C.a : C.g, 24, 'right', 700);
    // N2 (boxed during start), FF
    const n2c = dim ? C.a : C.g;
    if (e.phase === 'START') { x.fillStyle = '#2a2f33'; x.fillRect(X - 50, 282, 100, 32); }
    txt(x, dim ? 'XX' : e.n2.toFixed(1), X + 40, 298, n2c, 25, 'right', 700);
    txt(x, dim ? 'XX' : String(Math.round(e.ff / 10) * 10), X + 40, 334, n2c, 23, 'right', 700);
    if (e.ign) txt(x, 'IGN ' + e.ign, X - 70, 298, C.g, 16, 'left');
    if (e.phase === 'ABORT') txt(x, 'ABORT', X - 70, 334, C.a, 16, 'left');
    if (e.fire) { x.strokeStyle = C.r; x.lineWidth = 3; x.strokeRect(X - 74, 26, 148, 222); txt(x, 'FIRE', X, 18, C.r, 18, 'center', 700); }
  });
  for (const [t, Y] of [['N1', 92], ['%', 112], ['EGT', 214], ['°C', 234], ['N2', 290], ['%', 306], ['FF', 326], ['KG/H', 342]]) txt(x, t, 256, Y, C.c, 15);
  // fuel on board, flaps
  const fob = s.fuel.L + s.fuel.C + s.fuel.R;
  txt(x, 'FOB', 312, 376, C.w, 17, 'left'); txt(x, fmtK(Math.round(fob / 10) * 10) + ' KG', 500, 376, C.c, 19, 'right', 700);
  txt(x, 'FLAPS', 30, 376, C.w, 17, 'left'); txt(x, ['UP', '1', '2', '3', 'FULL'][w.flaps], 110, 376, C.g, 20, 'left', 700);
  ln(x, [[8, 396], [504, 396]], C.w, 2); ln(x, [[300, 402], [300, 506]], C.w, 2);
  // warnings and memos
  let Y = 416; const L = (t, col, size = 16, X = 14) => { if (Y > 500) return; txt(x, t, X, Y, col, size, 'left', 600); Y += 19; };
  const warn = s.alerts.filter(a => a.lvl === 'W'), caut = s.alerts.filter(a => a.lvl === 'C');
  for (const a of [...warn, ...caut]) {
    const col = a.lvl === 'W' ? C.r : C.a; L(a.title, col, 17); x.fillStyle = col; x.fillRect(14, Y - 9, Math.min(270, a.title.length * 10.3), 2);
    for (const l of a.lines) { if (l.done) continue; L(' ' + l.t, l.cond ? C.w : C.c, 13.5); }
  }
  const memos = s.memos; let Y2 = 416;
  const left = warn.length + caut.length ? [] : memos.slice(0, 5), right = warn.length + caut.length ? memos : memos.slice(5);
  for (const m of left) L(m.t, m.c === 'a' ? C.a : m.c === 'w' ? C.w : C.g, 16);
  for (const m of right.slice(0, 5)) { txt(x, m.t, 310, Y2, m.c === 'a' ? C.a : m.c === 'w' ? C.w : C.g, 13.5, 'left'); Y2 += 19; }
  x.restore();
}

/* ---------------- SYSTEMS (lower) ---------------- */
const valve = (x, X, Y, open, col = C.g, horiz = false) => { x.strokeStyle = col; x.lineWidth = 3; x.beginPath(); x.arc(X, Y, 13, 0, 7); x.stroke(); const a = (open ? 0 : Math.PI / 2) + (horiz ? Math.PI / 2 : 0); ln(x, [[X - Math.sin(a) * 13, Y - Math.cos(a) * 13], [X + Math.sin(a) * 13, Y + Math.cos(a) * 13]], col, 3); };
function title(x, t) { txt(x, t, 16, 26, C.w, 22, 'left', 700); x.fillStyle = C.w; x.fillRect(16, 40, t.length * 13.5, 2); }
function bottomStrip(x, sys) {
  ln(x, [[0, 466], [512, 466]], C.w, 2); ln(x, [[170, 466], [170, 512]], C.w, 2); ln(x, [[340, 466], [340, 512]], C.w, 2);
  txt(x, 'TAT', 10, 478, C.w, 13, 'left'); txt(x, `+${OAT}`, 60, 478, C.g, 15, 'left'); txt(x, '°C', 100, 478, C.c, 13, 'left');
  txt(x, 'SAT', 10, 498, C.w, 13, 'left'); txt(x, `+${OAT}`, 60, 498, C.g, 15, 'left'); txt(x, '°C', 100, 498, C.c, 13, 'left');
  const t = 6 * 3600 + 42 * 60 + sys.t; const hh = String(Math.floor(t / 3600) % 24).padStart(2, '0'), mm = String(Math.floor(t / 60) % 60).padStart(2, '0');
  txt(x, `${hh} H ${mm}`, 255, 489, C.g, 20, 'center', 700);
  const gw = 54200 + sys.st.fuel.L + sys.st.fuel.C + sys.st.fuel.R;
  txt(x, 'GW', 350, 489, C.w, 13, 'left'); txt(x, fmtK(Math.round(gw / 100) * 100), 478, 489, C.g, 17, 'right', 700); txt(x, 'KG', 506, 489, C.c, 13, 'right');
}
function genBox(x, X, Y, name, on, avail, load, sel = true) {
  box(x, X, Y, 92, 86, avail || on ? C.w : C.grey, 2); txt(x, name, X + 46, Y + 14, on || avail ? C.w : C.a, 15, 'center', 700);
  if (!sel) { txt(x, 'OFF', X + 46, Y + 46, C.w, 16); return; }
  if (avail || on) { txt(x, String(Math.round(load)), X + 54, Y + 36, C.g, 16, 'right'); txt(x, '%', X + 60, Y + 36, C.c, 13, 'left'); txt(x, '115', X + 54, Y + 55, C.g, 16, 'right'); txt(x, 'V', X + 60, Y + 55, C.c, 13, 'left'); txt(x, '400', X + 54, Y + 74, C.g, 16, 'right'); txt(x, 'HZ', X + 60, Y + 74, C.c, 13, 'left'); }
}
function busBar(x, X, Y, W, name, on) { x.fillStyle = on ? '#1c3a24' : '#3a2a10'; x.fillRect(X, Y, W, 26); box(x, X, Y, W, 26, on ? C.g : C.a, 2); txt(x, name, X + W / 2, Y + 13, on ? C.g : C.a, 16, 'center', 700); }
const PAGES = {
  ELEC(x, sys) {
    const s = sys.st, E = s.elec, w = sys.sw; title(x, 'ELEC');
    [0, 1].forEach(i => { const X = i ? 360 : 60, on = i ? w.bat2 : w.bat1; box(x, X, 54, 92, 66, C.w, 2); txt(x, 'BAT ' + (i + 1), X + 46, 68, C.w, 15, 'center', 700); txt(x, E.batV[i].toFixed(1), X + 58, 88, C.g, 16, 'right'); txt(x, 'V', X + 64, 88, C.c, 13, 'left'); const a = Math.round(E.batA[i]); txt(x, on ? String(a) : '0', X + 58, 108, on && a < -5 ? C.a : C.g, 16, 'right'); txt(x, 'A', X + 64, 108, C.c, 13, 'left'); if (on) ln(x, [[i ? X : X + 92, 88], [i ? 312 : 200, 88]], C.g, 3); });
    busBar(x, 200, 75, 112, 'DC BAT', E.dcBat);
    busBar(x, 24, 156, 112, 'DC 1', E.dc1); busBar(x, 200, 156, 112, 'DC ESS', E.dcEss); busBar(x, 376, 156, 112, 'DC 2', E.dc2);
    [0, 1].forEach(i => { const X = i ? 396 : 44; box(x, X, 204, 72, 56, E['ac' + (i + 1)] ? C.w : C.grey, 2); txt(x, 'TR ' + (i + 1), X + 36, 218, E['ac' + (i + 1)] ? C.w : C.a, 15, 'center', 700); if (E['ac' + (i + 1)]) { txt(x, '28 V', X + 36, 236, C.g, 14); txt(x, (i ? 82 : 96) + ' A', X + 36, 252, C.g, 14); ln(x, [[X + 36, 204], [X + 36, 182]], C.g, 3); ln(x, [[X + 36, 260], [X + 36, 290]], C.g, 3); } });
    busBar(x, 24, 290, 112, 'AC 1', E.ac1); busBar(x, 200, 290, 112, 'AC ESS', E.acEss); busBar(x, 376, 290, 112, 'AC 2', E.ac2);
    const g = s.eng;
    genBox(x, 14, 360, 'GEN 1', E.genOn[0], g[0].running, 32, w.gen1); genBox(x, 132, 360, 'APU GEN', E.apuGenOn, E.apuGenAvail, E.apuGenOn ? 38 : 0, w.apuGen); genBox(x, 288, 360, 'EXT PWR', E.extOn, E.extAvail, E.extOn ? 30 : 0); genBox(x, 406, 360, 'GEN 2', E.genOn[1], g[1].running, 34, w.gen2);
    const feed = (src, X) => { if (E.src1 === src || E.src2 === src) ln(x, [[X, 360], [X, 316]], C.g, 3); };
    feed('GEN 1', 60); feed('GEN 2', 452); feed('APU GEN', 178); feed('EXT PWR', 334);
    if ((E.src1 && E.src2 && (E.src1 !== 'GEN 1' || E.src2 !== 'GEN 2'))) ln(x, [[136, 340], [376, 340]], C.g, 3);
    bottomStrip(x, sys);
  },
  APU(x, sys) {
    const A = sys.st.apu, E = sys.st.elec, B = sys.st.bleed; title(x, 'APU');
    if (A.avail) txt(x, 'AVAIL', 256, 26, C.g, 22, 'center', 700);
    const dial = (X, Y, v, max, lab, unit, red) => { arcGauge(x, X, Y, 64, v, max, { ticks: [0, max / 2, max], tickLabels: t => String(Math.round(t / (max > 500 ? 100 : 10))), redFrom: red, dim: !E.dc }); txt(x, lab, X - 40, Y + 52, C.w, 15, 'left'); txt(x, unit, X - 40, Y + 70, C.c, 14, 'left'); txt(x, E.dc ? String(Math.round(v)) : 'XX', X + 56, Y + 58, E.dc ? C.g : C.a, 24, 'right', 700); };
    dial(140, 150, A.n, 110, 'N', '%', 107); dial(140, 330, A.egt, 1200, 'EGT', '°C', 1000);
    box(x, 300, 60, 180, 96, E.apuGenAvail ? C.w : C.grey, 2); txt(x, 'APU GEN', 390, 76, E.apuGenAvail ? C.w : C.a, 16, 'center', 700);
    if (E.apuGenAvail) { [['LOAD', E.apuGenOn ? 38 : 0, '%'], ['V', 115, ''], ['HZ', 400, '']].forEach(([l, v, u], i) => { txt(x, l === 'LOAD' ? 'LOAD' : '', 312, 98 + i * 20, C.w, 13, 'left'); txt(x, String(v), 440, 98 + i * 20, C.g, 16, 'right'); txt(x, u || l, 446, 98 + i * 20, C.c, 13, 'left'); }); }
    txt(x, 'APU BLEED', 390, 200, C.w, 16, 'center', 700); txt(x, A.avail ? String(Math.round(B.apuP || 0)) : 'XX', 410, 226, A.avail ? C.g : C.a, 20, 'right', 700); txt(x, 'PSI', 416, 226, C.c, 13, 'left');
    valve(x, 390, 270, B.apuValve > 0.5, C.g); ln(x, [[390, 283], [390, 330]], C.g, 3); if (B.apuValve > 0.5) ln(x, [[390, 257], [390, 240]], C.g, 3);
    txt(x, A.flap >= 1 ? 'FLAP OPEN' : A.flap > 0 ? 'FLAP MOVING' : 'FLAP CLOSED', 390, 370, A.flap > 0 && A.flap < 1 ? C.a : A.flap >= 1 ? C.g : C.w, 16, 'center', 700);
    if (A.phase === 'START') txt(x, 'STARTING', 390, 410, C.g, 16, 'center', 700);
    if (A.phase === 'COOL') txt(x, 'COOLING ' + Math.ceil(A.cool) + ' s', 390, 410, C.g, 16, 'center', 700);
    txt(x, 'FUEL ' + Math.round(A.ff) + ' KG/H', 390, 440, C.g, 14);
    bottomStrip(x, sys);
  },
  BLEED(x, sys) {
    const s = sys.st, B = s.bleed, w = sys.sw; title(x, 'BLEED');
    [0, 1].forEach(i => {
      const X = i ? 380 : 132, p = B.duct[i];
      box(x, X - 44, 70, 88, 44, w['pack' + (i + 1)] ? C.w : C.grey, 2); txt(x, 'PACK ' + (i + 1), X, 84, w['pack' + (i + 1)] ? C.w : C.a, 15, 'center', 700); txt(x, B.pack[i] > 0.5 ? 'FLOW' : 'OFF', X, 102, B.pack[i] > 0.5 ? C.g : C.a, 14);
      ln(x, [[X, 114], [X, 230]], p > 8 ? C.g : C.grey, 3);
      txt(x, String(Math.round(p)), X + 52, 180, C.g, 20, 'right', 700); txt(x, 'PSI', X + 56, 180, C.c, 13, 'left');
      valve(x, X, 300, B.engValve[i], C.g); ln(x, [[X, 230], [X, 287]], p > 8 ? C.g : C.grey, 3); ln(x, [[X, 313], [X, 370]], s.eng[i].running ? C.g : C.grey, 3);
      txt(x, 'ENG ' + (i + 1), X, 392, C.w, 16, 'center', 700); txt(x, 'HP / IP', X, 412, C.grey, 12);
    });
    ln(x, [[132, 230], [243, 230]], C.g, 3); ln(x, [[269, 230], [380, 230]], B.xValve > 0.5 ? C.g : C.grey, 3); valve(x, 256, 230, B.xValve > 0.5, C.g, true); txt(x, 'X BLEED', 256, 206, C.w, 13);
    ln(x, [[200, 230], [200, 300]], B.apuValve > 0.5 ? C.g : C.grey, 3); valve(x, 200, 313, B.apuValve > 0.5, C.g); ln(x, [[200, 326], [200, 370]], s.apu.avail ? C.g : C.grey, 3); txt(x, 'APU', 200, 392, C.w, 16, 'center', 700);
    s.eng.forEach((e, i) => { if (e.sv) txt(x, 'START AIR', i ? 380 : 132, 440, C.g, 14); });
    bottomStrip(x, sys);
  },
  ENG(x, sys) {
    const s = sys.st; title(x, 'ENG');
    const rows = [['F.USED', 'KG', 76], ['OIL', 'QT', 130], ['', 'PSI', 186], ['', '°C', 236], ['VIB N1', '', 286], ['VIB N2', '', 312]];
    rows.forEach(([a, b, Y]) => { txt(x, a, 256, Y - 8, C.w, 13); txt(x, b, 256, Y + 8, C.c, 13); });
    s.eng.forEach((e, i) => {
      const X = i ? 390 : 122, on = e.fadec || e.n2 > 1;
      txt(x, String(Math.round(s.fuel.used[i] / 10) * 10), X, 76, C.g, 20, 'center', 700);
      txt(x, on ? e.oilQ.toFixed(1) : 'XX', X, 130, on ? C.g : C.a, 20, 'center', 700);
      arcGauge(x, X, 196, 34, e.oilP, 100, { ticks: [0, 100], redFrom: 0, dim: !on }); txt(x, on ? String(Math.round(e.oilP)) : 'XX', X + 10, 214, on ? C.g : C.a, 18, 'left', 700);
      txt(x, on ? String(Math.round(e.oilT)) : 'XX', X, 236, on ? C.g : C.a, 20, 'center', 700);
      txt(x, on ? e.vib1.toFixed(1) : 'XX', X, 286, on ? C.g : C.a, 17, 'center'); txt(x, on ? e.vib2.toFixed(1) : 'XX', X, 312, on ? C.g : C.a, 17, 'center');
      // start valve, ignition, start air pressure
      valve(x, X, 372, e.sv, e.sv ? C.g : C.g); ln(x, [[X, 385], [X, 410]], e.sv ? C.g : C.grey, 3); ln(x, [[X, 340], [X, 359]], s.bleed.duct[i] > 10 ? C.g : C.grey, 3);
      txt(x, String(Math.round(s.bleed.duct[i])) + ' PSI', X + (i ? -64 : 64), 350, C.g, 15, 'center');
      if (e.ign) txt(x, 'IGN ' + e.ign, X, 430, C.g, 16, 'center', 700);
      if (e.phase === 'START') txt(x, 'STARTING', X, 450, C.g, 13);
    });
    txt(x, 'START VALVE', 256, 372, C.w, 12);
    bottomStrip(x, sys);
  },
  HYD(x, sys) {
    const s = sys.st, H = s.hyd, w = sys.sw; title(x, 'HYD');
    const X = [108, 256, 404], names = ['HYD 1', 'HYD 2', 'HYD 3'], pumps = [['ENG 1', 'hEng1', 0], ['ELEC', 'hElec', -1], ['ENG 2', 'hEng2', 1]];
    X.forEach((cx, i) => {
      const p = H.p[i], ok = p > 1450;
      txt(x, names[i], cx, 70, ok ? C.w : C.a, 20, 'center', 700); txt(x, String(Math.round(p / 50) * 50), cx, 98, ok ? C.g : C.a, 22, 'center', 700);
      x.fillStyle = ok ? C.g : C.a; x.beginPath(); x.moveTo(cx, 116); x.lineTo(cx - 9, 130); x.lineTo(cx + 9, 130); x.closePath(); x.fill();
      ln(x, [[cx, 130], [cx, 270]], ok ? C.g : C.a, 3);
      const [pn, sw, ei] = pumps[i]; const run = ei >= 0 ? s.eng[ei].n2 > 10 && w[sw] && !w['firePb' + (ei + 1)] : w[sw] && s.elec.ac && s.eng.some(e => e.running);
      box(x, cx - 22, 270, 44, 40, run ? C.g : C.a, 3); if (run) ln(x, [[cx, 270], [cx, 310]], C.g, 3); else if (w[sw]) txt(x, 'LO', cx, 290, C.a, 15, 'center', 700); else ln(x, [[cx - 14, 290], [cx + 14, 290]], C.a, 3);
      txt(x, pn, cx, 326, C.w, 14);
      if (ei >= 0) { ln(x, [[cx, 340], [cx, 352]], C.g, 3); valve(x, cx, 368, !w['firePb' + (ei + 1)], w['firePb' + (ei + 1)] ? C.a : C.g); }
      x.strokeStyle = C.w; x.lineWidth = 2; x.strokeRect(cx - 9, 400, 18, 50); x.fillStyle = C.g; x.fillRect(cx - 7, 412, 14, 36);
    });
    // PTU between HYD 1 and HYD 3
    const yP = 190; ln(x, [[108, yP], [212, yP]], C.g, 3); ln(x, [[300, yP], [404, yP]], C.g, 3); txt(x, 'PTU', 256, yP - 24, w.ptu ? C.w : C.a, 15, 'center', 700);
    x.strokeStyle = H.ptu ? C.g : C.w; x.lineWidth = 3; x.beginPath(); x.moveTo(214, yP); x.lineTo(234, yP - 12); x.lineTo(234, yP + 12); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(298, yP); x.lineTo(278, yP - 12); x.lineTo(278, yP + 12); x.closePath(); x.stroke();
    if (H.ptu) txt(x, 'ON', 256, yP + 4, C.g, 13, 'center', 700);
    bottomStrip(x, sys);
  },
  FUEL(x, sys) {
    const s = sys.st, F = s.fuel, w = sys.sw; title(x, 'FUEL');
    txt(x, 'F.USED', 256, 66, C.w, 14); txt(x, String(Math.round((F.used[0] + F.used[1] + F.apuUsed) / 10) * 10), 256, 86, C.g, 18, 'center', 700); txt(x, 'KG', 256, 104, C.c, 13);
    [0, 1].forEach(i => { const X = i ? 392 : 120; txt(x, 'ENG ' + (i + 1), X, 70, C.w, 16, 'center', 700); valve(x, X, 112, !w['firePb' + (i + 1)] && (w['master' + (i + 1)] || s.eng[i].fuelOn), C.g); ln(x, [[X, 125], [X, 250]], s.eng[i].fuelOn ? C.g : C.grey, 3); });
    ln(x, [[120, 220], [243, 220]], C.g, 3); ln(x, [[269, 220], [392, 220]], F.xOpen > 0.5 ? C.g : C.grey, 3); valve(x, 256, 220, F.xOpen > 0.5, C.g, true); txt(x, 'X FEED', 256, 196, C.w, 13);
    ln(x, [[60, 220], [60, 250]], s.apu.ff > 0 ? C.g : C.grey, 3); txt(x, 'APU', 60, 205, C.w, 13);
    // tanks
    const tank = (X, W, kg, name, pumps) => {
      x.strokeStyle = C.w; x.lineWidth = 2; x.strokeRect(X, 250, W, 120); txt(x, name, X + W / 2, 268, C.w, 14);
      txt(x, fmtK(Math.round(kg / 10) * 10), X + W / 2, 345, C.g, 21, 'center', 700);
      pumps.forEach(([id, px]) => { const run = F.run[id]; box(x, px - 14, 282, 28, 32, run ? C.g : C.a, 3); if (run) ln(x, [[px, 282], [px, 314]], C.g, 3); else if (w[id]) txt(x, 'LO', px, 298, C.a, 12, 'center', 700); else ln(x, [[px - 9, 298], [px + 9, 298]], C.a, 3); });
    };
    tank(16, 186, F.L, 'L', [['pL1', 76], ['pL2', 142]]); tank(206, 100, F.C, 'CTR', [['pC1', 234], ['pC2', 278]]); tank(310, 186, F.R, 'R', [['pR1', 370], ['pR2', 436]]);
    txt(x, 'FOB', 120, 410, C.w, 16); txt(x, fmtK(Math.round((F.L + F.C + F.R) / 10) * 10) + ' KG', 260, 410, C.c, 21, 'center', 700);
    bottomStrip(x, sys);
  }
};
/* ---------------- the six further SYSTEMS pages (generic layouts, our own design) ---------------- */
const tri = (x, X, Y, r, col, fill = true) => { x.beginPath(); x.moveTo(X, Y - r); x.lineTo(X - r * 0.9, Y + r * 0.7); x.lineTo(X + r * 0.9, Y + r * 0.7); x.closePath(); if (fill) { x.fillStyle = col; x.fill(); } else { x.strokeStyle = col; x.lineWidth = 2; x.stroke(); } };
Object.assign(PAGES, {
  PRESS(x, sys) {
    const s = sys.st, P = s.press, B = s.bleed, w = sys.sw; title(x, 'CAB PRESS');
    txt(x, 'LDG ELEV', 300, 26, C.w, 14, 'left'); txt(x, w.ldgElev === 0 ? 'AUTO' : 'MAN', 386, 26, C.g, 15, 'left', 700); txt(x, String(Math.round(AIRPORTS.ZZAA.elev / 10) * 10), 470, 26, C.g, 17, 'right', 700); txt(x, 'FT', 474, 26, C.c, 13, 'left');
    const g = (X, v, max, min, lab, unit, val, dec = 0) => { arcGauge(x, X, 130, 52, v - min, max - min, { ticks: [0, (max - min) / 2, max - min] }); txt(x, lab, X, 205, C.w, 15, 'center', 700); txt(x, val, X + 30, 172, C.g, 22, 'right', 700); txt(x, unit, X + 34, 172, C.c, 13, 'left'); };
    g(100, P.dp, 9, -1, 'ΔP', 'PSI', P.dp.toFixed(1)); g(256, P.vs / 1000, 2, -2, 'V/S', 'FT/MN', String(Math.round(P.vs / 50) * 50)); g(412, P.cabAlt / 1000, 10, 0, 'CAB ALT', 'FT', String(Math.round(P.cabAlt / 10) * 10));
    txt(x, w.pressMan ? 'MAN' : 'SYS 1', 256, 238, w.pressMan ? C.a : C.g, 17, 'center', 700);
    // cabin outline, inlet / extract and outflow valves, safety valve, packs
    x.strokeStyle = C.w; x.lineWidth = 2; x.beginPath(); x.moveTo(40, 300); x.lineTo(40, 270); x.lineTo(472, 270); x.lineTo(472, 300); x.stroke();
    ln(x, [[40, 300], [40, 360], [472, 360], [472, 300]], C.w, 2);
    txt(x, 'INLET', 74, 290, C.w, 13); txt(x, 'EXTRACT', 150, 290, C.w, 13);
    valve(x, 74, 330, true, C.g); valve(x, 150, 330, s.eng.every(e => !e.running), C.g);
    // outflow valve: needle from closed (vertical) to open (horizontal)
    const oa = (-90 + 90 * P.outflow) * D2R; x.strokeStyle = C.w; x.lineWidth = 2; x.beginPath(); x.arc(360, 330, 34, -Math.PI / 2, 0); x.stroke();
    ln(x, [[360, 330], [360 + Math.cos(oa) * 34, 330 + Math.sin(oa) * 34]], w.pressMan ? C.a : C.g, 4); txt(x, 'OUTFLOW', 360, 376, C.w, 13); txt(x, Math.round(P.outflow * 100) + ' %', 420, 300, C.g, 14, 'left');
    txt(x, 'SAFETY', 250, 290, C.w, 13); valve(x, 250, 330, false, C.g);
    [0, 1].forEach(i => { const X = i ? 330 : 182, on = B.pack[i] > 0.5; box(x, X - 46, 400, 92, 30, on ? C.g : C.a, 2); txt(x, 'PACK ' + (i + 1), X, 415, on ? C.g : C.a, 15, 'center', 700); if (on) ln(x, [[X, 400], [X, 360]], C.g, 3); });
    bottomStrip(x, sys);
  },
  COND(x, sys) {
    const s = sys.st, C2 = s.cond, B = s.bleed, w = sys.sw; title(x, 'COND');
    txt(x, 'TEMP: °C', 470, 26, C.c, 14, 'right');
    // cabin top view
    x.strokeStyle = C.w; x.lineWidth = 2; x.beginPath(); x.moveTo(36, 170); x.quadraticCurveTo(40, 80, 120, 80); x.lineTo(470, 80); x.lineTo(470, 230); x.lineTo(120, 230); x.quadraticCurveTo(40, 230, 36, 170); x.stroke();
    ln(x, [[150, 80], [150, 230]], C.w, 2); ln(x, [[310, 80], [310, 230]], C.w, 2);
    [['CKPT', 92], ['FWD', 230], ['AFT', 390]].forEach(([n, X], z) => {
      txt(x, n, X, 102, C.w, 16, 'center', 700); txt(x, C2.zone[z].toFixed(0), X, 140, C.g, 24, 'center', 700);
      txt(x, C2.duct[z].toFixed(0), X, 180, C.g, 17, 'center'); txt(x, 'DUCT', X, 200, C.grey, 11);
      ln(x, [[X, 230], [X, 270]], C2.hotValve > 0.5 ? C.g : C.grey, 3);
    });
    ln(x, [[92, 270], [430, 270]], C2.hotValve > 0.5 ? C.g : C.grey, 3);
    valve(x, 470, 270, C2.hotValve > 0.5, w.hotAir ? C.g : C.a, true); ln(x, [[430, 270], [457, 270]], C2.hotValve > 0.5 ? C.g : C.grey, 3); txt(x, 'HOT AIR', 470, 300, w.hotAir ? C.w : C.a, 14, 'center', 700);
    [0, 1].forEach(i => { const X = i ? 330 : 182, on = B.pack[i] > 0.5; box(x, X - 52, 340, 104, 64, on ? C.w : C.grey, 2); txt(x, 'PACK ' + (i + 1), X, 356, on ? C.w : C.a, 15, 'center', 700); txt(x, on ? C2.packOut[i].toFixed(0) : 'XX', X + 4, 380, on ? C.g : C.a, 20, 'right', 700); txt(x, on ? '°C' : '', X + 8, 380, C.c, 12, 'left'); txt(x, 'OUTLET', X, 396, C.grey, 10); ln(x, [[X, 340], [X, 300]], on ? C.g : C.grey, 3); });
    ln(x, [[182, 300], [330, 300]], B.pack[0] + B.pack[1] > 0.5 ? C.g : C.grey, 3); txt(x, 'MIXER', 256, 318, C.grey, 12);
    txt(x, `SEL  ${C2.sel.map(t => t.toFixed(0)).join(' / ')}`, 256, 440, C.c, 14);
    bottomStrip(x, sys);
  },
  DOOR(x, sys) {
    const s = sys.st, Dr = s.doors, w = sys.sw; title(x, 'DOOR / OXY');
    // fuselage (nose up)
    x.strokeStyle = C.w; x.lineWidth = 2; x.beginPath(); x.moveTo(206, 140); x.quadraticCurveTo(206, 60, 256, 52); x.quadraticCurveTo(306, 60, 306, 140); x.lineTo(306, 400); x.quadraticCurveTo(300, 452, 256, 456); x.quadraticCurveTo(212, 452, 206, 400); x.closePath(); x.stroke();
    const door = (X, Y, open, lab, side) => { const col = open ? C.a : C.g; x.fillStyle = open ? col : '#000'; x.strokeStyle = col; x.lineWidth = 2; x.fillRect(X - 7, Y - 14, 14, 28); x.strokeRect(X - 7, Y - 14, 14, 28); if (lab) txt(x, lab, side < 0 ? X - 16 : X + 16, Y, col, 14, side < 0 ? 'right' : 'left', 700); };
    door(206, 128, Dr.fwdL > 0.05, Dr.fwdL > 0.05 ? 'CABIN' : '', -1); door(306, 128, false, '', 1);
    door(206, 410, false, '', -1); door(306, 410, false, '', 1);
    for (const Y of [250, 278]) { door(206, Y, false, '', -1); door(306, Y, false, '', 1); }
    for (const [Y, l] of [[190, 'CARGO'], [360, 'CARGO']]) { x.strokeStyle = C.g; x.strokeRect(300, Y - 16, 12, 32); txt(x, l, 322, Y, C.g, 13, 'left'); }
    txt(x, 'AVIONICS', 256, 94, C.g, 12);
    if (Dr.bridge) { x.fillStyle = 'rgba(160,170,178,0.35)'; x.fillRect(98, 118, 100, 22); x.strokeStyle = C.grey; x.strokeRect(98, 118, 100, 22); txt(x, 'JET BRIDGE', 148, 156, C.grey, 13); }
    txt(x, 'CKPT OXY', 360, 58, C.w, 14, 'left'); txt(x, w.crewOxy ? '1850' : 'OFF', 480, 78, w.crewOxy ? C.g : C.a, 19, 'right', 700); txt(x, w.crewOxy ? 'PSI' : '', 484, 78, C.c, 12, 'left');
    txt(x, 'SLIDE', 40, 420, C.w, 13, 'left'); txt(x, Dr.fwdL > 0.05 ? 'DISARMED' : 'ARMED', 40, 440, Dr.fwdL > 0.05 ? C.w : C.g, 14, 'left', 700);
    bottomStrip(x, sys);
  },
  WHEEL(x, sys) {
    const s = sys.st, H = s.hyd, w = sys.sw, Bt = s.brakes.temp; title(x, 'WHEEL');
    // gear: three down-and-locked triangles
    for (const [X, Y, n] of [[256, 90, 'NOSE'], [126, 210, 'L'], [386, 210, 'R']]) { tri(x, X - 16, Y, 13, C.g); tri(x, X + 16, Y, 13, C.g); txt(x, n, X, Y + 26, C.w, 13); }
    txt(x, 'N/W STRG', 256, 140, H.p[2] > 1450 ? C.g : C.a, 14, 'center', 700);
    const hottest = Bt.indexOf(Math.max(...Bt));
    [[96, 0], [156, 1], [356, 2], [416, 3]].forEach(([X, i]) => {
      box(x, X - 26, 262, 52, 70, C.w, 2); txt(x, String(i + 1), X, 276, C.w, 14, 'center', 700);
      txt(x, String(Math.round(Bt[i] / 5) * 5), X, 304, Bt[i] > 300 ? C.a : C.g, 20, 'center', 700); txt(x, '°C', X, 322, C.c, 12);
      if (i === hottest) { x.strokeStyle = C.g; x.lineWidth = 3; x.beginPath(); x.arc(X, 262, 18, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
    });
    txt(x, 'BRAKES', 256, 296, C.w, 15, 'center', 700);
    const norm = H.p[0] > 1450, altn = H.accu > 1000;
    txt(x, 'NORM BRK', 140, 368, norm ? C.g : C.a, 15, 'center', 700); txt(x, 'ALTN BRK', 372, 368, altn ? C.g : C.a, 15, 'center', 700);
    txt(x, 'ACCU', 300, 398, C.w, 13, 'left'); txt(x, String(Math.round(H.accu / 50) * 50), 430, 398, C.g, 17, 'right', 700); txt(x, 'PSI', 434, 398, C.c, 12, 'left');
    txt(x, 'L / R', 40, 398, C.w, 13, 'left'); txt(x, `${Math.round(H.brakeL / 50) * 50} / ${Math.round(H.brakeR / 50) * 50}`, 200, 398, C.g, 17, 'right', 700); txt(x, 'PSI', 204, 398, C.c, 12, 'left');
    if (w.parkBrk) txt(x, 'PARK BRK ON', 256, 432, C.g, 17, 'center', 700);
    txt(x, 'AUTO BRK  OFF', 256, 452, C.grey, 13);
    bottomStrip(x, sys);
  },
  FCTL(x, sys) {
    const s = sys.st, Fc = s.fctl, H = s.hyd.p, w = sys.sw; title(x, 'F/CTL');
    const hy = (X, Y, list) => list.forEach((i, j) => txt(x, String(i + 1), X + (j - (list.length - 1) / 2) * 15, Y, H[i] > 1450 ? C.g : C.a, 15, 'center', 700));
    // spoilers 2-5 on each wing (arrows up when raised)
    txt(x, 'SPD BRK', 256, 64, C.w, 14, 'center', 700); txt(x, w.spdBrk ? 'ARMED' : 'RET', 256, 82, w.spdBrk ? C.c : C.g, 14, 'center', 700);
    for (const sd of [0, 1]) for (let j = 0; j < 4; j++) {
      const X = sd ? 300 + j * 40 : 212 - j * 40, Y = 100, v = Fc.spl[sd][j], sysI = [0, 2, 1, 2][j], ok = H[sysI] > 1450;
      ln(x, [[X - 14, Y], [X + 14, Y]], ok ? C.g : C.a, 3);
      if (v > 2) { ln(x, [[X, Y], [X, Y - 4 - v * 0.6]], C.g, 3); tri(x, X, Y - 8 - v * 0.6, 6, C.g); }
      txt(x, String(j + 2), X, Y + 14, ok ? C.w : C.a, 12);
    }
    // ailerons (vertical scales): + = trailing edge up
    const scale = (X, Y0, Hh, v, min, max, lab, sysL) => {
      const Rr = Hh * 1.3, ym = Y0 + Hh / 2, ang = Math.asin(Hh / 2 / Rr), off = Rr * Math.cos(ang); // gently curved vertical scale
      x.strokeStyle = C.w; x.lineWidth = 2; x.beginPath(); x.arc(X - off, ym, Rr, -ang, ang); x.stroke();
      const yAt = val => Y0 + Hh * (max - clamp(val, min, max)) / (max - min), xAt = Y => X - off + Math.sqrt(Rr * Rr - (Y - ym) * (Y - ym));
      for (const t of [min, 0, max]) { const Y = yAt(t), Xx = xAt(Y); ln(x, [[Xx - 7, Y], [Xx + 2, Y]], C.w, 2); }
      const Y = yAt(v), Xs = xAt(Y); const ok = sysL.some(i => H[i] > 1450);
      x.fillStyle = ok ? C.g : C.a; x.beginPath(); x.moveTo(Xs + 4, Y); x.lineTo(Xs + 18, Y - 7); x.lineTo(Xs + 18, Y + 7); x.closePath(); x.fill();
      txt(x, lab, X + 4, Y0 - 16, C.w, 14, 'center', 700); hy(X + 6, Y0 + Hh + 18, sysL); txt(x, 'UP', X - 22, Y0 + 6, C.grey, 10); txt(x, 'DN', X - 22, Y0 + Hh - 4, C.grey, 10);
    };
    scale(50, 160, 120, Fc.ail[0], -25, 25, 'L AIL', [0, 1]); scale(440, 160, 120, Fc.ail[1], -25, 25, 'R AIL', [0, 1]);
    scale(150, 300, 110, Fc.elev[0], -15, 30, 'L ELEV', [0, 1]); scale(340, 300, 110, Fc.elev[1], -15, 30, 'R ELEV', [0, 2]);
    // rudder
    x.strokeStyle = C.w; x.lineWidth = 2; x.beginPath(); x.arc(256, 330, 70, Math.PI * 0.32, Math.PI * 0.68); x.stroke();
    const ra = Math.PI / 2 - Fc.rud * D2R; ln(x, [[256, 330], [256 + Math.cos(ra) * 66, 330 + Math.sin(ra) * 66]], C.g, 4); txt(x, 'RUD', 256, 290, C.w, 14, 'center', 700); hy(256, 420, [0, 1, 2]);
    txt(x, 'PITCH TRIM', 256, 168, C.w, 14, 'center', 700); txt(x, '0.0°', 256, 188, C.g, 17, 'center', 700);
    const stick = { NEUTRAL: 'NEUTRAL', AFT: 'FULL AFT', FWD: 'FULL FWD', LEFT: 'FULL LEFT', RIGHT: 'FULL RIGHT' }[w.stickL];
    txt(x, 'CAPT STICK', 256, 226, C.w, 13, 'center'); txt(x, stick, 256, 244, C.c, 15, 'center', 700);
    bottomStrip(x, sys);
  },
  STS(x, sys) {
    const s = sys.st, w = sys.sw; title(x, 'STATUS');
    const L = [], R = [];
    for (const a of s.alerts) L.push([a.title, a.lvl === 'W' ? C.r : C.a]);
    s.eng.forEach((e, i) => { const n = i + 1; if (w['firePb' + n]) { R.push('ENG ' + n); R.push('ENG ' + n + ' BLEED'); } e.agents.forEach((a, j) => { if (a.disch) R.push(`ENG ${n} AGENT ${j + 1}`); }); if (e.fault) L.push([`ENG ${n} START FAULT`, C.a]); });
    if (w.firePbApu) R.push('APU');
    if (s.eng.some(e => e.running)) s.hyd.p.forEach((p, i) => { if (p < 1450) R.push('HYD ' + (i + 1)); });
    if (!w.pack1) L.push(['PACK 1 OFF', C.c]); if (!w.pack2) L.push(['PACK 2 OFF', C.c]);
    if (s.irs.some(r => r.mode === 'NAV' && !r.aligned)) L.push(['IRS ALIGN IN PROGRESS', C.w]);
    if (s.doors.fwdL > 0.05) L.push(['FWD CABIN DOOR OPEN', C.w]);
    if (w.manStart1 || w.manStart2) L.push(['MAN START SELECTED', C.c]);
    if (!fmsStatus(s.av.fms).all) L.push(['FLIGHT COMPUTER NOT SET', C.c]);
    if (!L.length && !R.length) { txt(x, 'NORMAL', 256, 220, C.g, 30, 'center', 700); bottomStrip(x, sys); return; }
    let Y = 76; for (const [t, c] of L.slice(0, 15)) { txt(x, t, 18, Y, c, 15, 'left', 600); Y += 24; }
    ln(x, [[330, 60], [330, 440]], C.w, 1.5); txt(x, 'INOP SYS', 420, 66, C.a, 15, 'center', 700); x.fillStyle = C.a; x.fillRect(380, 76, 80, 2);
    Y = 100; for (const t of R.slice(0, 13)) { txt(x, t, 346, Y, C.a, 15, 'left', 600); Y += 24; }
    bottomStrip(x, sys);
  }
});
export function drawSD(x, N, sys) {
  blank(x, N); const k = N / 512; x.save(); x.scale(k, k);
  const p = sys.st.sdPage, f = PAGES[p];
  if (f) f(x, sys); else { title(x, { FCTL: 'F/CTL', STS: 'STATUS' }[p] || p); txt(x, 'Page not modelled in this trainer', 256, 240, C.w, 17); bottomStrip(x, sys); }
  x.restore();
}

/* ---------------- standby instrument ---------------- */
export function drawStby(x, N, sys) {
  blank(x, N); const k = N / 256; x.save(); x.scale(k, k); const s = sys.st;
  const t = s.elec.dcBat && s.elec.dcOnT != null ? sys.t - s.elec.dcOnT : -1;
  if (t < 0) { x.restore(); return false; }
  x.save(); x.beginPath(); x.rect(48, 34, 160, 180); x.clip();
  if (t > 8) { x.fillStyle = C.sky; x.fillRect(0, 0, 256, 126); x.fillStyle = C.gnd; x.fillRect(0, 126, 256, 140); ln(x, [[0, 126], [256, 126]], C.w, 2); for (const p of [-10, 10]) ln(x, [[108, 126 - p * 3], [148, 126 - p * 3]], C.w, 2); x.fillStyle = C.y; x.fillRect(96, 124, 26, 5); x.fillRect(134, 124, 26, 5); x.fillRect(125, 123, 6, 6); }
  else { txt(x, 'INIT', 128, 110, C.w, 20, 'center', 700); txt(x, String(Math.ceil(8 - t)) + ' s', 128, 140, C.w, 17); }
  x.restore();
  x.fillStyle = '#30363b'; x.fillRect(4, 34, 42, 180); x.fillRect(210, 34, 42, 180);
  txt(x, '30', 25, 124, C.w, 15); txt(x, String(Math.round(baroAlt(s.av, 0) / 10) * 10), 231, 124, C.g, 15); txt(x, s.av.baro[0].std ? 'STD' : 'QNH ' + baroText(s.av, 0, sys.sw.baroUnitL), 128, 232, C.c, 14);
  txt(x, 'STBY', 128, 18, C.grey, 13);
  x.restore(); return true;
}
/* ---------------- clock ---------------- */
export function drawClock(x, N, sys) {
  blank(x, N, N * 0.75); const k = N / 256; x.save(); x.scale(k, k);
  const t = 6 * 3600 + 42 * 60 + sys.t; const hh = String(Math.floor(t / 3600) % 24).padStart(2, '0'), mm = String(Math.floor(t / 60) % 60).padStart(2, '0'), ss = String(Math.floor(t) % 60).padStart(2, '0');
  txt(x, 'UTC', 30, 30, C.grey, 15, 'left'); txt(x, `${hh}:${mm}`, 128, 82, '#e8edf0', 64, 'center', 700); txt(x, ss, 230, 96, '#e8edf0', 24, 'right', 700);
  const et = Math.max(0, sys.t); txt(x, 'ET', 30, 150, C.grey, 15, 'left'); txt(x, `${String(Math.floor(et / 3600)).padStart(2, '0')}:${String(Math.floor(et / 60) % 60).padStart(2, '0')}`, 128, 150, '#e8edf0', 30, 'center', 700);
  x.restore();
}
/* ---------------- brake / accumulator triple gauge (mechanical) ---------------- */
export function drawBrake(x, N, sys) {
  x.setTransform(1, 0, 0, 1, 0, 0); const k = N / 256; x.save(); x.scale(k, k);
  x.fillStyle = '#121416'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#05070a'; x.beginPath(); x.arc(128, 128, 120, 0, 7); x.fill();
  const H = sys.st.hyd;
  const needle = (cx, cy, a0, a1, v, R) => { const a = (a0 + (a1 - a0) * clamp(v / 4000, 0, 1)) * D2R; x.strokeStyle = '#f4f4f0'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.stroke(); x.fillStyle = '#2a2d30'; x.beginPath(); x.arc(cx, cy, 7, 0, 7); x.fill(); };
  const scale = (cx, cy, a0, a1, R, labels) => { x.strokeStyle = '#e8e8e2'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, R, Math.min(a0, a1) * D2R, Math.max(a0, a1) * D2R); x.stroke(); for (let i = 0; i <= 4; i++) { const a = (a0 + (a1 - a0) * i / 4) * D2R; ln(x, [[cx + Math.cos(a) * R, cy + Math.sin(a) * R], [cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10)]], '#e8e8e2', 2); if (labels) txt(x, String(i), cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22), '#e8e8e2', 14); } const ga = (a0 + (a1 - a0) * 0.75) * D2R, gb = (a0 + (a1 - a0) * 0.85) * D2R; x.strokeStyle = '#2fd060'; x.lineWidth = 6; x.beginPath(); x.arc(cx, cy, R + 4, Math.min(ga, gb), Math.max(ga, gb)); x.stroke(); };
  scale(128, 128, 200, 340, 92, true); needle(128, 128, 200, 340, H.accu, 84);
  scale(70, 210, 290, 200, 66, false); needle(70, 210, 290, 200, H.brakeL, 58);
  scale(186, 210, 250, 340, 66, false); needle(186, 210, 250, 340, H.brakeR, 58);
  txt(x, 'ACCU PRESS', 128, 70, '#e8e8e2', 13); txt(x, 'BRAKES', 128, 168, '#e8e8e2', 14); txt(x, 'L', 96, 196, '#e8e8e2', 14); txt(x, 'R', 160, 196, '#e8e8e2', 14); txt(x, 'PSI x1000', 128, 236, '#9aa', 11);
  x.restore();
}

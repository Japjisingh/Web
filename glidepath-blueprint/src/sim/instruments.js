/* Canvas drawing for the C172-class analogue panel. Each draw fn: (ctx, N) with N = canvas size in px. */
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const F = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const WHITE = '#eef1f1', DIM = '#8c979c';

function face(x, N) {
  const R = N * 0.5;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, N, N);
  x.translate(R, R);
  const g = x.createRadialGradient(0, -R * 0.2, R * 0.1, 0, 0, R);
  g.addColorStop(0, '#1a1d1f'); g.addColorStop(1, '#0c0d0e');
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, R * 0.96, 0, 7); x.fill();
  return R * 0.9;
}
function ticks(x, r, a0, a1, n, len, w, color = WHITE) {
  x.strokeStyle = color; x.lineWidth = w;
  for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * D2R; x.beginPath(); x.moveTo(Math.sin(a) * r, -Math.cos(a) * r); x.lineTo(Math.sin(a) * (r - len), -Math.cos(a) * (r - len)); x.stroke(); }
}
function arc(x, r, a0, a1, w, color) { x.strokeStyle = color; x.lineWidth = w; x.beginPath(); x.arc(0, 0, r, (a0 - 90) * D2R, (a1 - 90) * D2R); x.stroke(); }
function label(x, t, a, r, size, color = WHITE) { x.fillStyle = color; x.font = `600 ${size}px ${F}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, Math.sin(a * D2R) * r, -Math.cos(a * D2R) * r); }
function needle(x, a, r, w, color = WHITE, tail = 0.18) {
  x.save(); x.rotate(a * D2R); x.shadowColor = 'rgba(0,0,0,0.8)'; x.shadowBlur = w * 1.5; x.shadowOffsetY = w * 0.6;
  x.fillStyle = color; x.beginPath(); x.moveTo(-w / 2, r * tail); x.lineTo(-w * 0.35, -r * 0.92); x.lineTo(0, -r); x.lineTo(w * 0.35, -r * 0.92); x.lineTo(w / 2, r * tail); x.closePath(); x.fill();
  x.restore(); x.fillStyle = '#2a2e31'; x.beginPath(); x.arc(0, 0, w * 1.1, 0, 7); x.fill();
}
function glass(x, R) { const g = x.createLinearGradient(-R, -R, R * 0.3, R * 0.5); g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(0.45, 'rgba(255,255,255,0.03)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, R * 1.05, 0, 7); x.fill(); }
function flag(x, R, t) { x.fillStyle = '#c8322b'; x.fillRect(-R * 0.22, R * 0.25, R * 0.44, R * 0.17); x.fillStyle = '#fff'; x.font = `700 ${R * 0.13}px ${F}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, 0, R * 0.335); }

const asiAng = k => k < 40 ? k * 0.75 : 30 + (k - 40) * 1.95;
export function drawASI(x, N, ias) {
  const r = face(x, N), R = N * 0.5;
  arc(x, r * 0.88, asiAng(40), asiAng(85), r * 0.07, '#f2f2f2');
  arc(x, r * 0.95, asiAng(48), asiAng(129), r * 0.07, '#2fa84f');
  arc(x, r * 0.95, asiAng(129), asiAng(163), r * 0.07, '#e9c12c');
  x.save(); x.rotate(asiAng(163) * D2R); x.fillStyle = '#d8322b'; x.fillRect(-r * 0.02, -r * 0.99, r * 0.04, r * 0.16); x.restore();
  for (let k = 40; k <= 200; k += 10) { const a = asiAng(k); const big = k % 20 === 0; ticks(x, r, a, a, 0, big ? r * 0.14 : r * 0.08, big ? 3 : 2); if (big && k <= 180) label(x, String(k), a, r * 0.68, r * 0.15); }
  label(x, 'KNOTS', 180, r * 0.32, r * 0.1, DIM); label(x, 'AIRSPEED', 0, r * 0.3, r * 0.09, DIM);
  needle(x, asiAng(clamp(ias, 0, 205)), r * 0.86, r * 0.06);
  glass(x, R);
}
export function drawAI(x, N, pitch, bank, spin) {
  const R = N * 0.5, r = R * 0.9;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, N, N); x.translate(R, R);
  x.save(); x.beginPath(); x.arc(0, 0, r * 1.05, 0, 7); x.clip();
  x.rotate(-bank * D2R);
  const ppd = r * 0.022, off = clamp(pitch, -30, 30) * ppd * spin;
  x.fillStyle = '#2b78c8'; x.fillRect(-R * 2, -R * 3 + off, R * 4, R * 3);
  x.fillStyle = '#7a4a24'; x.fillRect(-R * 2, off, R * 4, R * 3);
  x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.moveTo(-R * 2, off); x.lineTo(R * 2, off); x.stroke();
  x.lineWidth = 2;
  for (const p of [5, 10, 15, 20]) { const w = p % 10 ? r * 0.18 : r * 0.36; for (const sg of [-1, 1]) { const y = off - sg * p * ppd; x.beginPath(); x.moveTo(-w / 2, y); x.lineTo(w / 2, y); x.stroke(); if (p % 10 === 0) { x.fillStyle = '#fff'; x.font = `600 ${r * 0.1}px ${F}`; x.textAlign = 'right'; x.fillText(String(p), -w / 2 - 4, y + 4); } } }
  // bank pointer arc rotates with horizon
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -r * 0.78); x.lineTo(-r * 0.06, -r * 0.66); x.lineTo(r * 0.06, -r * 0.66); x.closePath(); x.fill();
  x.restore();
  // fixed bank scale
  x.strokeStyle = '#fff';
  for (const a of [-60, -30, -20, -10, 0, 10, 20, 30, 60]) { x.save(); x.rotate(a * D2R); x.lineWidth = a % 30 === 0 ? 3 : 2; x.beginPath(); x.moveTo(0, -r * 0.98); x.lineTo(0, -r * (a % 30 === 0 ? 0.84 : 0.89)); x.stroke(); x.restore(); }
  for (const a of [-45, 45]) { x.save(); x.rotate(a * D2R); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -r * 0.86); x.lineTo(-r * 0.03, -r * 0.96); x.lineTo(r * 0.03, -r * 0.96); x.fill(); x.restore(); }
  // aircraft symbol
  x.strokeStyle = '#f2a33a'; x.fillStyle = '#f2a33a'; x.lineWidth = r * 0.05; x.lineCap = 'round';
  x.beginPath(); x.moveTo(-r * 0.5, 0); x.lineTo(-r * 0.16, 0); x.lineTo(0, r * 0.1); x.lineTo(r * 0.16, 0); x.lineTo(r * 0.5, 0); x.stroke();
  x.beginPath(); x.arc(0, 0, r * 0.04, 0, 7); x.fill();
  if (spin < 0.5) flag(x, r, 'GYRO');
  glass(x, R);
}
export function drawALT(x, N, ft, qnh = 1013) {
  const r = face(x, N), R = N * 0.5;
  for (let i = 0; i < 50; i++) { const a = i * 7.2; ticks(x, r, a, a, 0, i % 5 ? r * 0.07 : r * 0.14, i % 5 ? 2 : 3); }
  for (let i = 0; i < 10; i++) label(x, String(i), i * 36, r * 0.7, r * 0.2);
  // kollsman window
  x.fillStyle = '#000'; x.fillRect(r * 0.32, -r * 0.1, r * 0.42, r * 0.2); x.fillStyle = WHITE; x.font = `600 ${r * 0.12}px ${F}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(qnh), r * 0.53, 0);
  label(x, 'ALT', 180, r * 0.42, r * 0.1, DIM); label(x, '100 FEET', 180, r * 0.28, r * 0.08, DIM);
  const f = Math.max(-1000, ft);
  needle(x, (f / 10000) * 360, r * 0.45, r * 0.03);
  needle(x, (f / 1000 % 10) / 10 * 360, r * 0.6, r * 0.09);
  needle(x, (f % 1000) / 1000 * 360, r * 0.9, r * 0.05);
  glass(x, R);
}
export function drawTC(x, N, rate, ball, powered) {
  const r = face(x, N), R = N * 0.5;
  label(x, 'TURN COORDINATOR', 0, r * 0.62, r * 0.085, DIM);
  for (const a of [90, 110, 250, 270]) ticks(x, r, a, a, 0, r * 0.2, 5);
  label(x, 'L', 236, r * 0.66, r * 0.13); label(x, 'R', 124, r * 0.66, r * 0.13); label(x, '2 MIN', 180, r * 0.66, r * 0.08, DIM);
  // aircraft symbol (rotates 20° at standard rate)
  const a = powered ? clamp(rate / 3 * 20, -40, 40) : 0;
  x.save(); x.rotate(a * D2R); x.strokeStyle = WHITE; x.fillStyle = WHITE; x.lineWidth = r * 0.06; x.lineCap = 'round';
  x.beginPath(); x.moveTo(-r * 0.78, 0); x.lineTo(r * 0.78, 0); x.stroke(); x.beginPath(); x.arc(0, 0, r * 0.1, 0, 7); x.fill();
  x.lineWidth = r * 0.04; x.beginPath(); x.moveTo(0, -r * 0.1); x.lineTo(0, -r * 0.24); x.stroke(); x.restore();
  // inclinometer
  x.fillStyle = '#d9d2b8'; x.beginPath(); x.ellipse(0, r * 0.42, r * 0.5, r * 0.11, 0, 0, 7); x.fill();
  x.strokeStyle = '#111'; x.lineWidth = 2; for (const sx of [-1, 1]) { x.beginPath(); x.moveTo(sx * r * 0.12, r * 0.31); x.lineTo(sx * r * 0.12, r * 0.53); x.stroke(); }
  x.fillStyle = '#111'; x.beginPath(); x.arc(clamp(ball, -1, 1) * r * 0.36, r * 0.42, r * 0.09, 0, 7); x.fill();
  if (!powered) flag(x, r * 0.7, 'OFF');
  glass(x, R);
}
export function drawHI(x, N, hdg, bug) {
  const r = face(x, N), R = N * 0.5;
  x.save(); x.rotate(-hdg * D2R);
  for (let d = 0; d < 360; d += 5) { const big = d % 10 === 0; ticks(x, r, d, d, 0, big ? r * 0.13 : r * 0.07, big ? 3 : 2); }
  const C = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
  for (let d = 0; d < 360; d += 30) { x.save(); x.rotate(d * D2R); x.fillStyle = C[d] ? '#f2f2f2' : WHITE; x.font = `${C[d] ? 700 : 600} ${r * (C[d] ? 0.19 : 0.15)}px ${F}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(C[d] || String(d / 10), 0, -r * 0.66); x.restore(); }
  x.save(); x.rotate(bug * D2R); x.fillStyle = '#e4559e'; x.fillRect(-r * 0.08, -r * 0.99, r * 0.16, r * 0.08); x.restore();
  x.restore();
  // aircraft + lubber
  x.strokeStyle = '#f2a33a'; x.lineWidth = r * 0.04; x.lineCap = 'round';
  x.beginPath(); x.moveTo(0, -r * 0.45); x.lineTo(0, r * 0.32); x.moveTo(-r * 0.3, -r * 0.05); x.lineTo(r * 0.3, -r * 0.05); x.moveTo(-r * 0.12, r * 0.28); x.lineTo(r * 0.12, r * 0.28); x.stroke();
  x.fillStyle = '#f2a33a'; x.beginPath(); x.moveTo(0, -r * 0.84); x.lineTo(-r * 0.06, -r * 0.98); x.lineTo(r * 0.06, -r * 0.98); x.fill();
  for (const a of [45, 90, 135, 225, 270, 315]) { ticks(x, r * 1.08, a, a, 0, r * 0.08, 3, '#f2a33a'); }
  glass(x, R);
}
export function drawVSI(x, N, fpm) {
  const r = face(x, N), R = N * 0.5;
  const ang = v => -90 + clamp(v, -2000, 2000) / 2000 * 170;
  for (let v = -2000; v <= 2000; v += 100) { const a = ang(v); const big = v % 500 === 0; ticks(x, r, a, a, 0, big ? r * 0.14 : r * 0.07, big ? 3 : 2); }
  for (const v of [0, 5, 10, 15, 20]) { label(x, String(v), ang(v * 100), r * 0.68, r * 0.15); if (v) label(x, String(v), ang(-v * 100), r * 0.68, r * 0.15); }
  label(x, 'UP', -40, r * 0.38, r * 0.09, DIM); label(x, 'DOWN', -140, r * 0.38, r * 0.09, DIM); label(x, 'VERTICAL SPEED', 90, r * 0.3, r * 0.07, DIM); label(x, '100 FT/MIN', 180, r * 0.35, r * 0.07, DIM);
  needle(x, ang(fpm), r * 0.88, r * 0.06);
  glass(x, R);
}
export function drawTach(x, N, rpm) {
  const r = face(x, N), R = N * 0.5;
  const ang = v => -120 + clamp(v, 0, 3500) / 3500 * 240;
  arc(x, r * 0.95, ang(2100), ang(2700), r * 0.08, '#2fa84f');
  x.save(); x.rotate(ang(2700) * D2R); x.fillStyle = '#d8322b'; x.fillRect(-r * 0.025, -r * 0.99, r * 0.05, r * 0.18); x.restore();
  for (let v = 0; v <= 3500; v += 100) { const a = ang(v); const big = v % 500 === 0; ticks(x, r, a, a, 0, big ? r * 0.14 : r * 0.07, big ? 3 : 2); if (v % 500 === 0) label(x, String(v / 100), a, r * 0.68, r * 0.15); }
  label(x, 'RPM', 180, r * 0.4, r * 0.11, DIM); label(x, 'x100', 180, r * 0.58, r * 0.08, DIM);
  needle(x, ang(rpm), r * 0.86, r * 0.06);
  glass(x, R);
}
function miniScale(x, cy, r, v, lo, hi, greenA, greenB, lbl, color = WHITE) {
  x.save(); x.translate(0, cy);
  const ang = t => -60 + clamp((t - lo) / (hi - lo), 0, 1) * 120;
  x.strokeStyle = '#2fa84f'; x.lineWidth = r * 0.12; x.beginPath(); x.arc(0, 0, r, (ang(greenA) - 90) * D2R, (ang(greenB) - 90) * D2R); x.stroke();
  ticks(x, r * 1.08, -60, 60, 6, r * 0.18, 2);
  x.fillStyle = DIM; x.font = `600 ${r * 0.26}px ${F}`; x.textAlign = 'center'; x.fillText(lbl, 0, r * 0.35);
  needle(x, ang(v), r * 0.98, r * 0.09, color, 0.05);
  x.restore();
}
export function drawFuel(x, N, l, rr, powered) {
  const r = face(x, N), R = N * 0.5;
  miniScale(x, -r * 0.05, r * 0.45, powered ? l : 0, 0, 26, 3, 26, 'L', WHITE);
  miniScale(x, r * 0.62, r * 0.45, powered ? rr : 0, 0, 26, 3, 26, 'R', WHITE);
  label(x, 'FUEL QTY', 0, r * 0.8, r * 0.1, DIM); label(x, 'GAL', 0, r * 0.38, r * 0.09, DIM);
  glass(x, R);
}
export function drawOil(x, N, temp, press) {
  const r = face(x, N), R = N * 0.5;
  miniScale(x, -r * 0.05, r * 0.45, temp, 75, 245, 100, 245, 'TEMP');
  miniScale(x, r * 0.62, r * 0.45, press, 0, 115, 50, 90, 'PRESS');
  label(x, 'OIL', 0, r * 0.8, r * 0.11, DIM);
  glass(x, R);
}
export function drawVac(x, N, suction, amps) {
  const r = face(x, N), R = N * 0.5;
  miniScale(x, -r * 0.05, r * 0.45, suction, 3, 7, 4.5, 5.5, 'SUCTION');
  miniScale(x, r * 0.62, r * 0.45, amps, -60, 60, -2, 60, 'AMPS');
  label(x, 'VAC  ·  AMP', 0, r * 0.8, r * 0.09, DIM);
  glass(x, R);
}
export function drawRadio(x, W, H, on) {
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#16191b'; x.fillRect(0, 0, W, H);
  const units = [['AUDIO', 'COM1  MIC  ·  NAV1  ·  MKR'], ['COM 1', '118.600   121.500'], ['NAV 1', '110.30    113.90'], ['XPDR', '7000   ALT']];
  const h = H / 4;
  units.forEach(([n, d], i) => {
    const y = i * h; x.fillStyle = '#23272a'; x.fillRect(6, y + 5, W - 12, h - 10);
    x.fillStyle = '#0a0c0d'; x.fillRect(W * 0.22, y + h * 0.25, W * 0.6, h * 0.5);
    x.fillStyle = on ? (i === 3 ? '#7ff0b0' : '#ffb347') : '#1d2124'; x.font = `600 ${h * 0.28}px ${F}`; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillText(on ? d : '', W * 0.25, y + h * 0.5);
    x.fillStyle = '#9aa3a8'; x.font = `600 ${h * 0.16}px ${F}`; x.fillText(n, 14, y + h * 0.5);
    for (const kx of [W * 0.88, W * 0.94]) { x.fillStyle = '#3a3f43'; x.beginPath(); x.arc(kx, y + h * 0.5, h * 0.17, 0, 7); x.fill(); }
  });
}
export function drawPanel(x, W, H) {
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#30363a'); g.addColorStop(1, '#22272a');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const img = x.getImageData(0, 0, W, H), d = img.data; let s = 3;
  for (let i = 0; i < d.length; i += 4) { s = (s * 16807) % 2147483647; const n = (s / 2147483647 - 0.5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
}
export function drawPlacard(x, W, H, lines, opts = {}) {
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = opts.bg || '#1b1f22'; x.fillRect(0, 0, W, H);
  x.fillStyle = opts.color || '#d9dedf'; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((l, i) => { x.font = `${l.w || 600} ${l.s || H * 0.2}px ${F}`; x.fillStyle = l.c || opts.color || '#d9dedf'; x.fillText(l.t, l.x ?? W / 2, l.y ?? (H * (i + 0.5) / lines.length)); });
}

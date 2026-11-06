/* Glass cockpit trainer with synthetic vision (Sim Training Guide) */
import { createStage, addSky, makeTerrain, fbm, ui, hiDPI, THREE, D2R, R2D, norm360, norm180, clamp, pad3, hdir, MONO } from './core.js';

// World units: 1 unit = 30 m (about 98 ft).
const U_FT = 30 / 0.3048;
const TGT_ALT = 3000, TGT_HDG = 90, FOV = 50;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function terrainH(x, z) {
  const n = fbm(x * 0.0021, z * 0.0021, 5, 0.71);
  const r = 1 - Math.abs(fbm(x * 0.0055 + 3.1, z * 0.0055 - 2.3, 4, 0.23)) * 2.2;
  const m = smooth(90, 420, Math.hypot(x + 60, z - 40));
  return 2 + 6 * (n + 0.5) + m * (120 * Math.pow(Math.max(0, n + 0.2), 1.3) + 34 * Math.max(0, r) * Math.max(0, n + 0.35));
}
function terrainC(y, s) {
  const st = [[0, [0.12, 0.26, 0.09]], [10, [0.2, 0.32, 0.12]], [22, [0.33, 0.33, 0.18]], [36, [0.36, 0.28, 0.2]], [52, [0.42, 0.41, 0.42]], [66, [0.86, 0.89, 0.93]]];
  let c = st[st.length - 1][1];
  for (let i = 0; i < st.length - 1; i++) if (y < st[i + 1][0]) { const t = (y - st[i][0]) / (st[i + 1][0] - st[i][0]); c = st[i][1].map((v, k) => v + (st[i + 1][1][k] - v) * clamp(t, 0, 1)); break; }
  if (s > 0.45 && y < 60) c = c.map(v => v * 0.82 + 0.06);
  return c;
}

export default function (host) {
  const wrap = host.querySelector('.stage');
  const S = createStage(host, { fov: FOV, near: 0.5, far: 6000, bloom: false, cam: [0, 30, 0], target: [0, 30, -10] });
  S.controls.enabled = false; S.controls.update = () => false;
  S.camera.rotation.order = 'YXZ';
  addSky(S, { elevation: 32, azimuth: 160, turbidity: 4, rayleigh: 1.3, exposure: 0.6, envIntensity: 0.4, sunIntensity: 2.4, skyColor: 0xcfe2ff, groundColor: 0x55513f, hemi: 0.6 });
  S.scene.fog = new THREE.Fog(0xa9c0d3, 420, 2600);
  S.renderer.domElement.style.cursor = 'default';

  // terrain tile that re-centres under the aircraft
  let terrain = null, tc = { x: 1e9, z: 1e9 };
  function recentre(x, z) {
    const cx = Math.round(x / 40) * 40, cz = Math.round(z / 40) * 40;
    const m = makeTerrain({ size: 1800, seg: 240, height: (a, b) => terrainH(a + cx, b + cz), color: (y, s) => terrainC(y, s), roughness: 1 });
    m.position.set(cx, 0, cz);
    if (terrain) { S.scene.remove(terrain); terrain.geometry.dispose(); terrain.material.dispose(); }
    terrain = m; S.scene.add(terrain); tc = { x: cx, z: cz };
  }
  recentre(0, 0);

  // overlay for the PFD symbology
  const cv = document.createElement('canvas'); cv.tabIndex = 0;
  cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Primary flight display with synthetic vision. Drag or use the arrow keys to fly.');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1;cursor:grab;touch-action:none;';
  wrap.appendChild(cv);
  const hint = wrap.querySelector('.hint'); if (hint) hint.hidden = true;

  const U = ui(host);
  const st = { pitch: 2, bank: 0, V: 90, alt: 2500, hdg: 360, vs: 0, x: 0, z: 0, warn: '' };
  const mode = U.seg('disp', 'Display', [['svt', 'Synthetic vision'], ['classic', 'Classic']], 'svt');
  const sP = U.slider('pitch', 'Pitch', -10, 15, 2, 0.5, v => (v > 0 ? '+' : '') + v.toFixed(1) + '°');
  const sB = U.slider('bank', 'Bank', -45, 45, 0, 1, v => (v < 0 ? 'left ' : v > 0 ? 'right ' : '') + Math.abs(v) + '°');
  const sW = U.slider('pwr', 'Power', 0, 100, 60, 1, v => v + '%');
  U.button('Reset the exercise', reset);
  function reset() { Object.assign(st, { pitch: 2, bank: 0, V: 90, alt: 2500, hdg: 360, vs: 0, x: 0, z: 0, warn: '' }); sP.v = 2; sB.v = 0; sW.v = 60; }
  mode.on(v => { S.renderer.domElement.style.visibility = v === 'svt' ? 'visible' : 'hidden'; });

  let drag = null;
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, p: sP.v, b: sB.v }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
  cv.addEventListener('pointermove', e => { if (!drag) return; sP.v = clamp(Math.round((drag.p - (e.clientY - drag.y) * 0.06) * 2) / 2, -10, 15); sB.v = clamp(Math.round(drag.b + (e.clientX - drag.x) * 0.18), -45, 45); });
  const end = () => { drag = null; cv.style.cursor = 'grab'; }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('keydown', e => {
    const k = e.key; let used = true;
    if (k === 'ArrowUp') sP.v = clamp(sP.v - 0.5, -10, 15); else if (k === 'ArrowDown') sP.v = clamp(sP.v + 0.5, -10, 15);
    else if (k === 'ArrowLeft') sB.v = clamp(sB.v - 2, -45, 45); else if (k === 'ArrowRight') sB.v = clamp(sB.v + 2, -45, 45); else used = false;
    if (used) e.preventDefault();
  });

  function step(dt) {
    st.pitch += (sP.v - st.pitch) * Math.min(1, dt * 3); st.bank += (sB.v - st.bank) * Math.min(1, dt * 3);
    const pw = sW.v, Veq = 50 + 0.8 * pw - 4 * st.pitch;
    st.V += (Veq - st.V) * 0.25 * dt; st.V = clamp(st.V, 35, 180);
    st.vs = 101.27 * st.V * Math.sin((st.pitch - 2) * D2R) + (pw - 60) * 12 - (1 / Math.cos(st.bank * D2R) - 1) * 600;
    st.alt = Math.max(0, st.alt + st.vs / 60 * dt);
    st.hdg = norm360(st.hdg + 1091 * Math.tan(st.bank * D2R) / st.V * dt);
    const sp = st.V * 0.5144 / 30, d = hdir(st.hdg);
    st.x += d.x * sp * dt; st.z += d.z * sp * dt;
    const ground = terrainH(st.x, st.z) * U_FT;
    st.agl = st.alt - ground;
    st.warn = st.agl < 0 ? 'crash' : st.agl < 500 ? 'PULL UP' : st.agl < 1000 ? 'TERRAIN' : '';
    if (st.agl < 0) st.alt = ground + 1;
    if (Math.hypot(st.x - tc.x, st.z - tc.z) > 320) recentre(st.x, st.z);
    const c = S.camera;
    c.position.set(st.x, st.alt / U_FT + 0.3, st.z);
    c.rotation.set(st.pitch * D2R, -st.hdg * D2R, -st.bank * D2R);
  }

  /* ---------- PFD symbology ---------- */
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function draw() {
    const { ctx, W, H } = hiDPI(cv);
    ctx.clearRect(0, 0, W, H);
    const svt = mode.v === 'svt';
    const cx = W / 2, cy = H / 2;
    const k = (H / 2) / Math.tan(FOV / 2 * D2R);
    const yOf = P => -k * Math.tan((P - st.pitch) * D2R); // screen offset (up negative) of elevation P, unrolled
    const fs = Math.max(10, Math.round(H * 0.026));
    // attitude
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-st.bank * D2R);
    const hy = yOf(0);
    if (!svt) {
      const gS = ctx.createLinearGradient(0, hy - H, 0, hy); gS.addColorStop(0, '#1a5fb0'); gS.addColorStop(1, '#4b98e6');
      ctx.fillStyle = gS; ctx.fillRect(-W * 2, hy - H * 3, W * 4, H * 3);
      const gG = ctx.createLinearGradient(0, hy, 0, hy + H); gG.addColorStop(0, '#9a6532'); gG.addColorStop(1, '#5e3a18');
      ctx.fillStyle = gG; ctx.fillRect(-W * 2, hy, W * 4, H * 3);
    }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 3;
    ctx.beginPath(); ctx.moveTo(-W * 2, hy); ctx.lineTo(W * 2, hy); ctx.stroke();
    // pitch ladder, clipped to a central window
    ctx.save(); ctx.beginPath(); ctx.rect(-W * 0.22, -H * 0.33, W * 0.44, H * 0.58); ctx.clip();
    ctx.fillStyle = '#fff'; ctx.font = `600 ${fs}px ${MONO}`; ctx.textBaseline = 'middle'; ctx.lineWidth = 1.6;
    for (let p = -30; p <= 30; p += 2.5) {
      if (!p) continue; const y = yOf(p), w = p % 10 === 0 ? W * 0.13 : p % 5 === 0 ? W * 0.075 : W * 0.035;
      ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); ctx.stroke();
      if (p % 10 === 0) { ctx.textAlign = 'right'; ctx.fillText(Math.abs(p), -w / 2 - 6, y); ctx.textAlign = 'left'; ctx.fillText(Math.abs(p), w / 2 + 6, y); }
    }
    ctx.restore();
    // flight path marker (where the aircraft is actually going)
    const gam = Math.atan2(st.vs / 101.27, st.V) * R2D, fy = yOf(gam);
    ctx.strokeStyle = '#5fe0a8'; ctx.lineWidth = 2.2; const fr = fs * 0.6;
    ctx.beginPath(); ctx.arc(0, fy, fr, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-fr * 2.4, fy); ctx.lineTo(-fr, fy); ctx.moveTo(fr, fy); ctx.lineTo(fr * 2.4, fy); ctx.moveTo(0, fy - fr); ctx.lineTo(0, fy - fr * 2); ctx.stroke();
    ctx.restore();
    // roll scale (fixed) and sky pointer (rotates)
    ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 3;
    const ra = H * 0.3;
    ctx.beginPath(); ctx.arc(0, 0, ra, -Math.PI / 2 - 60 * D2R, -Math.PI / 2 + 60 * D2R); ctx.stroke();
    [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60].forEach(a => { ctx.save(); ctx.rotate(a * D2R); ctx.beginPath(); ctx.moveTo(0, -ra); ctx.lineTo(0, -ra - (Math.abs(a) % 30 === 0 ? 13 : 7)); ctx.stroke(); ctx.restore(); });
    ctx.beginPath(); ctx.moveTo(0, -ra); ctx.lineTo(-7, -ra - 12); ctx.lineTo(7, -ra - 12); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.rotate(-st.bank * D2R); ctx.fillStyle = '#f2b43a'; ctx.beginPath(); ctx.moveTo(0, -ra + 2); ctx.lineTo(-8, -ra + 14); ctx.lineTo(8, -ra + 14); ctx.closePath(); ctx.fill(); ctx.restore();
    // aircraft symbol
    ctx.shadowBlur = 4; ctx.fillStyle = '#f2b43a'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
    const aw = W * 0.09;
    [-1, 1].forEach(sd => { ctx.beginPath(); ctx.moveTo(sd * aw * 0.35, 0); ctx.lineTo(sd * (aw * 0.35 + aw), 0); ctx.lineTo(sd * (aw * 0.35 + aw), 5); ctx.lineTo(sd * (aw * 0.35 + 6), 5); ctx.lineTo(sd * (aw * 0.35 + 6), 16); ctx.lineTo(sd * aw * 0.35, 16); ctx.closePath(); ctx.fill(); ctx.stroke(); });
    ctx.beginPath(); ctx.rect(-4, -4, 8, 8); ctx.fill(); ctx.stroke();
    ctx.restore();

    // tapes
    const tw = Math.max(58, W * 0.1), th = H * 0.56, ty = cy - th / 2;
    const panel = svt ? 'rgba(10,16,22,0.42)' : 'rgba(30,40,48,0.9)';
    // speed
    const sx = W * 0.05;
    ctx.save(); ctx.fillStyle = panel; rr(ctx, sx, ty, tw, th, 6); ctx.fill(); ctx.clip();
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.font = `600 ${fs}px ${MONO}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1.5;
    const ppk = th / 60;
    // speed bands: white arc (flaps) 40-85, green 50-129, yellow 129-163
    [[50, 129, '#3fbf6b'], [129, 163, '#f2c230']].forEach(([a, b, c]) => { ctx.fillStyle = c; const y1 = cy - (b - st.V) * ppk, y2 = cy - (a - st.V) * ppk; ctx.fillRect(sx + tw - 5, y1, 5, y2 - y1); });
    ctx.fillStyle = '#fff';
    for (let v = Math.floor((st.V - 40) / 5) * 5; v <= st.V + 40; v += 5) { if (v < 0) continue; const y = cy - (v - st.V) * ppk; ctx.beginPath(); ctx.moveTo(sx + tw - (v % 10 ? 7 : 12), y); ctx.lineTo(sx + tw - 5, y); ctx.stroke(); if (v % 10 === 0) ctx.fillText(v, sx + tw - 16, y); }
    ctx.restore();
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; rr(ctx, sx - 3, cy - fs * 1.1, tw + 6, fs * 2.2, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.round(fs * 1.3)}px ${MONO}`; ctx.fillText(Math.round(st.V), sx + tw / 2, cy + 1);
    ctx.font = `600 ${fs}px ${MONO}`; ctx.fillStyle = '#d7e0e4'; ctx.fillText('IAS KT', sx + tw / 2, ty - fs);
    // altitude
    const aw2 = Math.max(70, W * 0.115), vw = 14, ax = W - W * 0.05 - aw2 - vw - 6;
    ctx.save(); ctx.fillStyle = panel; rr(ctx, ax, ty, aw2, th, 6); ctx.fill(); ctx.clip();
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `600 ${fs}px ${MONO}`; ctx.lineWidth = 1.5;
    const ppf = th / 700;
    for (let a2 = Math.floor((st.alt - 400) / 100) * 100; a2 <= st.alt + 400; a2 += 100) { const y = cy - (a2 - st.alt) * ppf; ctx.beginPath(); ctx.moveTo(ax, y); ctx.lineTo(ax + (a2 % 500 ? 7 : 12), y); ctx.stroke(); if (a2 % 200 === 0) ctx.fillText(a2, ax + 16, y); }
    const by = cy - (TGT_ALT - st.alt) * ppf; ctx.fillStyle = '#e46bd0'; ctx.fillRect(ax, clamp(by, ty, ty + th) - 8, 7, 16);
    ctx.restore();
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; rr(ctx, ax - 3, cy - fs * 1.1, aw2 + 6, fs * 2.2, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(fs * 1.3)}px ${MONO}`; ctx.fillText(Math.round(st.alt / 10) * 10, ax + aw2 / 2, cy + 1);
    ctx.font = `600 ${fs}px ${MONO}`; ctx.fillStyle = '#e46bd0'; ctx.fillText(TGT_ALT, ax + aw2 / 2, ty - fs);
    // VSI
    const vx = ax + aw2 + 6; ctx.fillStyle = panel; rr(ctx, vx, ty, vw, th, 4); ctx.fill();
    ctx.strokeStyle = '#d7e0e4'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(vx, cy); ctx.lineTo(vx + vw, cy); ctx.stroke();
    const vh = clamp(st.vs / 2000, -1, 1) * th / 2; ctx.fillStyle = '#5fe0a8'; ctx.fillRect(vx + 3, Math.min(cy, cy - vh), vw - 6, Math.abs(vh));
    ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.font = `600 ${Math.round(fs * 0.9)}px ${MONO}`; ctx.fillText((st.vs > 0 ? '+' : '') + Math.round(st.vs / 10) * 10 + ' fpm', vx + vw, ty + th + fs);
    // heading tape
    const hw = W * 0.44, hh = fs * 2.4, hx = cx - hw / 2, hy2 = H - hh - fs * 0.9;
    ctx.save(); ctx.fillStyle = panel; rr(ctx, hx, hy2, hw, hh, 6); ctx.fill(); ctx.clip();
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `600 ${fs}px ${MONO}`; ctx.lineWidth = 1.5;
    const pph = hw / 70, CN = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    for (let d = Math.floor((st.hdg - 40) / 5) * 5; d <= st.hdg + 40; d += 5) { const x = cx + (d - st.hdg) * pph, dn = norm360(d); ctx.beginPath(); ctx.moveTo(x, hy2); ctx.lineTo(x, hy2 + (dn % 10 ? 6 : 11)); ctx.stroke(); if (dn % 10 === 0) ctx.fillText(CN[dn] || String(dn / 10), x, hy2 + hh * 0.66); }
    const hb = cx + norm180(TGT_HDG - st.hdg) * pph; ctx.fillStyle = '#e46bd0'; ctx.fillRect(clamp(hb, hx, hx + hw) - 8, hy2, 16, 7);
    ctx.restore();
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; rr(ctx, cx - fs * 2.6, hy2 - fs * 1.75, fs * 5.2, fs * 1.6, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${fs}px ${MONO}`; ctx.fillText(pad3(st.hdg) + '°', cx, hy2 - fs * 0.88);
    // terrain awareness
    if (st.warn) {
      const txt = st.warn === 'crash' ? 'TERRAIN · RESET THE EXERCISE' : st.warn;
      ctx.font = `700 ${Math.round(fs * 1.4)}px ${MONO}`; const wdt = ctx.measureText(txt).width + 24;
      ctx.fillStyle = st.warn === 'TERRAIN' ? 'rgba(242,180,58,0.92)' : 'rgba(214,40,40,0.92)'; rr(ctx, cx - wdt / 2, H * 0.08, wdt, fs * 2.2, 4); ctx.fill();
      ctx.fillStyle = st.warn === 'TERRAIN' ? '#111' : '#fff'; ctx.fillText(txt, cx, H * 0.08 + fs * 1.1);
    }
    if (svt) { ctx.fillStyle = 'rgba(230,238,241,0.75)'; ctx.font = `600 ${Math.round(fs * 0.8)}px ${MONO}`; ctx.textAlign = 'left'; ctx.fillText('SVT · ' + Math.max(0, Math.round(st.agl / 10) * 10) + ' ft AGL', sx, fs * 1.3); }
  }

  let lastRO = -1;
  function readout() {
    const rot = 1091 * Math.tan(st.bank * D2R) / st.V, sr = Math.round(st.V / 10 + 7);
    const altOk = Math.abs(st.alt - TGT_ALT) < 100 && Math.abs(st.vs) < 200, hdgOk = Math.abs(norm180(st.hdg - TGT_HDG)) < 5 && Math.abs(st.bank) < 5;
    U.readout(`<p class="ro-big">Climb to 3,000 ft and turn right onto heading 090°</p>
      <ul class="checks"><li class="${altOk ? 'ok' : ''}">Level at 3,000 ft (±100 ft)</li><li class="${hdgOk ? 'ok' : ''}">Wings level on 090° (±5°)</li></ul>
      <dl class="ro"><div><dt>Rate of turn</dt><dd>${Math.abs(rot).toFixed(1)}°/s ${Math.abs(Math.abs(rot) - 3) < 0.4 ? '(standard rate)' : ''}</dd></div>
      <div><dt>Bank for a standard-rate turn</dt><dd>about ${sr}° at ${Math.round(st.V)} kt (TAS ÷ 10 + 7)</dd></div>
      <div><dt>Height above terrain</dt><dd>${Math.max(0, Math.round(st.agl / 10) * 10).toLocaleString('en-GB')} ft</dd></div></dl>
      <p class="note">Drag on the display or use the arrow keys (↑ nose down, ↓ nose up, like a yoke). The green circle is the flight path marker: where the aircraft is actually going. Synthetic vision draws the terrain from a database, as modern glass cockpits do. This trainer is for attitude-flying practice and is not a flight model.</p>`);
  }
  S.tick((dt, t) => { step(dt); draw(); if (t - lastRO > 0.4 || lastRO < 0) { lastRO = t; readout(); } });
  step(0); draw(); readout();
}

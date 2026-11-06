/* Wing section in a smoke tunnel: Joukowski aerofoil, potential flow, Cp-coloured surface.
   Separation past the critical angle is illustrated, not computed. */
import { createStage, makeArrow, ui, THREE, D2R, clamp, V3, MONO, REDUCED, noise3 } from './core.js';

// complex helpers
const cm = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]];
const cd = (p, q) => { const d = q[0] * q[0] + q[1] * q[1]; return [(p[0] * q[0] + p[1] * q[1]) / d, (p[1] * q[0] - p[0] * q[1]) / d]; };
const csq = p => { const r = Math.hypot(p[0], p[1]); const re = Math.sqrt(Math.max(0, (r + p[0]) / 2)); let im = Math.sqrt(Math.max(0, (r - p[0]) / 2)); if (p[1] < 0) im = -im; return [re, im]; };

function gridTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#0b1820'; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i <= 64; i++) { x.strokeStyle = i % 8 ? 'rgba(120,170,190,0.10)' : 'rgba(140,200,220,0.28)'; x.lineWidth = i % 8 ? 1 : 2; x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16, 512); x.stroke(); }
  for (let j = 0; j <= 32; j++) { x.strokeStyle = j % 8 ? 'rgba(120,170,190,0.10)' : 'rgba(140,200,220,0.28)'; x.lineWidth = j % 8 ? 1 : 2; x.beginPath(); x.moveTo(0, j * 16); x.lineTo(1024, j * 16); x.stroke(); }
  x.fillStyle = 'rgba(160,210,230,0.45)'; x.font = `600 14px ${MONO}`;
  for (let i = 1; i < 8; i++) x.fillText(String(i * 10), i * 128 + 4, 500);
  x.fillText('TEST SECTION · 2D WING · FLOW →', 12, 22);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export default function (host) {
  const S = createStage(host, { bg: 0x071017, env: 'room', cam: [0.9, 0.8, 7.4], target: [0.4, 0.1, 0], minDist: 3.5, maxDist: 16, maxPolar: Math.PI, bloom: { strength: 0.45, radius: 0.4, threshold: 1.25 }, exposure: 1.0 });
  S.scene.environmentIntensity = 0.35;
  const U = ui(host);
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 6, 8); S.scene.add(key);
  const rim = new THREE.DirectionalLight(0x88ccff, 1.0); rim.position.set(-6, 2, -4); S.scene.add(rim);

  // tunnel: back wall with grid, floor/ceiling rails, side frame
  const HALF = 1.3;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(15, 7.2), new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: 1, metalness: 0, envMapIntensity: 0.15, color: 0x8a9aa4 }));
  wall.position.set(0.3, 0, -HALF - 0.02); S.scene.add(wall);
  const steel = new THREE.MeshStandardMaterial({ color: 0x7d8a92, roughness: 0.35, metalness: 0.9 });
  [[-3.6], [3.6]].forEach(([y]) => {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(15, 0.08, HALF * 2 + 0.1), new THREE.MeshStandardMaterial({ color: 0x0e1b23, roughness: 0.6, metalness: 0.3 })); floor.position.set(0.3, y, 0); S.scene.add(floor);
    [-1, 1].forEach(sz => { const rail = new THREE.Mesh(new THREE.BoxGeometry(15, 0.07, 0.07), steel); rail.position.set(0.3, y + Math.sign(-y) * 0.06, sz * (HALF + 0.03)); S.scene.add(rail); });
  });
  [-7.2, 7.8].forEach(x => [-1, 1].forEach(sz => { const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 7.2, 0.07), steel); post.position.set(x, 0, sz * (HALF + 0.03)); S.scene.add(post); }));

  // Joukowski aerofoil
  const mu = [-0.09, 0.075], a = Math.hypot(1 - mu[0], mu[1]), beta = Math.asin(mu[1] / a);
  const NP = 220, prof = [], thetas = [];
  for (let i = 0; i < NP; i++) { const th = i / NP * Math.PI * 2 - beta; thetas.push(th); const z = [mu[0] + a * Math.cos(th), mu[1] + a * Math.sin(th)]; const inv = cd([1, 0], z); prof.push([z[0] + inv[0], z[1] + inv[1]]); }
  const shape = new THREE.Shape(); prof.forEach((p, i) => i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1]));
  const fg = new THREE.ExtrudeGeometry(shape, { depth: HALF * 2, bevelEnabled: false, curveSegments: 1 }); fg.translate(0, 0, -HALF);
  // map each vertex to its nearest profile point (for Cp colouring)
  const fp = fg.attributes.position, vIdx = new Uint16Array(fp.count);
  for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), y = fp.getY(i); let best = 0, bd = 1e9; for (let k = 0; k < NP; k++) { const d = (prof[k][0] - x) ** 2 + (prof[k][1] - y) ** 2; if (d < bd) { bd = d; best = k; } } vIdx[i] = best; }
  const fcol = new Float32Array(fp.count * 3); fg.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
  fg.computeVertexNormals();
  const foil = new THREE.Mesh(fg, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.5 }));
  S.scene.add(foil);

  // potential flow in the aerofoil frame: returns [u, v] or null inside
  function velZ(z, al, G) {
    const s = csq([z[0] * z[0] - z[1] * z[1] - 4, 2 * z[0] * z[1]]);
    const zA = [(z[0] + s[0]) / 2, (z[1] + s[1]) / 2], zB = [(z[0] - s[0]) / 2, (z[1] - s[1]) / 2];
    const dA = Math.hypot(zA[0] - mu[0], zA[1] - mu[1]), dB = Math.hypot(zB[0] - mu[0], zB[1] - mu[1]);
    const ze = dA > dB ? zA : zB; if (Math.max(dA, dB) < a * 1.003) return null;
    return velZeta(ze, al, G);
  }
  function velZeta(ze, al, G) {
    const w = [ze[0] - mu[0], ze[1] - mu[1]];
    const t2 = cd(cm([a * a, 0], [Math.cos(al), Math.sin(al)]), cm(w, w));
    const t3 = cd([0, G / (2 * Math.PI)], w);
    const dW = [Math.cos(al) - t2[0] + t3[0], -Math.sin(al) - t2[1] + t3[1]];
    const zi2 = cd([1, 0], cm(ze, ze));
    const W = cd(dW, [1 - zi2[0], -zi2[1]]);
    return [W[0], -W[1]];
  }

  // state
  let al = 0, ca = 1, sa = 0, G = 0, stallK = 0, aoa = 6;
  const toDisp = (x, y) => [x * ca + y * sa, -x * sa + y * ca];
  const toFoil = (x, y) => [x * ca - y * sa, x * sa + y * ca];

  // Cp colouring of the surface
  const NEU = [0.36, 0.39, 0.43], BLU = [0.0, 0.12, 1.0], RED = [1.0, 0.05, 0.02];
  const cpCol = cp => { if (cp < 0) { const t = Math.min(1, Math.pow(-cp / 1.6, 0.8)); return NEU.map((v, i) => v + (BLU[i] - v) * t); } const t = Math.min(1, cp); return NEU.map((v, i) => v + (RED[i] - v) * t); };
  const cpArr = new Float32Array(NP);
  function updateCp() {
    const Gk = 4 * Math.PI * a * Math.sin(al + beta);
    for (let k = 0; k < NP; k++) {
      const th = thetas[k], ze = [mu[0] + a * 1.025 * Math.cos(th), mu[1] + a * 1.025 * Math.sin(th)];
      const v = velZeta(ze, al, Gk); let cp = 1 - (v[0] * v[0] + v[1] * v[1]);
      // separated flow: suction on the rear upper surface collapses
      const p = prof[k];
      if (stallK > 0 && p[1] > 0.02 && p[0] > 1.6 - 3.2 * stallK && k < NP / 2) cp = cp * (1 - 0.75 * stallK) - 0.25 * stallK;
      cpArr[k] = clamp(cp, -3, 1);
    }
    for (let i = 0; i < fp.count; i++) { const c = cpCol(cpArr[vIdx[i]]); fcol[i * 3] = c[0]; fcol[i * 3 + 1] = c[1]; fcol[i * 3 + 2] = c[2]; }
    fg.attributes.color.needsUpdate = true;
  }

  // smoke streamlines (fat dashed lines on a sheet just inside the near wall)
  const NL = REDUCED ? 16 : 24, ZS = HALF - 0.04;
  const lines = [];
  for (let i = 0; i < NL; i++) {
    const L = S.fatLine([V3(-6, 0, ZS), V3(6, 0, ZS)], { colors: [1, 1, 1, 1, 1, 1], width: 1.3, opacity: 0.38 });
    const D = S.fatLine([V3(-6, 0, ZS), V3(6, 0, ZS)], { colors: [1, 1, 1, 1, 1, 1], width: 2.6, dashed: true, dashSize: 0.22, gapSize: 1.1 });
    D.material.dashOffset = -Math.random() * 1.3; L.renderOrder = 2; D.renderOrder = 3; S.scene.add(L, D); lines.push([L, D]);
  }
  let boil = 0;
  function streamline(y0, Gs) {
    const pts = [], col = [];
    let [x, y] = toFoil(-6.6, y0);
    const ds = 0.045;
    for (let n = 0; n < 420; n++) {
      const v1 = velZ([x, y], al, Gs); if (!v1) break;
      const m1 = Math.hypot(v1[0], v1[1]) || 1e-6;
      const xm = x + 0.5 * ds * v1[0] / m1, ym = y + 0.5 * ds * v1[1] / m1;
      const v2 = velZ([xm, ym], al, Gs) || v1; const m2 = Math.hypot(v2[0], v2[1]) || 1e-6;
      x += ds * v2[0] / m2; y += ds * v2[1] / m2;
      let [dx, dy] = toDisp(x, y);
      if (dx > 6.9 || Math.abs(dy) > 3.4) break;
      let sep = 0;
      if (stallK > 0) {
        const xs = 1.3 - 2.6 * stallK;
        const top = 0.45 + Math.max(0, x - xs) * 0.55 * (0.6 + stallK);
        if (x > xs) sep = clamp((x - xs) / 0.8, 0, 1) * clamp((top - y) / 0.6, 0, 1) * clamp((y - 0.02) / 0.25, 0, 1) * stallK;
      }
      if (sep) {
        const w = Math.min((dx + 1) * 0.45, 1.5);
        dy += sep * (0.1 * w + 0.24 * noise3(dx * 1.3 - boil * 1.1, y0 * 2.3, boil * 0.6) * w);
      }
      pts.push(V3(dx, dy, ZS));
      const sp = clamp(m2, 0, 2.2);
      const b = 0.35 + 0.4 * sp;
      const c = sep ? [1.25 * b, 0.42 * b, 0.32 * b] : [0.6 * b, 0.82 * b, 1.0 * b];
      col.push(...c);
    }
    return { pts, col };
  }
  function updateLines() {
    const Gk = 4 * Math.PI * a * Math.sin(al + beta);
    for (let i = 0; i < NL; i++) {
      const y0 = -2.7 + 5.4 * (i + 0.5) / NL;
      const { pts, col } = streamline(y0, Gk);
      const flat = pts.flatMap(p => [p.x, p.y, p.z]);
      lines[i].forEach((L, j) => {
        if (pts.length < 2) { L.visible = false; return; }
        L.visible = true; L.geometry.setPositions(flat); L.geometry.setColors(j ? col.map(c => c * 1.35) : col); L.computeLineDistances();
      });
    }
  }

  // drifting smoke particles across the span (volume)
  const NPART = REDUCED ? 200 : 450;
  const ppos = new Float32Array(NPART * 6), pcol = new Float32Array(NPART * 6), P = new Float32Array(NPART * 2), PZ = new Float32Array(NPART), age = new Float32Array(NPART);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(ppos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pcol, 3));
  const parts = new THREE.LineSegments(pg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
  S.scene.add(parts);
  function spawn(i, anywhere) { const dx = anywhere ? -6.5 + Math.random() * 13 : -6.8 + Math.random() * 0.4, dy = -3.0 + Math.random() * 6; const f = toFoil(dx, dy); P[i * 2] = f[0]; P[i * 2 + 1] = f[1]; PZ[i] = -HALF + 0.05 + Math.random() * (HALF * 2 - 0.25); age[i] = 0; }

  // arrows + labels
  const lift = makeArrow(0x3fe0a0, { radius: 0.035, glow: 1.4 }), drag = makeArrow(0xf2b43a, { radius: 0.03, glow: 1.4 });
  drag.rotation.z = -Math.PI / 2; S.scene.add(lift, drag);
  const lL = S.label('Lift', V3(), 'green'), dL = S.label('Drag', V3(), 'amber');
  S.label('Relative airflow →', V3(-5.4, 3.0, ZS), 'muted');
  const lowL = S.label('Low pressure', V3(), 'cyan'), highL = S.label('High pressure', V3(), 'pink');

  const sA = U.slider('aoa', 'Angle of attack', -4, 20, 6, 0.5, v => v.toFixed(1) + '°');
  const sV = U.slider('ias', 'Airspeed', 50, 150, 90, 1, v => v + ' kt');
  function coeffs(A) {
    const CL = A <= 15 ? 0.2 + 0.085 * A : Math.max(0.95, 1.475 - 0.1 * (A - 15));
    const CD = 0.007 + CL * CL / (Math.PI * 7 * 0.8) + (A > 15 ? 0.022 * Math.pow(A - 15, 1.4) : 0);
    return { CL, CD };
  }
  function update() {
    aoa = sA.v; al = aoa * D2R; ca = Math.cos(al); sa = Math.sin(al);
    foil.rotation.z = -al;
    stallK = clamp((aoa - 15) / 4, 0, 1);
    G = 4 * Math.PI * a * Math.sin(al + beta) * (1 - 0.45 * stallK);
    updateCp(); updateLines();
    const { CL, CD } = coeffs(aoa), q = Math.pow(sV.v / 100, 2);
    const [ox, oy] = toDisp(-1.0, 0.05);
    const lLen = Math.max(0.06, CL * q * 1.8), dLen = Math.max(0.06, CD * q * 1.8 * 8);
    lift.position.set(ox, oy + 0.15, HALF + 0.12); lift.userData.setLength(lLen);
    drag.position.set(ox + 0.35, oy, HALF + 0.12); drag.userData.setLength(dLen);
    lL.pos.set(ox, oy + lLen + 0.45, HALF + 0.12); dL.pos.set(ox + dLen + 0.8, oy, HALF + 0.12);
    // pressure labels: minimum and maximum Cp points
    let kmin = 0, kmax = 0; for (let k = 0; k < NP; k++) { if (cpArr[k] < cpArr[kmin]) kmin = k; if (cpArr[k] > cpArr[kmax]) kmax = k; }
    const pm = toDisp(prof[kmin][0], prof[kmin][1] + 0.55), px = toDisp(prof[kmax][0] - 0.55, prof[kmax][1] - 0.25);
    lowL.pos.set(pm[0], pm[1], HALF); highL.pos.set(px[0], px[1], HALF);
    const stalled = aoa > 15;
    U.readout(`<p class="ro-big ${stalled ? 'warn' : ''}">${stalled ? 'Stalled: airflow separating from the upper surface' : aoa > 12 ? 'Approaching the critical angle' : 'Smooth, attached airflow'}</p>
      <dl class="ro"><div><dt>Lift coefficient C<sub>L</sub></dt><dd>${CL.toFixed(2)}</dd></div>
      <div><dt>Drag coefficient C<sub>D</sub></dt><dd>${CD.toFixed(3)}</dd></div>
      <div><dt>Lift / drag</dt><dd>${(CL / CD).toFixed(1)}</dd></div>
      <div><dt>Lift compared with 100 kt</dt><dd>× ${(q * CL / coeffs(6).CL).toFixed(2)} of level-flight lift</dd></div></dl>
      <div class="cp-legend" style="display:grid;gap:4px"><span style="font-size:13px;font-weight:600">Surface colour: pressure coefficient C<sub>p</sub></span>
        <span aria-hidden="true" style="height:10px;border-radius:5px;background:linear-gradient(90deg,#0d52ff,#d1dbe5 62%,#ff2e1a)"></span>
        <span class="note" style="display:flex;justify-content:space-between"><span>Low pressure (suction)</span><span>Free stream</span><span>High pressure</span></span></div>
      <p class="note">The smoke lines bunch together and speed up over the top of the wing, where pressure is lowest. Lift = ½ρV²SC<sub>L</sub>, so doubling the airspeed gives four times the lift. The drag arrow is drawn 8× longer than lift to stay visible. This model is simplified: the stall above about 15° is illustrated, not computed.</p>`);
  }
  let pending = false;
  sA.on(() => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; update(); }); } });
  sV.on(update);
  update();
  for (let i = 0; i < NPART; i++) spawn(i, true);

  const cLo = [0.32, 0.45, 0.55], cHi = [0.9, 0.25, 0.2];
  let boilT = 0;
  S.tick(dt => {
    const sp = 2.0 * sV.v / 100;
    lines.forEach(([, D]) => { D.material.dashOffset -= dt * sp * 0.9; });
    if (stallK > 0) { boilT += dt; if (boilT > 0.12) { boilT = 0; boil += 0.35; updateLines(); } }
    const step = dt * sp, Gp = 4 * Math.PI * a * Math.sin(al + beta);
    for (let i = 0; i < NPART; i++) {
      let x = P[i * 2], y = P[i * 2 + 1];
      const v = velZ([x, y], al, Gp);
      if (!v) { spawn(i); continue; }
      let vx = v[0], vy = v[1]; const m = Math.hypot(vx, vy); if (m > 3) { vx *= 3 / m; vy *= 3 / m; }
      let sep = 0;
      if (stallK > 0 && y > 0.05 && x > 1.3 - 2.6 * stallK && x < 6.5 && y < 0.6 + (x + 0.9) * 0.42) sep = stallK;
      if (sep) { vx *= 1 - 0.7 * sep; vy *= 1 - 0.7 * sep; vx += (Math.random() - 0.62) * 2.4 * sep; vy += (Math.random() - 0.4) * 2.4 * sep; }
      x += vx * step; y += vy * step; age[i] += dt;
      const [dx, dy] = toDisp(x, y);
      if (dx > 6.9 || Math.abs(dy) > 3.4 || age[i] > 14) { spawn(i); continue; }
      P[i * 2] = x; P[i * 2 + 1] = y;
      const tl = 0.14 * sp, j = i * 6;
      const tx = (vx * ca + vy * sa) * tl, ty = (-vx * sa + vy * ca) * tl;
      ppos[j] = dx - tx; ppos[j + 1] = dy - ty; ppos[j + 2] = PZ[i]; ppos[j + 3] = dx; ppos[j + 4] = dy; ppos[j + 5] = PZ[i];
      const c = sep ? cHi : cLo;
      for (let e = 0; e < 2; e++) { const f = e ? 1 : 0.15; pcol[j + e * 3] = c[0] * f; pcol[j + e * 3 + 1] = c[1] * f; pcol[j + e * 3 + 2] = c[2] * f; }
    }
    pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
  });
}

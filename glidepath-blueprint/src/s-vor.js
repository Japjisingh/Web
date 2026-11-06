/* VOR radials and the CDI (Radio Navigation). */
import { createStage, addSky, makeTerrain, fieldColor, fbm, makeAircraft, glowSprite, ui, hiDPI, bezel, glassGlare, THREE, D2R, norm360, norm180, clamp, pad3, hdir, V3, MONO } from './core.js';

const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** additive ribbon trail that fades towards its tail */
function makeTrail(n, width, color) {
  const pos = new Float32Array(n * 6), col = new Float32Array(n * 6), idx = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  const c = new THREE.Color(color), hist = [];
  function rebuild() {
    const L = hist.length;
    for (let i = 0; i < n; i++) {
      const j = i * 6;
      if (i >= L || L < 2) { for (let k = 0; k < 6; k++) { pos[j + k] = 0; col[j + k] = 0; } continue; }
      const p = hist[i], a = hist[Math.max(0, i - 1)], b = hist[Math.min(L - 1, i + 1)];
      let dx = b.x - a.x, dz = b.z - a.z; const m = Math.hypot(dx, dz) || 1; dx /= m; dz /= m;
      const t = i / (L - 1), w = width * (0.25 + 0.75 * t);
      pos[j] = p.x - dz * w; pos[j + 1] = p.y; pos[j + 2] = p.z + dx * w;
      pos[j + 3] = p.x + dz * w; pos[j + 4] = p.y; pos[j + 5] = p.z - dx * w;
      const k = t * t * 1.6;
      col[j] = col[j + 3] = c.r * k; col[j + 1] = col[j + 4] = c.g * k; col[j + 2] = col[j + 5] = c.b * k;
    }
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
  }
  return {
    mesh,
    push(p) { const l = hist[hist.length - 1]; if (l && l.distanceTo(p) < 0.06) return; hist.push(p.clone()); if (hist.length > n) hist.shift(); rebuild(); },
    reset() { hist.length = 0; rebuild(); }
  };
}

/** Doppler VOR ground station: counterpoise on legs, antenna ring, shelter beneath */
function makeDVOR() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xeef1f2, roughness: 0.45, metalness: 0.05 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8c0c5, roughness: 0.35, metalness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a3136, roughness: 0.7 });
  const conc = new THREE.MeshStandardMaterial({ color: 0x9aa09c, roughness: 0.95 });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.65, 0.04, 64), conc); pad.position.y = 0.02; pad.receiveShadow = true; g.add(pad);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.035, 72), metal); disc.position.y = 0.6; g.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.02, 8, 96), white); rim.rotation.x = Math.PI / 2; rim.position.y = 0.6; g.add(rim);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.6, 8), metal); leg.position.set(Math.cos(a) * 1.05, 0.3, Math.sin(a) * 1.05); g.add(leg); }
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, x = Math.cos(a) * 1.18, z = Math.sin(a) * 1.18;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), white); rod.position.set(x, 0.72, z); g.add(rod);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.025), white); cap.position.set(x, 0.82, z); cap.rotation.y = -a; g.add(cap);
  }
  const cen = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.28, 20), white); cen.position.y = 0.76; g.add(cen);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), white); top.position.y = 0.9; g.add(top);
  const hut = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.48, 0.75), white); hut.position.y = 0.28; g.add(hut);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.01), dark); door.position.set(0, 0.21, 0.38); g.add(door);
  const ac = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.05), metal); ac.position.set(0.22, 0.3, 0.39); g.add(ac);
  const beacon = glowSprite(0xff2a2a, 0.35, 3); beacon.position.y = 1.0; g.add(beacon);
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  pad.castShadow = false;
  g.userData.beacon = beacon;
  return g;
}

function drawCDI(cv, obs, dots, flag) {
  const { ctx, W, H } = hiDPI(cv);
  ctx.clearRect(0, 0, W, H); ctx.save();
  const r = bezel(ctx, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // rotating compass card
  const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
  ctx.strokeStyle = '#f1f4f5'; ctx.fillStyle = '#f1f4f5';
  for (let d = 0; d < 360; d += 5) {
    ctx.save(); ctx.rotate((d - obs) * D2R);
    const major = d % 10 === 0, big = d % 30 === 0;
    ctx.lineWidth = big ? 2.2 : major ? 1.6 : 1; ctx.beginPath(); ctx.moveTo(0, -r * 0.95); ctx.lineTo(0, -r * (big ? 0.8 : major ? 0.85 : 0.89)); ctx.stroke();
    if (big) { ctx.font = `700 ${Math.round(r * (names[d] ? 0.15 : 0.13))}px ${MONO}`; ctx.fillText(names[d] || String(d / 10), 0, -r * 0.67); }
    ctx.restore();
  }
  // inner face
  ctx.fillStyle = '#0d1114'; ctx.beginPath(); ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#262d32'; ctx.lineWidth = 1; ctx.stroke();
  // lubber line (course index) and reciprocal index
  ctx.fillStyle = '#ffb23e'; ctx.beginPath(); ctx.moveTo(0, -r * 0.955); ctx.lineTo(-r * 0.07, -r * 1.06); ctx.lineTo(r * 0.07, -r * 1.06); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c9d1d5'; ctx.beginPath(); ctx.moveTo(0, r * 0.955); ctx.lineTo(-r * 0.05, r * 1.04); ctx.lineTo(r * 0.05, r * 1.04); ctx.closePath(); ctx.fill();
  // deviation dots (2 deg each)
  ctx.fillStyle = '#d6dde0';
  for (let i = -5; i <= 5; i++) { if (!i) continue; ctx.beginPath(); ctx.arc(i * r * 0.1, 0, r * 0.022, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#d6dde0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r * 0.05, 0, Math.PI * 2); ctx.stroke();
  // TO/FROM flag window
  const fx = r * 0.3, fy = -r * 0.3, fw = r * 0.26, fh = r * 0.15;
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#3d464c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(fx - fw / 2, fy - fh / 2, fw, fh, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = `800 ${Math.round(r * 0.11)}px ${MONO}`; ctx.fillText(flag === 'TO' ? 'TO' : 'FR', fx, fy + 1);
  // needle (hinged at top), with shadow
  const x = clamp(dots, -5, 5) * r * 0.1;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = Math.max(3, r * 0.04); ctx.beginPath(); ctx.moveTo(x * 0.15 + 2, -r * 0.56 + 2); ctx.lineTo(x + 2, r * 0.5 + 2); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2.4, r * 0.032); ctx.beginPath(); ctx.moveTo(x * 0.15, -r * 0.56); ctx.lineTo(x, r * 0.5); ctx.stroke();
  // course readout
  ctx.fillStyle = '#ffb23e'; ctx.font = `700 ${Math.round(r * 0.1)}px ${MONO}`; ctx.fillText('CRS ' + pad3(obs), 0, r * 0.36);
  glassGlare(ctx, r);
  // OBS knob (bottom-left corner)
  const kx = -r * 0.97, ky = r * 0.97, kr = r * 0.17;
  const kg = ctx.createRadialGradient(kx - kr * 0.3, ky - kr * 0.3, kr * 0.1, kx, ky, kr); kg.addColorStop(0, '#5b646a'); kg.addColorStop(1, '#1b1f22');
  ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#0e1113'; ctx.lineWidth = 1;
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(kx + Math.cos(a) * kr * 0.8, ky + Math.sin(a) * kr * 0.8); ctx.lineTo(kx + Math.cos(a) * kr, ky + Math.sin(a) * kr); ctx.stroke(); }
  ctx.fillStyle = '#c9d1d5'; ctx.font = `700 ${Math.round(r * 0.075)}px ${MONO}`; ctx.fillText('OBS', kx + kr * 1.55, ky + kr * 0.35);
  ctx.restore();
}

/** keep the white paint below the bloom threshold in full sun */
function tame(ac) { ac.traverse(m => { const mt = m.material; if (mt && mt.isMeshPhysicalMaterial && mt.color.getHex() === 0xf3f5f6) { mt.color.setHex(0xc4cbcf); mt.clearcoat = 0.45; mt.roughness = 0.42; } }); return ac; }

export default function (host) {
  const S = createStage(host, { cam: [0, 10.5, 13.5], target: [0, 0.4, 0.6], minDist: 3, maxDist: 34, shadows: true, fog: [0xc9d6df, 45, 140], bloom: { strength: 0.32, radius: 0.35, threshold: 2.2 } });
  addSky(S, { elevation: 38, azimuth: 160, shadow: { extent: 11, size: 2048 }, turbidity: 5, exposure: 0.66, envIntensity: 0.45 });
  const U = ui(host);
  const ROSE = 7.4, ALT = 2.1, DIST = 4.7;

  // terrain: flat around the station, rolling farmland further out
  const terr = makeTerrain({
    size: 150, seg: 190,
    height: (x, z) => { const r = Math.hypot(x, z); return smooth(9.5, 20, r) * (fbm(x * 0.03, z * 0.03) * 7 + 0.8) - 0.01; },
    color: (y, s) => { const k = 1 - clamp(s * 1.6, 0, 0.35); return [k, k, k * 0.97]; }
  });
  terr.material.vertexColors = true;
  terr.material.map = fieldTexture(S, 2048, 11, { centre: (x, n) => { const px = n / 150; x.fillStyle = '#5f7f3a'; x.beginPath(); x.arc(n / 2, n / 2, 2.9 * px, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#a49e86'; x.lineWidth = 0.16 * px; x.beginPath(); x.moveTo(n / 2, n / 2 + 1.6 * px); x.lineTo(n / 2 + 3 * px, n / 2 + 12 * px); x.lineTo(n / 2 + 4 * px, n); x.stroke(); } });
  terr.material.roughness = 1; terr.material.needsUpdate = true;
  S.scene.add(terr);

  const st = makeDVOR(); S.scene.add(st);
  S.label('VOR', V3(0, 1.45, 0), 'strong');

  // compass rose overlay
  const roseY = 0.06, rose = new THREE.Group(); S.scene.add(rose);
  const ring = []; for (let i = 0; i <= 180; i++) { const d = hdir(i * 2); ring.push(V3(d.x * ROSE, roseY, d.z * ROSE)); }
  rose.add(S.fatLine(ring, { color: 0xbfe9f5, width: 2.2 }));
  for (let d = 0; d < 360; d += 10) {
    const a = hdir(d), r2 = d % 30 ? ROSE - 0.3 : ROSE - 0.6;
    rose.add(S.fatLine([V3(a.x * ROSE, roseY, a.z * ROSE), V3(a.x * r2, roseY, a.z * r2)], { color: 0xdff6fc, width: d % 30 ? 1.6 : 2.6 }));
  }
  for (let d = 0; d < 360; d += 30) {
    const a = hdir(d);
    rose.add(S.fatLine([V3(a.x * 1.75, roseY, a.z * 1.75), V3(a.x * (ROSE - 0.6), roseY, a.z * (ROSE - 0.6))], { color: 0x9fd8ea, width: 1.3, opacity: 0.55 }));
    S.label(pad3(d), V3(a.x * (ROSE + 0.6), roseY, a.z * (ROSE + 0.6)), '');
  }

  // selected course (solid FROM side, dashed TO side) and aircraft radial
  const course = new THREE.Group(); S.scene.add(course);
  course.add(S.fatLine([V3(0, roseY + 0.02, -1.75), V3(0, roseY + 0.02, -ROSE)], { color: 0xff5fc0, width: 4.5 }));
  course.add(S.fatLine([V3(0, roseY + 0.02, 1.75), V3(0, roseY + 0.02, ROSE)], { color: 0xff5fc0, width: 4.5, dashed: true, dashSize: 0.35, gapSize: 0.25 }));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.5, 1.4) }));
  tip.rotation.x = -Math.PI / 2; tip.position.set(0, roseY + 0.03, -ROSE - 0.1); course.add(tip);
  const cLab = S.label('', V3(), 'pink');
  const radial = new THREE.Group(); S.scene.add(radial);
  radial.add(S.fatLine([V3(0, roseY + 0.04, -1.75), V3(0, roseY + 0.04, -DIST)], { color: 0x45d6f5, width: 3.5 }));
  const drop = S.fatLine([V3(0, 0, 0), V3(0, 1, 0)], { color: 0x9fe6f6, width: 1.5, dashed: true, dashSize: 0.12, gapSize: 0.1, opacity: 0.8 }); S.scene.add(drop);
  const foot = glowSprite(0x45d6f5, 0.5, 1.6); S.scene.add(foot);
  const aLab = S.label('', V3(), 'cyan');

  const ac = tame(makeAircraft({ scale: 1.7 })); ac.rotation.order = 'YXZ'; S.scene.add(ac);
  const trail = makeTrail(90, 0.09, 0x9feaff); S.scene.add(trail.mesh);

  const cv = host.querySelector('canvas.inst');
  const sR = U.slider('radial', 'Aircraft is on radial', 0, 359, 120, 1, v => pad3(v) + '°');
  const sH = U.slider('hdg', 'Aircraft heading', 0, 359, 270, 1, v => pad3(v) + '°');
  const sO = U.slider('obs', 'OBS, the course you select', 0, 359, 90, 1, v => pad3(v) + '°');
  const auto = U.seg('auto', 'Fly a circle round the VOR', [[0, 'Off'], [1, 'On']], 0);
  const view = U.seg('view', 'View', [['over', 'Overview'], ['chase', 'Chase']], 'over');
  auto.on(() => trail.reset());

  const camSave = { p: S.camera.position.clone(), t: S.controls.target.clone() };
  view.on(v => {
    if (v === 'chase') { camSave.p.copy(S.camera.position); camSave.t.copy(S.controls.target); S.controls.enabled = false; }
    else { S.controls.enabled = true; S.camera.position.copy(camSave.p); S.controls.target.copy(camSave.t); }
  });

  let bank = 0;
  function update() {
    const R = sR.v, H = sH.v, O = sO.v, p = hdir(R);
    const x = p.x * DIST, z = p.z * DIST;
    ac.position.set(x, ALT, z); ac.rotation.y = -H * D2R; ac.rotation.z = -bank;
    drop.userData.setPoints([V3(x, ALT - 0.15, z), V3(x, roseY + 0.05, z)]);
    foot.position.set(x, roseY + 0.05, z);
    course.rotation.y = -O * D2R; radial.rotation.y = -R * D2R;
    const cp = hdir(O); cLab.pos.set(cp.x * 3.1, 0.3, cp.z * 3.1); cLab.el.textContent = 'Course ' + pad3(O);
    aLab.pos.set(x, ALT + 0.95, z); aLab.el.textContent = 'Radial ' + pad3(R);
    const ang = norm180(R - O); let flag, defl;
    if (Math.abs(ang) < 90) { flag = 'FROM'; defl = -ang; } else { flag = 'TO'; defl = norm180(R - (O + 180)); }
    const dots = clamp(defl / 2, -5, 5);
    drawCDI(cv, O, dots, flag);
    const side = dots < -0.25 ? 'left' : dots > 0.25 ? 'right' : '';
    const rev = Math.abs(norm180(H - O)) > 90;
    U.readout(`<p class="ro-big">${flag} · ${side ? `needle ${Math.abs(dots).toFixed(1)} dots ${side}${Math.abs(dots) >= 5 ? ' (full scale)' : ''}` : 'needle centred'}</p>
      <p>You are on the <b>${pad3(R)} radial</b>. With <b>${pad3(O)}</b> set, flying ${pad3(O)}° would take you <b>${flag === 'TO' ? 'towards' : 'away from'}</b> the station.
      ${side ? `The selected course is to your <b>${side}</b> (one dot = 2°).` : 'You are on the selected course.'}</p>
      <p class="note">${rev ? `You are heading roughly opposite to ${pad3(O)}, so the needle is reverse-sensing here. ` : ''}Move the heading slider: the needle does not change. A VOR shows where you are, not where you are pointing.</p>`);
  }
  [sR, sH, sO].forEach(s => s.on(update)); update();
  new ResizeObserver(update).observe(cv);

  const chaseP = new THREE.Vector3(), chaseT = new THREE.Vector3();
  let tt = 0;
  S.tick(dt => {
    tt += dt;
    ac.userData.update(dt);
    st.userData.beacon.material.opacity = 0.55 + 0.45 * Math.max(0, Math.sin(tt * 3));
    const on = auto.v == 1;
    const tb = on ? 22 * D2R : 0; bank += (tb - bank) * Math.min(1, dt * 2);
    if (on) { sR.v = norm360(sR.v + dt * 14); sH.v = norm360(sR.v + 90); }
    if (on || Math.abs(bank) > 0.002) update();
    if (on) trail.push(ac.position);
    if (view.v === 'chase') {
      const d = hdir(sH.v);
      chaseP.set(ac.position.x - d.x * 4.2, ALT + 1.5, ac.position.z - d.z * 4.2);
      chaseT.set(ac.position.x + d.x * 2.5, ALT - 0.4, ac.position.z + d.z * 2.5);
      const k = Math.min(1, dt * 4);
      S.camera.position.lerp(chaseP, k); S.controls.target.lerp(chaseT, k);
    }
  });
}

/** high-resolution farmland texture (fields, hedgerows, woods, lanes); centre = world origin */
function fieldTexture(S, size, seed0, opts = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  let seed = seed0; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  x.fillStyle = '#3d5a2a'; x.fillRect(0, 0, size, size);
  const pal = ['#4b6d30', '#5e7b36', '#6e8541', '#8b8a4c', '#7a6b40', '#3f6229', '#a09858', '#567431', '#6a7f3a', '#91834f'];
  const cell = size / (opts.cells || 26);
  for (let i = -1; i <= (opts.cells || 26); i++) for (let j = -1; j <= (opts.cells || 26); j++) {
    const w = cell * (0.75 + rnd() * 0.8), h = cell * (0.65 + rnd() * 0.8);
    x.save(); x.translate(i * cell + rnd() * cell * 0.35, j * cell + rnd() * cell * 0.35); x.rotate((rnd() - 0.5) * 0.3);
    x.fillStyle = pal[Math.floor(rnd() * pal.length)]; x.fillRect(0, 0, w, h);
    if (rnd() < 0.55) { x.strokeStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,220,0.06)'; x.lineWidth = 1.2; const vert = rnd() < 0.5; for (let k = 0; k < (vert ? w : h); k += 3.5) { x.beginPath(); if (vert) { x.moveTo(k, 0); x.lineTo(k, h); } else { x.moveTo(0, k); x.lineTo(w, k); } x.stroke(); } }
    x.strokeStyle = 'rgba(32,48,22,0.85)'; x.lineWidth = 2.2; x.strokeRect(0, 0, w, h);
    x.restore();
  }
  for (let k = 0; k < 70; k++) { const cx = rnd() * size, cy = rnd() * size, n = 6 + rnd() * 18; for (let m = 0; m < n; m++) { x.fillStyle = rnd() < 0.5 ? '#26401c' : '#2f4a20'; x.beginPath(); x.arc(cx + (rnd() - 0.5) * cell * 0.9, cy + (rnd() - 0.5) * cell * 0.9, 2 + rnd() * cell * 0.12, 0, Math.PI * 2); x.fill(); } }
  x.strokeStyle = '#9e9984'; x.lineWidth = 1.5; x.lineCap = 'round';
  for (let k = 0; k < 5; k++) { x.beginPath(); let px = rnd() * size, py = 0; x.moveTo(px, py); while (py < size) { px += (rnd() - 0.5) * cell * 1.2; py += cell * 0.8; x.lineTo(px, py); } x.stroke(); }
  if (opts.centre) opts.centre(x, size);
  const img = x.getImageData(0, 0, size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.6; }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = S.renderer.capabilities.getMaxAnisotropy(); t.generateMipmaps = true;
  return t;
}

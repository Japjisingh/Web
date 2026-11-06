/* Holding pattern entries (Operational Procedures). */
import { createStage, addSky, makeTerrain, fieldColor, fbm, makeAircraft, makeArrow, glowSprite, ui, THREE, D2R, R2D, norm360, norm180, clamp, pad3, hdir, V3 } from './core.js';

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
      const k = t * t * 1.8;
      col[j] = col[j + 3] = c.r * k; col[j + 1] = col[j + 4] = c.g * k; col[j + 2] = col[j + 5] = c.b * k;
    }
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
  }
  return {
    mesh,
    push(p) { const l = hist[hist.length - 1]; if (l && l.distanceTo(p) < 0.05) return; hist.push(p.clone()); if (hist.length > n) hist.shift(); rebuild(); },
    reset() { hist.length = 0; rebuild(); }
  };
}

/** translucent wedge, faint at the fix and stronger at the rim (vertex alpha) */
function wedge(b0, b1, color, rad, y) {
  const c = new THREE.Color(color), n = 48, pos = [], col = [], idx = [];
  const rings = [0, 0.55, 1], alpha = [0.03, 0.1, 0.32];
  for (let r = 0; r < rings.length; r++) for (let i = 0; i <= n; i++) { const d = hdir(b0 + (b1 - b0) * i / n); pos.push(d.x * rad * rings[r], y, d.z * rad * rings[r]); col.push(c.r, c.g, c.b, alpha[r]); }
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < n; i++) { const a = r * (n + 1) + i, b = a + n + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
}

/** keep the white paint below the bloom threshold in full sun */
function tame(ac) { ac.traverse(m => { const mt = m.material; if (mt && mt.isMeshPhysicalMaterial && mt.color.getHex() === 0xf3f5f6) { mt.color.setHex(0xc4cbcf); mt.clearcoat = 0.45; mt.roughness = 0.42; } }); return ac; }

export default function (host) {
  const S = createStage(host, { cam: [0, 17, 15.5], target: [0, 2.2, 0.5], minDist: 5, maxDist: 42, shadows: true, fog: [0xc9d6df, 50, 150], bloom: { strength: 0.4, radius: 0.4, threshold: 2.0 } });
  addSky(S, { elevation: 42, azimuth: 205, shadow: { extent: 13, size: 2048 }, turbidity: 4.5, exposure: 0.66, envIntensity: 0.45 });
  const U = ui(host);
  const ALT = 3.2, r = 1.15, L = Math.PI * r, D0 = 7.2, RAD = 6.6;

  const terr = makeTerrain({
    size: 170, seg: 190,
    height: (x, z) => fbm(x * 0.028, z * 0.028) * 6 - 1.6,
    color: (y, s) => { const k = 1 - clamp(s * 1.6, 0, 0.35); return [k, k, k * 0.97]; }
  });
  terr.material.vertexColors = true; terr.material.map = fieldTexture(S, 2048, 29); terr.material.roughness = 1; terr.material.needsUpdate = true;
  S.scene.add(terr);

  // fix: light beam from the ground beacon up to the holding level
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 12, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.7, 1.8), transparent: true, opacity: 0.5, depthWrite: false }));
  const groundY = fbm(0, 0) * 6 - 1.6;
  beam.scale.y = ALT - groundY; beam.position.y = (ALT + groundY) / 2; S.scene.add(beam);
  const pin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.3 }));
  pin.rotation.x = Math.PI; pin.position.y = ALT + 0.36; S.scene.add(pin);
  const fixGlow = glowSprite(0xffffff, 1.1, 2.2); fixGlow.position.y = ALT; S.scene.add(fixGlow);
  const gGlow = glowSprite(0x9fe6ff, 1.4, 1.2); gGlow.position.y = groundY + 0.05; S.scene.add(gGlow);
  S.label('Holding fix', V3(0, ALT + 0.95, 0), 'strong');

  let dyn = new THREE.Group(); S.scene.add(dyn);
  const ac = tame(makeAircraft({ scale: 1.5 })); ac.rotation.order = 'YXZ'; S.scene.add(ac);
  const trail = makeTrail(140, 0.1, 0x7ff0c6); S.scene.add(trail.mesh);
  const secLabs = [S.label('', V3(), 'cyan'), S.label('', V3(), 'amber'), S.label('', V3(), 'pink')];
  let path = [], idx = 0, wait = 0, chev = null, curve = null, chevU = 0, prevH = null, bank = 0;

  function simulate(C, H, s, lapOnly) {
    const pts = []; let x = 0, z = 0, h = H; const step = 0.04, rate = step / r * R2D;
    const push = () => pts.push(V3(x, ALT, z));
    const fwd = () => { const d = hdir(h); x += d.x * step; z += d.z * step; push(); };
    const straight = dist => { for (let i = 0; i < dist / step; i++) fwd(); };
    const turnTo = (tgt, dir) => { tgt = norm360(tgt); if (!dir) dir = norm180(tgt - h) >= 0 ? 1 : -1; let g = 0; while (Math.abs(norm180(tgt - h)) > rate && g++ < 3000) { h = norm360(h + dir * rate); fwd(); } h = tgt; };
    const c = hdir(C);
    const intercept = () => { let g = 0; while (g++ < 4000) { const sp = -(x * c.x + z * c.z); if (sp <= 0.02) break; const cs = Math.max(sp - 1.4 * r, -0.6); const cx = -c.x * cs, cz = -c.z * cs; const want = norm360(Math.atan2(cx - x, -(cz - z)) * R2D); h = norm360(h + clamp(norm180(want - h), -rate, rate)); fwd(); } };
    const O = norm360(C + 180);
    let type = '';
    if (lapOnly) { h = C; push(); }
    else {
      const st = hdir(norm360(H + 180)); x = st.x * D0; z = st.z * D0; h = H; push(); straight(D0);
      const d = norm360(s > 0 ? H - C : C - H);
      if (d >= 250 || d <= 70) { type = 'Direct'; turnTo(O, s); straight(L); turnTo(C, s); intercept(); }
      else if (d <= 180) { type = 'Parallel'; turnTo(O, 0); straight(L); turnTo(C + 45 * s, -s); intercept(); }
      else { type = 'Teardrop'; turnTo(O - 30 * s, 0); straight(L); turnTo(C, s); intercept(); }
    }
    turnTo(O, s); straight(L); turnTo(C, s); intercept();
    return { pts, type };
  }

  const sC = U.slider('crs', 'Inbound course', 0, 359, 0, 1, v => pad3(v) + '°');
  const sH = U.slider('hdg', 'Your heading arriving at the fix', 0, 359, 135, 1, v => pad3(v) + '°');
  const turns = U.seg('turns', 'Turns', [[1, 'Right (standard)'], [-1, 'Left']], 1);
  const TXT = {
    Direct: s => `Cross the fix, turn ${s > 0 ? 'right' : 'left'} in the direction of the hold and fly the pattern.`,
    Parallel: s => `Cross the fix and turn onto the outbound heading on the non-holding side for one minute. Then turn ${s > 0 ? 'left' : 'right'} towards the holding side to intercept the inbound track or return to the fix.`,
    Teardrop: s => `Cross the fix and fly 30° off the outbound heading into the holding side for one minute. Then turn ${s > 0 ? 'right' : 'left'} to intercept the inbound track.`
  };
  const chevMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.5, 2.6) });
  const chevGeo = new THREE.ConeGeometry(0.11, 0.3, 3); chevGeo.rotateX(Math.PI / 2); chevGeo.scale(1, 0.35, 1);
  const NCH = 22, dummy = new THREE.Object3D();

  function update() {
    const C = sC.v, H = sH.v, s = +turns.v;
    S.scene.remove(dyn);
    dyn.traverse(o => { if (o.geometry && o.geometry !== chevGeo) o.geometry.dispose(); });
    dyn = new THREE.Group(); S.scene.add(dyn);
    const y = ALT - 0.02;
    const sec = s > 0 ? [[C + 70, C + 250, 0x43b9d6, 'Direct'], [C, C + 70, 0xf0b43c, 'Teardrop'], [C + 250, C + 360, 0xe06ab8, 'Parallel']]
                      : [[C + 110, C + 290, 0x43b9d6, 'Direct'], [C + 290, C + 360, 0xf0b43c, 'Teardrop'], [C, C + 110, 0xe06ab8, 'Parallel']];
    sec.forEach(([b0, b1, col, name], i) => {
      dyn.add(wedge(b0, b1, col, RAD, y));
      const arc = []; for (let k = 0; k <= 40; k++) { const d = hdir(b0 + (b1 - b0) * k / 40); arc.push(V3(d.x * RAD, y, d.z * RAD)); }
      dyn.add(S.fatLine(arc, { color: col, width: 3 }));
      const mid = hdir((b0 + b1) / 2); secLabs[i].pos.set(mid.x * (RAD - 1.1), y + 0.05, mid.z * (RAD - 1.1)); secLabs[i].el.textContent = name;
    });
    // sector boundaries: inbound course line and the 70° line through the fix
    const c = hdir(C), b70 = hdir(C + 70 * s);
    dyn.add(S.fatLine([V3(-b70.x * RAD, y, -b70.z * RAD), V3(b70.x * RAD, y, b70.z * RAD)], { color: 0xeaf2f5, width: 1.6, dashed: true, dashSize: 0.25, gapSize: 0.18, opacity: 0.85 }));
    dyn.add(S.fatLine([V3(-c.x * RAD, y, -c.z * RAD), V3(c.x * RAD, y, c.z * RAD)], { color: 0xeaf2f5, width: 1.6, opacity: 0.85 }));
    // racetrack: glowing tube + moving chevrons
    const lap = simulate(C, C, s, true).pts.filter((_, i) => i % 3 === 0);
    curve = new THREE.CatmullRomCurve3(lap.slice(0, -1), true);
    dyn.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 320, 0.045, 8, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.75, 1.9) })));
    chev = new THREE.InstancedMesh(chevGeo, chevMat, NCH); dyn.add(chev);
    // inbound arrow
    const arw = makeArrow(0xffffff, { radius: 0.05, glow: 1.2 }); arw.userData.setLength(2.2);
    const ao = new THREE.Group(); ao.rotation.y = -C * D2R; arw.rotation.x = -Math.PI / 2; arw.position.set(0, 0, 4.6); ao.add(arw); ao.position.y = ALT; dyn.add(ao);
    // entry path (planned) as a faint dashed line
    const res = simulate(C, H, s, false); path = res.pts; idx = 0; wait = 0; prevH = null; trail.reset();
    dyn.add(S.fatLine(path.filter((_, i) => i % 3 === 0), { color: 0x7ff0c6, width: 1.6, dashed: true, dashSize: 0.18, gapSize: 0.14, opacity: 0.55 }));
    U.readout(`<p class="ro-big">${res.type} entry</p><p>${TXT[res.type](s)}</p>
      <p class="note">Sectors are measured from the inbound course with a line at 70° through the fix. ICAO allows ±5° flexibility at the sector edges. Legs are 1 minute in still air.</p>`);
  }
  [sC, sH].forEach(x => x.on(update)); turns.on(update); update();

  S.tick((dt, t) => {
    ac.userData.update(dt);
    fixGlow.material.opacity = 0.7 + 0.3 * Math.sin(t * 3);
    chevU = (chevU + dt * 0.05) % 1;
    if (chev && curve) {
      for (let i = 0; i < NCH; i++) {
        const u = (chevU + i / NCH) % 1, p = curve.getPointAt(u), tg = curve.getTangentAt(u);
        dummy.position.copy(p); dummy.position.y += 0.002; dummy.lookAt(p.x + tg.x, p.y + tg.y, p.z + tg.z); dummy.updateMatrix(); chev.setMatrixAt(i, dummy.matrix);
      }
      chev.instanceMatrix.needsUpdate = true;
    }
    if (!path.length) return;
    if (idx >= path.length - 1) { wait += dt; if (wait > 1.8) { idx = 0; wait = 0; prevH = null; trail.reset(); } }
    else idx = Math.min(path.length - 1, idx + dt * 55);
    const i = Math.floor(idx), p = path[i], q = path[Math.min(path.length - 1, i + 1)];
    ac.position.copy(p);
    if (q !== p) {
      const h = Math.atan2(q.x - p.x, -(q.z - p.z));
      if (prevH !== null && dt > 0) { const rate = norm180((h - prevH) * R2D) / dt; bank += (clamp(rate * 0.012, -0.5, 0.5) - bank) * Math.min(1, dt * 3); }
      prevH = h; ac.rotation.y = -h; ac.rotation.z = -bank;
    }
    trail.push(p);
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

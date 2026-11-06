/* ILS + PAPI on final approach (Radio Navigation / Aerodromes) */
import { createStage, addSky, makeTerrain, fieldColor, fbm, makeAircraft, glowSprite, glowTexture, ui, hiDPI, bezel, glassGlare, THREE, D2R, clamp, fmt, V3, MONO, REDUCED } from './core.js';

// World units: 1 unit = 0.5 nm (926 m) along the approach. Side view draws heights 4x taller.
const EX = 4, GS = 3, RW_W = 0.13, RW_L = 3.24, TDZ = -0.33, LOC = -RW_L - 0.35, DMAX = 12;
const PAPI_SET = [3.5, 3 + 1 / 6, 3 - 1 / 6, 2.5]; // inner unit (nearest runway) first
const PAPI_TXT = ['Four red: too low', 'Three red: slightly low', 'Two white, two red: on the glidepath', 'Three white: slightly high', 'Four white: too high'];

/* ---------- runway texture: ICAO-style markings for a 45 m wide, 3,000 m runway ---------- */
function runwayTexture(renderer) {
  const W = 192, H = 5120, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#3a3c3e'; x.fillRect(0, 0, W, H);
  const img = x.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
  const pxm = H / 3000, pxw = W / 45;
  const Y = m => H - m * pxm, X = m => W / 2 + m * pxw;
  // tyre marks in the touchdown zone, both ends
  x.globalAlpha = 0.35; x.fillStyle = '#1c1d1e';
  for (const [a, b] of [[250, 900], [2100, 2750]]) for (let k = 0; k < 40; k++) { const m = a + Math.random() * (b - a); x.fillRect(X(-4 + Math.random() * 8), Y(m + 60), 2 + Math.random() * 3, 60 * pxm * Math.random()); }
  x.globalAlpha = 1;
  const white = '#e8ebeb'; x.fillStyle = white;
  const rect = (x0, x1, m0, m1) => x.fillRect(X(x0), Y(m1), (x1 - x0) * pxw, (m1 - m0) * pxm);
  function end(flip, des) {
    x.save(); if (flip) { x.translate(W, H); x.rotate(Math.PI); }
    rect(-22.4, -21.5, 0, 3000); rect(21.5, 22.4, 0, 3000);             // side stripes
    for (const sd of [-1, 1]) for (let i = 0; i < 6; i++) { const a = 1.5 + i * 3.6; sd > 0 ? rect(a, a + 1.8, 6, 36) : rect(-a - 1.8, -a, 6, 36); } // 12 threshold stripes
    x.font = `700 ${Math.round(18 * pxm * 1.6)}px "Barlow Condensed", Arial Narrow, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.save(); x.translate(W / 2, Y(48)); x.scale(1.25, 1); x.fillText(des, 0, 0); x.restore(); // designator
    for (let m = 110; m < 1500; m += 50) rect(-0.45, 0.45, m, m + 30);  // centreline: 30 m stroke, 20 m gap
    for (const sd of [-1, 1]) { const a = 10; sd > 0 ? rect(a, a + 6, 400, 450) : rect(-a - 6, -a, 400, 450); } // aiming point
    const tdz = [[150, 3], [300, 3], [600, 2], [750, 2], [900, 1], [1050, 1]];
    for (const [m, n] of tdz) for (const sd of [-1, 1]) for (let b = 0; b < n; b++) { const a = 10 + b * 4.5; sd > 0 ? rect(a, a + 3, m, m + 22.5) : rect(-a - 3, -a, m, m + 22.5); }
    x.restore();
  }
  end(false, '36'); end(true, '18');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/* ---------- farmland texture (sRGB canvas) covering the terrain ---------- */
function farmTexture(renderer, SIZE) {
  const N = 2048, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
  const toPx = v => (v + SIZE / 2) / SIZE * N;
  x.fillStyle = '#4f6b2c'; x.fillRect(0, 0, N, N);
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const pal = ['#58742e', '#647f33', '#73843d', '#86874a', '#506c2b', '#6c6640', '#5b7835', '#7a8a45', '#62603a'];
  const cell = 0.3 / SIZE * N;
  for (let gy = -1; gy < N / cell + 1; gy++) for (let gx = -1; gx < N / cell + 1; gx++) {
    const w = cell * (0.8 + rnd() * 0.9), h = cell * (0.7 + rnd() * 0.8);
    const px = gx * cell + (rnd() - 0.5) * cell * 0.4, py = gy * cell + (rnd() - 0.5) * cell * 0.4;
    x.save(); x.translate(px, py); x.rotate((rnd() - 0.5) * 0.12);
    x.fillStyle = pal[Math.floor(rnd() * pal.length)]; x.fillRect(0, 0, w, h);
    x.globalAlpha = 0.18; x.strokeStyle = '#2f3d1c'; for (let k = 0; k < h; k += 3) { x.beginPath(); x.moveTo(0, k); x.lineTo(w, k); x.stroke(); }
    x.globalAlpha = 0.55; x.strokeStyle = '#2a3a18'; x.lineWidth = 1; x.strokeRect(0, 0, w, h); x.globalAlpha = 1; x.restore();
  }
  // woods
  for (let i = 0; i < 90; i++) { const cx = rnd() * N, cy = rnd() * N, r = 3 + rnd() * 8; x.fillStyle = '#2c4119'; for (let k = 0; k < 14; k++) { x.beginPath(); x.arc(cx + (rnd() - 0.5) * r * 2, cy + (rnd() - 0.5) * r * 2, r * (0.4 + rnd() * 0.5), 0, 7); x.fill(); } }
  // roads
  x.strokeStyle = '#8c8a84'; x.lineWidth = 3;
  [[0.08, 0], [0.62, 0.3], [-0.2, 0.55]].forEach(([a, b]) => { x.beginPath(); x.moveTo(0, N * (0.2 + b)); x.bezierCurveTo(N * 0.3, N * (0.25 + b + a), N * 0.7, N * (0.1 + b - a), N, N * (0.18 + b)); x.stroke(); });
  // airfield grass
  x.fillStyle = '#47652a'; x.fillRect(toPx(-0.34), toPx(-RW_L - 0.2), toPx(0.62) - toPx(-0.34), toPx(1.1) - toPx(-RW_L - 0.2));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

/* ---------- soft additive beam surface ---------- */
function beamMaterial(color, k) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uK: { value: k }, uT: { value: 0 } },
    vertexShader: 'attribute vec2 bu; varying vec2 vB; void main(){ vB = bu; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uK; uniform float uT; varying vec2 vB;
      void main(){
        float across = pow(sin(3.14159 * clamp(vB.y, 0.0, 1.0)), 0.7);
        float fade = (1.0 - smoothstep(0.55, 1.0, vB.x)) * smoothstep(0.0, 0.05, vB.x);
        float pulse = 0.8 + 0.2 * sin(vB.x * 60.0 - uT * 3.0);
        gl_FragColor = vec4(uColor * uK * across * fade * pulse, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
}
/** fan surface from apex to the edge a-b, as an nu x nv grid with beam coords (u along, v across) */
function fan(apex, a, b, nu = 12, nv = 10) {
  const pos = [], bu = [], idx = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const u = i / nu, v = j / nv; const e = a.clone().lerp(b, v); const p = apex.clone().lerp(e, u);
    pos.push(p.x, p.y, p.z); bu.push(u, v);
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const k = i * (nv + 1) + j; idx.push(k, k + nv + 1, k + 1, k + 1, k + nv + 1, k + nv + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('bu', new THREE.Float32BufferAttribute(bu, 2)); g.setIndex(idx);
  return g;
}
/** glowing points: positions [[x,y,z]], colour (HDR) */
function lightPoints(list, color, size) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(list.flat(), 3));
  const m = new THREE.PointsMaterial({ size, map: glowTexture(), color: new THREE.Color(...color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  return new THREE.Points(g, m);
}

function drawILS(cv, locDots, gsDots) {
  const { ctx, W, H } = hiDPI(cv);
  ctx.clearRect(0, 0, W, H); ctx.save();
  const r = bezel(ctx, W, H), sp = r * 0.3;
  // face
  ctx.strokeStyle = '#d6dde0'; ctx.fillStyle = '#d6dde0'; ctx.lineWidth = Math.max(1.2, r * 0.018);
  for (let i = -2; i <= 2; i++) { if (!i) continue; ctx.beginPath(); ctx.arc(i * sp, 0, r * 0.035, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, i * sp, r * 0.035, 0, 7); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.09, 0, 7); ctx.stroke();
  ctx.font = `600 ${Math.round(r * 0.1)}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#9fb0b8'; ctx.fillText('NAV 1 · ILS', 0, -r * 0.8);
  ctx.fillStyle = '#f2b43a'; ctx.fillText('LOC', 0, r * 0.82);
  ctx.save(); ctx.rotate(-Math.PI / 2); ctx.fillText('G/S', 0, r * 0.82); ctx.restore();
  // needles with shadow
  const lx = clamp(locDots, -2.5, 2.5) * sp, gy = clamp(gsDots, -2.5, 2.5) * sp;
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = r * 0.04; ctx.shadowOffsetY = r * 0.02;
  ctx.strokeStyle = '#f5f7f7'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2.5, r * 0.04);
  ctx.beginPath(); ctx.moveTo(lx, -r * 0.7); ctx.lineTo(lx, r * 0.7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r * 0.7, gy); ctx.lineTo(r * 0.7, gy); ctx.stroke();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#2a3136'; ctx.beginPath(); ctx.arc(0, 0, r * 0.05, 0, 7); ctx.fill();
  glassGlare(ctx, r);
  ctx.restore();
}

export default function (host) {
  const S = createStage(host, { cam: [-1.15, 1.3, 5.4], target: [0.1, 0.42, 1.5], minDist: 1, maxDist: 40, near: 0.003, far: 6000, shadows: true, bloom: { strength: 0.85, radius: 0.5, threshold: 2.2 } });
  const U = ui(host);
  const sky = addSky(S, { elevation: 4.5, azimuth: 250, turbidity: 9, rayleigh: 2.4, mie: 0.006, mieG: 0.85, sunColor: 0xffc59a, sunIntensity: 2.4, exposure: 0.62, envIntensity: 0.45, skyColor: 0xffd9b8, groundColor: 0x2a2620, hemi: 0.45, shadow: { extent: 6, size: 2048 } });
  sky.light.target.position.set(0, 0, -1);
  S.scene.fog = new THREE.Fog(0xc9a58c, 14, 34);

  /* terrain: rolling farmland, flattened round the airfield */
  const flat = (x, z) => { const dx = Math.max(0, Math.abs(x) - 1.4), dz = Math.max(0, z - DMAX - 1, -RW_L - 1.5 - z); const d = Math.hypot(dx, dz); return clamp(d / 4, 0, 1); };
  const terrain = makeTerrain({ size: 70, seg: 300,
    height: (x, z) => { const f = flat(x, z); return -0.004 + fbm(x * 0.4, z * 0.4, 3) * 0.015 + f * f * (fbm(x * 0.05, z * 0.05, 5) * 0.5 + Math.max(0, fbm(x * 0.012, z * 0.012, 3) + 0.1) * 2.2); },
    color: (y, s, x, z) => { const f = flat(x, z); const k = 0.95 + fbm(x * 0.3, z * 0.3, 2) * 0.25; return s > 0.3 ? [0.8, 0.75, 0.7] : [k, k, k]; } });
  terrain.material.map = farmTexture(S.renderer, 70); terrain.material.needsUpdate = true;
  S.scene.add(terrain);

  /* runway, taxiway, apron */
  const rwG = new THREE.PlaneGeometry(RW_W, RW_L); rwG.rotateX(-Math.PI / 2);
  const rw = new THREE.Mesh(rwG, new THREE.MeshStandardMaterial({ map: runwayTexture(S.renderer), roughness: 0.82, metalness: 0 }));
  rw.position.set(0, 0.002, -RW_L / 2); rw.receiveShadow = true; S.scene.add(rw);
  const tarmac = new THREE.MeshStandardMaterial({ color: 0x45474a, roughness: 0.9 });
  const twy = new THREE.Mesh(new THREE.PlaneGeometry(0.035, RW_L * 0.92).rotateX(-Math.PI / 2), tarmac); twy.position.set(0.17, 0.0015, -RW_L / 2); twy.receiveShadow = true; S.scene.add(twy);
  for (const z of [-0.25, -1.6, -RW_L + 0.25]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.03).rotateX(-Math.PI / 2), tarmac); c.position.set(0.11, 0.0016, z); S.scene.add(c); }
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.6).rotateX(-Math.PI / 2), tarmac); apron.position.set(0.32, 0.0015, -1.6); apron.receiveShadow = true; S.scene.add(apron);
  const bldM = new THREE.MeshStandardMaterial({ color: 0xc9c4ba, roughness: 0.7 });
  [[0.47, -1.45, 0.08, 0.04, 0.14], [0.47, -1.75, 0.07, 0.035, 0.1], [0.5, -1.2, 0.03, 0.1, 0.03]].forEach(([x, z, w, h, d]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bldM); b.position.set(x, h / 2, z); b.castShadow = b.receiveShadow = true; S.scene.add(b); });

  /* lights */
  const edge = [], thr = [], endL = [], als = [];
  for (let m = 0; m <= 3000; m += 60) { const z = -m / 926; edge.push([-RW_W / 2 - 0.003, 0.006, z], [RW_W / 2 + 0.003, 0.006, z]); }
  for (let i = 0; i < 14; i++) { const x = -RW_W / 2 + (i + 0.5) * RW_W / 14; thr.push([x, 0.006, 0.004]); endL.push([x, 0.006, -RW_L - 0.004]); }
  for (let m = 30; m <= 900; m += 30) { const z = m / 926; for (let k = -2; k <= 2; k++) als.push([k * 0.0045, 0.008, z]); if (m === 300) for (let k = -6; k <= 6; k++) if (Math.abs(k) > 2) als.push([k * 0.007, 0.008, z]); }
  S.scene.add(lightPoints(edge, [3.2, 2.7, 1.9], 0.03), lightPoints(thr, [0.4, 3.6, 1.0], 0.032), lightPoints(endL, [3.6, 0.3, 0.25], 0.03), lightPoints(als, [2.2, 2.0, 1.7], 0.024));
  const rabbit = glowSprite(0xffffff, 0.09, 7); S.scene.add(rabbit);
  // PAPI: housings + lights, left of runway at the touchdown zone
  const papiLights = PAPI_SET.map((_, i) => {
    const x = -RW_W / 2 - 0.04 - i * 0.024;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.01, 0.012), new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.5, metalness: 0.4 }));
    box.position.set(x, 0.006, TDZ); box.castShadow = true; S.scene.add(box);
    const s = glowSprite(0xffffff, 0.05, 6); s.position.set(x, 0.008, TDZ + 0.008); S.scene.add(s); return s;
  });
  // localiser array beyond the far end, glidepath mast beside the touchdown zone
  const antM = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.5, metalness: 0.3 }), redM = new THREE.MeshStandardMaterial({ color: 0xc8352d, roughness: 0.5 });
  const locBar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.003, 0.003), antM); locBar.position.set(0, 0.012, LOC); S.scene.add(locBar);
  for (let i = 0; i < 12; i++) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.02, 0.004), antM); a.position.set(-0.075 + i * 0.0136, 0.01, LOC); a.castShadow = true; S.scene.add(a); }
  const mast = new THREE.Group(); mast.position.set(RW_W / 2 + 0.05, 0, TDZ);
  for (let i = 0; i < 4; i++) { const seg = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.006), i % 2 ? antM : redM); seg.position.y = 0.006 + i * 0.012; seg.castShadow = true; mast.add(seg); }
  S.scene.add(mast);

  /* beams (side view only) */
  const beams = new THREE.Group(); S.scene.add(beams);
  const zE = TDZ + DMAX;
  const hwLoc = (zE - LOC) * Math.tan(2.5 * D2R);
  const locMat = beamMaterial(0x43c6e6, 0.16);
  beams.add(new THREE.Mesh(fan(V3(0, 0.012, LOC), V3(-hwLoc, 0.012, zE), V3(hwLoc, 0.012, zE), 16, 12), locMat));
  const yL = DMAX * Math.tan((GS - 0.7) * D2R) * EX, yH = DMAX * Math.tan((GS + 0.7) * D2R) * EX, hw = hwLoc;
  const A = V3(0, 0, TDZ), c1 = V3(-hw, yL, zE), c2 = V3(hw, yL, zE), c3 = V3(hw, yH, zE), c4 = V3(-hw, yH, zE);
  const gsMat = beamMaterial(0xe86bc0, 0.1);
  [[c1, c2], [c2, c3], [c3, c4], [c4, c1]].forEach(([a, b]) => beams.add(new THREE.Mesh(fan(A, a, b, 14, 10), gsMat)));
  const gpLine = S.fatLine([A, V3(0, DMAX * Math.tan(GS * D2R) * EX, zE)], { color: 0xff8fd0, width: 2.5, dashed: true, dashSize: 0.25, gapSize: 0.16 });
  const locLine = S.fatLine([V3(0, 0.014, LOC), V3(0, 0.014, zE)], { color: 0x7fdcf2, width: 1.6, dashed: true, dashSize: 0.2, gapSize: 0.2, opacity: 0.8 });
  beams.add(gpLine, locLine);
  const labs = [
    S.label('3° glidepath (heights ×4)', V3(0, 3.6 * Math.tan(GS * D2R) * EX + 0.12, TDZ + 3.6), 'pink'),
    S.label('Localiser', V3(0.35, 0.03, 3.2), 'cyan'),
    S.label('PAPI', V3(-0.32, 0.12, TDZ + 0.1), 'strong'),
    S.label('Runway 36', V3(0.32, 0.06, -RW_L * 0.75), 'muted')
  ];

  /* aircraft */
  const ac = makeAircraft({ scale: 0.55 }); ac.traverse(m => { m.castShadow = false; }); S.scene.add(ac);
  const drop = S.fatLine([V3(0, 0, 0), V3(0, 1, 0)], { color: 0xc9d6dc, width: 1.2, dashed: true, dashSize: 0.06, gapSize: 0.05, opacity: 0.7 });
  S.scene.add(drop);

  /* pilot's view overlay */
  const shield = document.createElement('div');
  shield.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:24%;pointer-events:none;z-index:1;background:linear-gradient(to top,#07090b 0%,#0b0f12 62%,rgba(11,15,18,0.85) 80%,rgba(11,15,18,0) 100%);border-top-left-radius:50% 30%;border-top-right-radius:50% 30%;';
  shield.hidden = true;
  const tag = document.createElement('span'); tag.className = 'hint'; tag.style.cssText = 'left:auto;right:10px;top:10px;bottom:auto;color:#e6eef1';
  tag.textContent = "Pilot's view: true heights, not exaggerated"; tag.hidden = true;
  S.wrap.append(shield, tag);

  const cv = host.querySelector('canvas.inst');
  const view = U.seg('view', 'View', [['side', 'Side view'], ['pilot', "Pilot's view"]], 'side');
  const sAng = U.slider('ang', 'Your angle above touchdown', 1.5, 5, 3, 0.05, v => v.toFixed(2) + '°');
  const sLat = U.slider('lat', 'Left / right of the centreline', -4, 4, 0, 0.1, v => (v < 0 ? 'left ' : v > 0 ? 'right ' : '') + Math.abs(v).toFixed(1) + '°');
  const sD = U.slider('dist', 'Distance to touchdown', 1.5, 11, 4, 0.1, v => (v * 0.5).toFixed(1) + ' nm');
  const fly = U.seg('fly', 'Fly the approach', [[0, 'Off'], [1, 'On']], 0);

  let pilot = false; const saved = { pos: V3(), tgt: V3() };
  view.on(v => {
    const on = v === 'pilot';
    if (on && !pilot) { saved.pos.copy(S.camera.position); saved.tgt.copy(S.controls.target); }
    pilot = on; S.controls.enabled = !on; beams.visible = ac.visible = drop.visible = !on;
    labs.forEach(l => { l.off = on; }); shield.hidden = tag.hidden = !on;
    S.camera.fov = on ? 30 : 45; papiLights.forEach(p => p.scale.setScalar(on ? 0.016 : 0.05)); rabbit.scale.setScalar(on ? 0.02 : 0.09); rabbit.material.color.setScalar(on ? 3 : 7); S.camera.updateProjectionMatrix();
    if (!on) { S.camera.position.copy(saved.pos); S.controls.target.copy(saved.tgt); }
    update();
  });

  const tmp = V3();
  function update() {
    const ang = sAng.v, lat = sLat.v, d = sD.v;
    const z = TDZ + d, yt = d * Math.tan(ang * D2R), x = (z - LOC) * Math.tan(lat * D2R);
    ac.position.set(x, yt * EX, z);
    ac.rotation.set(-1.5 * D2R, 0, 0);
    drop.userData.setPoints([V3(x, 0, z), V3(x, yt * EX - 0.05, z)]);
    if (pilot) {
      S.camera.position.set(x, yt + 0.0015, z);
      tmp.set(0, -Math.tan(3.6 * D2R), -1).normalize().multiplyScalar(5).add(S.camera.position);
      S.controls.target.copy(tmp); S.camera.lookAt(tmp);
    }
    let whites = 0;
    papiLights.forEach((s, i) => { const white = ang > PAPI_SET[i]; if (white) whites++; s.material.color.setRGB(...(white ? [6, 6, 5.6] : [7, 0.35, 0.25])); });
    const locDots = -lat / 1.25, gsDots = (ang - GS) / 0.35;
    drawILS(cv, locDots, gsDots);
    const hft = d * 0.5 * 6076 * Math.tan(ang * D2R);
    const vAdv = Math.abs(gsDots) < 0.25 ? 'on the glidepath' : gsDots > 0 ? 'high: glidepath needle is below centre, fly down' : 'low: glidepath needle is above centre, fly up';
    const lAdv = Math.abs(locDots) < 0.25 ? 'on the centreline' : locDots > 0 ? 'left of the centreline: localiser needle is right, fly right' : 'right of the centreline: localiser needle is left, fly left';
    U.readout(`<p class="ro-big ${whites === 0 || whites === 4 ? 'warn' : ''}">${PAPI_TXT[whites]}</p>
      <dl class="ro"><div><dt>Height above touchdown</dt><dd>${fmt(hft)} ft at ${(d * 0.5).toFixed(1)} nm</dd></div>
      <div><dt>Vertically</dt><dd>${vAdv}</dd></div><div><dt>Laterally</dt><dd>${lAdv}</dd></div></dl>
      <p class="note">A 3° glidepath is about 300 ft per nautical mile. ${pilot ? "The pilot's view uses true heights, so judge the picture by the PAPI." : 'In the side view, heights are drawn 4× taller so the slope is visible.'} The beams are drawn as a funnel; real beams are wider and have false glidepaths above the real one.</p>`);
  }
  [sAng, sLat, sD].forEach(s => s.on(update)); update();
  new ResizeObserver(() => update()).observe(cv);

  let t = 0;
  S.tick(dt => {
    t += dt;
    ac.userData.update(dt);
    locMat.uniforms.uT.value = gsMat.uniforms.uT.value = t;
    gpLine.material.dashOffset = -t * 0.5;
    // sequenced flashers: run towards the threshold twice a second
    const n = 21, k = Math.floor((t * 2 % 1) * (n + 4));
    if (k < n && !REDUCED) { rabbit.visible = true; rabbit.position.set(0, 0.012, (900 - k * 40) / 926); } else rabbit.visible = false;
    if (fly.v == 1) { let d = sD.v - dt * 0.9; if (d < 1.5) d = 11; sD.v = d; update(); }
  });
}

/* Sim world: terrain, airfield (runway 18/36, 1,200 m x 30 m), hangars, tower, trees. 1 unit = 1 m. */
import { THREE, fbm, clamp, glowTexture } from '../core.js';
import { applyCloudShadow } from '../clouds-vol.js';

export const RWY = { len: 1200, wid: 30, thr36: 600, thr18: -600 };   // runway along z, 36 = heading north (-z)
const INNER = 6000;

const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** terrain height (m) — flat airfield, rolling farmland, hills far away */
export function groundHeight(x, z) {
  const dx = Math.max(0, Math.abs(x - 60) - 380), dz = Math.max(0, Math.abs(z) - 950);
  const r = Math.hypot(dx, dz);
  const f = sstep(0, 900, r);
  const d = Math.hypot(x, z);
  let h = f * (fbm(x * 0.00055, z * 0.00055, 4) * 70 + 18 * Math.max(0, fbm(x * 0.0021, z * 0.0021, 3)));
  h += sstep(7000, 16000, d) * (380 + 900 * Math.max(0, fbm(x * 0.00018 + 3, z * 0.00018, 4) + 0.15));
  return h;
}

function seeded(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }

function farmTexture(renderer) {
  const N = 2048, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
  const toPx = v => (v + INNER / 2) / INNER * N;
  x.fillStyle = '#56712f'; x.fillRect(0, 0, N, N);
  const rnd = seeded(23);
  const pal = ['#5b772f', '#6a8236', '#78873f', '#8b8a4c', '#53702c', '#6f6a42', '#5f7c36', '#7e8d47', '#66643c', '#9a9156'];
  const cell = 260 / INNER * N;
  for (let gy = -1; gy < N / cell + 1; gy++) for (let gx = -1; gx < N / cell + 1; gx++) {
    const w = cell * (0.8 + rnd() * 0.9), h = cell * (0.7 + rnd() * 0.8);
    const px = gx * cell + (rnd() - 0.5) * cell * 0.4, py = gy * cell + (rnd() - 0.5) * cell * 0.4;
    x.save(); x.translate(px, py); x.rotate((rnd() - 0.5) * 0.15);
    x.fillStyle = pal[Math.floor(rnd() * pal.length)]; x.fillRect(0, 0, w, h);
    x.globalAlpha = 0.16; x.strokeStyle = '#2f3d1c'; const dir = rnd() > 0.5; for (let k = 0; k < (dir ? h : w); k += 2.5) { x.beginPath(); if (dir) { x.moveTo(0, k); x.lineTo(w, k); } else { x.moveTo(k, 0); x.lineTo(k, h); } x.stroke(); }
    x.globalAlpha = 0.6; x.strokeStyle = '#2c3a19'; x.lineWidth = 1.2; x.strokeRect(0, 0, w, h); x.globalAlpha = 1; x.restore();
  }
  for (let i = 0; i < 140; i++) { const cx = rnd() * N, cy = rnd() * N, r = 4 + rnd() * 12; x.fillStyle = '#2b4019'; for (let k = 0; k < 16; k++) { x.beginPath(); x.arc(cx + (rnd() - 0.5) * r * 2.2, cy + (rnd() - 0.5) * r * 2.2, r * (0.4 + rnd() * 0.5), 0, 7); x.fill(); } }
  x.strokeStyle = '#8f8d86'; x.lineWidth = 2.5;
  [[0.08, 0], [0.62, 0.3], [-0.2, 0.55], [0.3, 0.75]].forEach(([a, b]) => { x.beginPath(); x.moveTo(0, N * (0.2 + b)); x.bezierCurveTo(N * 0.3, N * (0.25 + b + a), N * 0.7, N * (0.1 + b - a), N, N * (0.18 + b)); x.stroke(); });
  // village
  for (let i = 0; i < 60; i++) { x.fillStyle = rnd() > 0.5 ? '#a0796a' : '#b9b2a6'; x.fillRect(toPx(-1700 + rnd() * 400), toPx(900 + rnd() * 350), 3, 3); }
  // airfield grass (mown)
  x.fillStyle = '#4f6e2c'; x.fillRect(toPx(-160), toPx(-760), toPx(330) - toPx(-160), toPx(760) - toPx(-760));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
function grassDetail(renderer) {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
  const img = x.createImageData(N, N); const rnd = seeded(5);
  for (let i = 0; i < N * N; i++) { const v = 118 + (rnd() - 0.5) * 40; img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(INNER / 6, INNER / 6); t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

/* runway texture: 30 m x 1,200 m, ICAO-style markings both ends */
function runwayTexture(renderer) {
  const W = 128, H = 4096, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = '#3d3f41'; x.fillRect(0, 0, W, H);
  const img = x.getImageData(0, 0, W, H), d = img.data, rnd = seeded(9);
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 16; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
  const pxm = H / RWY.len, pxw = W / RWY.wid;
  const Y = m => H - m * pxm, X = m => W / 2 + m * pxw;
  const rect = (x0, x1, m0, m1) => x.fillRect(X(x0), Y(m1), (x1 - x0) * pxw, (m1 - m0) * pxm);
  x.globalAlpha = 0.3; x.fillStyle = '#1d1e1f';
  for (const [a, b] of [[150, 450], [750, 1050]]) for (let k = 0; k < 50; k++) { const m = a + rnd() * (b - a); x.fillRect(X(-3 + rnd() * 6), Y(m + 40), 1.5 + rnd() * 2, 40 * pxm * rnd()); }
  x.globalAlpha = 1; x.fillStyle = '#e9ecec';
  function end(flip, des) {
    x.save(); if (flip) { x.translate(W, H); x.rotate(Math.PI); }
    rect(-14.6, -14.1, 0, RWY.len); rect(14.1, 14.6, 0, RWY.len);
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) { const a = 1.5 + i * 3.3; sd > 0 ? rect(a, a + 1.8, 6, 36) : rect(-a - 1.8, -a, 6, 36); }
    x.font = `700 ${Math.round(9 * pxm * 1.6)}px "Barlow Condensed", Arial Narrow, sans-serif`; x.textAlign = 'center';
    x.save(); x.translate(W / 2, Y(42)); x.scale(1.5, 1); x.fillText(des, 0, 0); x.restore();
    for (let m = 90; m < RWY.len / 2; m += 50) rect(-0.4, 0.4, m, m + 30);
    for (const sd of [-1, 1]) { const a = 6; sd > 0 ? rect(a, a + 4, 250, 295) : rect(-a - 4, -a, 250, 295); }
    for (const [m, n] of [[150, 2], [400, 1]]) for (const sd of [-1, 1]) for (let b = 0; b < n; b++) { const a = 6 + b * 3.5; sd > 0 ? rect(a, a + 2, m, m + 22) : rect(-a - 2, -a, m, m + 22); }
    x.restore();
  }
  end(false, '36'); end(true, '18');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function terrainMesh(size, seg, offsetFn) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const X = p.getX(i), Z = p.getZ(i); p.setY(i, groundHeight(X, Z) + (offsetFn ? offsetFn(X, Z) : 0)); }
  g.computeVertexNormals();
  return g;
}

export function buildWorld(S) {
  const scene = S.scene, R = S.renderer;
  const grp = new THREE.Group(); scene.add(grp);
  // inner terrain (textured)
  const inner = new THREE.Mesh(terrainMesh(INNER, 150), new THREE.MeshStandardMaterial({ map: farmTexture(R), roughness: 0.95, metalness: 0 }));
  inner.material.onBeforeCompile = sh => {
    sh.uniforms.uDetail = { value: grassDetail(R) };
    sh.fragmentShader = 'uniform sampler2D uDetail;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= 0.55 + 0.9 * texture2D(uDetail, vMapUv * 900.0).r;');
  };
  inner.receiveShadow = true; grp.add(inner); applyCloudShadow(inner.material);
  // outer terrain (vertex-coloured fields, far hills), sunk under the inner square
  const og = terrainMesh(60000, 140, (x, z) => { const m = Math.max(Math.abs(x), Math.abs(z)); return m < INNER / 2 - 200 ? -6 : 0; });
  // outer terrain: the farm texture tiled every 6 km, tinted per vertex with a large-scale variation (lighter/darker
  // patchwork, hills fading to rock) so the countryside under the clouds keeps its detail from altitude
  const col = new Float32Array(og.attributes.position.count * 3), op = og.attributes.position;
  for (let i = 0; i < op.count; i++) {
    const X = op.getX(i), Z = op.getZ(i), y = op.getY(i);
    const v = fbm(X * 0.00011, Z * 0.00011) * 0.9, w = fbm(X * 0.00043 + 7.1, Z * 0.00043 - 3.3) * 0.5;
    let c = [0.92 + v * 0.35 + w * 0.2, 0.95 + v * 0.3 + w * 0.15, 0.9 + v * 0.25];
    if (y > 450) { const t = clamp((y - 450) / 700, 0, 1); c = [c[0] + (1.35 - c[0]) * t, c[1] + (1.18 - c[1]) * t, c[2] + (1.45 - c[2]) * t]; }
    col.set(c, i * 3);
  }
  og.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const oTex = inner.material.map.clone(); oTex.wrapS = oTex.wrapT = THREE.RepeatWrapping; oTex.repeat.set(60000 / INNER, 60000 / INNER); oTex.needsUpdate = true;
  const outer = new THREE.Mesh(og, new THREE.MeshStandardMaterial({ map: oTex, vertexColors: true, roughness: 1 })); grp.add(outer); applyCloudShadow(outer.material);

  // runway
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(RWY.wid, RWY.len), new THREE.MeshStandardMaterial({ map: runwayTexture(R), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  rw.rotation.x = -Math.PI / 2; rw.position.y = 0.04; rw.receiveShadow = true; grp.add(rw);
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x4a4c4e, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }); applyCloudShadow(asphalt); applyCloudShadow(rw.material);
  const flatRect = (w, l, x, z, mat = asphalt, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat); m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, 0.03, z); m.receiveShadow = true; grp.add(m); return m; };
  flatRect(15, 160, 80, 520, asphalt, Math.PI / 2);      // taxiway to apron (south)
  flatRect(15, 160, 80, -40, asphalt, Math.PI / 2);      // mid taxiway
  flatRect(15, 600, 150, 240);                           // parallel taxiway
  flatRect(110, 260, 230, 140, new THREE.MeshStandardMaterial({ color: 0x6e6f6d, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); // apron
  // taxiway yellow centrelines
  const yel = new THREE.MeshBasicMaterial({ color: 0xd8b13a, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  flatRect(0.3, 160, 80, 520, yel, Math.PI / 2); flatRect(0.3, 600, 150, 240, yel); flatRect(0.3, 160, 80, -40, yel, Math.PI / 2);

  // runway edge, threshold and end lights (instanced)
  const lg = new THREE.SphereGeometry(0.22, 8, 6);
  const mk = (color, list) => { const m = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ color: new THREE.Color(...color) }), list.length); const o = new THREE.Object3D(); list.forEach((p, i) => { o.position.set(...p); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }); grp.add(m); return m; };
  const edge = []; for (let z = -RWY.len / 2 + 30; z <= RWY.len / 2 - 30; z += 60) for (const sx of [-1, 1]) edge.push([sx * (RWY.wid / 2 + 1.5), 0.35, z]);
  const thr = [], ends = []; for (let x = -15; x <= 15; x += 3) { thr.push([x, 0.35, RWY.thr36 + 1.5]); ends.push([x, 0.35, RWY.thr18 - 1.5]); }
  const lights = [mk([3, 2.9, 2.4], edge), mk([0.4, 3.2, 0.8], thr), mk([3.2, 0.3, 0.2], ends)];
  const baseCol = [[3, 2.9, 2.4], [0.4, 3.2, 0.8], [3.2, 0.3, 0.2]];
  const glows = [];
  const glowPts = (list, col, size) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(list.flat(), 3)); const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, map: glowTexture(), color: new THREE.Color(...col), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }); const p = new THREE.Points(g, m); p.frustumCulled = false; grp.add(p); glows.push({ p, col }); return p; };
  glowPts(edge, [3.4, 3.1, 2.4], 5); glowPts(thr, [0.5, 4, 1], 6); glowPts(ends, [4, 0.4, 0.3], 6);
  // approach lighting (runway 36): centreline barrettes every 30 m, crossbar at 300 m, sequenced flashers
  const als = [], flash = [];
  for (let d = 30; d <= 420; d += 30) { for (let k = -2; k <= 2; k++) als.push([k * 1.0, 0.6, RWY.thr36 + d]); flash.push([0, 0.9, RWY.thr36 + d]); }
  for (let x = -15; x <= 15; x += 2) if (Math.abs(x) > 3) als.push([x, 0.6, RWY.thr36 + 300]);
  const alsMesh = mk([3, 2.9, 2.4], als); const alsGlow = glowPts(als, [3.4, 3.1, 2.3], 5);
  const flG = new THREE.BufferGeometry(); flG.setAttribute('position', new THREE.Float32BufferAttribute(flash.flat(), 3)); flG.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(flash.length * 3), 3));
  const flashPts = new THREE.Points(flG, new THREE.PointsMaterial({ size: 14, sizeAttenuation: false, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); flashPts.frustumCulled = false; grp.add(flashPts); glows.push({ p: flashPts, col: null });
  for (const p of als) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0x8a8f92 })); st.position.set(p[0], 0.3, p[2]); grp.add(st); }
  // PAPI, left of runway 36, abeam the aiming point
  const PAPI_Z = RWY.thr36 - 300, papiSet = [3.5, 3 + 1 / 6, 3 - 1 / 6, 2.5];
  const papiPos = papiSet.map((_, i) => [-RWY.wid / 2 - 15 - i * 9, 0.9, PAPI_Z]);
  const housing = new THREE.MeshStandardMaterial({ color: 0x3a3f42, roughness: 0.7 });
  const papiLamp = papiPos.map(p => { const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.0), housing); box.position.set(p[0], 0.5, p[2]); box.castShadow = true; grp.add(box); const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); lamp.position.set(p[0], 0.55, p[2] + 0.51); grp.add(lamp); return lamp; });
  const papiGlow = new THREE.BufferGeometry(); papiGlow.setAttribute('position', new THREE.Float32BufferAttribute(papiPos.map(p => [p[0], 0.6, p[2] + 0.6]).flat(), 3)); papiGlow.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
  const papiPts = new THREE.Points(papiGlow, new THREE.PointsMaterial({ size: 10, sizeAttenuation: false, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); papiPts.frustumCulled = false; grp.add(papiPts); glows.push({ p: papiPts, col: null });

  // hangars, tower, windsock
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9cfd3, roughness: 0.45, metalness: 0.5 });
  const roofM = new THREE.MeshStandardMaterial({ color: 0x8e979c, roughness: 0.5, metalness: 0.6 });
  const doorM = new THREE.MeshStandardMaterial({ color: 0x5f6a72, roughness: 0.6, metalness: 0.3 });
  [[300, 60], [300, 120], [300, 180], [300, 245]].forEach(([x, z], i) => {
    const w = i === 3 ? 40 : 28, d = 24, h = 8;
    const box = new THREE.Mesh(new THREE.BoxGeometry(d, h, w), metal); box.position.set(x, h / 2, z); box.castShadow = box.receiveShadow = true; grp.add(box);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, w, 24, 1, false, 0, Math.PI), roofM); roof.rotation.set(Math.PI / 2, Math.PI / 2, 0); roof.scale.set(1, 1, 0.35); roof.position.set(x, h, z); roof.castShadow = true; grp.add(roof);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.85, h * 0.85), doorM); door.rotation.y = -Math.PI / 2; door.position.set(x - d / 2 - 0.05, h * 0.43, z); grp.add(door);
  });
  const tw = new THREE.Group(); tw.position.set(260, 0, -60);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(5, 14, 5), new THREE.MeshStandardMaterial({ color: 0xe4e2dc, roughness: 0.8 })); shaft.position.y = 7; shaft.castShadow = true; tw.add(shaft);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 3.6, 3.4, 8), new THREE.MeshPhysicalMaterial({ color: 0x223844, roughness: 0.1, metalness: 0.3, clearcoat: 1, emissive: 0xffd9a0, emissiveIntensity: 0 })); cab.position.y = 15.7; tw.add(cab);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xe4e2dc })); cap.position.y = 17.6; tw.add(cap);
  grp.add(tw);
  const sock = new THREE.Group(); sock.position.set(45, 0, 430);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd })); pole.position.y = 3; pole.castShadow = true; sock.add(pole);
  const sockPiv = new THREE.Group(); sockPiv.position.y = 5.85; sockPiv.rotation.order = 'YZX'; sock.add(sockPiv);
  const stripes = document.createElement('canvas'); stripes.width = 8; stripes.height = 64; { const x = stripes.getContext('2d'); for (let i = 0; i < 5; i++) { x.fillStyle = i % 2 ? '#f4f4f0' : '#f26b21'; x.fillRect(0, i * 64 / 5, 8, 64 / 5 + 1); } }
  const sTex = new THREE.CanvasTexture(stripes); sTex.colorSpace = THREE.SRGBColorSpace;
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.45, 3.2, 16, 5, true), new THREE.MeshStandardMaterial({ map: sTex, side: THREE.DoubleSide, roughness: 0.8 })); cone.rotation.z = -Math.PI / 2; cone.position.set(1.6, 0, 0); cone.castShadow = true; sockPiv.add(cone); grp.add(sock);
  const sockLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.2) })); sockLight.position.y = 6.1; sock.add(sockLight);
  // apron flood lights
  const floods = [];
  for (const z of [40, 240]) {
    const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 14, 8), new THREE.MeshStandardMaterial({ color: 0x9aa0a4, metalness: 0.6, roughness: 0.4 })); pole2.position.set(178, 7, z); grp.add(pole2);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.2, 0.2) })); head.position.set(178, 14, z); grp.add(head);
    const pl = new THREE.PointLight(0xffe2b0, 0, 170, 1.6); pl.position.set(182, 13, z); grp.add(pl); floods.push({ pl, head });
  }
  glowPts([[178, 14, 40], [178, 14, 240]], [3.5, 3, 2], 12);
  // countryside: lit windows and street lights (night only)
  const rnd2 = seeded(31), village = [];
  const clusters = [[-1550, 1050, 140], [1900, -1300, 90], [-2300, -2200, 110], [2600, 1800, 80], [600, 2600, 70], [-900, -2700, 60]];
  for (const [cx, cz, n] of clusters) for (let i = 0; i < n; i++) { const x = cx + (rnd2() - 0.5) * 420, z = cz + (rnd2() - 0.5) * 360; village.push([x, groundHeight(x, z) + 3 + rnd2() * 3, z]); }
  for (let i = 0; i < 180; i++) { const x = (rnd2() - 0.5) * 9000, z = (rnd2() - 0.5) * 9000; if (Math.abs(x - 60) < 500 && Math.abs(z) < 1100) continue; village.push([x, groundHeight(x, z) + 3, z]); }
  glowPts(village, [2.6, 1.8, 0.9], 3);
  // stars (follow the camera)
  const sg = new THREE.BufferGeometry(), sp = [], sc = [];
  for (let i = 0; i < 1600; i++) { const u = rnd2() * 2 - 1, a = rnd2() * Math.PI * 2, r = Math.sqrt(1 - u * u); const y = Math.abs(u) * 0.98 + 0.02; sp.push(r * Math.cos(a) * 14000, y * 14000, r * Math.sin(a) * 14000); const b = 0.25 + Math.pow(rnd2(), 3) * 1.4; sc.push(b, b, b * (0.9 + rnd2() * 0.2)); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false })); stars.frustumCulled = false; scene.add(stars);

  // trees (instanced): cone + trunk
  const rnd = seeded(77); const trees = [];
  while (trees.length < 900) {
    const cx = (rnd() - 0.5) * 5400, cz = (rnd() - 0.5) * 5400;
    if (Math.abs(cx - 60) < 420 && Math.abs(cz) < 1000) continue;
    const n = 4 + Math.floor(rnd() * 14);
    for (let k = 0; k < n && trees.length < 900; k++) { const x = cx + (rnd() - 0.5) * 70, z = cz + (rnd() - 0.5) * 70; trees.push([x, groundHeight(x, z), z, 9 + rnd() * 9]); }
  }
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x2f4a1e, roughness: 0.95, flatShading: true }), trees.length); applyCloudShadow(crown.material);
  const o = new THREE.Object3D();
  trees.forEach(([x, y, z, h], i) => { o.position.set(x, y + h * 0.6, z); o.scale.set(h * 0.32, h * 0.5, h * 0.32); o.rotation.y = rnd() * 6; o.updateMatrix(); crown.setMatrixAt(i, o.matrix); });
  grp.add(crown);
  const papiOut = [0, 0, 0, 0];
  let tt = 0, night = 0;
  return {
    group: grp, lights, sock: cone, sockPiv, stars, glows, towerPos: new THREE.Vector3(258, 18.5, -57), papiZ: PAPI_Z, papiX: papiPos[1][0],
    /** night 0 (day) .. 1 (dark): light intensities */
    setNight(n, lowVis) {
      night = n; const k = 1 + n * 4;
      lights.forEach((m, i) => m.material.color.setRGB(...baseCol[i].map(v => v * k)));
      alsMesh.material.color.setRGB(3 * k, 2.9 * k, 2.4 * k);
      const on = n > 0.3 || lowVis;
      glows.forEach(g => { if (g.col) g.p.material.opacity = on ? Math.min(1, n * 1.1 + (lowVis ? 0.4 : 0)) : 0; });
      alsGlow.visible = flashPts.visible = on;
      floods.forEach(f => { f.pl.intensity = n > 0.5 ? 26000 * n : 0; f.head.material.color.setRGB(...(n > 0.5 ? [8, 7, 5] : [0.2, 0.2, 0.2])); });
      cab.material.emissiveIntensity = n > 0.5 ? 0.6 : 0;
      stars.material.opacity = clamp((n - 0.6) / 0.4, 0, 1);
      sockLight.visible = n > 0.3;
    },
    /** per frame: sequenced flashers, PAPI colours seen from eye, windsock */
    update(dt, eye, windDir, windKt) {
      tt += dt;
      const fc = flG.attributes.color, nf = fc.count, ph = (tt * 2) % 1, idx = Math.floor((1 - ph) * nf);
      for (let i = 0; i < nf; i++) { const v = i === idx ? 9 : 0; fc.setXYZ(i, v, v, v); } fc.needsUpdate = true;
      const pc = papiGlow.attributes.color;
      papiLamp.forEach((l, i) => {
        const p = papiPos[i], d = Math.hypot(eye.x - p[0], eye.z - p[2]); const ang = Math.atan2(eye.y - p[1], d) * 180 / Math.PI;
        const white = ang > papiSet[i]; papiOut[i] = white ? 1 : 0;
        const k = 3 + night * 9; l.material.color.setRGB(...(white ? [k, k, k * 0.92] : [k, k * 0.05, k * 0.04]));
        pc.setXYZ(i, ...(white ? [k, k, k] : [k, k * 0.06, k * 0.05]));
      });
      pc.needsUpdate = true; papiPts.material.opacity = Math.min(1, 0.35 + night);
      const to = windDir + 180, spd = Math.max(0, windKt);
      sockPiv.rotation.y = (90 - to) * Math.PI / 180 + Math.sin(tt * 3.1) * 0.04 * Math.min(1, spd / 5);
      sockPiv.rotation.z = -(1 - Math.min(1, spd / 15)) * 1.25 + Math.sin(tt * 5.3) * 0.03 * Math.min(1, spd / 8);
      return papiOut;
    }
  };
}

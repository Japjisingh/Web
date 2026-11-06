/* Great circle vs rhumb line on a NASA-textured globe. */
import { createStage, makeAircraft, glowSprite, ui, THREE, D2R, R2D, norm360, norm180, clamp, pad3, fmt, V3, REDUCED } from './core.js';

const EARTH_VS = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const EARTH_FS = /* glsl */`
uniform sampler2D dayMap; uniform sampler2D nightMap; uniform sampler2D bumpMap; uniform sampler2D waterMap;
uniform vec3 sunDir; uniform float hasTex; uniform float bumpScale;
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
vec3 perturb(vec3 p, vec3 n, float dhx, float dhy) {
  vec3 sx = dFdx(p), sy = dFdy(p);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * n - grad);
}
void main() {
  vec3 n = normalize(vN);
  vec3 V = normalize(cameraPosition - vP);
  vec3 dayCol = mix(vec3(0.03, 0.10, 0.22), texture2D(dayMap, vUv).rgb, hasTex);
  vec3 nightCol = texture2D(nightMap, vUv).rgb * hasTex;
  float water = mix(1.0, texture2D(waterMap, vUv).r, hasTex);
  float h = texture2D(bumpMap, vUv).r * hasTex;
  vec3 nb = perturb(vP, n, dFdx(h) * bumpScale, dFdy(h) * bumpScale);
  nb = normalize(mix(nb, n, water));
  float ndl = dot(nb, sunDir);
  float ndlG = dot(n, sunDir);
  float day = smoothstep(-0.12, 0.22, ndlG);
  vec3 col = dayCol * (max(ndl, 0.0) * 1.55 + 0.035);
  // twilight warmth along the terminator
  float tw = smoothstep(0.25, 0.0, abs(ndlG + 0.02));
  col *= mix(vec3(1.0), vec3(1.25, 0.82, 0.62), tw * 0.6);
  // ocean glint
  vec3 H = normalize(sunDir + V);
  float spec = pow(max(dot(n, H), 0.0), 140.0) * water * step(0.0, ndlG);
  col += vec3(1.0, 0.92, 0.8) * spec * 0.75;
  col += vec3(0.25, 0.4, 0.55) * pow(max(dot(n, H), 0.0), 8.0) * water * 0.08 * day;
  // city lights on the night side
  float city = smoothstep(0.08, 0.55, nightCol.r - nightCol.b * 0.35);
  vec3 lights = vec3(1.0, 0.68, 0.36) * city * 3.2;
  col += (lights + nightCol * vec3(0.10, 0.13, 0.2)) * (1.0 - day);
  // atmospheric haze at the limb
  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  col += vec3(0.28, 0.52, 1.0) * fres * (0.08 + 0.9 * smoothstep(-0.3, 0.6, ndlG)) * 0.9;
  gl_FragColor = vec4(col, 1.0);
}`;
const ATMO_VS = /* glsl */`
varying vec3 vN; varying vec3 vP;
void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }`;
const ATMO_FS = /* glsl */`
uniform vec3 sunDir; varying vec3 vN; varying vec3 vP;
void main() {
  vec3 n = normalize(vN); vec3 V = normalize(cameraPosition - vP);
  float d = -dot(n, V);              // back faces: 0 at shell limb, rising towards the Earth's limb
  float i = pow(smoothstep(0.0, 0.42, d), 2.2) * (1.0 - smoothstep(0.42, 0.7, d));
  float lit = 0.18 + 0.82 * smoothstep(-0.35, 0.5, dot(n, sunDir));
  gl_FragColor = vec4(vec3(0.32, 0.58, 1.0) * i * lit * 1.9, 1.0);
}`;

export default function (host) {
  const S = createStage(host, { bg: 0x02060b, env: 'room', cam: [0, 2.4, 6.4], minDist: 3, maxDist: 14, maxPolar: Math.PI - 0.05, bloom: { strength: 0.75, radius: 0.55, threshold: 1.05 }, exposure: 1.15 });
  S.scene.environmentIntensity = 0.5;
  const U = ui(host);
  const R = 2, NM = 3440.065;
  const sunDir = V3(-0.92, 0.26, 0.06).normalize();
  const key = new THREE.DirectionalLight(0xfff1e0, 2.2); key.position.copy(sunDir).multiplyScalar(20); S.scene.add(key);
  S.scene.add(new THREE.AmbientLight(0x6080a0, 0.25));

  // starfield
  {
    const N = 2600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 120 + Math.random() * 60, s = Math.sqrt(1 - u * u);
      pos.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3);
      const b = 0.35 + Math.pow(Math.random(), 3) * 1.6, t = Math.random();
      col.set([b * (0.85 + 0.15 * t), b * 0.9, b * (1.05 - 0.15 * t)], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    S.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.55, vertexColors: true, sizeAttenuation: true, depthWrite: false })));
  }

  const world = new THREE.Group(); S.scene.add(world);
  const uni = { dayMap: { value: null }, nightMap: { value: null }, bumpMap: { value: null }, waterMap: { value: null }, sunDir: { value: sunDir }, hasTex: { value: 0 }, bumpScale: { value: 0.012 } };
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blank.needsUpdate = true;
  ['dayMap', 'nightMap', 'bumpMap', 'waterMap'].forEach(k => { uni[k].value = blank; });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), new THREE.ShaderMaterial({ uniforms: uni, vertexShader: EARTH_VS, fragmentShader: EARTH_FS }));
  world.add(earth);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.075, 96, 64), new THREE.ShaderMaterial({ uniforms: { sunDir: { value: sunDir } }, vertexShader: ATMO_VS, fragmentShader: ATMO_FS, side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  S.scene.add(atmo);

  // textures (NASA Blue Marble, Black Marble, topography, water mask)
  const loader = new THREE.TextureLoader(), maxAniso = S.renderer.capabilities.getMaxAnisotropy();
  const files = { dayMap: ['assets/earth-day.jpg', true], nightMap: ['assets/earth-night.jpg', true], bumpMap: ['assets/earth-bump.jpg', false], waterMap: ['assets/earth-water.jpg', false] };
  let loaded = 0;
  Object.entries(files).forEach(([k, [url, srgb]]) => loader.load(url, t => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, maxAniso); uni[k].value = t;
    if (++loaded === 4) uni.hasTex.value = 1;
  }, undefined, () => { /* keep the plain globe if a texture fails */ }));

  const ll = (lat, lon, r = R) => { const a = lat * D2R, b = lon * D2R; return V3(r * Math.cos(a) * Math.cos(b), r * Math.sin(a), -r * Math.cos(a) * Math.sin(b)); };
  // faint graticule
  {
    const pts = [];
    for (let lat = -75; lat <= 75; lat += 15) for (let lon = -180; lon < 180; lon += 3) pts.push(ll(lat, lon, R * 1.002), ll(lat, lon + 3, R * 1.002));
    for (let lon = -180; lon < 180; lon += 15) for (let lat = -90; lat < 90; lat += 3) pts.push(ll(lat, lon, R * 1.002), ll(lat + 3, lon, R * 1.002));
    world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.09, depthWrite: false })));
    const eq = []; for (let lon = -180; lon <= 180; lon += 2) eq.push(ll(0, lon, R * 1.003));
    world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(eq), new THREE.LineBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.28, depthWrite: false })));
  }
  S.label('Equator', ll(0, 20, R * 1.05), 'muted', world, R);
  S.label('N pole', ll(90, 0, R * 1.08), 'muted', world, R);

  const AP = { DEL: ['Delhi', 28.556, 77.100], SFO: ['San Francisco', 37.619, -122.375], LHR: ['London', 51.470, -0.454], JFK: ['New York', 40.640, -73.779], BOM: ['Mumbai', 19.089, 72.868], SYD: ['Sydney', -33.946, 151.177] };
  const routes = { 'DEL-SFO': ['DEL', 'SFO'], 'LHR-JFK': ['LHR', 'JFK'], 'BOM-SYD': ['BOM', 'SYD'] };
  const GC_COL = new THREE.Color(1.0, 0.42, 0.78), RH_COL = new THREE.Color(1.0, 0.72, 0.25);

  // aircraft + glow
  const mkPlane = col => { const p = makeAircraft({ scale: 0.13, accent: col }); const gl = glowSprite(col, 0.22, 1.6); world.add(p); world.add(gl); return { p, gl }; };
  const pG = mkPlane(0xff6cc4), pR = mkPlane(0xffb83d);
  const routeGroup = new THREE.Group(); world.add(routeGroup);
  let gcPts = [], rhPts = [], dGC = 1, dRH = 1, labs = [], prog = 0, cities = [];
  let gcBase, rhBase, gcTrail, rhTrail;
  let rotTarget = 0, camAnim = 0, first = true; const camFrom = V3(), camTo = V3();
  const along = (pts, t) => { const f = clamp(t, 0, 1) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)); return pts[i].clone().lerp(pts[i + 1], f - i); };
  const lift = (v, t) => v.multiplyScalar(1 + 0.012 + 0.035 * Math.sin(Math.PI * t));

  function line(pts, color, width, opacity) {
    const L = S.fatLine(pts, { color: 0xffffff, width, opacity }); L.material.color.copy(color); return L;
  }
  function setRoute(key) {
    const [a, b] = routes[key].map(k => AP[k]);
    const p1 = a[1] * D2R, l1 = a[2] * D2R, p2 = b[1] * D2R, l2 = b[2] * D2R;
    const va = ll(a[1], a[2], 1), vb = ll(b[1], b[2], 1);
    const om = Math.acos(clamp(va.dot(vb), -1, 1)), so = Math.sin(om);
    dGC = om * NM; gcPts = [];
    for (let i = 0; i <= 200; i++) { const t = i / 200; gcPts.push(lift(va.clone().multiplyScalar(Math.sin((1 - t) * om) / so).add(vb.clone().multiplyScalar(Math.sin(t * om) / so)).multiplyScalar(R), t)); }
    let dl = l2 - l1; if (dl > Math.PI) dl -= 2 * Math.PI; if (dl < -Math.PI) dl += 2 * Math.PI;
    const psi = p => Math.log(Math.tan(Math.PI / 4 + p / 2));
    const dpsi = psi(p2) - psi(p1), dp = p2 - p1;
    const q = Math.abs(dpsi) > 1e-12 ? dp / dpsi : Math.cos(p1);
    dRH = Math.sqrt(dp * dp + q * q * dl * dl) * NM; rhPts = [];
    for (let i = 0; i <= 200; i++) { const t = i / 200; const lat = 2 * Math.atan(Math.exp(psi(p1) + dpsi * t)) - Math.PI / 2; rhPts.push(lift(ll(lat * R2D, (l1 + dl * t) * R2D, R), t)); }

    while (routeGroup.children.length) { const c = routeGroup.children[0]; routeGroup.remove(c); c.geometry && c.geometry.dispose(); }
    gcBase = line(gcPts, GC_COL, 1.6, 0.45); rhBase = line(rhPts, RH_COL, 1.6, 0.45);
    gcTrail = line(gcPts.slice(0, 2), GC_COL.clone().multiplyScalar(2.2), 3.4); rhTrail = line(rhPts.slice(0, 2), RH_COL.clone().multiplyScalar(2.2), 3.4);
    routeGroup.add(gcBase, rhBase, gcTrail, rhTrail);
    labs.forEach(l => S.unlabel(l)); labs = []; cities = [];
    for (const c of [a, b]) {
      const pos = ll(c[1], c[2], R * 1.004);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) })); dot.position.copy(pos); routeGroup.add(dot);
      const g = glowSprite(0x9fe3ff, 0.18, 1.8); g.position.copy(pos); routeGroup.add(g); cities.push(g);
      labs.push(S.label(c[0], ll(c[1], c[2], R * 1.12), 'strong', world, R));
    }
    const gcCourse = norm360(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) * R2D);
    const rhCourse = norm360(Math.atan2(dl, dpsi) * R2D);
    const mid = gcPts[100].clone().normalize();
    const midLat = Math.asin(mid.y) * R2D, midLon = Math.atan2(-mid.z, mid.x) * R2D;
    rotTarget = (-90 - midLon) * D2R;
    const el = clamp(midLat, -45, 60) * D2R, dist = S.camera.position.length();
    camFrom.copy(S.camera.position); camTo.set(0, dist * Math.sin(el), dist * Math.cos(el)); camAnim = REDUCED ? 1 : 0.0001;
    if (REDUCED || first) { camAnim = 1; world.rotation.y = rotTarget; S.camera.position.copy(camTo); }
    first = false;
    prog = 0;
    const save = dRH - dGC;
    U.readout(`<dl class="ro">
      <div><dt><i class="sw sw-gc"></i>Great circle</dt><dd>${fmt(dGC)} nm · starts on ${pad3(gcCourse)}°T</dd></div>
      <div><dt><i class="sw sw-rh"></i>Rhumb line</dt><dd>${fmt(dRH)} nm · holds ${pad3(rhCourse)}°T</dd></div>
      <div><dt>Great circle is shorter by</dt><dd>${fmt(save)} nm (${(save / dRH * 100).toFixed(1)}%)</dd></div></dl>
      <p class="note">The pink aircraft follows the great circle, so its true course keeps changing. The amber one holds a single course and crosses every meridian at the same angle. Both fly at the same speed, so watch which one arrives first.</p>
      <p class="note">Imagery: NASA Blue Marble by day and city lights (Black Marble) on the night side. The sun position is illustrative, and the route arcs are lifted slightly off the surface so you can see them.</p>`);
  }
  const route = U.seg('route', 'Route', [['DEL-SFO', 'Delhi → San Francisco'], ['LHR-JFK', 'London → New York'], ['BOM-SYD', 'Mumbai → Sydney']], 'DEL-SFO');
  route.on(setRoute); setRoute('DEL-SFO');
  world.rotation.y = rotTarget;

  const m4 = new THREE.Matrix4(), up = V3(), fw = V3(), rt = V3(), bk = V3();
  function place(o, pts, t) {
    const p = along(pts, t), q = along(pts, Math.min(1, t + 0.004)), pr = along(pts, Math.max(0, t - 0.004));
    fw.subVectors(q, pr); if (fw.lengthSq() < 1e-10) fw.set(0, 0, -1); fw.normalize();
    up.copy(p).normalize(); rt.crossVectors(fw, up).normalize(); up.crossVectors(rt, fw).normalize(); bk.copy(fw).negate();
    m4.makeBasis(rt, up, bk); o.p.quaternion.setFromRotationMatrix(m4);
    o.p.position.copy(p).addScaledVector(up, 0.015); o.gl.position.copy(o.p.position);
  }
  function trail(L, pts, t) {
    const n = Math.max(2, Math.round(clamp(t, 0, 1) * (pts.length - 1)) + 1);
    const sub = pts.slice(0, n); sub[sub.length - 1] = along(pts, t); if (sub.length < 2) sub.unshift(pts[0]);
    L.userData.setPoints(sub);
  }
  let tAcc = 0, pulse = 0;
  S.tick(dt => {
    const dr = norm180((rotTarget - world.rotation.y) * R2D) * D2R;
    world.rotation.y += dr * Math.min(1, dt * 3);
    if (camAnim > 0 && camAnim < 1) { camAnim = Math.min(1, camAnim + dt * 1.2); const e = 1 - Math.pow(1 - camAnim, 3); S.camera.position.lerpVectors(camFrom, camTo, e); }
    prog += dt * 1100;
    if (prog > dRH + 1600) prog = 0;
    const tg = prog / dGC, tr = prog / dRH;
    place(pG, gcPts, Math.min(1, tg)); place(pR, rhPts, Math.min(1, tr));
    pG.p.userData.update(dt); pR.p.userData.update(dt);
    tAcc += dt; if (tAcc > 0.05) { tAcc = 0; trail(gcTrail, gcPts, tg); trail(rhTrail, rhPts, tr); }
    pulse += dt; cities.forEach((c, i) => { const s = 0.16 + 0.07 * (0.5 + 0.5 * Math.sin(pulse * 3 + i * 1.7)); c.scale.setScalar(s); });
  });
}

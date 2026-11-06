/* Sim cloud layer: METAR coverage -> weather map (coverage, cloud type, precipitation, top height) -> shared volumetric
   renderer (src/clouds-vol.js). Same public API as before (set / setLight / drift / density / inside / shade / noDepth / state).
   A CPU copy of the density (identical maths) drives IMC, cloud shade on the aircraft and the tests. */
import { THREE } from '../core.js';
import { createVolumetricClouds, makeCPUDensity, fbm2, worley2, defaultQuality } from '../clouds-vol.js';

const MAP = 128, MAP_SIZE = 40000, TOP_MIN = 250, TOP_MAX = 4500;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* precomputed tileable noise fields for the weather map (built once) */
let FIELDS = null;
function fields() {
  if (FIELDS) return FIELDS;
  const n1 = new Float32Array(MAP * MAP), cell = new Float32Array(MAP * MAP), n3 = new Float32Array(MAP * MAP), cell2 = new Float32Array(MAP * MAP);
  for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
    const u = (x + 0.5) / MAP, v = (y + 0.5) / MAP, i = y * MAP + x;
    n1[i] = fbm2(u, v, 5, 4, 101) * 0.95 + 0.5;
    cell[i] = worley2(u, v, 14, 201);
    cell2[i] = worley2(u, v, 7, 211);
    n3[i] = fbm2(u, v, 3, 3, 301) * 0.95 + 0.5;
  }
  FIELDS = { n1, cell, cell2, n3 };
  return FIELDS;
}

/* coverage class from the numeric cover the sim passes (FEW .2, SCT .4, BKN .68, OVC .97) */
function kind(cover) { return cover <= 0 ? 'SKC' : cover < 0.3 ? 'FEW' : cover < 0.55 ? 'SCT' : cover < 0.9 ? 'BKN' : 'OVC'; }

function buildWeather(k, ovcThick) {
  const F = fields(), data = new Uint8Array(MAP * MAP * 4); let maxTop = 0, anyRain = 0;
  const topN = m => clamp((m - TOP_MIN) / (TOP_MAX - TOP_MIN), 0, 1);
  for (let i = 0; i < MAP * MAP; i++) {
    const n = F.n1[i], c = F.cell[i], c2 = F.cell2[i], m = F.n3[i];
    let cov = 0, type = 0.5, pr = 0, top = 1000;
    if (k === 'FEW') { cov = 0.68 * sstep(0.76, 0.96, c * 0.72 + n * 0.42); type = 0.5; top = 650 + 650 * c; }
    else if (k === 'SCT') {
      cov = 0.74 * sstep(0.58, 0.86, c * 0.68 + n * 0.45 + c2 * 0.08);
      const tcu = sstep(0.58, 0.76, m) * sstep(0.45, 0.72, c2);
      type = 0.52 + 0.33 * tcu; top = 900 + 900 * c + 2300 * tcu; cov = Math.min(0.84, cov + 0.12 * tcu * (cov > 0.05 ? 1 : 0)); pr = tcu > 0.6 ? 0.45 * tcu * cov : 0;
    } else if (k === 'BKN') {
      cov = 0.84 * sstep(0.4, 0.75, c * 0.45 + n * 0.62 + c2 * 0.1); type = 0.38 + 0.12 * c2; top = 700 + 700 * c2 + 300 * n;
      pr = sstep(0.7, 0.85, m) * 0.25 * cov;
    } else if (k === 'OVC') {
      cov = 0.86 + 0.14 * sstep(0.2, 0.8, n); type = 0.12 + 0.12 * c; top = ovcThick * (0.85 + 0.3 * n);
      pr = sstep(0.65, 0.8, m) * 0.3;
    }
    data[i * 4] = Math.round(clamp(cov, 0, 1) * 255);
    data[i * 4 + 1] = Math.round(clamp(type, 0, 1) * 255);
    data[i * 4 + 2] = Math.round(clamp(pr, 0, 1) * 255);
    data[i * 4 + 3] = Math.round(topN(top) * 255);
    if (cov > 0.02) maxTop = Math.max(maxTop, top);
    if (pr > 0.02) anyRain = 1;
  }
  return { data, maxTop: Math.max(maxTop, 300), anyRain };
}

export function createClouds(S, o = {}) {
  const host = o.host || null;
  const vc = createVolumetricClouds(S, { unit: 1, host, quality: (host && host.__quality) || defaultQuality(), shadows: true, maxDist: 42000, nearSkip: 4 });
  const U = vc.uniforms;
  const tex = new THREE.DataTexture(new Uint8Array(MAP * MAP * 4), MAP, MAP, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
  U.uWeather.value = tex; U.uMapSize.value = MAP_SIZE; U.uTopMin.value = TOP_MIN; U.uTopMax.value = TOP_MAX;
  let wdata = tex.image.data;
  const state = { cover: 0, base: 1000, top: 1900, kind: 'SKC', drift: new THREE.Vector2(), get quality() { return vc.quality; } };

  /** CPU weather sample, bilinear + repeat, exactly like the GPU texture */
  function weatherAt(x, z) {
    const u = (x - U.uMapOff.value.x) / MAP_SIZE + 0.5, v = (z - U.uMapOff.value.y) / MAP_SIZE + 0.5;
    const fx = u * MAP - 0.5, fy = v * MAP - 0.5, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const out = [0, 0, 0, 0];
    for (let c = 0; c < 4; c++) {
      const g = (a, b) => wdata[((((b % MAP) + MAP) % MAP) * MAP + (((a % MAP) + MAP) % MAP)) * 4 + c] / 255;
      out[c] = (g(ix, iy) * (1 - tx) + g(ix + 1, iy) * tx) * (1 - ty) + (g(ix, iy + 1) * (1 - tx) + g(ix + 1, iy + 1) * tx) * ty;
    }
    out[3] = TOP_MIN + (TOP_MAX - TOP_MIN) * out[3];
    return out;
  }
  const cpu = makeCPUDensity(U, weatherAt);

  let lastKey = '';
  function set(cover, base, top) {
    state.cover = cover; state.base = base; state.top = top;
    const k = kind(cover); state.kind = k;
    vc.setEnabled(cover > 0);
    U.uBaseM.value = base;
    const key = k + '|' + Math.round(top - base);
    if (key !== lastKey && k !== 'SKC') {
      lastKey = key;
      const w = buildWeather(k, Math.max(300, top - base));
      tex.image.data.set(w.data); tex.needsUpdate = true; wdata = tex.image.data;
      U.uMaxTopM.value = w.maxTop + 50; U.uRain.value = w.anyRain ? 1 : 0;
      // denser, darker-based layers for BKN/OVC
      U.uDark.value = k === 'OVC' ? 0.8 : k === 'BKN' ? 0.45 : k === 'SCT' ? 0.15 : 0.05;
      U.uDensity.value = k === 'OVC' ? 0.9 : 1.25;
      U.uCoverMul.value = 1;
    }
    U.uSlabBot.value = U.uRain.value > 0 ? 0 : base;
    U.uSlabTop.value = base + U.uMaxTopM.value;
    memo.t = -1;
  }
  function setLight(sun, sunCol, amb, fogCol, fogDist) {
    U.uSun.value.copy(sun).normalize();
    U.uSunCol.value.copy(sunCol);
    const night = sunCol.r + sunCol.g + sunCol.b < 0.4;
    U.uAmbTop.value.copy(amb).multiplyScalar(night ? 1.4 : 0.95).add(new THREE.Color(0.02, 0.03, 0.05).multiplyScalar(night ? 0.2 : 1));
    U.uAmbBot.value.copy(amb).multiplyScalar(0.3).lerp(fogCol, 0.08);
    U.uFogCol.value.copy(fogCol).multiplyScalar(1 - 0.35 * U.uDark.value); U.uFogDist.value = Math.max(2000, fogDist);
    U.uSunGain.value = night ? 2.4 : 2.7;
    // overcast: light through a thick layer is weaker and the base reads as a darker grey ceiling
    const ovk = state.kind === 'OVC' ? 0.26 : state.kind === 'BKN' ? 0.7 : 1;
    U.uSunGain.value *= ovk; U.uAmbBot.value.multiplyScalar(state.kind === 'OVC' ? 0.7 : 1);
  }
  // wind: coverage and noise move with the air; slow vertical boil
  function drift(dx, dz) {
    state.drift.x += dx; state.drift.y += dz;
    U.uMapOff.value.x += dx; U.uMapOff.value.y += dz;
    const bs = U.uBaseScale.value; U.uNoiseOff.value.x -= dx * bs; U.uNoiseOff.value.z -= dz * bs; U.uNoiseOff.value.y -= 0.0000035 * (Math.abs(dx) + Math.abs(dz) + 0.2);
    const l = Math.hypot(dx, dz); if (l > 1e-6) U.uShearDir.value.set(dx / l, dz / l);
  }
  const density = (x, y, z) => (state.cover ? cpu(x, y, z, false) : 0);
  // cheap memo so the per-frame CPU queries stay well under a millisecond
  const memo = { t: -1, p: new THREE.Vector3(), inside: 0, shade: 1, sp: new THREE.Vector3() };
  function inside(p) {
    const now = performance.now();
    if (memo.t > 0 && now - memo.t < 120 && memo.p.distanceToSquared(p) < 64) return memo.inside;
    let a = 0; for (const [dx, dy, dz] of [[0, 0, 0], [25, 0, 0], [-25, 0, 0], [0, 15, 0], [0, 0, 25]]) a += density(p.x + dx, p.y + dy, p.z + dz);
    memo.t = now; memo.p.copy(p); memo.inside = a / 5; return memo.inside;
  }
  let shadeT = -1;
  function shade(p, sun) {
    if (!state.cover) return 1;
    const now = performance.now(); if (shadeT > 0 && now - shadeT < 250 && memo.sp.distanceToSquared(p) < 400) return memo.shade;
    let od = 0; const s = U.uSun.value;
    for (let i = 1; i <= 12; i++) { const t = i * i * 22; od += cpu(p.x + s.x * t, p.y + s.y * t, p.z + s.z * t, true) * (i * i * 22 - (i - 1) * (i - 1) * 22); }
    shadeT = now; memo.sp.copy(p); memo.shade = Math.exp(-od * U.uSigma.value * 0.5); return memo.shade;
  }
  return {
    pass: vc.pass, state, uniforms: U, vc,
    set, setLight, drift, density, inside, shade,
    noDepth: obj => vc.noDepth(obj),
    setQuality: q => vc.setQuality(q),
    set debugFull(v) { vc.debugFull = v; }
  };
}

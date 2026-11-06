/* Volumetric cloud renderer (WebGL 2, three r186), shared by the flight sim and the thunderstorm scene.

   Technique (after Schneider/Hillaire "Nubis"-style real-time cloudscapes):
   - Noise: tileable Perlin-Worley base 3D texture (64/96/128³, RGBA8: R = Perlin-Worley, GBA = Worley fBm octaves),
     Worley detail 3D texture (32³), 2D curl-noise texture. Generated on the GPU, a few slices per frame.
   - Shape: weather function (coverage, cloud type stratus→cumulus→cumulonimbus, precipitation, top height) +
     per-type height gradient + optional anvil layer, base noise remapped by coverage, eroded by curl-distorted detail noise.
   - Light: Beer-Lambert with energy-conserving integration, Beer-powder, dual-lobe Henyey-Greenstein,
     4-octave multiple-scattering approximation, 6-sample cone light march, height-graded sky ambient, aerial perspective.
   - Speed: rendered at reduced resolution; each frame only 1 of every 2×2 cloud pixels is ray-marched (interleaved
     gradient noise jitter), the rest are reprojected from the previous frame (world-space, previous view-projection,
     neighbourhood clamped) and the result is joint-bilaterally upsampled against full-resolution scene depth.
   - A CPU copy of the same density function drives in-cloud visibility, sun shading and tests.
   Units: the density/lighting maths work in metres; `unit` = metres per world unit (sim 1, storm scene 1000). */
import { THREE } from './core.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const remap = (x, a, b, c, d) => c + (x - a) / (b - a) * (d - c);
const mixf = (a, b, t) => a + (b - a) * t;
const LOW_POWER = (navigator.hardwareConcurrency || 8) <= 4 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

export const QUALITY = {
  low: { scale: 0.33, noise: 64, steps: 48, light: 4, shadow: 128, slices: 8 },
  medium: { scale: 0.5, noise: 96, steps: 72, light: 5, shadow: 192, slices: 12 },
  high: { scale: 0.5, noise: 128, steps: 104, light: 6, shadow: 256, slices: 16 },
  ultra: { scale: 0.75, noise: 128, steps: 140, light: 6, shadow: 384, slices: 32 }
};
export const defaultQuality = () => (LOW_POWER ? 'medium' : 'high');

/* ------------------------------------------------------------------ */
/* Noise: identical functions in GLSL (texture generation) and JS (CPU) */
/* ------------------------------------------------------------------ */
const NOISE_GLSL = /* glsl */`
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 h3(vec3 c, float seed) { uint s = uint(seed); uvec3 u = uvec3(ivec3(c)) + uvec3(s * 73u, s * 151u, s * 211u); return vec3(pcg3d(u)) * (1.0 / 4294967295.0); }
float worleyT(vec3 p, float per, float seed) {
  vec3 id = floor(p), f = p - id; float md = 1.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 o = vec3(float(x), float(y), float(z)); vec3 c = mod(id + o, per); vec3 d = o + h3(c, seed) - f; md = min(md, dot(d, d));
  }
  return 1.0 - sqrt(md);
}
float gradT(vec3 c, vec3 d, float per, float seed) { vec3 g = h3(mod(c, per), seed) * 2.0 - 1.0; return dot(g, d); }
float perlinT(vec3 p, float per, float seed) {
  vec3 i = floor(p), f = p - i; vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = gradT(i, f, per, seed), n100 = gradT(i + vec3(1, 0, 0), f - vec3(1, 0, 0), per, seed);
  float n010 = gradT(i + vec3(0, 1, 0), f - vec3(0, 1, 0), per, seed), n110 = gradT(i + vec3(1, 1, 0), f - vec3(1, 1, 0), per, seed);
  float n001 = gradT(i + vec3(0, 0, 1), f - vec3(0, 0, 1), per, seed), n101 = gradT(i + vec3(1, 0, 1), f - vec3(1, 0, 1), per, seed);
  float n011 = gradT(i + vec3(0, 1, 1), f - vec3(0, 1, 1), per, seed), n111 = gradT(i + vec3(1, 1, 1), f - vec3(1, 1, 1), per, seed);
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float perlinFbm(vec3 p, float freq, int oct, float seed) {
  float g = exp2(-0.85), amp = 1.0, n = 0.0, f = freq;
  for (int i = 0; i < 7; i++) { if (i >= oct) break; n += amp * perlinT(p * f, f, seed + float(i)); f *= 2.0; amp *= g; }
  return n;
}
float worleyFbm(vec3 p, float freq, float seed) {
  return worleyT(p * freq, freq, seed) * 0.625 + worleyT(p * freq * 2.0, freq * 2.0, seed + 1.0) * 0.25 + worleyT(p * freq * 4.0, freq * 4.0, seed + 2.0) * 0.125;
}
vec4 baseNoise(vec3 p) {
  float pf = mix(1.0, perlinFbm(p, 4.0, 7, 0.0), 0.5); pf = abs(pf * 2.0 - 1.0);
  float g = worleyFbm(p, 4.0, 10.0), b = worleyFbm(p, 8.0, 20.0), a = worleyFbm(p, 16.0, 30.0);
  return vec4(g + pf * (1.0 - g), g, b, a);
}
vec4 detailNoise(vec3 p) { return vec4(worleyFbm(p, 4.0, 40.0), worleyFbm(p, 8.0, 50.0), worleyFbm(p, 16.0, 60.0), 1.0); }
`;

const U32 = 1 / 4294967295;
function h3(cx, cy, cz, seed, out) {
  let x = (cx + seed * 73) >>> 0, y = (cy + seed * 151) >>> 0, z = (cz + seed * 211) >>> 0;
  x = (Math.imul(x, 1664525) + 1013904223) >>> 0; y = (Math.imul(y, 1664525) + 1013904223) >>> 0; z = (Math.imul(z, 1664525) + 1013904223) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0; y = (y + Math.imul(z, x)) >>> 0; z = (z + Math.imul(x, y)) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0; y = (y ^ (y >>> 16)) >>> 0; z = (z ^ (z >>> 16)) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0; y = (y + Math.imul(z, x)) >>> 0; z = (z + Math.imul(x, y)) >>> 0;
  out[0] = x * U32; out[1] = y * U32; out[2] = z * U32; return out;
}
const _h = [0, 0, 0];
const wrapI = (c, p) => ((c % p) + p) % p;
function worleyT(px, py, pz, per, seed) {
  const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz), fx = px - ix, fy = py - iy, fz = pz - iz; let md = 1;
  for (let z = -1; z <= 1; z++) for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
    h3(wrapI(ix + x, per), wrapI(iy + y, per), wrapI(iz + z, per), seed, _h);
    const dx = x + _h[0] - fx, dy = y + _h[1] - fy, dz = z + _h[2] - fz, d = dx * dx + dy * dy + dz * dz; if (d < md) md = d;
  }
  return 1 - Math.sqrt(md);
}
function gradT(cx, cy, cz, dx, dy, dz, per, seed) { h3(wrapI(cx, per), wrapI(cy, per), wrapI(cz, per), seed, _h); return (_h[0] * 2 - 1) * dx + (_h[1] * 2 - 1) * dy + (_h[2] * 2 - 1) * dz; }
function perlinT(px, py, pz, per, seed) {
  const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz), fx = px - ix, fy = py - iy, fz = pz - iz;
  const q = t => t * t * t * (t * (t * 6 - 15) + 10), ux = q(fx), uy = q(fy), uz = q(fz);
  const n000 = gradT(ix, iy, iz, fx, fy, fz, per, seed), n100 = gradT(ix + 1, iy, iz, fx - 1, fy, fz, per, seed);
  const n010 = gradT(ix, iy + 1, iz, fx, fy - 1, fz, per, seed), n110 = gradT(ix + 1, iy + 1, iz, fx - 1, fy - 1, fz, per, seed);
  const n001 = gradT(ix, iy, iz + 1, fx, fy, fz - 1, per, seed), n101 = gradT(ix + 1, iy, iz + 1, fx - 1, fy, fz - 1, per, seed);
  const n011 = gradT(ix, iy + 1, iz + 1, fx, fy - 1, fz - 1, per, seed), n111 = gradT(ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1, per, seed);
  return mixf(mixf(mixf(n000, n100, ux), mixf(n010, n110, ux), uy), mixf(mixf(n001, n101, ux), mixf(n011, n111, ux), uy), uz);
}
function perlinFbm(x, y, z, freq, oct, seed) { const g = Math.pow(2, -0.85); let amp = 1, n = 0, f = freq; for (let i = 0; i < oct; i++) { n += amp * perlinT(x * f, y * f, z * f, f, seed + i); f *= 2; amp *= g; } return n; }
function worleyFbm(x, y, z, freq, seed) { return worleyT(x * freq, y * freq, z * freq, freq, seed) * 0.625 + worleyT(x * freq * 2, y * freq * 2, z * freq * 2, freq * 2, seed + 1) * 0.25 + worleyT(x * freq * 4, y * freq * 4, z * freq * 4, freq * 4, seed + 2) * 0.125; }
const fr = v => v - Math.floor(v);
/** CPU base noise at tile coords (wrapped), returns {r,g,b,a} values like the 3D texture */
export function baseNoiseCPU(x, y, z) {
  x = fr(x); y = fr(y); z = fr(z);
  let pf = mixf(1, perlinFbm(x, y, z, 4, 7, 0), 0.5); pf = Math.abs(pf * 2 - 1);
  const g = worleyFbm(x, y, z, 4, 10), b = worleyFbm(x, y, z, 8, 20), a = worleyFbm(x, y, z, 16, 30);
  return [g + pf * (1 - g), g, b, a];
}
export function detailNoiseCPU(x, y, z) { x = fr(x); y = fr(y); z = fr(z); return [worleyFbm(x, y, z, 4, 40), worleyFbm(x, y, z, 8, 50), worleyFbm(x, y, z, 16, 60)]; }
/** 2D tileable fBm (for weather maps), period 1 */
export function fbm2(u, v, freq, oct, seed) { let n = 0, amp = 1, f = freq, s = 0; for (let i = 0; i < oct; i++) { n += amp * perlinT(fr(u) * f, fr(v) * f, 0.5, f, seed + i); s += amp; f *= 2; amp *= 0.5; } return n / s; }
export function worley2(u, v, freq, seed) { return worleyT(fr(u) * freq, fr(v) * freq, 0.5, freq, seed); }

/* ------------------------------------------------------------------ */
/* GPU noise generation (time-sliced)                                  */
/* ------------------------------------------------------------------ */
const VERT = /* glsl */`precision highp float; in vec3 position; in vec2 uv; out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const GEN_FRAG = /* glsl */`precision highp float; precision highp int;
in vec2 vUv; uniform float uLayer, uN; uniform int uKind; layout(location = 0) out vec4 outC;
${NOISE_GLSL}
void main() {
  vec3 p = vec3(floor(gl_FragCoord.xy), uLayer) + 0.5; p /= uN;
  if (uKind == 0) outC = baseNoise(p);
  else if (uKind == 1) outC = detailNoise(p);
  else {
    vec2 q = (floor(gl_FragCoord.xy) + 0.5) / uN; float e = 1.0 / uN;
    float n0 = perlinFbm(vec3(q, 0.5), 6.0, 3, 70.0);
    float nx = perlinFbm(vec3(q + vec2(e, 0.0), 0.5), 6.0, 3, 70.0), ny = perlinFbm(vec3(q + vec2(0.0, e), 0.5), 6.0, 3, 70.0);
    vec2 c = vec2(ny - n0, -(nx - n0)) / e / 30.0;
    outC = vec4(clamp(c * 0.5 + 0.5, 0.0, 1.0), 0.0, 1.0);
  }
}`;

function noiseTarget3D(N) {
  const rt = new THREE.WebGL3DRenderTarget(N, N, N, { depthBuffer: false });
  const t = rt.texture; t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping; t.generateMipmaps = false;
  return rt;
}
/** shared noise set per renderer + size, generated over several frames */
const noiseCaches = new WeakMap();
function getNoise(renderer, N, slicesPerFrame) {
  if (!noiseCaches.has(renderer)) noiseCaches.set(renderer, new Map());
  const noiseCache = noiseCaches.get(renderer), key = N; if (noiseCache.has(key)) return noiseCache.get(key);
  const mat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: GEN_FRAG, uniforms: { uLayer: { value: 0 }, uN: { value: N }, uKind: { value: 0 } }, depthTest: false, depthWrite: false });
  const quad = new FullScreenQuad(mat);
  const base = noiseTarget3D(N), detail = noiseTarget3D(32);
  const curl = new THREE.WebGLRenderTarget(128, 128, { depthBuffer: false, type: THREE.UnsignedByteType });
  curl.texture.wrapS = curl.texture.wrapT = THREE.RepeatWrapping; curl.texture.minFilter = curl.texture.magFilter = THREE.LinearFilter;
  const jobs = [];
  for (let z = 0; z < 32; z++) jobs.push([detail, 1, z, 32]);
  jobs.push([curl, 2, 0, 128]);
  for (let z = 0; z < N; z++) jobs.push([base, 0, z, N]);
  const st = { base: base.texture, detail: detail.texture, curl: curl.texture, ready: false, t0: 0, ms: 0, N,
    step(r) {
      if (st.ready) return true;
      if (!st.t0) st.t0 = performance.now();
      const prevRT = r.getRenderTarget(), ac = r.autoClear; r.autoClear = false;
      for (let k = 0; k < slicesPerFrame && jobs.length; k++) {
        const [rt, kind, z, n] = jobs.shift();
        mat.uniforms.uKind.value = kind; mat.uniforms.uLayer.value = z; mat.uniforms.uN.value = n;
        r.setRenderTarget(rt, z); quad.render(r);
      }
      r.setRenderTarget(prevRT); r.autoClear = ac;
      if (!jobs.length) { st.ready = true; st.ms = performance.now() - st.t0; quad.dispose(); mat.dispose(); }
      return st.ready;
    } };
  noiseCache.set(key, st);
  return st;
}

/* ------------------------------------------------------------------ */
/* Shared GLSL: density + lighting                                     */
/* ------------------------------------------------------------------ */
const DENSITY_GLSL = /* glsl */`
uniform sampler3D uBaseTex, uDetTex; uniform sampler2D uCurl;
uniform float uBaseScale, uDetScale, uCurlScale, uCurlAmt, uDensity, uCoverMul, uErode, uShear;
uniform vec2 uShearDir; uniform vec3 uNoiseOff;
float remap(float x, float a, float b, float c, float d) { return c + (x - a) / (b - a) * (d - c); }
float heightGrad(float hf, float type) {
  float s1 = smoothstep(0.0, 0.45, type), s2 = smoothstep(0.6, 0.95, type);
  float strat = smoothstep(0.0, 0.1, hf) * (1.0 - smoothstep(0.55, 1.0, hf));
  float cumu = smoothstep(0.0, 0.08, hf) * (1.0 - smoothstep(0.3, 1.0, hf));
  float cb = smoothstep(0.0, 0.05, hf) * (1.0 - smoothstep(0.82, 1.0, hf));
  return mix(mix(strat, cumu, s1), cb, s2);
}
// returns density (metres space); hf = height fraction in the column
float cloudDensity(vec3 pm, bool cheap, out float hf) {
  float hm = pm.y - uBaseM; hf = 0.0;
  if (hm < 0.0 || hm > uMaxTopM) return 0.0;
  vec2 xz = pm.xz - uShearDir * hm * uShear;
  vec4 wx = weatherAt(xz);
  float top = max(wx.a, 1.0), h = hm / top;
  float cov = clamp(wx.r * uCoverMul, 0.0, 1.0);
  float grad = (h > 0.0 && h < 1.0) ? heightGrad(h, wx.g) : 0.0;
  vec3 an = anvilAt(xz); float ag = 0.0;
  if (an.x > 0.001) { float ah = (hm - an.y) / max(an.z - an.y, 1.0); ag = an.x * smoothstep(0.0, 0.3, ah) * (1.0 - smoothstep(0.62, 1.0, ah)); }
  if (cov * grad < 0.002 && ag < 0.002) return 0.0;
  hf = clamp(max(h, ag > 0.002 ? 0.9 : 0.0), 0.0, 1.0);
  vec4 n = texture(uBaseTex, pm * uBaseScale + uNoiseOff);
  float low = n.g * 0.625 + n.b * 0.25 + n.a * 0.125;
  float base = remap(n.r, low - 1.0, 1.0, 0.0, 1.0);
  float c = max(cov > 0.001 ? remap(base * grad, 1.0 - cov, 1.0, 0.0, 1.0) * cov : 0.0, ag > 0.001 ? remap(base, 1.0 - ag, 1.0, 0.0, 1.0) * ag : 0.0);
  if (c <= 0.0) return 0.0;
  if (!cheap) {
    vec2 cu = texture(uCurl, pm.xz * uCurlScale).rg * 2.0 - 1.0;
    vec3 dp = pm * uDetScale + uNoiseOff * 3.0 + vec3(cu.x, 0.0, cu.y) * uCurlAmt * (1.0 - hf);
    vec3 d = texture(uDetTex, dp).rgb; float df = d.r * 0.625 + d.g * 0.25 + d.b * 0.125;
    float dmod = mix(df, 1.0 - df, clamp(hf * 4.0, 0.0, 1.0));
    c = remap(c, dmod * (0.42 + uErode * 0.5), 1.0, 0.0, 1.0);
  }
  return max(c, 0.0) * uDensity;
}`;

const MARCH_FRAG = /* glsl */`precision highp float; precision highp int; precision highp sampler3D;
in vec2 vUv;
layout(location = 0) out vec4 outC;
layout(location = 1) out vec4 outD;
uniform sampler2D tDepth;
uniform mat4 uInvProj, uCamWorld; uniform vec3 uCamPos; uniform float uNear, uFar, uUnit;
uniform vec2 uCloudRes, uMarchRes; uniform ivec2 uOffset; uniform int uFull, uSteps, uLight; uniform float uFrame;
uniform vec3 uSun, uSunCol, uAmbTop, uAmbBot, uFogCol, uFlashCol, uFlashPos; uniform float uFogDist, uSigma, uMinStep, uMaxStep, uStepGrow, uMaxDist, uDark, uFlash, uRain, uSunGain, uAmbGain;
uniform float uSlabBot, uSlabTop, uNearSkip;
uniform float uBaseM, uMaxTopM;
WEATHER_GLSL
${'DENSITY'}
uvec3 pcg3d(uvec3 v) { v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; v ^= v >> 16u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; return v; }
float hgN(float mu, float g) { float g2 = g * g; return (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5); }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float perspZ(float d) { return (uNear * uFar) / ((uFar - uNear) * d - uFar); }
float rainDensity(vec3 pm) {
  if (uRain <= 0.0 || pm.y >= uBaseM) return 0.0;
  vec4 wx = weatherAt(pm.xz); if (wx.b < 0.01) return 0.0;
  float n = texture(uBaseTex, vec3(pm.x * 0.00045, pm.y * 0.00006, pm.z * 0.00045) + uNoiseOff).g;
  float fade = smoothstep(0.0, 0.35, pm.y / uBaseM) * (1.0 - smoothstep(0.85, 1.0, pm.y / uBaseM) * 0.5);
  return wx.b * uRain * 0.0011 * smoothstep(0.35, 0.75, n) * (0.4 + 0.6 * fade);
}
void main() {
  ivec2 mp = ivec2(gl_FragCoord.xy);
  ivec2 cp = uFull == 1 ? mp : mp * 2 + uOffset;
  vec2 uv = (vec2(cp) + 0.5) / uCloudRes;
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0); vec3 rv = normalize(v.xyz / v.w);
  vec3 rd = normalize((uCamWorld * vec4(rv, 0.0)).xyz), ro = uCamPos;
  float dz = texture(tDepth, uv).x;
  float sceneT = uMaxDist;
  if (dz < 0.99999) sceneT = min(uMaxDist, perspZ(dz) / rv.z);
  // slab intersection (world units)
  float t0 = 0.0, t1 = sceneT;
  float yb = uSlabBot / uUnit, yt = uSlabTop / uUnit;
  if (abs(rd.y) < 1e-5) { if (ro.y < yb || ro.y > yt) { outC = vec4(0.0); outD = vec4(sceneT, sceneT, 0.0, 0.0); return; } }
  else {
    float ta = (yb - ro.y) / rd.y, tb = (yt - ro.y) / rd.y;
    t0 = max(0.0, min(ta, tb)); t1 = min(t1, max(ta, tb));
  }
  t0 = max(t0, uNearSkip);
  if (t0 >= t1) { outC = vec4(0.0); outD = vec4(sceneT, sceneT, 0.0, 0.0); return; }
  float mu = dot(rd, uSun);
  uvec3 hj = pcg3d(uvec3(uvec2(cp), uint(uFrame)));
  float jit = fract(float(hj.x) * (1.0 / 4294967295.0) * 0.6 + ign(vec2(cp) + uFrame * 5.588238) * 0.4);
  vec3 col = vec3(0.0); float T = 1.0, front = sceneT;
  float t = t0, steps = 0.0;
  float stepW = max(uMinStep, t0 * uUnit * uStepGrow) / uUnit;
  t += stepW * jit;
  float cone[6] = float[6](35.0, 80.0, 160.0, 320.0, 650.0, 1400.0);
  int n = 0; float skipped = 0.0;
  for (int i = 0; i < 640; i++) {
    if (n >= uSteps || t >= t1 || T < 0.01) break;
    float dtw = clamp(t * uUnit * uStepGrow, uMinStep, uMaxStep) / uUnit;
    vec3 p = ro + rd * t, pm = p * uUnit;
    float hf; float d = cloudDensity(pm, true, hf);
    float rd0 = rainDensity(pm);
    if (d > 0.0 && skipped > 0.0) { t -= skipped * 0.7; skipped = 0.0; continue; }   // re-enter the cloud edge with fine steps
    if (d > 0.0) d = cloudDensity(pm, false, hf);
    else if (rd0 <= 0.0) { skipped = max(dtw * 2.5, 110.0 / uUnit); t += skipped; continue; }
    skipped = 0.0; n++;
    float sig = (d + rd0) * uSigma, dtm = dtw * uUnit;
    if (sig > 1e-6) {
      if (front >= sceneT && T < 0.97) front = t;
      // light march (cone)
      float od = 0.0; float hh;
      for (int k = 0; k < 6; k++) {
        if (k >= uLight) break;
        float dist = cone[k];
        vec3 jo = vec3(fract(jit * 7.1 + float(k) * 0.37) - 0.5, fract(jit * 3.3 + float(k) * 0.71) - 0.5, fract(jit * 5.7 + float(k) * 0.13) - 0.5) * dist * 0.25;
        vec3 lp = pm + uSun * dist + jo;
        float ld = cloudDensity(lp, k >= 3, hh);
        od += ld * (k == 0 ? dist : dist - cone[k - 1]);
      }
      float dOpt = od * uSigma * 0.6;
      // multiple scattering octaves (Wrenninge): extinction a^i, energy b^i, anisotropy c^i
      float ms = 0.0, a = 1.0, b = 1.0, c = 1.0;
      for (int o = 0; o < 4; o++) {
        float ph = 0.72 * hgN(mu, 0.62 * c) + 0.28 * hgN(mu, -0.22 * c);
        ms += b * exp(-dOpt * a) * ph; a *= 0.5; b *= 0.6; c *= 0.6;
      }
      float powder = 1.0 - exp(-d * uSigma * 140.0);
      ms *= mix(1.0, powder, clamp(0.55 - 0.45 * mu, 0.0, 1.0));
      vec3 amb = mix(uAmbBot * (1.0 - uDark * 0.75), uAmbTop, smoothstep(0.0, 0.85, hf)) * (0.6 + 0.4 * exp(-od * uSigma * 0.15));
      vec3 S = uSunCol * ms * uSunGain + amb * uAmbGain;
      if (rd0 > 0.0 && d <= 0.0) S = uAmbBot * uAmbGain * 0.7;
      if (uFlash > 0.0) S += uFlashCol * uFlash * exp(-distance(pm, uFlashPos * uUnit) / 1400.0) * 6.0;
      float fogK = 1.0 - exp(-t * uUnit / uFogDist);
      S = mix(S, uFogCol, fogK);
      float Tr = exp(-sig * dtm);
      col += T * S * (1.0 - Tr); T *= Tr;
    }
    t += dtw;
  }
  float a = 1.0 - T;
  outC = vec4(col, a);
  outD = vec4(a > 0.003 ? front : sceneT, sceneT, 0.0, 0.0);
}`;

const RESOLVE_FRAG = /* glsl */`precision highp float; precision highp int;
in vec2 vUv; layout(location = 0) out vec4 outC; layout(location = 1) out vec4 outD;
uniform sampler2D tNewC, tNewD, tHistC, tHistD; uniform ivec2 uOffset, uNewSize; uniform int uFull, uHist;
uniform vec2 uCloudRes; uniform mat4 uInvProj, uCamWorld, uPrevVP; uniform vec3 uCamPos;
void main() {
  ivec2 pc = ivec2(gl_FragCoord.xy);
  if (uFull == 1) { outC = texelFetch(tNewC, pc, 0); outD = texelFetch(tNewD, pc, 0); return; }
  ivec2 q = min(pc / 2, uNewSize - 1); ivec2 o = pc - (pc / 2) * 2;
  vec4 nC = texelFetch(tNewC, q, 0); vec4 nD = texelFetch(tNewD, q, 0);
  // neighbourhood of fresh samples (3x3) for clamping
  vec4 mn = vec4(1e9), mx = vec4(-1e9), avg = vec4(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec4 s = texelFetch(tNewC, clamp(q + ivec2(x, y), ivec2(0), uNewSize - 1), 0); mn = min(mn, s); mx = max(mx, s); avg += s; }
  avg /= 9.0;
  vec2 uv = (vec2(pc) + 0.5) / uCloudRes;
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0); vec3 rv = normalize(v.xyz / v.w);
  vec3 rd = normalize((uCamWorld * vec4(rv, 0.0)).xyz);
  float dist = nC.a > 0.02 ? nD.x : nD.y;
  vec4 cp = uPrevVP * vec4(uCamPos + rd * dist, 1.0);
  vec2 puv = cp.xy / cp.w * 0.5 + 0.5;
  bool valid = uHist == 1 && cp.w > 0.0 && all(greaterThanEqual(puv, vec2(0.0))) && all(lessThanEqual(puv, vec2(1.0)));
  vec4 hC = texture(tHistC, puv), hD = texture(tHistD, puv);
  if (any(isnan(hC)) || any(isnan(hD))) valid = false;
  if (any(isnan(nC))) nC = vec4(0.0);
  if (valid) { float r = abs(hD.y - nD.y) / max(nD.y, 1e-3); if (r > 0.25) valid = false; }
  vec4 pad = vec4(0.04) + (mx - mn) * 0.1;
  hC = clamp(hC, mn - pad, mx + pad);
  if (o == uOffset) {
    outC = valid ? mix(hC, nC, 0.55) : nC; outD = nD;
  } else {
    outC = valid ? hC : avg; outD = valid ? vec4(hD.x, nD.y, 0.0, 0.0) : nD;
  }
}`;

const COMP_FRAG = /* glsl */`precision highp float; precision highp int;
in vec2 vUv; layout(location = 0) out vec4 outC;
uniform sampler2D tDiffuse, tDepth, tCloudC, tCloudD; uniform vec2 uCloudRes; uniform mat4 uInvProj; uniform float uNear, uFar, uMaxDist, uFade; uniform int uOn;
float perspZ(float d) { return (uNear * uFar) / ((uFar - uNear) * d - uFar); }
void main() {
  vec4 s = texture(tDiffuse, vUv);
  if (uOn == 0) { outC = s; return; }
  float dz = texture(tDepth, vUv).x;
  vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec3 rv = normalize(v.xyz / v.w);
  float sd = dz < 0.99999 ? min(uMaxDist, perspZ(dz) / rv.z) : uMaxDist;
  vec2 cp = vUv * uCloudRes - 0.5; ivec2 b = ivec2(floor(cp)); vec2 f = cp - floor(cp);
  vec4 acc = vec4(0.0); float sw = 0.0, best = 0.0; ivec2 mx = ivec2(uCloudRes) - 1;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    ivec2 tp = clamp(b + ivec2(i, j), ivec2(0), mx);
    vec4 c = texelFetch(tCloudC, tp, 0), d = texelFetch(tCloudD, tp, 0);
    float wb = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y);
    float wd = exp(-abs(log(sd + 1.0) - log(d.y + 1.0)) * 6.0); best = max(best, wd);
    float w = wb * wd + 1e-5 * wb;
    if (c.a > 0.01 && sd < d.x * 0.97) c = vec4(0.0);
    acc += c * w; sw += w;
  }
  // thin foreground edges (struts, frames): no tap shares this pixel's depth, so look a little wider for one that does
  if (best < 0.25) {
    vec4 acc2 = vec4(0.0); float sw2 = 0.0;
    for (int j = -1; j <= 2; j++) for (int i = -1; i <= 2; i++) {
      ivec2 tp = clamp(b + ivec2(i, j), ivec2(0), mx);
      vec4 c = texelFetch(tCloudC, tp, 0), d = texelFetch(tCloudD, tp, 0);
      float wd = exp(-abs(log(sd + 1.0) - log(d.y + 1.0)) * 6.0);
      if (c.a > 0.01 && sd < d.x * 0.97) c = vec4(0.0);
      acc2 += c * wd; sw2 += wd;
    }
    if (sw2 > 0.05) { acc = acc2; sw = sw2; }
  }
  vec4 c = acc / max(sw, 1e-6);
  if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0);
  c = clamp(c, 0.0, 64.0) * uFade;
  outC = vec4(s.rgb * (1.0 - c.a) + c.rgb, s.a);
}`;

const SHADOW_FRAG = /* glsl */`precision highp float; precision highp int; precision highp sampler3D;
in vec2 vUv; layout(location = 0) out vec4 outC;
uniform vec2 uCenter; uniform float uSize, uSigma; uniform vec3 uSun;
uniform float uBaseM, uMaxTopM;
WEATHER_GLSL
${'DENSITY'}
void main() {
  vec2 xz = uCenter + (vUv - 0.5) * uSize;
  float od = 0.0, hf; vec3 s = uSun / max(uSun.y, 0.08);
  for (int i = 0; i < 18; i++) {
    float y = uBaseM + (float(i) + 0.5) / 18.0 * uMaxTopM;
    vec3 pm = vec3(xz.x + s.x * y, y, xz.y + s.z * y);
    od += cloudDensity(pm, true, hf) * uMaxTopM / 18.0 / max(uSun.y, 0.08);
  }
  outC = vec4(mix(0.12, 1.0, exp(-od * uSigma * 0.8)), 0.0, 0.0, 1.0);
}`;

const SAMPLE_MAP_GLSL = /* glsl */`
uniform sampler2D uWeather; uniform float uMapSize, uTopMin, uTopMax; uniform vec2 uMapOff;
vec4 weatherAt(vec2 xz) { vec4 w = texture(uWeather, (xz - uMapOff) / uMapSize + 0.5); w.a = mix(uTopMin, uTopMax, w.a); return w; }
vec3 anvilAt(vec2 xz) { return vec3(0.0); }`;

/* shared uniforms for terrain cloud shadows (read by world materials) */
export const CLOUD_SHADOW = {
  uCloudShadow: { value: null }, uCloudShadowCenter: { value: new THREE.Vector2() }, uCloudShadowSize: { value: 20000 },
  uCloudShadowFar: { value: 1 }, uCloudShadowOn: { value: 0 }
};
(() => { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; CLOUD_SHADOW.uCloudShadow.value = t; })();
/** patch a lit material so its direct light is multiplied by the cloud shadow texture */
export function applyCloudShadow(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, CLOUD_SHADOW);
    sh.vertexShader = 'varying vec3 vCloudW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 cw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n cw = instanceMatrix * cw;\n#endif\n vCloudW = (modelMatrix * cw).xyz; }');
    sh.fragmentShader = 'varying vec3 vCloudW; uniform sampler2D uCloudShadow; uniform vec2 uCloudShadowCenter; uniform float uCloudShadowSize, uCloudShadowFar, uCloudShadowOn;\n' +
      sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      if (uCloudShadowOn > 0.5) { vec2 cuv = (vCloudW.xz - uCloudShadowCenter) / uCloudShadowSize + 0.5;
        float edge = smoothstep(0.5, 0.42, max(abs(cuv.x - 0.5), abs(cuv.y - 0.5)));
        float cs = mix(uCloudShadowFar, texture2D(uCloudShadow, cuv).r, edge);
        reflectedLight.directDiffuse *= cs; reflectedLight.directSpecular *= cs; reflectedLight.indirectDiffuse *= mix(0.55, 1.0, cs); }`);
  };
  mat.needsUpdate = true;
}

/* ------------------------------------------------------------------ */
/* Renderer                                                            */
/* ------------------------------------------------------------------ */
/**
 * createVolumetricClouds(S, opts)
 * opts: unit (m per world unit), weatherGLSL (defines weatherAt/anvilAt; default = weather map texture), extraUniforms,
 *       quality ('low'|'medium'|'high'|'ultra'), host (reads host.__quality + 'sim-quality' events), maxDist (world units),
 *       shadows (bool: compute terrain shadow texture), rain (bool)
 */
export function createVolumetricClouds(S, o = {}) {
  const r = S.renderer, unit = o.unit ?? 1;
  const qn = q => (typeof q === 'string' ? q : q && (q.cloudSteps || q.level)) || null;
  const qres = q => (q && typeof q === 'object' && q.cloudRes) || null;
  let qName = qn(o.host && o.host.__quality) || qn(o.quality) || defaultQuality(); if (!QUALITY[qName]) qName = defaultQuality();
  let Q = { ...QUALITY[qName] }; { const rs = qres(o.host && o.host.__quality); if (rs) Q.scale = rs; }
  let noise = getNoise(r, Q.noise, Q.slices);
  const weatherGLSL = o.weatherGLSL || SAMPLE_MAP_GLSL;
  const U = {
    uBaseTex: { value: null }, uDetTex: { value: null }, uCurl: { value: null },
    uBaseM: { value: 1000 }, uMaxTopM: { value: 2500 }, uBaseScale: { value: 1 / 5200 }, uDetScale: { value: 1 / 950 }, uCurlScale: { value: 1 / 3000 }, uCurlAmt: { value: 0.22 },
    uDensity: { value: 1 }, uCoverMul: { value: 1 }, uErode: { value: 0 }, uShear: { value: 0.15 }, uShearDir: { value: new THREE.Vector2(1, 0) }, uNoiseOff: { value: new THREE.Vector3() },
    uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uAmbTop: { value: new THREE.Color(0.6, 0.7, 0.85) }, uAmbBot: { value: new THREE.Color(0.3, 0.33, 0.38) },
    uFogCol: { value: new THREE.Color(0.75, 0.8, 0.85) }, uFogDist: { value: 25000 }, uSigma: { value: 0.05 }, uMinStep: { value: 25 }, uMaxStep: { value: 420 }, uStepGrow: { value: 0.018 },
    uMaxDist: { value: (o.maxDist ?? 40000) }, uDark: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(0.85, 0.9, 1) }, uFlashPos: { value: new THREE.Vector3() },
    uRain: { value: 0 }, uSunGain: { value: 1.1 }, uAmbGain: { value: 1 }, uSlabBot: { value: 1000 }, uSlabTop: { value: 3500 }, uNearSkip: { value: o.nearSkip ?? 0 },
    uWeather: { value: null }, uMapSize: { value: 40000 }, uTopMin: { value: 300 }, uTopMax: { value: 4000 }, uMapOff: { value: new THREE.Vector2() },
    ...(o.extraUniforms || {})
  };
  const build = src => src.replace('WEATHER_GLSL', weatherGLSL).replace('DENSITY', DENSITY_GLSL);
  const camU = { tDepth: { value: null }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() }, uNear: { value: 0.1 }, uFar: { value: 1000 }, uUnit: { value: unit },
    uCloudRes: { value: new THREE.Vector2(1, 1) }, uMarchRes: { value: new THREE.Vector2(1, 1) }, uOffset: { value: new THREE.Vector2(0, 0) }, uFull: { value: 0 }, uSteps: { value: Q.steps }, uLight: { value: Q.light }, uFrame: { value: 0 } };
  const march = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: build(MARCH_FRAG), uniforms: { ...U, ...camU }, depthTest: false, depthWrite: false });
  const resolveU = { tNewC: { value: null }, tNewD: { value: null }, tHistC: { value: null }, tHistD: { value: null }, uOffset: camU.uOffset, uNewSize: { value: new THREE.Vector2(1, 1) }, uFull: camU.uFull, uHist: { value: 0 },
    uCloudRes: camU.uCloudRes, uInvProj: camU.uInvProj, uCamWorld: camU.uCamWorld, uPrevVP: { value: new THREE.Matrix4() }, uCamPos: camU.uCamPos };
  const resolve = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: RESOLVE_FRAG, uniforms: resolveU, depthTest: false, depthWrite: false });
  const compU = { tDiffuse: { value: null }, tDepth: camU.tDepth, tCloudC: { value: null }, tCloudD: { value: null }, uCloudRes: camU.uCloudRes, uInvProj: camU.uInvProj, uNear: camU.uNear, uFar: camU.uFar, uMaxDist: U.uMaxDist, uOn: { value: 0 }, uFade: { value: 0 } };
  const comp = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: COMP_FRAG, uniforms: compU, depthTest: false, depthWrite: false });
  const mq = new FullScreenQuad(march), rq = new FullScreenQuad(resolve), cq = new FullScreenQuad(comp);
  // shadow texture
  let shadowRT = null, shadowMat = null, sq = null, shadowAge = 99;
  if (o.shadows) {
    shadowRT = new THREE.WebGLRenderTarget(Q.shadow, Q.shadow, { depthBuffer: false, type: THREE.HalfFloatType });
    shadowRT.texture.minFilter = shadowRT.texture.magFilter = THREE.LinearFilter;
    shadowMat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: build(SHADOW_FRAG), uniforms: { ...U, uCenter: { value: new THREE.Vector2() }, uSize: { value: 20000 } }, depthTest: false, depthWrite: false });
    sq = new FullScreenQuad(shadowMat);
  }
  // render targets
  const depthRT = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: true, depthTexture: new THREE.DepthTexture(4, 4, THREE.FloatType) });
  camU.tDepth.value = depthRT.depthTexture;
  const mk = () => { const t = new THREE.WebGLRenderTarget(4, 4, { count: 2, type: THREE.HalfFloatType, depthBuffer: false }); t.textures.forEach(x => { x.minFilter = x.magFilter = THREE.LinearFilter; }); return t; };
  const newRT = mk(); let hist = [mk(), mk()], hi = 0, haveHist = false;
  const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  const prevVP = new THREE.Matrix4(), vp = new THREE.Matrix4();
  let frame = 0, enabled = false, debugFull = false, fadeT0 = 0;
  const state = { enabled: false, ready: false, get noiseMs() { return noise.ms; } };
  const overlayDepth = { value: depthRT.depthTexture };

  function setQuality(q) {
    const name = qn(q), rs = qres(q);
    if (!QUALITY[name]) return;
    if (name === qName && noise) { if (rs && rs !== Q.scale) { Q.scale = rs; haveHist = false; } return; }
    qName = name; Q = { ...QUALITY[name] }; if (rs) Q.scale = rs; camU.uSteps.value = Q.steps; camU.uLight.value = Q.light;
    noise = getNoise(r, Q.noise, Q.slices); haveHist = false;
    if (shadowRT) shadowRT.setSize(Q.shadow, Q.shadow);
  }
  if (o.host) o.host.addEventListener('sim-quality', e => setQuality(e.detail || o.host.__quality));

  class CloudPass extends Pass {
    constructor() { super(); this.needsSwap = true; }
    render(rr, writeBuffer, readBuffer) {
      const cam = S.camera;
      if (o.host && typeof o.host.__quality === 'string' && o.host.__quality !== qName) setQuality(o.host.__quality);
      const ready = noise.step(rr); state.ready = ready;
      if (!ready) fadeT0 = 0; else if (!fadeT0) fadeT0 = performance.now();
      compU.uFade.value = ready ? Math.min(1, (performance.now() - fadeT0) / 1000) : 0;
      const on = enabled && ready && !rr.xr.isPresenting;
      compU.uOn.value = on ? 1 : 0;
      if (on) {
        U.uBaseTex.value = noise.base; U.uDetTex.value = noise.detail; U.uCurl.value = noise.curl;
        const W = readBuffer.width, H = readBuffer.height;
        if (depthRT.width !== W || depthRT.height !== H) depthRT.setSize(W, H);
        // full-resolution depth pre-pass (opaque layer 0 only)
        const mask = cam.layers.mask, ov = S.scene.overrideMaterial, au = rr.shadowMap.autoUpdate, bg = S.scene.background;
        cam.layers.set(0); S.scene.overrideMaterial = depthMat; rr.shadowMap.autoUpdate = false; S.scene.background = null;
        rr.setRenderTarget(depthRT); rr.clear(); rr.render(S.scene, cam);
        cam.layers.mask = mask; S.scene.overrideMaterial = ov; rr.shadowMap.autoUpdate = au; S.scene.background = bg;
        // sizes
        const full = debugFull || o.host?.__cloudFull;
        const cw = Math.max(16, Math.round(W * Q.scale)), ch = Math.max(16, Math.round(H * Q.scale));
        const mw = full ? cw : Math.ceil(cw / 2), mh = full ? ch : Math.ceil(ch / 2);
        if (hist[0].width !== cw || hist[0].height !== ch) { hist.forEach(t => t.setSize(cw, ch)); haveHist = false; }
        if (newRT.width !== mw || newRT.height !== mh) newRT.setSize(mw, mh);
        camU.uCloudRes.value.set(cw, ch); camU.uMarchRes.value.set(mw, mh); resolveU.uNewSize.value.set(mw, mh);
        camU.uFull.value = full ? 1 : 0;
        const k = frame % 4, OFF = [[0, 0], [1, 1], [1, 0], [0, 1]]; camU.uOffset.value.set(OFF[k][0], OFF[k][1]);
        camU.uInvProj.value.copy(cam.projectionMatrixInverse); camU.uCamWorld.value.copy(cam.matrixWorld); cam.getWorldPosition(camU.uCamPos.value);
        camU.uNear.value = cam.near; camU.uFar.value = cam.far; camU.uFrame.value = frame % 1024;
        // march
        rr.setRenderTarget(newRT); mq.render(rr);
        // resolve into history
        const prev = hist[hi], next = hist[1 - hi];
        resolveU.tNewC.value = newRT.textures[0]; resolveU.tNewD.value = newRT.textures[1];
        resolveU.tHistC.value = prev.textures[0]; resolveU.tHistD.value = prev.textures[1]; resolveU.uHist.value = haveHist ? 1 : 0;
        resolveU.uPrevVP.value.copy(prevVP);
        rr.setRenderTarget(next); rq.render(rr);
        hi = 1 - hi; haveHist = true;
        vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); prevVP.copy(vp);
        compU.tCloudC.value = next.textures[0]; compU.tCloudD.value = next.textures[1];
        // terrain shadow texture
        if (shadowRT && (shadowAge++ > 6)) {
          shadowAge = 0;
          const c = shadowMat.uniforms.uCenter.value; c.set(Math.round(camU.uCamPos.value.x * unit / 500) * 500, Math.round(camU.uCamPos.value.z * unit / 500) * 500);
          shadowMat.uniforms.uSize.value = 20000;
          rr.setRenderTarget(shadowRT); sq.render(rr);
          CLOUD_SHADOW.uCloudShadow.value = shadowRT.texture; CLOUD_SHADOW.uCloudShadowCenter.value.copy(c); CLOUD_SHADOW.uCloudShadowSize.value = 20000;
          CLOUD_SHADOW.uCloudShadowOn.value = U.uSun.value.y > 0.02 ? 1 : 0;
        }
        frame++;
      } else if (shadowRT) CLOUD_SHADOW.uCloudShadowOn.value = 0;
      compU.tDiffuse.value = readBuffer.texture;
      rr.setRenderTarget(this.renderToScreen ? null : writeBuffer); cq.render(rr);
    }
  }
  /** overlay pass: draws layer-2 objects (e.g. teaching particles) after the clouds, depth-tested by hand against the pre-pass */
  class OverlayPass extends Pass {
    constructor() { super(); this.needsSwap = false; }
    render(rr, writeBuffer, readBuffer) {
      const cam = S.camera, mask = cam.layers.mask, ac = rr.autoClear, au = rr.shadowMap.autoUpdate, bg = S.scene.background;
      cam.layers.set(2); rr.autoClear = false; rr.shadowMap.autoUpdate = false; S.scene.background = null;
      rr.setRenderTarget(this.renderToScreen ? null : readBuffer); rr.clearDepth(); rr.render(S.scene, cam);
      cam.layers.mask = mask; rr.autoClear = ac; rr.shadowMap.autoUpdate = au; S.scene.background = bg;
    }
  }
  const pass = new CloudPass();
  S.composer.insertPass(pass, 1);
  let overlayPass = null;
  S.camera.layers.enable(1);

  return {
    pass, uniforms: U, state, CLOUD_SHADOW, get shadowRT() { return shadowRT; },
    get quality() { return qName; }, setQuality,
    setEnabled(v) { enabled = !!v; state.enabled = enabled; if (!v) haveHist = false; },
    set debugFull(v) { debugFull = v; }, get debugFull() { return debugFull; },
    /** objects drawn without writing depth (glass, glows, lines, points) must not occlude clouds */
    noDepth(obj) { obj.traverse(x => x.layers.set(1)); },
    /** draw obj after the clouds (layer 2), depth-tested against the opaque scene */
    overlay(obj) {
      if (!overlayPass) { overlayPass = new OverlayPass(); S.composer.insertPass(overlayPass, S.composer.passes.indexOf(pass) + 1); }
      obj.traverse(x => {
        x.layers.set(2);
        if (x.material && !x.material.userData.cloudOverlay) {
          const m = x.material; m.userData.cloudOverlay = true; const prevOBC = m.onBeforeCompile;
          m.onBeforeCompile = (sh, rr) => { if (prevOBC) prevOBC(sh, rr); sh.uniforms.uCloudSceneDepth = overlayDepth;
            sh.fragmentShader = 'uniform sampler2D uCloudSceneDepth;\n' + sh.fragmentShader.replace(/void main\(\)\s*\{/, 'void main() {\n if (gl_FragCoord.z > texelFetch(uCloudSceneDepth, ivec2(gl_FragCoord.xy), 0).x + 1e-6) discard;'); };
          m.needsUpdate = true;
        }
      });
    }
  };
}

/* ------------------------------------------------------------------ */
/* CPU density (same maths as cloudDensity, used for IMC/shade/tests)   */
/* ------------------------------------------------------------------ */
export function heightGradCPU(hf, type) {
  const s1 = sstep(0, 0.45, type), s2 = sstep(0.6, 0.95, type);
  const strat = sstep(0, 0.1, hf) * (1 - sstep(0.55, 1, hf)), cumu = sstep(0, 0.08, hf) * (1 - sstep(0.3, 1, hf)), cb = sstep(0, 0.05, hf) * (1 - sstep(0.82, 1, hf));
  return mixf(mixf(strat, cumu, s1), cb, s2);
}
/** U: the renderer uniforms; weatherAt(x,z) -> [cov,type,precip,topM]; returns density(xm,ym,zm, cheap) in metres space */
export function makeCPUDensity(U, weatherAt) {
  return function density(x, y, z, cheap = false) {
    const hm = y - U.uBaseM.value; if (hm < 0 || hm > U.uMaxTopM.value) return 0;
    const sh = U.uShear.value * hm, sd = U.uShearDir.value; const wxp = x - sd.x * sh, wzp = z - sd.y * sh;
    const w = weatherAt(wxp, wzp); const top = Math.max(w[3], 1), h = hm / top;
    const cov = clamp(w[0] * U.uCoverMul.value, 0, 1);
    const grad = h > 0 && h < 1 ? heightGradCPU(h, w[1]) : 0;
    if (cov * grad < 0.002) return 0;
    const bs = U.uBaseScale.value, off = U.uNoiseOff.value;
    const n = baseNoiseCPU(x * bs + off.x, y * bs + off.y, z * bs + off.z);
    const low = n[1] * 0.625 + n[2] * 0.25 + n[3] * 0.125, base = remap(n[0], low - 1, 1, 0, 1);
    let c = remap(base * grad, 1 - cov, 1, 0, 1) * cov; if (c <= 0) return 0;
    if (!cheap) {
      const ds = U.uDetScale.value, hf = clamp(h, 0, 1);
      const d = detailNoiseCPU(x * ds + off.x * 3, y * ds + off.y * 3, z * ds + off.z * 3), df = d[0] * 0.625 + d[1] * 0.25 + d[2] * 0.125;
      const dmod = mixf(df, 1 - df, clamp(hf * 4, 0, 1));
      c = remap(c, dmod * (0.42 + U.uErode.value * 0.5), 1, 0, 1);
    }
    return Math.max(c, 0) * U.uDensity.value;
  };
}

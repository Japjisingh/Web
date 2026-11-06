/* Thunderstorm life cycle on the shared volumetric cloud renderer (Meteorology). Scene units are kilometres. */
import { createStage, addSky, makeTerrain, fieldColor, fbm, makeAircraft, softPointsMaterial, ui, THREE, clamp, lerp, V3, REDUCED } from './core.js';
import { createVolumetricClouds, defaultQuality } from './clouds-vol.js';

/* Cumulonimbus weather function: tower footprint, downwind anvil, rain shaft (inputs in metres) */
const STORM_WX = /* glsl */`
uniform float uR, uTopM, uAnvil, uAnvilT, uRainAmt; uniform vec2 uCellPos, uRainPos;
vec4 weatherAt(vec2 xz) {
  vec2 q = xz / 1000.0;
  float r = length(q - uCellPos);
  float cov = 1.0 - smoothstep(uR * 0.15, uR * 1.15, r);
  float pr = uRainAmt * (1.0 - smoothstep(0.5, 1.7, length(q - uRainPos)));
  return vec4(cov * 0.9, 1.0, pr, uTopM - uBaseM);
}
vec3 anvilAt(vec2 xz) {
  vec2 q = xz / 1000.0 - uCellPos;
  vec2 aq = vec2((q.x - 2.0 * uAnvil) / (1.0 + 0.55 * uAnvil), q.y * 1.05);
  float aR = 4.2 * uAnvil + 0.001;
  float c = uAnvil * (1.0 - smoothstep(aR * 0.45, aR, length(aq)));
  float topRel = uTopM - uBaseM;
  return vec3(c * 0.9, topRel - uAnvilT * 1000.0, topRel + 150.0);
}`;

export default function (host) {
  const S = createStage(host, { cam: [3.2, 4.0, 18], target: [1.8, 4.1, 0], minDist: 6, maxDist: 55, shadows: true, bloom: { strength: 0.8, radius: 0.5, threshold: 1.8 } });
  const { scene } = S;
  const sk = addSky(S, { elevation: 13, azimuth: 100, turbidity: 9, rayleigh: 2.4, mie: 0.007, exposure: 0.45, sunIntensity: 2.0, hemi: 0.7, skyColor: 0xa9bccc, groundColor: 0x2b3329, shadow: { extent: 16 } });
  scene.fog = new THREE.Fog(0x7f8e9a, 40, 130);

  /* ---- ground ---- */
  const terrain = makeTerrain({
    size: 140, seg: 220,
    height: (x, z) => { const r = Math.hypot(x - 2, z); const k = clamp((r - 10) / 18, 0, 1); return (fbm(x * 0.03, z * 0.03) * 3.2 + 0.2) * k * k - 0.02; },
    color: (y, s, x, z) => fieldColor(x, z, y, s)
  });
  scene.add(terrain);
  const rwy = new THREE.Mesh(new THREE.BoxGeometry(5, 0.04, 0.55), new THREE.MeshStandardMaterial({ color: 0x3b4044, roughness: 0.9 })); rwy.position.set(12.4, 0.02, 0.2); rwy.receiveShadow = true; scene.add(rwy);
  for (let x = 10.4; x < 14.6; x += 0.45) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.03), new THREE.MeshStandardMaterial({ color: 0xe8ecef })); d.position.set(x, 0.025, 0.2); scene.add(d); }

  /* ---- volumetric cloud (shared renderer, 1 unit = 1 km) ---- */
  const ex = { uR: { value: 2.9 }, uTopM: { value: 8600 }, uAnvil: { value: 1 }, uAnvilT: { value: 1.3 }, uRainAmt: { value: 1 }, uCellPos: { value: new THREE.Vector2(0, 0) }, uRainPos: { value: new THREE.Vector2(0.6, 0) } };
  const vc = createVolumetricClouds(S, { unit: 1000, weatherGLSL: STORM_WX, extraUniforms: ex, host, quality: host.__quality || defaultQuality(), maxDist: 220, nearSkip: 0 });
  const uniforms = vc.uniforms;
  Object.assign(uniforms.uBaseM, { value: 1600 }); uniforms.uMaxTopM.value = 8600; uniforms.uSlabBot.value = 0; uniforms.uSlabTop.value = 10200;
  uniforms.uShear.value = 0.1; uniforms.uShearDir.value.set(1, 0); uniforms.uRain.value = 1; uniforms.uDensity.value = 1.5; uniforms.uSigma.value = 0.05;
  uniforms.uBaseScale.value = 1 / 3400; uniforms.uDetScale.value = 1 / 650; uniforms.uCurlScale.value = 1 / 2200;
  S.bloomPass.threshold = 3.2; S.bloomPass.strength = 0.6;
  uniforms.uMinStep.value = 70; uniforms.uMaxStep.value = 260; uniforms.uStepGrow.value = 0.005;
  uniforms.uSun.value.copy(sk.sun).normalize(); uniforms.uSunCol.value.setRGB(1.55, 1.45, 1.32); uniforms.uSunGain.value = 0.85;
  uniforms.uAmbTop.value.setRGB(0.26, 0.3, 0.37); uniforms.uAmbBot.value.setRGB(0.05, 0.055, 0.065);
  uniforms.uFogCol.value.setRGB(0.42, 0.47, 0.53); uniforms.uFogDist.value = 160000;
  vc.setEnabled(true);
  [sk.sky].forEach(o => vc.noDepth(o));

  /* ---- 0 °C level ---- */
  const fz = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), new THREE.MeshBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false })); fz.rotation.x = -Math.PI / 2; fz.position.set(1.5, 3.2, 0); scene.add(fz);
  const fzEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(18, 14)), new THREE.LineBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0.35 })); fzEdge.rotation.x = -Math.PI / 2; fzEdge.position.copy(fz.position); scene.add(fzEdge);
  S.label('0 °C level', V3(9.4, 3.2, -6.2), 'cyan'); vc.noDepth(fz); vc.noDepth(fzEdge);

  /* ---- particles: updraft, downdraft, outflow, rain ---- */
  function pool(n, color, size) {
    const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) pos[i * 3 + 1] = -50;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, softPointsMaterial({ size, color, opacity: 0.9 })); p.renderOrder = 2; p.frustumCulled = false; scene.add(p); vc.overlay(p);
    return { n, pos, g, seed: new Float32Array(n).map(() => Math.random()) };
  }
  const up = pool(300, new THREE.Color(1.6, 0.7, 0.25), 0.2), dn = pool(300, new THREE.Color(0.4, 0.85, 1.7), 0.2), out = pool(260, new THREE.Color(0.4, 0.85, 1.6), 0.17);
  const NR = 700, rPos = new Float32Array(NR * 6), rSeed = new Float32Array(NR).map(() => Math.random());
  const rGeo = new THREE.BufferGeometry(); rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
  const rain = new THREE.LineSegments(rGeo, new THREE.LineBasicMaterial({ color: 0x8f9ead, transparent: true, opacity: 0.28, depthWrite: false })); rain.renderOrder = 2; rain.frustumCulled = false; scene.add(rain);
  for (let i = 0; i < NR; i++) rPos[i * 6 + 1] = rPos[i * 6 + 4] = -50;
  vc.overlay(rain);

  /* ---- lightning ---- */
  const bolt = S.fatLine([V3(0, -50, 0), V3(0, -49, 0)], { color: 0xffffff, width: 3 }); bolt.material.color.setRGB(7, 7, 10); bolt.visible = false; bolt.renderOrder = 3; scene.add(bolt);
  const branch = S.fatLine([V3(0, -50, 0), V3(0, -49, 0)], { color: 0xffffff, width: 1.6 }); branch.material.color.setRGB(5, 5, 8); branch.visible = false; branch.renderOrder = 3; scene.add(branch); vc.noDepth(bolt); vc.noDepth(branch);
  const flashLight = new THREE.PointLight(0xc8d8ff, 0, 30, 1.5); flashLight.position.set(0.5, 1.2, 0); scene.add(flashLight);
  let nextBolt = 1.5, boltT = -1;
  function jag(a, b, n, amp) { const pts = [a.clone()]; for (let i = 1; i < n; i++) { const t = i / n; pts.push(new THREE.Vector3(lerp(a.x, b.x, t) + (Math.random() - 0.5) * amp, lerp(a.y, b.y, t) + (Math.random() - 0.5) * amp * 0.3, lerp(a.z, b.z, t) + (Math.random() - 0.5) * amp)); } pts.push(b.clone()); return pts; }
  function strike() {
    const top = V3(0.2 + (Math.random() - 0.5) * 1.6, 1.75, (Math.random() - 0.5) * 1.4), gnd = V3(top.x + (Math.random() - 0.5) * 2.5, 0.02, top.z + (Math.random() - 0.5) * 2);
    const main = jag(top, gnd, 16, 0.55); bolt.userData.setPoints(main);
    const k = 4 + Math.floor(Math.random() * 6); const bEnd = main[k].clone().add(V3((Math.random() - 0.5) * 2.4, -1.1, (Math.random() - 0.5) * 1.5));
    branch.userData.setPoints(jag(main[k], bEnd, 7, 0.35));
    uniforms.uFlashPos.value.copy(top).add(V3(0, 1.4, 0)); flashLight.position.copy(top);
    boltT = 0;
  }

  /* ---- approach through the microburst ---- */
  const path = new THREE.Group(); scene.add(path);
  const pathLine = S.fatLine([V3(-12, 2.4, 0.2), V3(10.2, 0.15, 0.2)], { color: 0xffffff, width: 2, dashed: true, dashSize: 0.35, gapSize: 0.25, opacity: 0.7 }); path.add(pathLine); vc.noDepth(pathLine);
  const ac = makeAircraft({ scale: 1.5 }); ac.rotation.y = -Math.PI / 2; path.add(ac);
  const apl = [S.label('Headwind: airspeed and lift increase', V3(-6, 3.3, 0.2), 'green'), S.label('Downdraft: aircraft sinks', V3(1.6, 2.5, 0.2), 'amber'), S.label('Tailwind: airspeed drops', V3(6.8, 1.55, 0.2), 'pink')];

  /* ---- stages ---- */
  const P = {
    top: [5.4, 8.6, 8.3], R: [2.3, 2.9, 1.9], an: [0, 1, 1.15], anT: [0.6, 1.3, 1.0], er: [0.0, 0.05, 0.65], dk: [0.25, 0.9, 0.45], rain: [0, 1, 0.4], dens: [1.0, 1.1, 0.8],
    up: [1, 1, 0.05], dn: [0, 0.8, 1], out: [0, 1, 0.25], ap: [0, 1, 0]
  };
  const ip = (arr, sv) => { const i = Math.min(1, Math.floor(sv)), f = sv - i; return arr[i] + (arr[i + 1] - arr[i]) * f; };
  let sv = 1, target = 1, auto = false, autoT = 0, acx = -12, lastT = -1;
  const U = ui(host);
  const stageSeg = U.seg('stage', 'Stage', [[0, 'Cumulus'], [1, 'Mature'], [2, 'Dissipating']], 1);
  const autoSeg = U.seg('auto', 'Play the life cycle', [[0, 'Off'], [1, 'On']], 0);
  const TXT = [
    ['Cumulus stage', 'Warm, moist air rises in strong updrafts and the cloud grows quickly above the freezing level. Little or no rain reaches the ground yet.'],
    ['Mature stage', 'Falling rain and hail drag air down, so updrafts and downdrafts sit side by side. This is the most dangerous stage: severe turbulence, icing, hail, lightning and microbursts. The outflow spreads along the ground as a gust front.'],
    ['Dissipating stage', 'Downdrafts take over and cut off the warm inflow. Rain weakens and the anvil drifts away downwind, but gusty winds can still reach the ground.']
  ];
  function text(i) { U.readout(`<p class="ro-big">${TXT[i][0]}</p><p>${TXT[i][1]}</p><p class="note">Orange dots are rising air, blue dots are sinking air. In the mature stage, watch the aircraft on approach fly through the microburst. The cloud is a simplified 3D model, drawn to show the structure rather than to scale.</p>`); }
  stageSeg.on(v => { target = +v; text(+v); }); autoSeg.on(v => { auto = v == 1; autoT = 0; });
  text(1);

  S.tick((dt, t) => {
    dt = Math.max(0, dt);
    const wdt = lastT < 0 ? dt : Math.min(0.5, Math.max(0, t - lastT)); lastT = t;
    if (auto) { autoT += wdt; if (autoT > 6) { autoT = 0; stageSeg.set((Math.round(target) + 1) % 3); } }
    sv += (target - sv) * Math.min(1, wdt * (REDUCED ? 10 : 1.3));
    const H = ip(P.top, sv);
    ex.uTopM.value = H * 1000; ex.uR.value = ip(P.R, sv); ex.uAnvil.value = ip(P.an, sv); ex.uAnvilT.value = ip(P.anT, sv); ex.uRainAmt.value = ip(P.rain, sv);
    uniforms.uErode.value = ip(P.er, sv); uniforms.uDark.value = ip(P.dk, sv); uniforms.uDensity.value = 2.2 * ip(P.dens, sv);
    uniforms.uNoiseOff.value.set(t * 0.0009, -t * 0.0016, t * 0.0005);
    // particles
    const step = (pl, wgt, fn) => { const act = Math.floor(pl.n * wgt); for (let i = 0; i < pl.n; i++) { if (i >= act) { pl.pos[i * 3 + 1] = -50; continue; } fn(pl.pos, i, pl.seed[i]); } pl.g.attributes.position.needsUpdate = true; };
    step(up, ip(P.up, sv), (a, i, s) => { if (a[i * 3 + 1] < 0.5 || a[i * 3 + 1] > H - 0.5) { const an = Math.random() * 6.28, r = Math.random() * 1.0; a[i * 3] = Math.cos(an) * r - 0.4; a[i * 3 + 2] = Math.sin(an) * r; a[i * 3 + 1] = 0.6 + Math.random() * (H - 1.2); } a[i * 3 + 1] += dt * (2.2 + s * 1.6); a[i * 3] += dt * 0.08; });
    const dOff = sv < 1.5 ? 1.1 : 0;
    step(dn, ip(P.dn, sv), (a, i, s) => { if (a[i * 3 + 1] < 0.25 || a[i * 3 + 1] > 10) { const an = Math.random() * 6.28, r = Math.random() * (dOff ? 0.8 : 1.4); a[i * 3] = Math.cos(an) * r + dOff; a[i * 3 + 2] = Math.sin(an) * r; a[i * 3 + 1] = 0.4 + Math.random() * (H * 0.8); } a[i * 3 + 1] -= dt * (2.4 + s * 1.6); });
    step(out, ip(P.out, sv), (a, i, s) => { const dx = a[i * 3] - 1, dz = a[i * 3 + 2], rr = Math.hypot(dx, dz); if (a[i * 3 + 1] < 0 || rr > 7 || rr < 0.01) { const an = s * 6.28 + Math.random() * 0.3; a[i * 3] = 1 + Math.cos(an) * 0.3; a[i * 3 + 2] = Math.sin(an) * 0.3; a[i * 3 + 1] = 0.12 + Math.random() * 0.35; return; } const k = (2.8 + s) * dt / rr; a[i * 3] += dx * k; a[i * 3 + 2] += dz * k; });
    const rw = ip(P.rain, sv), ract = Math.floor(NR * rw);
    for (let i = 0; i < NR; i++) {
      const j = i * 6;
      if (i >= ract) { rPos[j + 1] = rPos[j + 4] = -50; continue; }
      let y = rPos[j + 4];
      if (y < 0.02 || y > 1.7) { const an = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 1.7; rPos[j] = rPos[j + 3] = Math.cos(an) * r + 0.6; rPos[j + 2] = rPos[j + 5] = Math.sin(an) * r; y = 0.05 + Math.random() * 1.6; }
      y -= dt * (6 + rSeed[i] * 2); rPos[j + 4] = y; rPos[j + 1] = y + 0.32; rPos[j] = rPos[j + 3] - 0.05;
    }
    rGeo.attributes.position.needsUpdate = true;
    // lightning in the mature stage
    const mature = sv > 0.6 && sv < 1.45;
    if (mature && !REDUCED) { nextBolt -= dt; if (nextBolt < 0) { strike(); nextBolt = 2 + Math.random() * 3.5; } }
    if (boltT >= 0) {
      boltT += dt; const on = boltT < 0.06 || (boltT > 0.11 && boltT < 0.2);
      bolt.visible = branch.visible = on; const fl = on ? 1 : Math.max(0, 1 - (boltT - 0.2) * 6);
      uniforms.uFlash.value = fl; flashLight.intensity = fl * 60;
      if (boltT > 0.4) { boltT = -1; bolt.visible = branch.visible = false; uniforms.uFlash.value = 0; flashLight.intensity = 0; }
    }
    // approach
    const apw = ip(P.ap, sv); path.visible = apw > 0.5; apl.forEach(l => { l.off = apw <= 0.5; });
    if (path.visible) {
      acx += dt * 2.6; if (acx > 10) acx = -12;
      const base = 2.4 - (acx + 12) / 22.2 * 2.25, g1 = Math.exp(-Math.pow((acx + 4.5) / 2.2, 2)), g2 = Math.exp(-Math.pow((acx - 2) / 1.8, 2));
      ac.position.set(acx, Math.max(0.2, base + 0.45 * g1 - 0.75 * g2), 0.2);
      ac.rotation.z = -0.15 * g1 + 0.2 * g2; ac.userData.update(dt);
    }
  });
}

/* Virtual procedure trainer: generic twin-jet with a classic narrow-body flight-deck layout.
   Cockpit preparation (cold & dark → power-up → overhead scan → APU), engine start, and an engine fire during start.
   Generic training aid; flows, messages and figures are written by us from general public knowledge. */
import { createStage, addSky, ui, THREE, D2R, clamp, REDUCED } from './core.js';
import { createQuality, LEVELS, AUTO_LEVEL } from './sim/quality.js';
import { xrSupported, createXR } from './sim/xr.js';
import { createSystems, REF, fmtT } from './jet/systems.js';
import { createFlow, SCENARIOS } from './jet/flows.js';
import { CTL, operate, valueText, fmsId } from './jet/controls.js';
import { buildDeck, EYE } from './jet/deck.js';
import { drawSD } from './jet/displays.js';
import { buildAirport } from './jet/airport.js';
import { createJetAudio } from './jet/audio.js';
import { createChecklist } from './jet/checklist.js';
import { createHUD } from './jet/hud.js';
import { createFinishPass } from './jet/post.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PRESETS = {
  captain: { pos: V(-0.53, 1.17, 0.14), target: V(-0.45, 1.25, -1.0), fov: 70, label: 'Captain' },
  overhead: { pos: V(-0.02, 1.07, 0.05), target: V(0.0, 1.875, -0.34), fov: 54, label: 'Overhead' },
  pedestal: { pos: V(-0.30, 1.16, 0.10), target: V(0.0, 0.42, -0.38), fov: 58, label: 'Pedestal' },
  displays: { pos: V(-0.34, 1.12, -0.12), target: V(-0.26, 0.70, -0.90), fov: 56, label: 'Displays' }
};
const PANEL_VIEW = { OVHD: 'overhead', CB: 'overhead', PED: 'pedestal', 'PED-F': 'pedestal', 'MIP-CAPT': 'displays', 'MIP-CTR': 'displays', 'MIP-FO': 'displays', FCU: 'captain', 'EFIS-L': 'captain', 'EFIS-R': 'captain' };
const PANEL_NAME = { OVHD: 'overhead panel', CB: 'overhead panel', PED: 'pedestal', 'PED-F': 'pedestal', 'MIP-CAPT': 'main panel', 'MIP-CTR': 'main panel', 'MIP-FO': 'main panel', FCU: 'glareshield', 'EFIS-L': 'glareshield', 'EFIS-R': 'glareshield' };
const TOD = {
  day: { label: 'Day', el: 50, az: 34, mie: 0.002, bloom: [40, 0.35], fogD: [1400, 16000], sun: 0xfff3e2, sunI: 3.6, hemi: 0.1, hs: 0xd8e4f0, hg: 0x6a6a64, exp: 0.6, env: 0.7, turb: 2.2, ray: 2.0, integ: 0, beams: 0, fog: 0xc8d6e2, night: 0, area: [0xdbe8f5, 0.7], refl: 0.05 },
  dusk: { label: 'Dusk', el: 5, az: -66, mie: 0.006, bloom: [7, 0.55], fogD: [600, 8000], sun: 0xffaa70, sunI: 2.4, hemi: 0.16, hs: 0x8f96c4, hg: 0x2a2620, exp: 1.25, env: 0.5, turb: 6, ray: 2.6, integ: 0.75, beams: 0.022, fog: 0xc8a896, night: 0.6, area: [0xd9b9b8, 1.1], refl: 0.16 },
  night: { label: 'Night', el: -12, az: -64, mie: 0.005, bloom: [6, 0.6], fogD: [400, 6000], sun: 0x8aa0ff, sunI: 0, hemi: 0.06, hs: 0x1c2840, hg: 0x050607, exp: 1.5, env: 0.12, turb: 2, ray: 0.6, integ: 1, beams: 0, fog: 0x0a0f17, night: 1, area: [0x4a5a80, 0.16], refl: 0.22 }
};

export default function (host) {
  const S = createStage(host, { cam: [EYE.x, EYE.y, EYE.z], target: [EYE.x, EYE.y, EYE.z - 1], fov: 64, near: 0.015, far: 9000, shadows: true, bloom: { strength: 0.6, radius: 0.42, threshold: 7 } });
  const wrap = S.wrap, cam = S.camera, R = S.renderer;
  S.controls.enabled = false; S.controls.update = () => false;
  cam.rotation.order = 'YXZ';
  const sky = addSky(S, { elevation: 34, azimuth: -38, turbidity: 3.5, rayleigh: 1.3, scale: 6000, exposure: 0.8, envIntensity: 0.7, sunIntensity: 3.4, hemi: 0.3, groundColor: 0x6a6a64, shadow: { extent: 2.0, size: 2048 } });
  R.toneMapping = THREE.ACESFilmicToneMapping; R.localClippingEnabled = true; RectAreaLightUniformsLib.init();
  Object.assign(sky.light.shadow.camera, { near: 20, far: 100 }); sky.light.shadow.bias = -0.0006; sky.light.shadow.normalBias = 0.01; sky.light.shadow.camera.updateProjectionMatrix();
  S.scene.fog = new THREE.Fog(0xc4d2de, 400, 5200);
  const fill = new THREE.PointLight(0xfff4e6, 0.3, 3.2, 1.6); fill.position.set(0, 1.85, 0.45); S.scene.add(fill);
  // soft sky light from the windscreen and side windows (area lights): no crushed blacks at dusk, gentle gradients by day
  const skyWin = new THREE.RectAreaLight(0xdbe8f5, 2, 1.7, 0.62); skyWin.position.set(0, 1.36, -0.9); skyWin.lookAt(0, 1.0, 0.4); S.scene.add(skyWin);
  const sideWin = [-1, 1].map(sd => { const l = new THREE.RectAreaLight(0xdbe8f5, 1, 0.85, 0.5); l.position.set(sd * 0.96, 1.28, -0.4); l.lookAt(0, 1.0, -0.2); S.scene.add(l); return l; });
  const dome = new THREE.PointLight(0xffe9c8, 0, 3.2, 1.3); dome.position.set(-0.05, 1.98, 0.62); S.scene.add(dome);
  const floodL = new THREE.SpotLight(0xffe2bc, 0, 1.6, 0.9, 0.8, 1.2); floodL.position.set(0, 0.95, -0.80); floodL.target.position.set(0, 0.55, -0.95); S.scene.add(floodL, floodL.target);
  const finish = createFinishPass(); S.composer.addPass(finish);
  S.onResize((w, h) => { finish.uniforms.uAspect.value = w / h; });

  const sys = createSystems({ fast: false });
  const deck = buildDeck(R); S.scene.add(deck.root);
  const apt = buildAirport(R); S.scene.add(apt.root);
  // interior surfaces see far less sky than the open environment map suggests: keep it for reflections only
  // (scene.environment ignores per-material intensity, so interior materials get the map explicitly)
  const interior = new Map();
  deck.root.traverse(o => { const m = o.isMesh && o.material; if (m && 'envMapIntensity' in m && !interior.has(m)) interior.set(m, m.transparent ? 0.5 : m.emissiveMap && m.roughnessMap ? 0.6 : m.metalness > 0.5 ? 0.5 : 0.13); });
  function interiorEnv(T) { for (const [m, k] of interior) { const first = !m.envMap; m.envMap = S.scene.environment; m.envMapIntensity = k * T.env; if (first) m.needsUpdate = true; } }
  const audio = createJetAudio();
  const quality = createQuality(S, host, sky.light);
  if (document.fonts && document.fonts.load) Promise.all(['600 20px "Barlow Condensed"', '700 20px "Barlow Condensed"', '700 20px "JetBrains Mono"'].map(f => document.fonts.load(f))).then(() => { try { deck.refont(); } catch (e) { /* keep fallback lettering */ } }).catch(() => {});

  /* ---------------- light shafts through the windscreen (dust in the sun beams) ---------------- */
  const beamMat = new THREE.ShaderMaterial({ uniforms: { uI: { value: 0.05 }, uCol: { value: new THREE.Color(1, 0.9, 0.75) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'attribute float aT; varying float vT; varying vec3 vP; void main(){ vT = aT; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uI; uniform vec3 uCol; varying float vT; varying vec3 vP; float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); } void main(){ float dust = 0.75 + 0.25 * h(floor(vP * 60.0)); gl_FragColor = vec4(uCol * uI * pow(1.0 - vT, 1.7) * dust, 1.0); }' });
  let beams = null;
  function buildBeams(dir) {
    if (beams) { S.scene.remove(beams); beams.geometry.dispose(); }
    const pos = [], t = [], L = 2.2, d = dir.clone().multiplyScalar(-L);
    for (const P of deck.panes) { const far = P.map(p => p.clone().add(d)); for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4], c = far[(i + 1) % 4], e = far[i]; pos.push(a, b, c, a, c, e); t.push(0, 0, 1, 0, 1, 1); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos.flatMap(p => [p.x, p.y, p.z]), 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
    beams = new THREE.Mesh(g, beamMat); beams.renderOrder = 4; beams.frustumCulled = false; S.scene.add(beams);
  }

  /* ---------------- time of day ---------------- */
  const envScene = new THREE.Scene(); const sky2 = sky.sky.clone(); sky2.material = sky.sky.material; envScene.add(sky2);
  let tod = 'day', todK = TOD.day;
  function setTOD(k) {
    tod = k; const T = todK = TOD[k]; const el = T.el * D2R, az = T.az * D2R;
    sky.sun.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az));
    const u = sky.sky.material.uniforms; u.sunPosition.value.copy(sky.sun); u.turbidity.value = T.turb; u.rayleigh.value = T.ray; u.mieCoefficient.value = T.mie; u.mieDirectionalG.value = 0.74;
    sky.light.color.setHex(T.sun); sky.light.intensity = T.sunI; sky.light.position.copy(sky.sun).multiplyScalar(60).add(V(0, 1.2, -0.3)); sky.light.target.position.set(0, 1.2, -0.3);
    sky.hemi.color.setHex(T.hs); sky.hemi.groundColor.setHex(T.hg); sky.hemi.intensity = T.hemi;
    if (S.bloomPass) { S.bloomPass.threshold = T.bloom[0]; S.bloomPass.strength = T.bloom[1]; }
    R.toneMappingExposure = T.exp; S.envFromScene(envScene); S.scene.environmentIntensity = T.env; interiorEnv(T); S.scene.fog.color.setHex(T.fog); S.scene.fog.near = T.fogD[0]; S.scene.fog.far = T.fogD[1];
    beamMat.uniforms.uI.value = T.beams; beamMat.uniforms.uCol.value.setHex(T.sun); if (T.beams > 0) buildBeams(sky.sun);
    if (beams) beams.visible = T.beams > 0;
    apt.setNight(T.night); fill.intensity = 0.3 * (1 - T.night * 0.85);
    skyWin.color.setHex(T.area[0]); skyWin.intensity = T.area[1]; for (const l of sideWin) { l.color.setHex(T.area[0]); l.intensity = T.area[1] * 0.6; }
    deck.reflections.setStrength(T.refl);
    HUDsync();
  }

  /* ---------------- camera: presets, look, zoom ---------------- */
  const view = { pos: EYE.clone(), yaw: 0, pitch: 0, fov: 64 };
  let tween = null, viewName = 'captain', userLookT = -10, tAbs = 0;
  const dirYP = d => ({ yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(clamp(d.y / d.length(), -1, 1)) });
  function presetState(name) { const p = PRESETS[name]; const yp = dirYP(p.target.clone().sub(p.pos)); return { pos: p.pos.clone(), yaw: yp.yaw, pitch: yp.pitch, fov: p.fov }; }
  function goTo(st, dur = 1.0) { if (REDUCED) dur = 0.01; tween = { a: { pos: view.pos.clone(), yaw: view.yaw, pitch: view.pitch, fov: view.fov }, b: st, t: 0, dur }; }
  function setView(name, instant = false) { viewName = name; const st = presetState(name); if (instant) { Object.assign(view, st); view.pos = st.pos.clone(); tween = null; } else goTo(st); if (vSeg && vSeg.v !== name) vSeg.set(name); hud.setView(name); }
  function lookAtWorld(p, panel, dur = 1.0) {
    const vn = PANEL_VIEW[panel] || 'captain', base = PRESETS[vn];
    if (vn === 'overhead' || vn === 'pedestal') { const off = p.clone().sub(base.target); off.x *= 0.75; const pos = base.pos.clone().add(off.multiplyScalar(0.8)); const yp = dirYP(p.clone().sub(pos)); goTo({ pos, yaw: yp.yaw, pitch: yp.pitch, fov: Math.min(base.fov, 50) }, dur); return; }
    const pos = base.pos.clone(); const yp = dirYP(p.clone().sub(pos)); goTo({ pos, yaw: yp.yaw, pitch: yp.pitch, fov: Math.min(base.fov, 52) }, dur); }
  function applyView(dt) {
    if (tween) { tween.t += dt; const k = clamp(tween.t / tween.dur, 0, 1), e = k * k * k * (k * (k * 6 - 15) + 10); const a = tween.a, b = tween.b;
      view.pos.lerpVectors(a.pos, b.pos, e); let dy = b.yaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); view.yaw = a.yaw + dy * e; view.pitch = a.pitch + (b.pitch - a.pitch) * e; view.fov = a.fov + (b.fov - a.fov) * e; if (k >= 1) tween = null; }
    cam.position.copy(view.pos); cam.rotation.set(view.pitch, view.yaw, 0, 'YXZ'); if (Math.abs(cam.fov - view.fov) > 0.01) { cam.fov = view.fov; cam.updateProjectionMatrix(); }
  }

  /* ---------------- immersive HUD (primary UI) ---------------- */
  const hint = wrap.querySelector('.hint'); if (hint) hint.style.display = 'none';
  wrap.tabIndex = 0;
  let mode = 'guided', scn = 'full';
  let vSeg = null;
  const hud = createHUD(wrap, {
    show: () => showMe(), check: () => checkCurrent(), confirm: () => { if (flow.confirm()) audio.control('touch'); }, finish: () => flow.finish(),
    retry: () => start(scn), next: () => { const o = ['guided', 'practice', 'memory']; setMode(o[(o.indexOf(mode) + 1) % 3]); }, close: () => hud.hideDebrief(),
    sound: () => toggleSound(), dock: () => hud.toggleDock()
  });
  const root = hud.root;
  hud.views(Object.entries(PRESETS).map(([k, p]) => [k, p.label]), 'captain', v => setView(v));
  function HUDsync() { hud.setGroup('mode', mode); hud.setGroup('scn', scn); hud.setGroup('tod', tod); hud.setGroup('fast', sys.fast ? 'fast' : 'real'); }

  /* ---------------- side column: compact mirror + accessible controls ---------------- */
  const U = ui(host);
  const mSeg = U.seg('mode', 'Mode', [['guided', 'Guided'], ['practice', 'Practice'], ['memory', 'Memory']], mode);
  const sSeg = U.seg('scn', 'Scenario', Object.entries(SCENARIOS).map(([k, s]) => [k, s.title]), scn);
  vSeg = U.seg('view', 'View', Object.entries(PRESETS).map(([k, p]) => [k, p.label]), 'captain');
  const box = host.querySelector('.controls');
  const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px'; box.appendChild(row);
  const mkBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-sm'; b.style.marginRight = '0'; b.textContent = t; b.addEventListener('click', fn); row.appendChild(b); return b; };
  const resetCold = () => { if (SCENARIOS[scn].init !== 'cold') setScenario('full'); else start(scn); };
  const skipBefore = () => { if (SCENARIOS[scn].init === 'beforeStart') start(scn); else setScenario('start'); };
  mkBtn('Reset to cold & dark', resetCold); mkBtn('Skip to before start', skipBefore);
  const soundB = mkBtn('Sound on', () => toggleSound());
  const vrB = mkBtn('Enter VR', () => enterVR()); vrB.hidden = true;
  const dSeg = U.seg('tod', 'Time of day', Object.entries(TOD).map(([k, t]) => [k, t.label]), 'day');
  const tSeg = U.seg('fast', 'Timings', [['real', 'Realistic'], ['fast', 'Fast start (training)']], 'real');
  const qSeg = U.seg('q', 'Quality', Object.entries(LEVELS).map(([k, l]) => [k, l.label]), AUTO_LEVEL);
  const vrNote = document.createElement('p'); vrNote.className = 'note'; vrNote.textContent = 'VR works on Meta Quest and Vision Pro when the trainer is hosted on its own site.'; vrNote.hidden = true; box.appendChild(vrNote);
  function setMode(v) { if (mSeg.v !== v) mSeg.set(v); else { mode = v; start(scn); } }
  function setScenario(v) { if (sSeg.v !== v) sSeg.set(v); else start(v); }
  function toggleSound() { const on = audio.toggle(); soundB.textContent = on === null ? 'No sound available' : on ? 'Sound off' : 'Sound on'; hudSoundB.textContent = on ? 'Sound off' : 'Sound on'; root.querySelector('[data-a="sound"]').classList.toggle('on', !!on); }
  function enterVR() { xr.enter().catch(e => { vrNote.textContent = 'VR could not start: ' + (e.message || e); vrNote.hidden = false; }); }
  { // keep the side column compact: mode + scenario visible, the rest folded away (the immersive overlay is the primary UI)
    const det = document.createElement('details'); det.innerHTML = '<summary style="cursor:pointer;font-weight:600;font-size:14px">View, time of day, sound and settings</summary>';
    const body = document.createElement('div'); body.style.cssText = 'display:grid;gap:12px;margin-top:10px'; det.appendChild(body);
    [...box.children].slice(2).forEach(el => body.appendChild(el)); box.appendChild(det);
  }
  mSeg.on(v => { mode = v; start(scn); });
  sSeg.on(v => start(v));
  vSeg.on(v => { if (v !== viewName) setView(v); });
  dSeg.on(v => setTOD(v));
  tSeg.on(v => { sys.fast = v === 'fast'; HUDsync(); });
  qSeg.on(k => quality.set(k));
  hud.group('mode', [['guided', 'Guided'], ['practice', 'Practice'], ['memory', 'Memory']], mode, v => setMode(v));
  hud.group('scn', Object.entries(SCENARIOS).map(([k, s]) => [k, s.title]), scn, v => { setScenario(v); hud.closeMenu(); });
  hud.group('tod', Object.entries(TOD).map(([k, t]) => [k, t.label]), 'day', v => dSeg.set(v));
  hud.group('fast', [['real', 'Realistic'], ['fast', 'Fast start']], 'real', v => tSeg.set(v));
  hud.action('Reset to cold & dark', () => { resetCold(); hud.closeMenu(); }); hud.action('Skip to before start', () => { skipBefore(); hud.closeMenu(); });
  const hudSoundB = hud.action('Sound on', () => toggleSound()); const hudVR = hud.action('Enter VR', () => enterVR()); hudVR.hidden = true;
  const CL = createChecklist(host);

  /* readout */
  const out = host.querySelector('.readout');
  out.innerHTML = `<p class="ro-big" data-k="status">Cold &amp; dark</p>
    <dl class="ro" data-k="nums"></dl>
    <p class="note">Times: APU about ${REF.apuStart} s (Fast start ${REF.apuStartFast} s); IRS alignment shortened to ${REF.irsAlign} s (real ${REF.irsReal}); engine start about 50 s. All engine and system figures are approximate.</p>
    <p class="note"><b>Generic training aid.</b> Not a certified training device, and not any manufacturer's or operator's procedures. The aircraft is a fictional twin-jet; follow your operator's manuals and your instructor.</p>`;
  const N = {};
  for (const [k, l] of [['pwr', 'AC power'], ['apu', 'APU'], ['irs', 'IRS'], ['e1', 'ENG 1'], ['e2', 'ENG 2'], ['hyd', 'HYD 1/2/3'], ['bleed', 'Bleed (L/R)']]) { const d = document.createElement('div'); d.innerHTML = `<dt>${l}</dt><dd></dd>`; out.querySelector('[data-k="nums"]').appendChild(d); N[k] = d.querySelector('dd'); }
  function readout() {
    const s = sys.st, E = s.elec;
    N.pwr.textContent = E.ac ? (E.src1 === E.src2 ? E.src1 : `${E.src1 || '—'} / ${E.src2 || '—'}`) : E.dc ? 'none (batteries only)' : 'none';
    N.apu.textContent = s.apu.phase === 'OFF' ? 'off' : `${s.apu.avail ? 'AVAIL · ' : s.apu.phase === 'START' ? 'starting · ' : s.apu.phase === 'COOL' ? 'cooling · ' : ''}N ${Math.round(s.apu.n)} % · EGT ${Math.round(s.apu.egt)} °C`;
    const al = s.irs.every(r => r.aligned), anyNav = s.irs.some(r => r.mode !== 'OFF');
    N.irs.textContent = al ? 'aligned' : anyNav ? `aligning ${fmtT(sys.alignRemaining())}` : 'off';
    s.eng.forEach((e, i) => { N['e' + (i + 1)].textContent = e.n2 < 0.5 && !e.fire ? 'off' : `${e.fire ? 'FIRE · ' : e.phase === 'START' ? 'starting · ' : e.running ? 'idle · ' : ''}N1 ${e.n1.toFixed(1)} · N2 ${e.n2.toFixed(1)} · EGT ${Math.round(e.egt)}`; });
    N.hyd.textContent = s.hyd.p.map(p => Math.round(p / 50) * 50).join(' / ') + ' psi';
    N.bleed.textContent = s.bleed.duct.map(Math.round).join(' / ') + ' psi';
    const st = out.querySelector('[data-k="status"]');
    const fire = s.eng.findIndex(e => e.fire);
    let t = 'Cold & dark';
    if (fire >= 0) t = `ENG ${fire + 1} FIRE`;
    else if (s.eng.every(e => e.running)) t = 'Both engines running';
    else if (s.eng.some(e => e.phase === 'START')) t = `Engine ${s.eng.findIndex(e => e.phase === 'START') + 1} starting`;
    else if (s.eng.some(e => e.running)) t = 'One engine running';
    else if (s.apu.avail) t = 'APU running';
    else if (s.apu.phase === 'START' || s.apu.phase === 'FLAP') t = 'APU starting';
    else if (E.ac) t = 'Powered: ' + (E.src1 || E.src2);
    else if (E.dc) t = 'Batteries on';
    st.textContent = t; st.classList.toggle('warn', fire >= 0 || s.master.warn);
  }

  /* ---------------- scenario lifecycle ---------------- */
  let flow = null, debriefShown = false, lastCurId = null, frameAt = -1;
  function start(k) {
    scn = k; const sc = SCENARIOS[k];
    sys.reset(sc.init); sys.fast = tSeg.v === 'fast';
    if (sc.fire) sys.fireInject = { ...sc.fire };
    flow = createFlow(sys, k, mode); debriefShown = false; hud.hideDebrief(); lastCurId = null;
    CL.render(flow, sys); hud.render(flow, sys);
    if (sSeg.v !== k) sSeg.set(k);
    HUDsync();
  }
  const ctlName = id => (CTL[id] && CTL[id].name) || id.replace(/^d_/, '');
  const liveScore = () => { const r = flow.result(); const n = r.inOrder + r.late.length; return n ? Math.max(0, Math.round(100 * (r.inOrder + 0.5 * r.late.length) / n) - Math.min(20, r.wrong.length * 2)) : null; };
  function showDebrief() { debriefShown = true; const r = flow.result(); CL.debrief(flow, r, ctlName); hud.debrief(flow, r, ctlName); }
  CL.on('show', () => showMe());
  CL.on('confirm', () => { if (flow.confirm()) audio.control('touch'); });
  CL.on('check', () => checkCurrent());
  CL.on('finish', () => flow.finish());
  CL.on('retry', () => start(scn));
  CL.on('next', () => { const o = ['guided', 'practice', 'memory']; setMode(o[(o.indexOf(mode) + 1) % 3]); });
  function checkCurrent() { const c = flow.current(); if (!c) return; const id = c.ctl ? c.ctl[0] : 'area:' + c.area; if (flow.touch(id, c.area ? [c.area] : [])) { audio.control('touch'); haptic(8); } }

  /* ---------------- picking and operating controls ---------------- */
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  function hitToCtl(h) {
    if (!h) return null; const o = h.object;
    if (o.userData.bank) return { id: o.userData.bank.ids[h.instanceId], h };
    if (o.userData.ctl) return { id: o.userData.ctl, h };
    if (o.userData.panel) { const P = o.userData.panel; const lp = P.group.worldToLocal(h.point.clone()); const a = P.areaAt(lp); return a ? { id: 'area:' + a.id, area: a, P, h } : { id: null, P, h }; }
    return null;
  }
  function pickRay(origin, dir) { ray.set(origin, dir); ray.far = 3; for (const h of ray.intersectObjects(deck.hits, false)) { const r = hitToCtl(h); if (r) return r; } return null; }
  function pickScreen(cx, cy) { const r = R.domElement.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); cam.updateMatrixWorld(); ray.setFromCamera(ndc, cam); ray.far = 3; for (const h of ray.intersectObjects(deck.hits, false)) { const x = hitToCtl(h); if (x) return x; } return null; }
  function areasAt(p) { const C = p.id && deck.ctls[p.id]; const P = C ? C.panel : p.P; if (!P) return []; const lp = C && C.u != null ? P.local(C.u, C.v) : P.group.worldToLocal(p.h.point.clone()); const res = []; const u = lp.x + P.w / 2, v = P.h / 2 - lp.y; for (const a of P.areas) if (u >= a.u0 && u <= a.u1 && v >= a.v0 && v <= a.v1) { res.push(a.id); if (a.group) res.push(a.group); } return res; }
  function direction(id, h) {
    const C = deck.ctls[id], c = CTL[id]; if (!C || !h) return undefined;
    const P = C.panel; const lp = P.group.worldToLocal(h.point.clone());
    if (c.k === 'tog') return lp.y > P.local(C.u, C.v).y ? 1 : -1;
    if (c.k === 'rot' || (c.k === 'knob' && !c.push)) return lp.x > P.local(C.u, C.v).x ? 1 : -1;
    if (c.k === 'lever' && c.pos.length > 2) { const tl = P.group.worldToLocal(C.obj.localToWorld(V(0, 0, C.tipZ || 0.1))); const fwd = lp.y > tl.y; return id === 'flaps' ? (fwd ? -1 : 1) : (fwd ? 1 : -1); }
    return undefined;
  }
  let lastXRSource = null;
  function haptic(ms = 12, strength = 0.5) { try { if (navigator.vibrate && matchMedia('(pointer: coarse)').matches) navigator.vibrate(ms); } catch (e) { /* none */ } try { const g = lastXRSource && lastXRSource.gamepad; if (g && g.hapticActuators && g.hapticActuators[0]) g.hapticActuators[0].pulse(strength, ms * 3); } catch (e) { /* none */ } }
  const perf = () => performance.now() / 1000;
  function act(p, how) {
    if (!p || !p.id) return null;
    const id = p.id, c = CTL[id], C = deck.ctls[id];
    const areas = p.h ? areasAt(p) : (p.areas || []);
    if (flow.touch(id, areas)) { audio.control('touch'); haptic(8); flashTouch(id, p); return 'check'; }
    if (id.startsWith('area:')) return null;
    if (!c || c.k === 'deco' || c.k === 'ind') {
      if (C && C.guard) { C.guardOpen = !C.guardOpen; audio.control('guard'); haptic(); return 'guard'; }
      if (C && C.kind !== 'ind') { audio.control('pb'); deck.press(id, perf()); haptic(6); }
      return null;
    }
    const r = operate(sys, id, how !== undefined ? how : direction(id, p.h));
    if (!r.did) return null;
    audio.control(r.sound); deck.press(id, perf()); haptic(r.sound === 'lever' ? 22 : 12);
    if (r.did !== 'guard') flow.operated(id);
    return r.did;
  }
  const touchMark = new THREE.Mesh(new THREE.RingGeometry(0.006, 0.009, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 9, 4), transparent: true, opacity: 0, depthWrite: false })); S.scene.add(touchMark);
  let touchT = 0;
  function flashTouch(id, p) { const w = id.startsWith('area:') ? null : deck.ctlWorld(id); const pos = w ? w.pos : p.h ? p.h.point : null; if (!pos) return; const n = w ? w.nrm : p.h.face ? p.h.face.normal.clone().transformDirection(p.h.object.matrixWorld) : V(0, 0, 1); touchMark.position.copy(pos); touchMark.lookAt(pos.clone().add(n)); touchMark.position.addScaledVector(n, 0.012); touchT = 0.6; }

  /* pointer: drag to look, tap to operate, pinch / wheel to zoom */
  const cvs = R.domElement; const pts = new Map(); let down = null, pinch = null, hoverT = 0;
  cvs.style.touchAction = 'none';
  cvs.addEventListener('pointerdown', e => { wrap.focus({ preventScroll: true }); hud.closeMenu(); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); cvs.setPointerCapture(e.pointerId);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), fov: view.fov }; down = null; }
    else { down = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch, moved: false, id: e.pointerId, t0: performance.now(), mod: e.shiftKey || e.altKey || e.button === 2 };
      const pk = pickScreen(e.clientX, e.clientY); if (pk && pk.id && CTL[pk.id] && CTL[pk.id].k === 'knob') { down.knob = pk; down.steps = 0; } }
    hud.tip.style.display = 'none'; });
  cvs.addEventListener('contextmenu', e => e.preventDefault());
  cvs.addEventListener('pointermove', e => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; view.fov = clamp(pinch.fov * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 24, 78); tween = null; userLookT = tAbs; return; }
    if (down && down.id === e.pointerId && down.knob) { // drag on a knob turns it: up or right = clockwise, one detent per 14 px
      const n = Math.trunc(((e.clientX - down.x) - (e.clientY - down.y)) / 14); if (n !== down.steps) { act(down.knob, n - down.steps); down.steps = n; down.moved = true; } return; }
    if (down && down.id === e.pointerId) { const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 6) down.moved = true; if (down.moved) { const k = view.fov / 64 * 0.0055; view.yaw = clamp(down.yaw + dx * k, -2.1, 2.1); view.pitch = clamp(down.pitch + dy * k, -1.25, 1.35); tween = null; userLookT = tAbs; } return; }
    if (e.pointerType !== 'mouse' || performance.now() - hoverT < 60) return; hoverT = performance.now();
    const p = pickScreen(e.clientX, e.clientY); const r = wrap.getBoundingClientRect(); const tip = hud.tip;
    if (p && p.id) { const id = p.id; let t;
      if (id.startsWith('area:')) t = p.area.title ? `${p.area.title} panel` : '';
      else { const c = CTL[id]; const vt = c ? valueText(sys, id) : ''; t = c ? `<b>${c.name}</b>${vt ? ' · ' + vt : ''}${c.k === 'tog' ? '<br><small>Click the upper or lower half to move it</small>' : c.k === 'rot' ? '<br><small>Click the left or right side to turn it</small>' : c.k === 'lever' && c.pos.length > 2 ? '<br><small>Click the front or back half to move it</small>' : c.k === 'gpb' ? '<br><small>First click lifts the guard</small>' : c.k === 'knob' ? (c.push ? `<br><small>Drag or scroll to turn · click to push: ${c.pull ? c.push : ''} · Shift+click or long-press to pull: ${c.pull}</small>` : '<br><small>Drag or scroll to turn, or click the left or right side</small>') : c.k === 'stick' ? '<br><small>Click to step through neutral, full aft, full forward, full left, full right</small>' : ''}` : 'Not modelled in this trainer'; }
      if (t) { tip.innerHTML = t; tip.style.display = 'block'; tip.style.transform = `translate(${Math.min(e.clientX - r.left + 14, r.width - 270)}px,${Math.min(e.clientY - r.top + 16, r.height - 60)}px)`; cvs.style.cursor = id.startsWith('area:') ? 'grab' : 'pointer'; } else tip.style.display = 'none';
    } else { tip.style.display = 'none'; cvs.style.cursor = 'grab'; }
  });
  const up = e => { const d = down; pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!d || d.id !== e.pointerId) return; down = null; if (d.moved) return;
    if (d.knob && CTL[d.knob.id].push) { act(d.knob, d.mod || e.shiftKey || e.altKey || performance.now() - d.t0 > 450 ? 'pull' : 'push'); return; }
    act(pickScreen(e.clientX, e.clientY)); };
  cvs.addEventListener('pointerup', up); cvs.addEventListener('pointercancel', e => { pts.delete(e.pointerId); down = null; pinch = null; });
  cvs.addEventListener('pointerleave', () => { hud.tip.style.display = 'none'; });
  let wheelAcc = 0;
  cvs.addEventListener('wheel', e => { if (document.activeElement !== wrap && !e.ctrlKey) return; e.preventDefault();
    if (!e.ctrlKey) { const pk = pickScreen(e.clientX, e.clientY); if (pk && pk.id && CTL[pk.id] && CTL[pk.id].k === 'knob') { wheelAcc -= e.deltaY * (e.deltaMode === 1 ? 40 : 1); const n = Math.trunc(wheelAcc / 100); /* one detent per wheel notch; trackpads accumulate */ if (n) { wheelAcc = 0; act(pk, n * (e.shiftKey ? 10 : 1)); } return; } }
    view.fov = clamp(view.fov * (1 + Math.sign(e.deltaY) * 0.08), 24, 78); tween = null; }, { passive: false });
  wrap.addEventListener('keydown', e => {
    if (e.target !== wrap) return; const k = e.key, st = 0.06;
    if (k === 'ArrowLeft') view.yaw += st; else if (k === 'ArrowRight') view.yaw -= st; else if (k === 'ArrowUp') view.pitch = Math.min(1.35, view.pitch + st); else if (k === 'ArrowDown') view.pitch = Math.max(-1.25, view.pitch - st);
    else if (k === '+' || k === '=') view.fov = Math.max(24, view.fov - 4); else if (k === '-') view.fov = Math.min(78, view.fov + 4);
    else if ('1234'.includes(k)) setView(Object.keys(PRESETS)[+k - 1]); else return;
    e.preventDefault(); tween = null; userLookT = tAbs;
  });

  /* ---------------- spatial guidance: halo, leader-line callout, focus, edge arrow ---------------- */
  const hlTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.strokeStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 12; x.lineWidth = 6; x.beginPath(); x.roundRect(14, 14, 100, 100, 26); x.stroke(); x.shadowBlur = 0; x.lineWidth = 2; x.globalAlpha = 0.5; x.beginPath(); x.roundRect(6, 6, 116, 116, 32); x.stroke(); return new THREE.CanvasTexture(c); })();
  const hlMat = new THREE.MeshBasicMaterial({ map: hlTex, color: new THREE.Color(6, 1.3, 4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
  const hls = []; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), hlMat); m.visible = false; m.renderOrder = 5; S.scene.add(m); hls.push(m); }
  function ctlDone(step, id) { if (step.want && id in step.want) return sys.sw[CTL[id].sw] === step.want[id]; if (step.id === 'fireTest') return sys.st.testsDone[{ test1: 'eng1', testApu: 'apu', test2: 'eng2' }[id]]; return false; }
  function targets() {
    const c = flow && flow.current(); if (!c) return [];
    const res = [];
    if (c.guide && !c.touch) { const g = c.guide(sys); if (g.ctl) { const w = deck.ctlWorld(g.ctl); if (w) res.push({ ...w, id: g.ctl, w: w.size * 2.2, h: w.size * 2.2 }); } else if (g.area) { const a = deck.areaWorld(g.area); if (a) res.push({ pos: a.pos, nrm: a.nrm, quat: a.quat, w: a.w + 0.006, h: a.h + 0.006, panel: a.panel, area: a.a }); } return res; }
    if (c.ctl) { const ids = c.any ? [c.ctl[0]] : c.kind === 'set' && !c.touch ? c.ctl.filter(id => !ctlDone(c, id)) : c.ctl; for (const id of (ids.length ? ids : c.ctl)) { const w = deck.ctlWorld(id); if (w) res.push({ ...w, id, w: w.size * 1.75, h: w.size * 1.75 }); if (c.ctl.length > 1 && c.kind !== 'set' && res.length) break; } }
    else if (c.area) { const a = deck.areaWorld(c.area); if (a) res.push({ pos: a.pos, nrm: a.nrm, quat: a.quat, w: a.w + 0.01, h: a.h + 0.01, panel: a.panel, area: a.a }); }
    else if (c.look) { const w = deck.ctlWorld(c.look); if (w) res.push({ ...w, id: c.look, w: w.size * 1.25, h: w.size * 1.25 }); }
    return res;
  }
  let tg = [];
  function showMe(dur = 1.0) { if (!tg.length) tg = targets(); if (tg[0]) { const c = tg.reduce((a, t) => a.add(t.pos), V(0, 0, 0)).multiplyScalar(1 / tg.length); lookAtWorld(c, tg[0].panel, dur); } }
  const tmpV = new THREE.Vector3();
  const actionText = c => c.guide && !c.touch ? (c.guide(sys).area ? 'Type the entry' : 'Press') : c.kind === 'check' || c.touch ? 'Touch to check' : c.kind === 'wait' ? 'Monitor' : c.kind === 'confirm' ? 'Press Done' : (c.t.split('—')[1] || '').replace(/\(.*\)/, '').trim() || 'Operate';
  let focusDim = 0;
  function updateGuidance(t, dt) {
    const guided = mode === 'guided' && flow && !flow.finished;
    tg = guided ? targets() : [];
    hls.forEach((m, i) => { const T = tg[i]; m.visible = !!T; if (!T) return; m.position.copy(T.pos).addScaledVector(T.nrm, 0.004); if (T.quat) m.quaternion.copy(T.quat); else m.lookAt(tmpV.copy(T.pos).add(T.nrm)); const pul = 1 + 0.07 * Math.sin(t * 5); m.scale.set(T.w * pul, T.h * pul, 1); });
    hlMat.opacity = 0.7 + 0.3 * Math.sin(t * 5);
    const c = guided ? flow.current() : null;
    if (c && c.id !== lastCurId) { lastCurId = c.id; frameAt = flow.cur > 0 ? t + 0.5 : -1; }
    if (c && frameAt > 0 && t >= frameAt) { frameAt = -1; if (tg[0] && t - userLookT > 1.2) { const pr = tg[0].pos.clone().project(cam), cv = tg[0].pos.clone().applyMatrix4(cam.matrixWorldInverse); if (cv.z > 0 || Math.abs(pr.x) > 0.6 || Math.abs(pr.y) > 0.6) showMe(1.1); } }
    const W = wrap.clientWidth, H = wrap.clientHeight; let shown = false;
    if (guided && tg[0]) {
      let sx = 0, sy = 0, rad = 0, behind = false;
      for (const T of tg) { const pr = T.pos.clone().project(cam), cv = T.pos.clone().applyMatrix4(cam.matrixWorldInverse); if (cv.z > 0) behind = true; sx += (pr.x * 0.5 + 0.5) * W; sy += (-pr.y * 0.5 + 0.5) * H; }
      sx /= tg.length; sy /= tg.length; for (const T of tg) { const pr = T.pos.clone().project(cam); rad = Math.max(rad, Math.hypot((pr.x * 0.5 + 0.5) * W - sx, (-pr.y * 0.5 + 0.5) * H - sy)); }
      const sz = tg[0].pos.clone().add(V(0, Math.max(tg[0].w, tg[0].h) * 0.6, 0)).project(cam); rad = Math.max(rad + 18, Math.abs((-sz.y * 0.5 + 0.5) * H - (-tg[0].pos.clone().project(cam).y * 0.5 + 0.5) * H) + 10, 24);
      const off = behind || sx < 8 || sx > W - 8 || sy < 8 || sy > H - 8;
      if (!off && !tween) {
        shown = true;
        finish.uniforms.uFocus.value.set(sx / W, 1 - sy / H, Math.min(0.3, (rad + 26) / H));
        const C = hud.call; const name = tg[0].area ? (/keypad$/.test(tg[0].area.title) ? tg[0].area.title : `${tg[0].area.title} panel`) : (CTL[tg[0].id] && CTL[tg[0].id].name) || ({ ewd: 'ENGINE & WARNING display', sd: 'SYSTEMS display' })[tg[0].id] || 'Control';
        C.querySelector('.t').textContent = tg.length > 1 && !tg[0].area ? `${name} +${tg.length - 1}` : name; C.querySelector('.a').textContent = actionText(c);
        C.style.display = 'block'; const cw = C.offsetWidth, ch = C.offsetHeight;
        const dir = sx > W * 0.55 ? -1 : 1; let cx = sx + dir * (rad + 60) - (dir < 0 ? cw : 0), cy = sy - rad - 40 - ch / 2;
        if (cy < 64) cy = sy + rad + 30; cx = clamp(cx, 10, W - cw - 10); cy = clamp(cy, 64, H - ch - 130);
        C.style.transform = `translate(${cx}px,${cy}px)`;
        const ax = dir > 0 ? cx : cx + cw, ay = cy + ch / 2; const ang = Math.atan2(ay - sy, ax - sx); const ex = sx + Math.cos(ang) * rad * 0.85, ey = sy + Math.sin(ang) * rad * 0.85;
        const L = hud.lead; L.style.display = ''; L.querySelectorAll('line').forEach(l => { l.setAttribute('x1', ex); l.setAttribute('y1', ey); l.setAttribute('x2', ax); l.setAttribute('y2', ay); }); const cs = L.querySelectorAll('circle'); cs[0].setAttribute('cx', ax); cs[0].setAttribute('cy', ay); cs[1].setAttribute('cx', ex); cs[1].setAttribute('cy', ey);
        hud.edge.style.display = 'none';
      } else if (!tween) {
        const cv = tg[0].pos.clone().applyMatrix4(cam.matrixWorldInverse); const ang = Math.atan2(cv.y, cv.x);
        const dirTxt = Math.abs(cv.y) > Math.abs(cv.x) ? (cv.y > 0 ? 'Look up' : 'Look down') : (cv.x > 0 ? 'Look right' : 'Look left');
        const E = hud.edge; E.querySelector('span').textContent = `${dirTxt} · ${PANEL_NAME[tg[0].panel] || 'flight deck'}`; E.querySelector('b').style.transform = `rotate(${-ang}rad)`; E.style.display = 'flex';
        const ew = E.offsetWidth, eh = E.offsetHeight; const ax = W / 2 + Math.cos(ang) * (W / 2 - ew / 2 - 14), ay = H / 2 - Math.sin(ang) * (H / 2 - eh / 2 - 60);
        E.style.transform = `translate(${clamp(ax - ew / 2, 10, W - ew - 10)}px,${clamp(ay - eh / 2, 60, H - eh - 140)}px)`;
      }
    } else hud.edge.style.display = 'none';
    if (!shown) { hud.call.style.display = 'none'; hud.lead.style.display = 'none'; }
    focusDim += ((shown ? 0.45 : 0) - focusDim) * Math.min(1, dt * 3);
    finish.uniforms.uDim.value = focusDim;
  }

  /* ---------------- XR ---------------- */
  const rig = new THREE.Group(); rig.position.copy(EYE); S.scene.add(rig);
  const xr = createXR(S, rig, (dt) => frame(dt, true), on => { vrB.textContent = hudVR.textContent = on ? 'Exit VR' : 'Enter VR'; });
  [0, 1].forEach(i => { const c = R.xr.getController(i); rig.add(c); const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xff8fd0 })); line.scale.z = 1.2; c.add(line);
    c.addEventListener('connected', e => { c.userData.src = e.data; }); c.addEventListener('select', () => { lastXRSource = c.userData.src; const o = c.getWorldPosition(V(0, 0, 0)), d = V(0, 0, -1).applyQuaternion(c.getWorldQuaternion(new THREE.Quaternion())); act(pickRay(o, d)); }); });
  xrSupported().then(ok => { vrB.hidden = hudVR.hidden = !ok; vrNote.hidden = ok; });

  /* ---------------- main loop ---------------- */
  let roT = 0, clT = 0, warnWas = false;
  function frame(dt, fromXR = false) {
    tAbs += dt;
    sys.update(dt);
    flow.update();
    for (const e of sys.events) { audio.event(e); if (e.type === 'warn') haptic(60, 0.9); }
    sys.events.length = 0;
    if (sys.st.master.warn && !warnWas) { try { if (navigator.vibrate && matchMedia('(pointer: coarse)').matches) navigator.vibrate([90, 60, 90]); } catch (e) { /* none */ } }
    warnWas = sys.st.master.warn;
    deck.update(sys, dt, tAbs); apt.update(sys, dt); audio.update(sys, dt);
    const E = sys.st.elec;
    const integ = E.dc ? todK.integ : 0; deck.setIntegral(integ, integ * [0, 0.55, 1][sys.sw.intLtOvhd]);
    dome.intensity = E.dc ? [0, 0.7, 1.8][sys.sw.dome] + todK.night * 0.5 : 0; floodL.intensity = E.dc ? todK.night * 2.2 : 0;
    deck.flood.material.emissiveIntensity = E.dc ? 0.3 + todK.night : 0;
    if (!fromXR) applyView(dt);
    updateGuidance(tAbs, dt);
    finish.uniforms.uTime.value = tAbs;
    if (touchT > 0) { touchT -= dt; touchMark.material.opacity = Math.max(0, touchT / 0.6); touchMark.scale.setScalar(1 + (0.6 - touchT) * 2); }
    roT += dt; clT += dt;
    if (clT > 0.2) {
      clT = 0; CL.render(flow, sys); hud.render(flow, sys, { score: liveScore() });
      const w = sys.st.alerts.find(a => a.lvl === 'W'), cu = sys.st.alerts.find(a => a.lvl === 'C');
      hud.alert(w ? `⚠ ${w.title}` : cu ? cu.title : '', w ? 'W' : 'C');
    }
    if (roT > 0.3) { roT = 0; readout(); }
    if (flow.finished && !debriefShown) showDebrief();
  }
  S.tick(dt => { if (R.xr.isPresenting) return; frame(dt, false); });

  /* ---------------- hero capture mode (supersampled, full-viewport) ---------------- */
  let heroPR = 0; const pr0 = R.setPixelRatio.bind(R), cpr0 = S.composer.setPixelRatio.bind(S.composer);
  R.setPixelRatio = v => pr0(heroPR || v); S.composer.setPixelRatio = v => cpr0(heroPR || v);
  function hero(on, pr = 2) {
    root.classList.toggle('hero', !!on);
    if (on) { wrap.dataset.css = wrap.style.cssText; wrap.style.cssText += ';position:fixed;inset:0;width:100vw;height:100vh;max-width:none;aspect-ratio:auto;border-radius:0;z-index:9999'; quality.set('ultra'); heroPR = pr; finish.uniforms.uGrain.value = 0.022; }
    else { wrap.style.cssText = wrap.dataset.css || ''; heroPR = 0; quality.set(qSeg.v); finish.uniforms.uGrain.value = 0.035; }
    window.dispatchEvent(new Event('resize'));
  }

  /* ---------------- test hooks ---------------- */
  host.__jet = {
    sys, deck, S, CTL, hud, get flow() { return flow; }, get mode() { return mode; }, get view() { return viewName; }, get tod() { return tod; },
    act(id, how) { return act({ id }, how); },
    touch(area) { return act({ id: 'area:' + area, areas: [area] }); },
    confirm() { return flow.confirm(); },
    advance(sec) { const n = Math.round(sec / (1 / 30)); for (let i = 0; i < n; i++) { sys.update(1 / 30); flow.update(); } sys.events.length = 0; },
    setMode, setScenario, setTOD: k => dSeg.set(k), setView(v, instant) { setView(v, instant); },
    lookAt(id, fov = 46) { const w = deck.ctlWorld(id); if (w) { const st = { pos: PRESETS[PANEL_VIEW[w.panel] || 'captain'].pos.clone(), fov }; Object.assign(st, dirYP(w.pos.clone().sub(st.pos))); Object.assign(view, st); tween = null; userLookT = tAbs; } },
    pose(p) { if (p.pos) view.pos = p.pos.clone ? p.pos.clone() : V(...p.pos); if (p.fov) view.fov = p.fov; if (p.yaw != null) view.yaw = p.yaw; if (p.pitch != null) view.pitch = p.pitch; if (p.target) Object.assign(view, dirYP(V(...p.target).sub(view.pos))); tween = null; userLookT = tAbs; touchT = 0; touchMark.material.opacity = 0; },
    hero, showMe: () => showMe(0.01), dock: o => hud.toggleDock(o), result() { return flow.result(); }, quality, audio,
    /** type a string on flight computer n (1 or 2): letters, digits, / . - and space */
    type(n, text) { for (const ch of String(text)) act({ id: fmsId(n, ch === ' ' ? 'SP' : ch) }); },
    /** knob: op 'turn' (n detents), 'push', 'pull' or 'set' (value) */
    knob(id, op, n) { return act({ id }, op === 'turn' ? n : op === 'set' ? { to: n } : op); },
    __drawSD: drawSD,
    /** compact copy of the avionics and switch state for tests */
    state() { const s = sys.st; return JSON.parse(JSON.stringify({ av: s.av, sdPage: s.sdPage, sw: sys.sw, press: s.press, cond: s.cond, doors: s.doors, brakes: s.brakes, fctl: s.fctl, eng: s.eng.map(e => ({ phase: e.phase, n2: e.n2, sv: e.sv, fuelOn: e.fuelOn, lit: e.lit, running: e.running, man: e.man, fire: e.fire, fault: e.fault })) })); }
  };
  start(scn); setView('captain', true); setTOD('day');
  quality.set(AUTO_LEVEL);
  if (wrap.clientWidth < 760) hud.toggleDock(false);
}

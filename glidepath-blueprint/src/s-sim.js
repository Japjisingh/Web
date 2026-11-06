/* C172-class flight simulator prototype: 6-DOF flight model, 3D cockpit with every control, chase and tower views. */
import { createStage, addSky, ui, hiDPI, THREE, D2R, clamp, pad3, fmt, REDUCED, MONO } from './core.js';
import { createAircraft, createControls, step, setGround, setFlight, trimFor, stallAlpha, KT, FT, FLAPS } from './sim/fdm.js';
import { buildWorld, groundHeight, RWY } from './sim/world.js';
import { buildExterior, buildCockpit } from './sim/model.js';
import { createClouds } from './sim/clouds.js';
import { createWeather, COVER, TOD, PRESETS } from './sim/weather.js';
import { createSound } from './sim/sound.js';
import { xrSupported, createXR } from './sim/xr.js';
import { createQuality, LEVELS, AUTO_LEVEL } from './sim/quality.js'; // model-quality worker

const LOW = (navigator.hardwareConcurrency || 8) <= 4 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
// time-of-day looks
const LOOK = {
  dawn: { sunCol: [1.0, 0.72, 0.5], sunI: 1.5, hs: 0xffc9a8, hg: 0x2a2a30, hi: 0.35, exp: 0.85, bt: 3.4, bs: 0.5, fog: 0xd6b9a6, night: 0.55, env: 0.35, amb: [0.5, 0.42, 0.44] },
  day: { sunCol: [1.0, 0.96, 0.9], sunI: 2.6, hs: 0xbfd8ff, hg: 0x3a4a3a, hi: 0.5, exp: 0.6, bt: 10, bs: 0.55, fog: 0xbfd0de, night: 0, env: 0.4, amb: [0.55, 0.63, 0.74] },
  dusk: { sunCol: [1.0, 0.58, 0.36], sunI: 1.15, hs: 0xffb98a, hg: 0x1e1e26, hi: 0.3, exp: 1.0, bt: 2.8, bs: 0.5, fog: 0xc59b86, night: 0.72, env: 0.3, amb: [0.42, 0.33, 0.36] },
  night: { sunCol: [0.55, 0.65, 1.0], sunI: 0.16, hs: 0x24365a, hg: 0x07080b, hi: 0.14, exp: 1.6, bt: 2.2, bs: 0.45, fog: 0x0b1018, night: 1, env: 0.22, amb: [0.035, 0.045, 0.07] }
};

const VSPEEDS = 'Vr 55 · Vx 62 · Vy 74 · best glide 68 · Vfe 110 (10°) / 85 (10–30°) · Vno 129 · Vne 163 KIAS';

export default function (host) {
  const S = createStage(host, { cam: [-14, 5, 600], target: [0, 1.5, 560], fov: 60, near: 0.02, far: 60000, minDist: 5, maxDist: 80, maxPolar: Math.PI * 0.94, shadows: true, bloom: { strength: 0.55, radius: 0.3, threshold: 10 } });
  const wrap = S.wrap;
  const sky = addSky(S, { elevation: 36, azimuth: 140, turbidity: 5, rayleigh: 1.4, scale: 30000, exposure: 0.6, envIntensity: 0.4, shadow: { extent: 9, size: 2048 } });
  sky.light.shadow.camera.far = 300;
  S.scene.fog = new THREE.Fog(0xbfd0de, 3000, 26000);
  const W = buildWorld(S);
  const ground = groundHeight;
  // CLOUDS-BEGIN: volumetric cloud layer (quality follows host.__quality / 'sim-quality' events)
  const clouds = createClouds(S, { low: LOW || REDUCED, host });
  // CLOUDS-END
  const wx = createWeather(); wx.apply({ dir: 300, spd: 6, gust: 0, turb: 0, vis: 20000, cover: 'SCT', base: 3500, tod: 'day' });
  const snd = createSound();
  const envScene = new THREE.Scene(); const sky2 = sky.sky.clone(); sky2.material = sky.sky.material; envScene.add(sky2);

  // aircraft
  const ext = buildExterior(); S.scene.add(ext.root);
  const ck = buildCockpit(S.renderer); ext.root.add(ck.group);
  const s = createAircraft(), c = createControls();
  s.hdgBug = 0; c.panelLt = 1; c.flood = 0;
  [sky.sky, W.stars, ...W.glows.map(g => g.p), ...ext.glows, ...ck.glass].forEach(o => clouds.noDepth(o));
  const xrRig = new THREE.Group(); xrRig.position.copy(ck.eye); ext.root.add(xrRig);
  // render quality (model-quality worker): tighter shadow box around the aircraft; presets drive pixel ratio, shadows, AO, cloud hint
  Object.assign(sky.light.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 }); sky.light.shadow.camera.updateProjectionMatrix();
  const quality = createQuality(S, host, sky.light);

  /* ---------- view handling ---------- */
  let view = 'cockpit', lookYaw = 0, lookPitch = -20 * D2R;
  const origUpdate = S.controls.update.bind(S.controls);
  S.controls.update = () => (view === 'chase' ? origUpdate() : false);
  const lastPos = new THREE.Vector3();
  function setView(v) {
    view = v;
    const cam = S.camera;
    ck.group.visible = v !== 'tower';
    ext.cabinMeshes.forEach(m => { m.visible = v !== 'cockpit'; });
    if (v === 'cockpit') { ext.root.add(cam); cam.position.copy(ck.eye); cam.near = 0.02; cam.fov = 62; S.controls.enabled = false; }
    else {
      S.scene.add(cam); S.controls.enabled = v === 'chase';
      if (v === 'chase') { const back = new THREE.Vector3(0, 0, 1).applyQuaternion(s.q); back.y = 0; back.normalize(); cam.position.copy(s.pos).addScaledVector(back, 15).add(new THREE.Vector3(0, 4.5, 0)); S.controls.target.copy(s.pos); cam.near = 0.2; cam.fov = 55; }
      else { cam.position.copy(W.towerPos); cam.near = 1; }
    }
    cam.updateProjectionMatrix(); lastPos.copy(s.pos);
  }

  /* ---------- overlays in the stage ---------- */
  const ov = (css) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;z-index:3;pointer-events:none;font:600 12px/1.3 ' + MONO + ';color:#eef3f5;' + css; wrap.appendChild(d); return d; };
  const focusTip = ov('left:50%;top:10px;transform:translateX(-50%);background:rgba(6,16,22,.72);padding:6px 10px;border-radius:6px;white-space:nowrap;max-width:94%;overflow:hidden;text-overflow:ellipsis');
  const warnBox = ov('right:10px;top:10px;padding:6px 10px;border-radius:6px;font-size:13px;display:none');
  const tip = ov('left:0;top:0;background:rgba(6,16,22,.85);padding:4px 7px;border-radius:4px;display:none;white-space:nowrap');
  const center = ov('left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(6,16,22,.82);padding:14px 18px;border-radius:8px;font-size:14px;text-align:center;display:none;max-width:80%;white-space:normal');
  wrap.tabIndex = 0; wrap.setAttribute('aria-label', 'Flight simulator. Click to take control with the keyboard.');
  const hint = wrap.querySelector('.hint'); if (hint) hint.textContent = 'Cockpit: drag to look round, click any control · Chase: drag to orbit';
  function focusText() { focusTip.textContent = document.activeElement === wrap ? 'Keyboard active · W/S pitch · A/D roll · Z/X rudder · +/− power' : 'Click the sim to take control'; }
  wrap.addEventListener('focus', focusText); wrap.addEventListener('blur', () => { keys.clear(); focusText(); }); focusText();

  /* ---------- side panel: controls ---------- */
  const U = ui(host);
  const vSeg = U.seg('view', 'View', [['cockpit', 'Cockpit'], ['chase', 'Chase'], ['tower', 'Tower']], 'cockpit'); vSeg.on(setView);
  const sSeg = U.seg('scn', 'Scenario', [['to', 'Take-off'], ['dw', 'Downwind'], ['fin', 'Final approach'], ['efato', 'Engine failure after take-off'], ['stall', 'Stall practice']], 'to'); sSeg.on(k => start(k));
  const box = host.querySelector('.controls');
  const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px'; box.appendChild(row);
  const mkBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-sm'; b.textContent = t; b.addEventListener('click', fn); row.appendChild(b); return b; };
  mkBtn('Restart', () => start(scn)); const pauseB = mkBtn('Pause', () => { paused = !paused; pauseB.textContent = paused ? 'Resume' : 'Pause'; }); const soundB = mkBtn('Sound on', () => { const on = snd.toggle(); soundB.textContent = on === null ? 'No sound available' : on ? 'Sound off' : 'Sound on'; });
  const vrB = mkBtn('Enter VR', () => xr.enter().catch(e => { vrNote.textContent = 'VR could not start: ' + (e.message || e); vrNote.hidden = false; })); vrB.hidden = true;
  const vrNote = document.createElement('p'); vrNote.className = 'note'; vrNote.textContent = 'VR works on Meta Quest and Vision Pro when the app is hosted on its own site.'; vrNote.hidden = true;
  // virtual yoke + throttle for touch
  const fly = document.createElement('div'); fly.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center'; box.appendChild(fly);
  const padWrap = document.createElement('div'); padWrap.style.cssText = 'display:grid;gap:4px;justify-items:center';
  const pad = document.createElement('canvas'); pad.style.cssText = 'width:132px;height:132px;touch-action:none;border-radius:10px;cursor:grab;display:block'; pad.setAttribute('aria-label', 'Virtual yoke: drag up to push, down to pull, sideways to roll'); pad.tabIndex = -1;
  const padL = document.createElement('span'); padL.className = 'ctl-l'; padL.textContent = 'Yoke (drag)'; padL.style.fontSize = '13px';
  padWrap.append(pad, padL); fly.appendChild(padWrap);
  const sliders = document.createElement('div'); sliders.style.cssText = 'display:grid;gap:10px;min-width:0'; fly.appendChild(sliders);
  const moveTo = el => { sliders.appendChild(box.lastElementChild === el ? el : el); };
  const thrS = U.slider('thr', 'Throttle', 0, 100, 0, 1, v => v + '%'); moveTo(box.lastElementChild); thrS.on(v => { c.throttle = v / 100; });
  const rudS = U.slider('rud', 'Rudder (springs back)', -100, 100, 0, 1, v => v === 0 ? 'centre' : (v < 0 ? 'left ' : 'right ') + Math.abs(v) + '%'); const rudEl = box.lastElementChild; moveTo(rudEl); rudS.on(v => { uiYaw = v / 100; });
  const rudIn = rudEl.querySelector('input'); const recentre = () => { uiYaw = 0; rudS.v = 0; }; rudIn.addEventListener('pointerup', recentre); rudIn.addEventListener('change', recentre); rudIn.addEventListener('touchend', recentre);
  const trimS = U.slider('trim', 'Elevator trim', -100, 100, -24, 1, v => v === 0 ? 'neutral' : (v < 0 ? 'nose up ' : 'nose down ') + Math.abs(v) + '%'); moveTo(box.lastElementChild); trimS.on(v => { c.trim = v / 100 * 0.25; });
  const flapSeg = U.seg('flaps', 'Flaps', [[0, '0°'], [1, '10°'], [2, '20°'], [3, '30°']], 0); flapSeg.on(v => { c.flap = +v; });
  const row2 = document.createElement('div'); row2.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px'; box.appendChild(row2);
  const brakeB = document.createElement('button'); brakeB.type = 'button'; brakeB.className = 'btn-sm'; brakeB.textContent = 'Hold for brakes'; brakeB.style.touchAction = 'none'; row2.appendChild(brakeB);
  brakeB.addEventListener('pointerdown', e => { uiBrake = 1; brakeB.setPointerCapture(e.pointerId); }); const relB = () => { uiBrake = 0; }; brakeB.addEventListener('pointerup', relB); brakeB.addEventListener('pointercancel', relB);
  const parkB = document.createElement('button'); parkB.type = 'button'; parkB.className = 'btn-sm'; row2.appendChild(parkB); parkB.addEventListener('click', () => { c.park = !c.park; });
  const det = document.createElement('details'); det.innerHTML = `<summary style="cursor:pointer;font-weight:600;font-size:14px">Keyboard and joystick controls</summary>
    <ul style="margin:8px 0 0;padding-left:18px;font-size:13.5px;display:grid;gap:3px;color:var(--muted)">
    <li><b>W / S</b> or <b>↑ / ↓</b>: push / pull (nose down / up)</li><li><b>A / D</b> or <b>← / →</b>: roll left / right</li><li><b>Z / X</b>: rudder left / right</li>
    <li><b>+ / −</b> or <b>Page Up / Down</b>: throttle</li><li><b>F / V</b>: flaps up / down one stage</li><li><b>[ / ]</b>: trim nose down / nose up</li>
    <li><b>B</b> (hold): brakes · <b>P</b>: parking brake · <b>M</b>: mixture rich / cut-off · <b>C</b>: carb heat</li>
    <li><b>L</b>: landing light · <b>T</b>: taxi light · <b>K</b>: panel lights · <b>J</b>: flood light (off, white, red)</li>
    <li>USB yoke, joystick or gamepad: move a control to activate it. Axis 1 roll, axis 2 pitch, then throttle and rudder if your device has them.</li></ul>`;
  box.appendChild(det);
  box.appendChild(vrNote);
  const qSeg = U.seg('q', 'Quality', Object.entries(LEVELS).map(([k, l]) => [k, l.label]), AUTO_LEVEL); qSeg.on(k => quality.set(k));
  const yokeB = mkBtn('Hide yokes', () => { ck.setYokes(!ck.yokesVisible); yokeB.textContent = ck.yokesVisible ? 'Hide yokes' : 'Show yokes'; });
  const wdet = document.createElement('details'); wdet.open = true; wdet.innerHTML = '<summary style="cursor:pointer;font-weight:600;font-size:14px">Weather and time</summary>';
  const wbody = document.createElement('div'); wbody.style.cssText = 'display:grid;gap:10px;margin-top:10px'; wdet.appendChild(wbody); box.appendChild(wdet);
  const into = () => { const el = box.lastElementChild; if (el !== wdet) wbody.appendChild(el); };
  const preSeg = U.seg('pre', 'Preset', Object.entries(PRESETS).map(([k, p]) => [k, p.label]), ''); into();
  const todSeg = U.seg('tod', 'Time of day', Object.entries(TOD).map(([k, t]) => [k, t.label]), wx.tod); into();
  const cloudSeg = U.seg('cl', 'Clouds (METAR cover)', ['SKC', 'FEW', 'SCT', 'BKN', 'OVC'].map(k => [k, k]), wx.cover); into();
  const baseS = U.slider('base', 'Cloud base', 1000, 8000, wx.base, 100, v => fmt(v) + ' ft'); into();
  const dirS = U.slider('wdir', 'Wind from', 0, 350, wx.dir, 10, v => pad3(v) + '°'); into();
  const spdS = U.slider('wspd', 'Wind speed', 0, 35, wx.spd, 1, v => v + ' kt'); into();
  const gustS = U.slider('gust', 'Gusts (above wind speed)', 0, 20, wx.gust, 1, v => v ? '+' + v + ' kt' : 'none'); into();
  const turbSeg = U.seg('turb', 'Turbulence', [[0, 'None'], [1, 'Light'], [2, 'Moderate']], wx.turb); into();
  const visS = U.slider('vis', 'Visibility', 0.8, 20, wx.vis / 1000, 0.1, v => v >= 10 ? v.toFixed(0) + ' km (10 km or more)' : v < 5 ? Math.round(v * 1000) + ' m' : v.toFixed(1) + ' km'); into();
  todSeg.on(v => { wx.tod = v; envDirty = true; }); cloudSeg.on(v => { wx.cover = v; envDirty = true; }); baseS.on(v => { wx.base = v; envDirty = true; });
  dirS.on(v => { wx.dir = v; }); spdS.on(v => { wx.spd = v; }); gustS.on(v => { wx.gust = v; }); turbSeg.on(v => { wx.turb = +v; }); visS.on(v => { wx.vis = v * 1000; envDirty = true; });
  preSeg.on(k => { if (!PRESETS[k]) return; wx.apply(PRESETS[k]); todSeg.set(wx.tod); cloudSeg.set(wx.cover); baseS.v = wx.base; dirS.v = wx.dir; spdS.v = wx.spd; gustS.v = wx.gust; turbSeg.set(wx.turb); visS.v = wx.vis / 1000; envDirty = true; });

  /* ---------- side panel: live control inputs ---------- */
  const inBox = host.querySelector('.sim-inputs');
  const inCv = document.createElement('canvas'); inCv.style.cssText = 'width:100%;height:250px;display:block'; inCv.setAttribute('role', 'img'); inCv.setAttribute('aria-label', 'Live positions of every flight control');
  const gpLine = document.createElement('p'); gpLine.className = 'note'; gpLine.style.marginTop = '6px';
  if (inBox) { const h = document.createElement('p'); h.className = 'ctl-l'; h.textContent = 'Control inputs'; h.style.marginBottom = '6px'; inBox.append(h, inCv, gpLine); }
  let theme = {}; const readTheme = () => { const cs = getComputedStyle(host); for (const k of ['ink', 'muted', 'line', 'magenta', 'cyan', 'green', 'amber', 'red', 'sunk', 'surface']) theme[k] = cs.getPropertyValue('--' + k).trim() || '#888'; };
  readTheme(); matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', readTheme);
  new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  function drawInputs() {
    if (!inBox) return;
    const { ctx: x, W: w, H: h } = hiDPI(inCv); x.clearRect(0, 0, w, h);
    const T = theme; x.font = `600 10.5px ${MONO}`; x.textBaseline = 'middle';
    const lab = (t, X, Y, col = T.muted, al = 'center') => { x.fillStyle = col; x.textAlign = al; x.fillText(t, X, Y); };
    // yoke
    const ys = 92, yx = 4, yy = 14;
    x.strokeStyle = T.line; x.lineWidth = 1; x.strokeRect(yx, yy, ys, ys); x.beginPath(); x.moveTo(yx + ys / 2, yy); x.lineTo(yx + ys / 2, yy + ys); x.moveTo(yx, yy + ys / 2); x.lineTo(yx + ys, yy + ys / 2); x.stroke();
    x.fillStyle = T.magenta; x.beginPath(); x.arc(yx + ys / 2 + c.roll * ys / 2, yy + ys / 2 + c.pitch * ys / 2, 6, 0, 7); x.fill();
    lab('YOKE', yx + ys / 2, 6); lab('push', yx + ys / 2, yy + 7); lab('pull', yx + ys / 2, yy + ys - 7);
    // rudder bar + brakes
    const ry = yy + ys + 18; x.fillStyle = T.sunk; x.fillRect(yx, ry - 5, ys, 10); x.fillStyle = T.cyan; x.fillRect(yx + ys / 2 + Math.min(0, c.yaw) * ys / 2, ry - 5, Math.abs(c.yaw) * ys / 2, 10); x.fillStyle = T.ink; x.fillRect(yx + ys / 2 + c.yaw * ys / 2 - 1.5, ry - 8, 3, 16);
    lab('RUDDER', yx + ys / 2, ry + 15);
    const bL = c.park ? 1 : c.brakeL, bR = c.park ? 1 : c.brakeR;
    x.fillStyle = T.sunk; x.fillRect(yx, ry + 24, 40, 6); x.fillRect(yx + ys - 40, ry + 24, 40, 6); x.fillStyle = T.red; x.fillRect(yx, ry + 24, 40 * bL, 6); x.fillRect(yx + ys - 40, ry + 24, 40 * bR, 6);
    lab('BRAKE L', yx + 20, ry + 38); lab('BRAKE R', yx + ys - 20, ry + 38);
    // levers
    const bars = [['THR', c.throttle, T.ink], ['MIX', c.mixture, T.red], ['CARB', c.carb ? 1 : 0, T.amber], ['FLAP', c.flap / 3, T.cyan], ['TRIM', 0.5 - c.trim / 0.5, T.green]];
    const bx0 = yx + ys + 18, bw = 14, gap = Math.min(30, (w - bx0 - 150) / 5 + 14);
    bars.forEach(([n, v, col], i) => { const X = bx0 + i * gap, top = 18, H = 110; x.fillStyle = T.sunk; x.fillRect(X, top, bw, H); x.fillStyle = col; x.fillRect(X, top + H * (1 - clamp(v, 0, 1)), bw, H * clamp(v, 0, 1)); lab(n, X + bw / 2, 8); });
    lab(FLAPS[c.flap] + '°', bx0 + 3 * gap + bw / 2, 140, T.ink); lab(c.trim > 0.01 ? 'DN' : c.trim < -0.01 ? 'UP' : '0', bx0 + 4 * gap + bw / 2, 140, T.ink); lab(Math.round(c.throttle * 100) + '%', bx0 + bw / 2, 140, T.ink);
    // switches
    const wide = w >= 470, tx = wide ? bx0 + 5 * gap + 4 : 4; const rows = [['MAGS', ['OFF', 'R', 'L', 'BOTH', 'START'][c.mags]], ['FUEL', ['BOTH', 'LEFT', 'RIGHT', 'OFF'][c.fuel]], ['MASTER', (c.bat ? 'BAT ' : '') + (c.alt ? 'ALT' : '') || 'OFF'], ['AVIONICS', c.avionics ? 'ON' : 'OFF'], ['PARK BRK', c.park ? 'SET' : 'OFF'], ['ENGINE', s.failed ? 'FAILED' : s.running ? 'RUNNING' : 'STOPPED'], ['RPM', fmt(s.rpm)]];
    const bad = (k, v) => (v === 'OFF' && k !== 'PARK BRK') || v === 'FAILED' || v === 'STOPPED';
    if (wide) rows.forEach(([k, v], i) => { lab(k, tx, 14 + i * 21, T.muted, 'left'); lab(v, tx, 24 + i * 21, bad(k, v) ? T.red : T.ink, 'left'); });
    else { x.strokeStyle = T.line; x.beginPath(); x.moveTo(0, 172); x.lineTo(w, 172); x.stroke(); rows.forEach(([k, v], i) => { const cx = 4 + (i % 3) * (w / 3), cy = 186 + Math.floor(i / 3) * 24; lab(k, cx, cy, T.muted, 'left'); lab(v, cx, cy + 11, bad(k, v) ? T.red : T.ink, 'left'); }); }
    gpLine.textContent = gpName ? `Controller: ${gpName.slice(0, 60)}` : 'No yoke or joystick detected. Keyboard, mouse and touch are active.';
  }
  function drawPad() {
    const { ctx: x, W: w, H: h } = hiDPI(pad); const T = theme;
    x.clearRect(0, 0, w, h); x.fillStyle = T.sunk; x.fillRect(0, 0, w, h); x.strokeStyle = T.line; x.lineWidth = 1; x.strokeRect(0.5, 0.5, w - 1, h - 1);
    x.beginPath(); x.moveTo(w / 2, 6); x.lineTo(w / 2, h - 6); x.moveTo(6, h / 2); x.lineTo(w - 6, h / 2); x.stroke();
    x.fillStyle = T.magenta; x.beginPath(); x.arc(w / 2 + c.roll * (w / 2 - 12), h / 2 + c.pitch * (h / 2 - 12), 11, 0, 7); x.fill();
    x.fillStyle = T.muted; x.font = `600 10px ${MONO}`; x.textAlign = 'center'; x.fillText('PUSH', w / 2, 14); x.fillText('PULL', w / 2, h - 8);
  }

  /* ---------- inputs ---------- */
  const keys = new Set(); let uiYaw = 0, uiBrake = 0, padActive = false, padP = 0, padR = 0, gpName = '', gpLast = null;
  const kb = { pitch: 0, roll: 0, yaw: 0 };
  const KEYMAP = { w: 1, s: 1, a: 1, d: 1, arrowup: 1, arrowdown: 1, arrowleft: 1, arrowright: 1, z: 1, x: 1, '+': 1, '=': 1, '-': 1, pageup: 1, pagedown: 1, f: 1, v: 1, '[': 1, ']': 1, b: 1, p: 1, m: 1, c: 1, l: 1, t: 1, k: 1, j: 1 };
  wrap.addEventListener('keydown', e => {
    const k = e.key.toLowerCase(); if (!KEYMAP[k]) return; e.preventDefault();
    if (!e.repeat) { if (k === 'f') c.flap = Math.max(0, c.flap - 1); if (k === 'v') c.flap = Math.min(3, c.flap + 1); if (k === 'p') c.park = !c.park; if (k === 'm') c.mixture = c.mixture > 0.5 ? 0 : 1; if (k === 'c') c.carb = c.carb ? 0 : 1; if (k === 'l') c.lights.land = !c.lights.land; if (k === 't') c.lights.taxi = !c.lights.taxi; if (k === 'k') c.panelLt = (c.panelLt + 1) % 3; if (k === 'j') c.flood = (c.flood + 1) % 3; if ('fvpmcltkj'.includes(k)) snd.click(); }
    keys.add(k);
  });
  wrap.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  // virtual yoke
  const padSet = e => { const r = pad.getBoundingClientRect(); padR = clamp(((e.clientX - r.left) / r.width - 0.5) * 2.3, -1, 1); padP = clamp(((e.clientY - r.top) / r.height - 0.5) * 2.3, -1, 1); };
  pad.addEventListener('pointerdown', e => { padActive = true; pad.setPointerCapture(e.pointerId); padSet(e); });
  pad.addEventListener('pointermove', e => { if (padActive) padSet(e); });
  const padUp = () => { padActive = false; }; pad.addEventListener('pointerup', padUp); pad.addEventListener('pointercancel', padUp);
  function readGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : []; let gp = null; for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) { gpName = ''; return null; }
    gpName = gp.id; const dz = v => Math.abs(v) < 0.06 ? 0 : v; const ax = gp.axes;
    const out = { roll: dz(ax[0] || 0), pitch: dz(ax[1] || 0) };
    if (gp.mapping === 'standard') { out.yaw = dz(ax[2] || 0); const bL = gp.buttons[6]?.value || 0, bR = gp.buttons[7]?.value || 0; out.brakeL = bL; out.brakeR = bR; if (gp.buttons[5]?.pressed) out.thrDelta = 1; if (gp.buttons[4]?.pressed) out.thrDelta = -1; }
    else { if (ax.length > 2) out.throttle = clamp((1 - ax[2]) / 2, 0, 1); if (ax.length > 5) out.yaw = dz(ax[5]); else if (ax.length > 3) out.yaw = dz(ax[3]); }
    return out;
  }

  /* ---------- pointer: look round + click controls (cockpit) ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null, hoverT = 0;
  const pick = e => { const r = S.renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); S.camera.updateMatrixWorld(); ray.setFromCamera(ndc, S.camera); const h = ray.intersectObjects(ck.hits, false); return h[0] || null; };
  const cvs = S.renderer.domElement;
  cvs.addEventListener('pointerdown', e => { wrap.focus({ preventScroll: true }); down = { x: e.clientX, y: e.clientY, yaw: lookYaw, pitch: lookPitch, moved: false }; if (view === 'cockpit') cvs.setPointerCapture(e.pointerId); });
  cvs.addEventListener('pointermove', e => {
    if (down && view === 'cockpit') { const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 5) down.moved = true; if (down.moved) { lookYaw = clamp(down.yaw - dx * 0.006, -1.9, 1.9); lookPitch = clamp(down.pitch - dy * 0.006, -0.85, 0.6); } tip.style.display = 'none'; return; }
    if (view !== 'cockpit' || performance.now() - hoverT < 70) return; hoverT = performance.now();
    const h = pick(e); const r = wrap.getBoundingClientRect();
    if (h && h.object.userData.ctl) { tip.textContent = h.object.userData.ctl.name; tip.style.display = 'block'; tip.style.transform = `translate(${Math.min(e.clientX - r.left + 12, r.width - 260)}px,${e.clientY - r.top + 14}px)`; cvs.style.cursor = h.object.userData.ctl.key ? 'pointer' : 'help'; }
    else { tip.style.display = 'none'; cvs.style.cursor = 'grab'; }
  });
  cvs.addEventListener('pointerup', e => { const d = down; down = null; if (!d || d.moved || view !== 'cockpit') return; const h = pick(e); if (h && h.object.userData.ctl?.key) act(h.object.userData.ctl.key, h.point); });
  cvs.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
  let startTimer = 0;
  function act(k, p) {
    const lp = ck.group.worldToLocal(p.clone());
    if (k === 'throttle') c.throttle = c.throttle >= 0.99 ? 0 : Math.min(1, Math.round(c.throttle * 4 + 1) / 4);
    else if (k === 'mixture') c.mixture = c.mixture > 0.5 ? 0 : 1;
    else if (k === 'carb') c.carb = c.carb ? 0 : 1;
    else if (k === 'flap') c.flap = clamp(c.flap - ck.half('flap', lp), 0, 3);
    else if (k === 'mags') { if (c.mags === 3) { c.mags = 4; startTimer = 1.6; } else c.mags = c.mags === 4 ? 0 : c.mags + 1; }
    else if (k === 'bat') c.bat = !c.bat; else if (k === 'alt') c.alt = !c.alt; else if (k === 'avionics') c.avionics = !c.avionics;
    else if (k.startsWith('light:')) { const n = k.slice(6); c.lights[n] = !c.lights[n]; }
    else if (k === 'park') c.park = !c.park;
    else if (k === 'trim') c.trim = clamp(c.trim + ck.half('trim', lp) * 0.015, -0.25, 0.25);
    else if (k === 'fuel') c.fuel = (c.fuel + 1) % 4;
    else if (k === 'panelLt') c.panelLt = (c.panelLt + 1) % 3;
    else if (k === 'flood') c.flood = (c.flood + 1) % 3;
    snd.click(); syncUI();
  }
  function syncUI() { thrS.v = Math.round(c.throttle * 100); trimS.v = Math.round(c.trim / 0.25 * 100); flapSeg.set(c.flap); parkB.textContent = c.park ? 'Release parking brake' : 'Set parking brake'; }
  // keep flapSeg.set from looping: it calls on(), which only sets c.flap

  /* ---------- scenarios ---------- */
  let scn = 'to', st = {}, paused = false;
  const climbGamma = Vkt => { let lo = 0, hi = 0.3; for (let i = 0; i < 30; i++) { const g = (lo + hi) / 2; trimFor(Vkt * KT, g, 120, 0).throttle < 0.999 ? lo = g : hi = g; } return lo; };
  const hdgErr = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  const onRunway = () => Math.abs(s.pos.x) < RWY.wid / 2 + 2 && Math.abs(s.pos.z) < RWY.len / 2 + 5;
  let papi = [0, 0, 0, 0];
  const SC = {
    fin: { title: 'Final approach to runway 36 (PAPI)', setup() { const d = 2780, h = d * Math.tan(3 * D2R); setFlight(s, c, { x: 0, z: W.papiZ + d, h: h + 1.45, hdg: 0, Vkt: 65, gamma: -3 * D2R, flap: 2 }); c.lights.land = true; },
      steps: [['Line up with the runway centreline', () => Math.abs(s.pos.x) < 15 && s.pos.z < W.papiZ + 2400],
        ['Hold the glidepath: two white, two red on the PAPI', () => papi.reduce((a, b) => a + b) === 2 && (st.pp = (st.pp || 0) + 1) > 150],
        ['Flaps 30° and about 65 kt approaching the threshold', () => s.flapPos > 2.9 && Math.abs(s.ias - 63) < 7 && s.pos.z < RWY.thr36 + 600],
        ['Flare and touch down gently', () => s.onGround && s.hardTouch < 2.5],
        ['Stop on the runway', () => s.onGround && s.ias < 3 && onRunway()]] },
    to: { title: 'Take-off from runway 36', setup() { setGround(s, c, { x: 0, z: RWY.thr36 - 45, hdg: 0, ground }); c.trim = -0.06; },
      steps: [['Full power: push the throttle fully in', () => c.throttle > 0.95 && s.rpm > 2150],
        ['Keep straight on the centreline with rudder', () => s.ias > 45 && Math.abs(s.pos.x) < 6],
        ['Rotate at 55 kt: gently pull back', () => !s.onGround && s.ias > 45],
        ['Climb at 74 kt (Vy)', () => !s.onGround && Math.abs(s.ias - 74) < 5 && s.vs > 200 && (st.vy = (st.vy || 0) + 1) > 120],
        ['Climb through 500 ft above the runway', () => s.agl > 500]] },
    dw: { title: 'Left-hand circuit: downwind for runway 36', setup() { setFlight(s, c, { x: -1050, z: -250, h: ground(-1050, -250) + 1000 * FT, hdg: 180, Vkt: 90 }); },
      steps: [['Downwind at 1,000 ft above the field and 90 kt', () => Math.abs(s.agl - 1000) < 150 && Math.abs(s.ias - 90) < 10 && (st.dw = (st.dw || 0) + 1) > 240],
        ['Abeam the threshold: carb heat on, about 1,500 rpm, flaps 10°', () => c.carb && s.rpm < 1800 && s.flapPos > 0.9],
        ['Base leg: turn left, flaps 20°, 70 kt', () => hdgErr(s.hdg, 90) < 35 && s.flapPos > 1.9],
        ['Final: flaps 30°, 65 kt, aim for the threshold', () => hdgErr(s.hdg, 0) < 25 && Math.abs(s.pos.x) < 150 && s.flapPos > 2.9],
        ['Land and stop on the runway', () => s.onGround && s.ias < 3 && onRunway()]] },
    efato: { title: 'Engine failure after take-off', setup() { const g = climbGamma(70); setFlight(s, c, { x: 0, z: RWY.thr18 - 260, h: 400 * FT + 1.45, hdg: 0, Vkt: 70, gamma: g, throttle: 1 }); st.failT = 3; },
      steps: [['Engine failure! Lower the nose: best glide 68 kt', () => s.failed && Math.abs(s.ias - 68) < 6 && (st.g = (st.g || 0) + 1) > 180],
        ['Land ahead, within about 30° either side', () => s.onGround && hdgErr(s.hdg, 0) < 35],
        ['Fuel selector OFF, mixture idle cut-off, magnetos OFF', () => c.fuel === 3 && c.mixture < 0.15 && c.mags === 0],
        ['Master switch OFF before touchdown', () => !c.bat && !c.alt],
        ['Touch down and stop', () => s.onGround && s.ias < 3]] },
    stall: { title: 'Power-off stall and recovery', setup() { setFlight(s, c, { x: 1800, z: -1800, h: 3000 * FT, hdg: 0, Vkt: 70 }); },
      steps: [['Carb heat on, throttle to idle', () => c.carb && c.throttle < 0.08],
        ['Hold altitude: raise the nose as the speed falls', () => s.ias < 56 && Math.abs(s.vs) < 600],
        ['At the stall warning, keep the wings level with rudder', () => s.stallWarn || s.stalled],
        ['Recover: lower the nose, full power, carb heat off', () => st.stalledOnce && s.alpha < stallAlpha(Math.round(s.flapPos)) - 2 * D2R && c.throttle > 0.9 && !c.carb],
        ['Climb away at 74 kt', () => s.vs > 300 && s.ias > 65]] }
  };
  function start(k) {
    scn = k; st = { done: [], t: 0 }; const sc = SC[k]; sc.setup(); s.crashed = false; s.crashReason = ''; s.hardTouch = 0;
    c.bat = c.alt = c.avionics = true; const nl = LOOK[wx.tod].night > 0.5; c.lights = { bcn: true, land: k === 'to' || k === 'fin' || nl, taxi: k === 'to' && nl, nav: true, strb: true }; c.panelLt = 1; c.flood = nl ? 2 : 0;
    paused = false; pauseB.textContent = 'Pause'; center.style.display = 'none';
    s.hdg = Math.round(s.hdg); s.hdgBug = sc === SC.dw ? 180 : 0; s.turnRate = 0;
    syncUI(); buildChecks(); if (view !== 'cockpit') setView(view); lastPos.copy(s.pos);
  }

  /* ---------- readout ---------- */
  const out = host.querySelector('.readout');
  out.innerHTML = `<p class="ro-big" data-k="status">Ready</p>
    <dl class="ro" data-k="nums"></dl>
    <p class="mono" data-k="metar" style="font-size:12.5px;line-height:1.45;background:var(--sunk);padding:8px 10px;border-radius:6px;word-break:break-word"></p>
    <p class="note" data-k="decode" style="margin-top:-2px"></p>
    <p class="ctl-l" data-k="title" style="margin-top:4px"></p><ul class="checks" data-k="checks"></ul>
    <p class="note">Speeds (approximate, from public data; always use your POH): ${VSPEEDS}.</p>
    <p class="note">Prototype for learning, not a certified training device: hours flown here can't be logged. The flight model is simplified and its figures are approximate. Follow your aircraft's POH and your instructor.</p>`;
  const q = k => out.querySelector(`[data-k="${k}"]`);
  const nums = q('nums'); const N = {};
  [['ias', 'Airspeed'], ['alt', 'Altitude'], ['vs', 'Vertical speed'], ['hdg', 'Heading'], ['rpm', 'Engine'], ['flap', 'Flaps'], ['wind', 'Wind on runway 36']].forEach(([k, l]) => { const d = document.createElement('div'); d.innerHTML = `<dt>${l}</dt><dd></dd>`; nums.appendChild(d); N[k] = d.querySelector('dd'); });
  function buildChecks() { q('title').textContent = SC[scn].title; q('checks').innerHTML = SC[scn].steps.map(([t]) => `<li>${t}</li>`).join(''); }
  function updateReadout() {
    N.ias.textContent = `${Math.round(s.ias)} kt`; N.alt.textContent = `${fmt(s.alt)} ft (${fmt(Math.max(0, s.agl))} ft above ground)`; N.vs.textContent = `${s.vs > 0 ? '+' : ''}${fmt(Math.round(s.vs / 10) * 10)} fpm`;
    N.hdg.textContent = pad3(s.hdg) + '°'; N.rpm.textContent = `${fmt(Math.round(s.rpm / 10) * 10)} rpm${s.failed ? ' · failed' : s.running ? '' : ' · stopped'}`; N.flap.textContent = `${FLAPS[c.flap]}°${Math.abs(s.flapPos - c.flap) > 0.05 ? ' (moving)' : ''}`;
    const comp = wx.components(0), cr = Math.round(Math.abs(comp.cross)), hw = Math.round(comp.head);
    N.wind.textContent = wx.spd < 1 ? 'calm' : `${cr ? `crosswind ${cr} kt from the ${comp.cross < 0 ? 'left' : 'right'}` : 'no crosswind'} · ${hw >= 0 ? 'headwind ' + hw : 'tailwind ' + -hw} kt${wx.gust >= 10 ? ', gusty' : ''}`;
    const m = wx.metar(); q('metar').textContent = m.code; q('decode').textContent = m.decode;
    const lis = q('checks').children; st.done.forEach((d, i) => { if (lis[i]) lis[i].className = d ? 'ok' : ''; });
    const stEl = q('status');
    let txt = 'Flying', warn = false;
    if (s.crashed) { txt = 'Crashed: ' + s.crashReason; warn = true; }
    else if (s.stalled) { txt = 'STALL: lower the nose'; warn = true; }
    else if (s.stallWarn) { txt = 'Stall warning'; warn = true; }
    else if (s.ias > 163) { txt = 'Overspeed: above Vne'; warn = true; }
    else if (s.flapPos > 1.05 && s.ias > 85 || s.flapPos > 0.05 && s.ias > 110) { txt = 'Flaps above their limit speed'; warn = true; }
    else if (s.failed) { txt = 'Engine failure'; warn = true; }
    else if (imc > 0.5) { txt = 'In cloud (IMC): fly on instruments'; warn = true; }
    else if (s.onGround) txt = Math.hypot(s.vel.x, s.vel.z) < 0.5 ? 'On the ground' : 'Rolling';
    if (paused) txt = 'Paused';
    stEl.textContent = txt; stEl.classList.toggle('warn', warn);
    warnBox.style.display = warn && !s.crashed ? 'block' : 'none'; warnBox.textContent = txt; warnBox.style.background = 'rgba(200,40,40,.85)';
  }

  /* ---------- main loop ---------- */
  const DT = 1 / 120; let acc = 0, roT = 0, inT = 0, padT = 0;
  const lightV = new THREE.Vector3(); const sun = sky.sun.clone().normalize();
  function inputs(dt) {
    const k = n => keys.has(n);
    const tp = (k('s') || k('arrowdown') ? 1 : 0) - (k('w') || k('arrowup') ? 1 : 0);
    const tr = (k('d') || k('arrowright') ? 1 : 0) - (k('a') || k('arrowleft') ? 1 : 0);
    const ty = (k('x') ? 1 : 0) - (k('z') ? 1 : 0);
    const ease = (v, t, up, back) => { const r = t !== 0 ? up : back; return v + clamp(t - v, -r * dt, r * dt); };
    kb.pitch = ease(kb.pitch, tp, 1.4, 2.5); kb.roll = ease(kb.roll, tr, 2.5, 3.5); kb.yaw = ease(kb.yaw, ty, 2.5, 3.5);
    if (k('+') || k('=') || k('pageup')) c.throttle = Math.min(1, c.throttle + dt * 0.6);
    if (k('-') || k('pagedown')) c.throttle = Math.max(0, c.throttle - dt * 0.6);
    if (k('[')) c.trim = Math.min(0.25, c.trim + dt * 0.06); if (k(']')) c.trim = Math.max(-0.25, c.trim - dt * 0.06);
    const gp = readGamepad();
    let pitch = kb.pitch, roll = kb.roll, yaw = kb.yaw + uiYaw;
    if (padActive) { pitch = padP; roll = padR; } else { padP *= Math.max(0, 1 - dt * 6); padR *= Math.max(0, 1 - dt * 6); if (Math.abs(padP) > 0.01 || Math.abs(padR) > 0.01) { pitch = padP; roll = padR; } }
    if (gp) {
      if (Math.abs(gp.pitch) > 0 || Math.abs(gp.roll) > 0) { pitch = gp.pitch; roll = gp.roll; }
      if (gp.yaw) yaw = gp.yaw;
      if (gp.throttle != null && (gpLast == null || Math.abs(gp.throttle - gpLast) > 0.02)) { c.throttle = gp.throttle; gpLast = gp.throttle; }
      if (gp.thrDelta) c.throttle = clamp(c.throttle + gp.thrDelta * dt * 0.6, 0, 1);
    }
    c.pitch = clamp(pitch, -1, 1); c.roll = clamp(roll, -1, 1); c.yaw = clamp(yaw, -1, 1);
    const kbB = k('b') ? 1 : 0; c.brakeL = Math.max(kbB, uiBrake, gp?.brakeL || 0); c.brakeR = Math.max(kbB, uiBrake, gp?.brakeR || 0);
    if (startTimer > 0) { startTimer -= dt; if (startTimer <= 0 && c.mags === 4) c.mags = 3; }
  }
  function scenario(dt) {
    st.t += dt;
    if (scn === 'efato' && !s.failed && st.t > st.failT) { s.failed = true; }
    if (s.stalled) st.stalledOnce = true;
    SC[scn].steps.forEach(([, fn], i) => { if (!st.done[i] && (i === 0 || st.done[i - 1] || scn === 'efato') && fn()) st.done[i] = true; });
  }
  /* ---------- environment: time of day, visibility, clouds ---------- */
  let envDirty = true, imc = 0, shadeT = 1, curLook = LOOK.day, look = 'day';
  const sunDir = new THREE.Vector3(), lightDir = new THREE.Vector3(), fogBase = new THREE.Color(), cloudFog = new THREE.Color(), tmpC = new THREE.Color();
  function applyEnv() {
    envDirty = false; look = wx.tod; const L = curLook = LOOK[look], T = TOD[look];
    const el = T.elev * D2R, az = T.az * D2R;
    sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az));
    const u = sky.sky.material.uniforms; u.sunPosition.value.copy(sunDir);
    u.turbidity.value = look === 'day' ? 5 : 8; u.rayleigh.value = look === 'night' ? 0.6 : look === 'day' ? 1.4 : 2.6;
    if (look === 'night') { const mel = 35 * D2R, maz = 200 * D2R; lightDir.set(Math.cos(mel) * Math.sin(maz), Math.sin(mel), -Math.cos(mel) * Math.cos(maz)); } else lightDir.copy(sunDir).setY(Math.max(0.05, sunDir.y)).normalize();
    sky.light.color.setRGB(...L.sunCol); sky.hemi.color.setHex(L.hs); sky.hemi.groundColor.setHex(L.hg); sky.hemi.intensity = L.hi;
    S.renderer.toneMappingExposure = L.exp; S.bloomPass.threshold = L.bt; S.bloomPass.strength = L.bs;
    S.envFromScene(envScene); S.scene.environmentIntensity = L.env;
    fogBase.setHex(L.fog);
    W.setNight(L.night, wx.vis < 5000); s._night = L.night;
    const cov = COVER[wx.cover], baseM = wx.base * FT; clouds.set(cov, baseM, baseM + (cov > 0.9 ? 480 : 1150));
    const sc = new THREE.Color(...L.sunCol).multiplyScalar(look === 'night' ? 0.05 : L.sunI * 0.55);
    clouds.setLight(lightDir, sc, new THREE.Color(...L.amb), fogBase, Math.min(30000, wx.vis * 1.6));
  }
  const camW = new THREE.Vector3(), shake = new THREE.Vector3();
  let shakeT = 0;
  function frame(dt, fromXR) {
    if (envDirty) applyEnv();
    wx.update(dt, s, Math.max(0, s.agl * FT));
    if (!paused && !s.crashed) {
      inputs(dt);
      acc += dt; let n = 0;
      while (acc >= DT && n < 8) { step(s, c, DT, ground); acc -= DT; n++; }
      if (n === 8) acc = 0;
      scenario(dt);
      if (s.crashed) { center.innerHTML = `<b>${s.crashReason}</b><br>Press Restart or pick a scenario.`; center.style.display = 'block'; }
    }
    ext.root.position.copy(s.pos); ext.root.quaternion.copy(s.q);
    s._gy = ground(s.pos.x, s.pos.z); ext.update(c, s, dt);
    if (view === 'cockpit' || fromXR) {
      ck.update(c, s, dt); ck.setLighting(curLook.night, c.panelLt, c.flood);
      if (!fromXR) {
        S.camera.rotation.set(lookPitch, lookYaw, 0, 'YXZ');
        shakeT += dt; const gs = Math.hypot(s.vel.x, s.vel.z);
        const amp = REDUCED ? 0 : 0.0007 * Math.pow(s.rpm / 2700, 3) + (s.onGround ? 0.0022 * clamp(gs / 25, 0, 1) : 0) + 0.0012 * wx.turb;
        shake.set(Math.sin(shakeT * 41) * 0.6 + Math.sin(shakeT * 73) * 0.4, Math.sin(shakeT * 53 + 1) * 0.7 + Math.sin(shakeT * 97) * 0.3, 0).multiplyScalar(amp);
        S.camera.position.copy(ck.eye).add(shake);
      }
    } else if (view === 'chase') { const d = lightV.copy(s.pos).sub(lastPos); S.camera.position.add(d); S.controls.target.copy(s.pos); }
    else { S.camera.position.copy(W.towerPos); S.camera.lookAt(s.pos); const dist = S.camera.position.distanceTo(s.pos); S.camera.fov = clamp(2 * Math.atan(16 / dist) / D2R, 2.5, 55); S.camera.updateProjectionMatrix(); }
    lastPos.copy(s.pos);
    S.camera.getWorldPosition(camW);
    sky.sky.position.copy(camW); W.stars.position.copy(camW);
    sky.light.position.copy(s.pos).addScaledVector(lightDir, 120); sky.light.target.position.copy(s.pos);
    shadeT += (clouds.shade(s.pos, lightDir) - shadeT) * Math.min(1, dt * 1.5);
    sky.light.intensity = curLook.sunI * (0.25 + 0.75 * shadeT);
    const to = (wx.dir + 180) * D2R; clouds.drift(Math.sin(to) * wx.spd * KT * dt, -Math.cos(to) * wx.spd * KT * dt);
    imc += (clamp(clouds.inside(camW) * 3, 0, 1) - imc) * Math.min(1, dt * 2.5);
    const visFar = Math.min(30000, wx.vis * 1.15);
    tmpC.setRGB(...curLook.amb).multiplyScalar(curLook.night > 0.9 ? 1.2 : 1.6); if (curLook.night < 0.9) tmpC.add(new THREE.Color(...curLook.sunCol).multiplyScalar(0.12));
    cloudFog.copy(fogBase).lerp(tmpC, imc);
    S.scene.fog.color.copy(cloudFog); S.scene.fog.near = (1 - imc) * visFar * 0.12 + imc * 2; S.scene.fog.far = (1 - imc) * visFar + imc * 70;
    // CLOUDS-BEGIN: overcast look below a BKN/OVC layer: grey fog/haze, dimmer sky light and reflections (sun dims via clouds.shade)
    { const cs = clouds.state, ovK = cs.kind === 'OVC' ? 0.9 : cs.kind === 'BKN' ? 0.5 : 0, thick = cs.kind === 'OVC' ? Math.max(200, cs.top - cs.base) : 900;
      const ov = ovK * clamp((cs.base + thick - camW.y) / thick, 0, 1);
      const g = frame.ovGrey || (frame.ovGrey = new THREE.Color());
      if (ov > 0.001) { const lum = cloudFog.r * 0.3 + cloudFog.g * 0.55 + cloudFog.b * 0.15; g.setRGB(lum, lum * 1.01, lum * 1.05).multiplyScalar(0.5); S.scene.fog.color.copy(cloudFog).lerp(g, ov * 0.85 * (1 - imc)); }
      sky.hemi.intensity = curLook.hi * (1 - 0.4 * ov); S.scene.environmentIntensity = curLook.env * (1 - 0.5 * ov);
      clouds.uniforms.uFogCol.value.copy(S.scene.fog.color).multiplyScalar(1 - 0.35 * clouds.uniforms.uDark.value); }
    // CLOUDS-END
    papi = W.update(dt, camW, wx.dir, wx.gustNow || wx.spd);
    const now = performance.now();
    if (now - roT > 250) { roT = now; updateReadout(); }
    if (now - inT > 66) { inT = now; drawInputs(); drawPad(); parkB.textContent = c.park ? 'Release parking brake' : 'Set parking brake'; if (document.activeElement?.type !== 'range') { thrS.v = Math.round(c.throttle * 100); trimS.v = Math.round(c.trim / 0.25 * 100); } }
    if (now - padT > 400) { padT = now; if (+flapSeg.v !== c.flap) flapSeg.set(c.flap); }
    snd.update(s, c);
  }
  start('to'); setView('cockpit');
  const xr = createXR(S, xrRig, (dt, fromXR) => frame(dt, fromXR), on => { vrB.textContent = on ? 'Exit VR' : 'Enter VR'; });
  xrSupported().then(ok => { vrB.hidden = !ok; vrNote.hidden = ok; });
  quality.set(AUTO_LEVEL);
  host.__sim = { s, c, keys, S, sky, ck, ext, quality, qSeg, W, wx, clouds, start, setView, preSeg, todSeg, cloudSeg, vSeg, sSeg, get imc() { return imc; }, get paused() { return paused; } };
  S.tick(dt => { if (S.renderer.xr.isPresenting) return; frame(dt, false); });
  applyEnv(); ck.update(c, s, 0, true); drawInputs(); drawPad(); updateReadout();
}

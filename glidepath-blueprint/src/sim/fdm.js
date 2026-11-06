/* C172-class flight dynamics: 6-DOF rigid body, simplified aero, fixed-pitch prop, tricycle gear.
   SI units. World: x east, y up, z south (north = -z). Body (three.js local): x right, y up, z aft (nose = -z). */
import * as THREE from 'three';

export const G = 9.80665, RHO0 = 1.225, KT = 0.514444, FT = 0.3048;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const FLAPS = [0, 10, 20, 30];

export const AC = {
  m: 1043, S: 16.2, b: 11.0, c: 1.49,
  I: new THREE.Vector3(1825, 2667, 1285),           // about local x (pitch), y (yaw), z (roll)
  CL0: 0.31, CLa: 5.0, CLmin: -1.1,
  CLmax: [1.69, 1.92, 2.21, 2.43],                   // gives ~48/45/42/40 KIAS at 1043 kg
  dCL0: [0, 0.23, 0.52, 0.74],
  CD0: 0.031, CD0f: [0, 0.007, 0.022, 0.045], k: 0.0568,
  Cm0: 0.04, Cma: -1.8, Cmq: -12.4, Cmde: -1.28, Cmf: [0, -0.012, -0.024, -0.034],
  Clb: -0.092, Clp: -0.484, Clr: 0.08, Clda: 0.17, Cldr: 0.012,
  Cnb: 0.0587, Cnr: -0.0937, Cnp: -0.0278, Cnda: -0.012, Cndr: 0.0645,
  CYb: -0.31, CYdr: -0.187,
  deMax: 0.44, daMax: 0.30, drMax: 0.28, trimMax: 0.25,
  Tstatic: 2450, rpmStatic: 2330, rpmIdle: 650, rpmRed: 2700,
  // gear contact points (local), spring k, damper c
  gear: [
    { name: 'nose', p: new THREE.Vector3(0, -1.45, -1.55), k: 26000, c: 3200, steer: true },
    { name: 'left', p: new THREE.Vector3(-1.25, -1.45, 0.35), k: 45000, c: 5200, brake: 'L' },
    { name: 'right', p: new THREE.Vector3(1.25, -1.45, 0.35), k: 45000, c: 5200, brake: 'R' }
  ],
  // structure points that must never touch the ground
  crashPts: [new THREE.Vector3(-5.5, 0.64, -0.2), new THREE.Vector3(5.5, 0.64, -0.2), new THREE.Vector3(0, -1.17, -2.56), new THREE.Vector3(0, -0.05, 4.4), new THREE.Vector3(0, -0.92, -0.5)] // wingtips, prop tip, tail, belly (C172-class geometry)
};

export const isaRho = h => RHO0 * Math.pow(Math.max(0.2, 1 - 2.25577e-5 * h), 4.25588);

/** lift coefficient with stall, for alpha (rad) and flap index */
export function liftCoef(a, fi) {
  const cl0 = AC.CL0 + AC.dCL0[fi], clmax = AC.CLmax[fi];
  const as = (clmax - cl0) / AC.CLa, an = (AC.CLmin - cl0) / AC.CLa;
  if (a <= as && a >= an) return cl0 + AC.CLa * a;
  const fp = 1.15 * Math.sin(2 * a);
  if (a > as) { const d = a - as; const post = clmax - clmax * 0.32 * Math.min(1, d / (6 * D2R)); const bl = smooth(0.12, 0.6, d); return post * (1 - bl) + fp * bl; }
  const d = an - a; const post = AC.CLmin + 0.35 * Math.min(1, d / 0.1); const bl = smooth(0.12, 0.6, d); return post * (1 - bl) + fp * bl;
}
export const stallAlpha = fi => (AC.CLmax[fi] - AC.CL0 - AC.dCL0[fi]) / AC.CLa;

/* ---------------- engine & propeller ---------------- */
export function rpmFull(Vkt) { return Math.min(3100, AC.rpmStatic + 3.6 * Math.max(0, Vkt)); }
export function thrustOf(rpm, V, rho) {
  if (rpm < 120) return -0.25 * 0.5 * rho * V * V;                 // stopped prop: a little drag
  const Vp = 86 * rpm / AC.rpmRed;                                  // prop "pitch speed"
  let f = 1 - Math.pow(Math.max(0, V) / Vp, 1.3); f = Math.max(-1.6, f);
  return AC.Tstatic * (rho / RHO0) * Math.pow(rpm / AC.rpmStatic, 2) * f;
}

export function createAircraft() {
  const s = {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), // w: local angular velocity
    rpm: 0, flapPos: 0, windNow: new THREE.Vector3(), turbP: 0, running: false, failed: false, fuelStarve: 0, crank: 0, fuelL: 24, fuelR: 24, oilT: 180, oilP: 70, amps: 0,
    // derived
    ias: 0, tas: 0, alpha: 0, beta: 0, alt: 0, agl: 0, vs: 0, hdg: 0, pitch: 0, bank: 0, turnRate: 0, ball: 0, nz: 1,
    onGround: false, wow: [false, false, false], stallWarn: false, stalled: false, crashed: false, crashReason: '', hardTouch: 0, thrust: 0,
    t: 0
  };
  return s;
}

// controls (all set by the app): pitch -1..1 (+ = pull/nose up), roll -1..1 (+ right), yaw -1..1 (+ right),
// throttle 0..1, mixture 0..1, carb 0/1, flap index, trim (rad, elevator offset), brakeL/brakeR 0..1, park, mags 0 OFF 1 R 2 L 3 BOTH 4 START, fuel 0 BOTH 1 LEFT 2 RIGHT 3 OFF, bat, alt
export function createControls() {
  return { pitch: 0, roll: 0, yaw: 0, throttle: 0, mixture: 1, carb: 0, flap: 0, flapPos: 0, trim: 0, brakeL: 0, brakeR: 0, park: false, mags: 3, fuel: 0, bat: true, alt: true, avionics: true, lights: { bcn: true, land: false, taxi: false, nav: true, strb: true } };
}

const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _m = new THREE.Vector3(), _qi = new THREE.Quaternion();
const _r = new THREE.Vector3(), _wW = new THREE.Vector3(), _vc = new THREE.Vector3(), _fw = new THREE.Vector3(), _lat = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _tmp = new THREE.Vector3(), _tq = new THREE.Vector3(), _Fw = new THREE.Vector3(), _Tw = new THREE.Vector3();
const RIGHT = new THREE.Vector3(1, 0, 0), FWD = new THREE.Vector3(0, 0, -1), UP = new THREE.Vector3(0, 1, 0);

/** one physics step. ground(x,z) -> terrain height */
export function step(s, c, dt, ground) {
  if (s.crashed) return;
  s.t += dt;
  const rho = isaRho(Math.max(0, s.pos.y));
  // flap motor: ~2.5 s per 10°
  const target = c.flap; s.flapPos += clamp(target - s.flapPos, -dt * 0.4, dt * 0.4); // in index units
  const fiLo = Math.floor(clamp(s.flapPos, 0, 3)), fiHi = Math.min(3, fiLo + 1), ff = clamp(s.flapPos, 0, 3) - fiLo;
  const fl = (arr) => arr[fiLo] + (arr[fiHi] - arr[fiLo]) * ff;

  // ---------- air data (local) ----------
  _qi.copy(s.q).invert();
  _v.copy(s.vel).sub(s.windNow).applyQuaternion(_qi);                 // air-relative velocity (wind, gusts, turbulence)
  const u = -_v.z, wv = -_v.y, vv = _v.x;
  const V = Math.max(0.01, _v.length());
  const alpha = Math.atan2(wv, Math.max(0.01, Math.abs(u)) * Math.sign(u || 1));
  const beta = Math.asin(clamp(vv / V, -1, 1));
  const qd = 0.5 * rho * V * V;
  s.alpha = alpha; s.beta = beta; s.tas = V; s.ias = Math.sqrt(2 * qd / RHO0) / KT * (u > 0 ? 1 : 0);
  const pR = -s.w.z, qR = s.w.x, rR = -s.w.y;                     // roll right, pitch up, yaw right
  const Vh = Math.max(V, 5), ph = (pR - s.turbP) * AC.b / (2 * Vh), qh = qR * AC.c / (2 * Vh), rh = rR * AC.b / (2 * Vh);

  // lift (blend flap curves)
  const clLo = liftCoef(alpha, fiLo), clHi = liftCoef(alpha, fiHi), CL = clLo + (clHi - clLo) * ff;
  const as = stallAlpha(fiLo);
  const stallDepth = clamp((alpha - as) / (6 * D2R), 0, 1);
  s.stalled = alpha > as + 0.5 * D2R && V > 8;
  const clmax = fl(AC.CLmax), cl0 = AC.CL0 + fl(AC.dCL0);
  s.stallWarn = V > 8 && (cl0 + AC.CLa * alpha) > 0.82 * clmax && !s.onGround;
  const CD = AC.CD0 + fl(AC.CD0f) + AC.k * CL * CL + 0.9 * Math.pow(Math.sin(Math.max(0, alpha - as)), 2) + 0.03 * Math.abs(beta);
  const CY = AC.CYb * beta;

  // controls
  const de = clamp(-c.pitch * AC.deMax + c.trim, -0.5, 0.5);
  const da = c.roll * AC.daMax, dr = c.yaw * AC.drMax;

  // engine & prop
  engine(s, c, dt, V);
  const T = thrustOf(s.rpm, u, rho); s.thrust = T;
  const qslip = Math.max(0, T) / 2.84 * 0.55;                     // slipstream over the tail
  const qt = qd + qslip;

  // aero forces in local frame
  _tmp.copy(_v).multiplyScalar(-1 / V);                          // relative wind direction (towards which drag acts)... drag along -v
  const dir = _v.clone().multiplyScalar(1 / V);
  const liftDir = new THREE.Vector3().crossVectors(RIGHT, dir).normalize();
  _f.set(0, 0, 0)
    .addScaledVector(liftDir, qd * AC.S * CL)
    .addScaledVector(dir, -qd * AC.S * CD)
    .addScaledVector(RIGHT, qd * AC.S * CY + qt * AC.S * AC.CYdr * dr * 0.5);
  _f.addScaledVector(FWD, T);
  // moments (aero sign conventions -> local axes)
  const Cm = AC.Cm0 + AC.Cma * alpha * (1 - 0.5 * stallDepth) + AC.Cmq * qh + fl(AC.Cmf) - 0.08 * stallDepth;
  const M = qd * AC.S * AC.c * Cm + qt * AC.S * AC.c * AC.Cmde * de;
  const aileronEff = 1 - 0.55 * stallDepth;
  const Cl = AC.Clb * beta + AC.Clp * (1 - 0.7 * stallDepth) * ph + AC.Clr * rh + AC.Clda * da * aileronEff + AC.Cldr * dr;
  const L = qd * AC.S * AC.b * Cl;
  const Cn = AC.Cnb * beta + AC.Cnr * rh + AC.Cnp * ph + AC.Cnda * da;
  let N = qd * AC.S * AC.b * Cn + qt * AC.S * AC.b * AC.Cndr * dr;
  N += -0.06 * Math.max(0, T) * clamp(1 - u / 45, 0, 1);         // P-factor / slipstream: left-turning at high power, low speed
  _m.set(M, -N, -L);
  // specific force for the slip ball (aero + thrust, local)
  const fyAero = _f.x / AC.m;

  // to world
  _Fw.copy(_f).applyQuaternion(s.q);
  _Tw.copy(_m).applyQuaternion(s.q);                              // torque world (we convert back later)
  _Fw.y -= AC.m * G;

  // ---------- ground contact ----------
  _wW.copy(s.w).applyQuaternion(s.q);
  let onG = 0; let gy = 0;
  for (let i = 0; i < AC.gear.length; i++) {
    const g = AC.gear[i];
    _r.copy(g.p).applyQuaternion(s.q);
    const px = s.pos.x + _r.x, py = s.pos.y + _r.y, pz = s.pos.z + _r.z;
    const h = ground(px, pz), pen = h - py;
    s.wow[i] = pen > 0;
    if (pen <= 0) continue;
    onG++;
    _vc.crossVectors(_wW, _r).add(s.vel);
    if (_vc.y < -3.2 && !s.onGround) { s.hardTouch = Math.max(s.hardTouch, -_vc.y); }
    let Nf = g.k * Math.min(pen, 0.4) - g.c * _vc.y; if (pen > 0.4) Nf += 400000 * (pen - 0.4);
    Nf = Math.max(0, Nf);
    // wheel direction
    _fw.set(0, 0, -1).applyQuaternion(s.q);
    if (g.steer) { const st = -c.yaw * 10 * D2R * clamp(1 - s.tas / 40, 0.3, 1); _fw.applyAxisAngle(UP, st); }
    _fw.y = 0; _fw.normalize(); _lat.crossVectors(_up, _fw).normalize();
    const vl = _vc.dot(_fw), vt = _vc.dot(_lat);
    const brake = g.brake ? (c.park ? 1 : (g.brake === 'L' ? c.brakeL : c.brakeR)) : 0;
    const mu = 0.025 + 0.6 * brake;
    const Fl = -clamp(vl * 4000, -mu * Nf, mu * Nf);
    const Ft = -clamp(vt * 9000, -0.75 * Nf, 0.75 * Nf);
    _tmp.set(0, Nf, 0).addScaledVector(_fw, Fl).addScaledVector(_lat, Ft);
    _Fw.add(_tmp);
    _tq.crossVectors(_r, _tmp); _Tw.add(_tq);
    gy += h;
  }
  s.onGround = onG > 0;
  // crash checks
  for (const p of AC.crashPts) {
    _r.copy(p).applyQuaternion(s.q);
    const h = ground(s.pos.x + _r.x, s.pos.z + _r.z);
    if (s.pos.y + _r.y < h - 0.05) { s.crashed = true; s.crashReason = p.y > 0.5 ? 'A wingtip hit the ground.' : p.z > 3 ? 'Tail strike: the tail hit the ground.' : p.z < -2 ? 'Prop strike: the propeller hit the ground.' : 'The fuselage hit the ground.'; return; }
  }
  if (s.hardTouch > 4.2) { s.crashed = true; s.crashReason = `Very hard landing (${Math.round(s.hardTouch * 196.85)} fpm at touchdown).`; return; }

  // ---------- integrate ----------
  s.vel.addScaledVector(_Fw, dt / AC.m);
  s.pos.addScaledVector(s.vel, dt);
  // angular: torque back to local
  _tq.copy(_Tw).applyQuaternion(_qi);
  const I = AC.I, w = s.w;
  const Iw = _tmp.set(I.x * w.x, I.y * w.y, I.z * w.z);
  const gyro = new THREE.Vector3().crossVectors(w, Iw);
  w.x += (_tq.x - gyro.x) / I.x * dt; w.y += (_tq.y - gyro.y) / I.y * dt; w.z += (_tq.z - gyro.z) / I.z * dt;
  const dq = new THREE.Quaternion(w.x * dt * 0.5, w.y * dt * 0.5, w.z * dt * 0.5, 0);
  dq.premultiply(s.q);  // q * (0,w)/2 dt  -> premultiply gives s.q * dq
  s.q.x += dq.x; s.q.y += dq.y; s.q.z += dq.z; s.q.w += dq.w; s.q.normalize();

  // ---------- derived ----------
  _fw.set(0, 0, -1).applyQuaternion(s.q); _r.set(1, 0, 0).applyQuaternion(s.q); _tmp.set(0, 1, 0).applyQuaternion(s.q);
  s.pitch = Math.asin(clamp(_fw.y, -1, 1)) / D2R;
  s.bank = Math.atan2(-_r.y, _tmp.y) / D2R;
  const hdg = ((Math.atan2(_fw.x, -_fw.z) / D2R) + 360) % 360;
  let dh = hdg - s.hdg; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  s.turnRate += (dh / dt - s.turnRate) * Math.min(1, dt * 4);
  s.hdg = hdg;
  s.alt = s.pos.y / FT; s.agl = (s.pos.y - 1.45 - ground(s.pos.x, s.pos.z)) / FT;
  s.vs += (s.vel.y / FT * 60 - s.vs) * Math.min(1, dt * 3);
  s.ball += (clamp(-fyAero / G * 4, -1, 1) - s.ball) * Math.min(1, dt * 5);
  s.nz = (_f.clone().dot(UP) / AC.m) / G;
  // fuel burn ~ 8 gph at cruise
  if (s.running) { const gph = 2 + 9 * Math.pow(s.rpm / 2700, 3); const burn = gph / 3600 * dt; if (c.fuel === 1) s.fuelL = Math.max(0, s.fuelL - burn); else if (c.fuel === 2) s.fuelR = Math.max(0, s.fuelR - burn); else if (c.fuel === 0) { s.fuelL = Math.max(0, s.fuelL - burn / 2); s.fuelR = Math.max(0, s.fuelR - burn / 2); } }
  s.oilT += ((s.running ? 165 + 35 * (s.rpm / 2700) : 60) - s.oilT) * dt * 0.01;
  s.oilP += ((s.running ? 30 + 45 * Math.min(1, s.rpm / 2000) : 0) - s.oilP) * dt * 1.5;
  s.amps += (((c.bat && c.alt && s.rpm > 1000) ? 3 : (c.bat ? -6 : 0)) - s.amps) * dt * 2;
}

function engine(s, c, dt, V) {
  const Vkt = V / KT;
  const fuelOK = c.fuel !== 3 && (c.fuel === 0 ? (s.fuelL + s.fuelR) > 0.1 : c.fuel === 1 ? s.fuelL > 0.05 : s.fuelR > 0.05);
  if (fuelOK) s.fuelStarve = Math.max(0, s.fuelStarve - dt * 2); else s.fuelStarve += dt;
  const fuelFlowing = s.fuelStarve < 8;
  const ignition = c.mags > 0;
  const mixOK = c.mixture > 0.15;
  const cranking = c.mags === 4 && c.bat;
  if (s.running && (!fuelFlowing || !ignition || !mixOK || s.failed)) s.running = false;
  if (!s.running && !s.failed && fuelFlowing && ignition && mixOK && (s.rpm > 380 || (cranking && s.rpm > 200))) s.running = true;
  let target;
  if (s.running) {
    const full = rpmFull(Vkt);
    target = AC.rpmIdle + (full - AC.rpmIdle) * Math.pow(c.throttle, 0.85);
    if (c.mags === 1) target -= 75; else if (c.mags === 2) target -= 100;
    if (c.carb) target -= 60 + 40 * c.throttle;
    target *= 0.86 + 0.14 * clamp((c.mixture - 0.15) / 0.5, 0, 1);
  } else {
    target = clamp(Vkt * 8 - 220, 0, 1300);
    if (cranking) target = Math.max(target, 260);
  }
  const tau = s.running ? 0.6 : 1.4;
  s.rpm += (target - s.rpm) * Math.min(1, dt / tau);
}

/* ---------------- trim: steady flight at V (m/s), flight-path angle gamma (rad) ---------------- */
export function trimFor(V, gamma, h, fi) {
  const rho = isaRho(h), qd = 0.5 * rho * V * V, W = AC.m * G;
  const CL = W * Math.cos(gamma) / (qd * AC.S);
  const alpha = (CL - AC.CL0 - AC.dCL0[fi]) / AC.CLa;
  const CD = AC.CD0 + AC.CD0f[fi] + AC.k * CL * CL;
  const Treq = qd * AC.S * CD + W * Math.sin(gamma);
  // throttle by bisection on steady-state thrust
  let lo = 0, hi = 1, thr = 1;
  for (let i = 0; i < 40; i++) {
    thr = (lo + hi) / 2;
    const rpm = AC.rpmIdle + (rpmFull(V / KT) - AC.rpmIdle) * Math.pow(thr, 0.85);
    const T = thrustOf(rpm, V * Math.cos(alpha), rho);
    if (T > Treq) hi = thr; else lo = thr;
  }
  const rpm = AC.rpmIdle + (rpmFull(V / KT) - AC.rpmIdle) * Math.pow(thr, 0.85);
  const T = thrustOf(rpm, V, rho), qslip = Math.max(0, T) / 2.84 * 0.55;
  const de = -(AC.Cm0 + AC.Cma * alpha + AC.Cmf[fi]) * qd / ((qd + qslip) * AC.Cmde);
  return { alpha, throttle: thr, trim: clamp(de, -AC.trimMax, AC.trimMax), rpm, feasible: Treq <= thrustOf(AC.rpmIdle + (rpmFull(V / KT) - AC.rpmIdle), V, rho) };
}

/** put the aircraft in steady flight */
export function setFlight(s, c, { x, z, h, hdg, Vkt, gamma = 0, flap = 0, throttle = null }) {
  const V = Vkt * KT, tr = trimFor(V, gamma, h, flap);
  const pitch = tr.alpha + gamma;
  s.q.setFromEuler(new THREE.Euler(pitch, -hdg * D2R, 0, 'YXZ'));
  s.pos.set(x, h, z);
  const d = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(1, 0, 0), gamma).applyAxisAngle(new THREE.Vector3(0, 1, 0), -hdg * D2R);
  s.vel.copy(d).multiplyScalar(V);
  s.w.set(0, 0, 0);
  s.running = true; s.failed = false; s.rpm = tr.rpm; s.flapPos = flap; s.crashed = false; s.hardTouch = 0; s.fuelStarve = 0;
  s.hdg = hdg; s.vs = s.vel.y / FT * 60;
  c.throttle = throttle ?? tr.throttle; c.trim = tr.trim; c.flap = flap; c.pitch = c.roll = c.yaw = 0; c.brakeL = c.brakeR = 0; c.park = false;
  c.mixture = 1; c.carb = 0; c.mags = 3; c.fuel = 0;
  return tr;
}
/** on the ground, stationary, heading hdg */
export function setGround(s, c, { x, z, hdg, ground, running = true }) {
  s.q.setFromEuler(new THREE.Euler(0, -hdg * D2R, 0, 'YXZ'));
  const h = ground(x, z);
  s.pos.set(x, h + 1.45 - 0.08, z); s.vel.set(0, 0, 0); s.w.set(0, 0, 0);
  s.running = running; s.failed = false; s.rpm = running ? AC.rpmIdle : 0; s.flapPos = 0; s.crashed = false; s.hardTouch = 0; s.fuelStarve = 0; s.hdg = hdg; s.vs = 0;
  Object.assign(c, { throttle: 0, trim: -0.06, flap: 0, pitch: 0, roll: 0, yaw: 0, brakeL: 0, brakeR: 0, park: false, mixture: 1, carb: 0, mags: 3, fuel: 0 });
}

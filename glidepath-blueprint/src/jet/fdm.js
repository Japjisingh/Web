/* Ground and flight dynamics for the generic medium twin-jet (about 64 t, two engines of about 120 kN).
   Believable and teachable, not certified: point-mass flight path with a simple attitude control law (the stick
   commands pitch rate and roll rate; attitude is held when the stick is released), a bicycle steering model on the
   ground, rolling friction, toe brakes with brake heating, flaps / slats, gear, speed brakes, ground spoilers, reverse thrust
   and an autobrake (RTO / LO / MED). In the air the rudder makes a sideslip (the flight path follows the air mass, so a
   crosswind needs a crab angle); touchdown measures the sink rate, crab and pitch; bounces and tail strikes are detected.
   SI units, fixed timestep, no three.js (runs in Node for tests). Every figure is approximate and generic.
   Scene frame (see layout.js): x right, y up, z aft. yaw: rotation about +y, the nose points along (-sin yaw, -cos yaw).
   The reference point is the main-gear contact point; h is its height above the runway. */
import { PARK, PUSH_PATH, LINEUP, P, yawOfA, hdgOfYaw, yawOfHdg, WIND, ELEV_FT, WHEELBASE, toSN } from './layout.js';

export const KT = 0.514444, FT = 0.3048, G = 9.80665;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lag = (x, t, tau, dt) => x + (t - x) * (1 - Math.exp(-dt / Math.max(1e-3, tau)));
const towards = (x, t, rate, dt) => x + clamp(t - x, -rate * dt, rate * dt);

export const AF = {
  m: 64000, S: 122.6,
  Tmax: 120000, n1Toga: 92,                          // per engine, sea level static at TOGA N1
  CLa: 5.1, CL0: [0.24, 0.74, 0.86, 0.95, 1.05], CLmax: [1.42, 1.95, 2.15, 2.35, 2.6], aMax: [11.5, 14, 14.5, 15, 15.5],
  CD0: 0.0215, CDflap: [0, 0.009, 0.021, 0.035, 0.062], CDgear: 0.018, k: 0.047,
  VFE: [350, 230, 200, 185, 177], VLO: 220, VLE: 280, VMO: 350,
  mu0: 0.0085, mu1: 0.0005, muBrk: 0.48, muBrkWet: 0.28, brakeCap: 71000,
  CDsb: 0.032, CLsb: 0.12,                            // speed brakes in flight (full extension)
  abDecel: [0, 1.7, 2.6, 0], abJerk: 1.4,             // autobrake LO / MED target deceleration (m/s²), onset rate (m/s³)
  tailPitch: 11.7, tailArm: 17, wheelbase: WHEELBASE
};
export const FLAP_NAMES = ['0', '1', '2', '3', 'FULL'];
export const rho = altM => 1.225 * Math.pow(Math.max(0.2, 1 - 2.2558e-5 * altM), 4.2559);
/** thrust of one engine (N) from N1 (%), air density and Mach number (thrust lapse with speed and altitude) */
export function thrustOf(n1, altM, mach) { if (n1 < 1) return 0; return AF.Tmax * Math.pow(n1 / AF.n1Toga, 2.2) * Math.pow(rho(altM) / 1.225, 0.75) * (1 - 0.95 * Math.min(0.5, mach)); }
/** wind as a scene vector (m/s, the direction the air moves) */
export function windVec(w = WIND) { const yaw = yawOfHdg((w.from + 180) % 360); return { x: -Math.sin(yaw) * w.kt * KT, z: -Math.cos(yaw) * w.kt * KT }; }

export function createFDM() {
  const F = { events: [] };
  const emit = (type, d = {}) => F.events.push({ type, ...d });
  F.reset = (at = 'park') => {
    const pose = at === 'lineup' ? { ...P(LINEUP.s, LINEUP.n), yaw: yawOfA(LINEUP.a) } : { ...P(PARK.s, PARK.n), yaw: yawOfA(PARK.a) };
    Object.assign(F, {
      x: pose.x, z: pose.z, h: 0, yaw: pose.yaw, pitch: 0, roll: 0, q: 0, p: 0,
      u: 0, V: 0, gamma: 0, vs: 0, onGround: true, airT: 0, gndT: 0,
      flap: 0, gear: 1, spoiler: 0, sb: 0, abActive: false, abDecel: false, decel: 0, brakeCmd: 0, abMode: 0, abTgt: 0, abT: 0, abCmd: 0, psi: pose.yaw, beta: 0,
      td: null, tdT: -1, landed: false, noseT: -1, bounces: 0, rev: 0,
      brakeT: [68, 74, 61, 70], tailstrike: false, push: null, mode: 'GROUND', nwsAngle: 0,
      ias: 0, tas: 0, gs: 0, trk: 0, ax: 0, vx: 0, vz: 0
    });
    F.events.length = 0; derived(0);
  };
  /** place the aircraft in the air (approach scenarios): o = { x, z, h, yaw, ias, gamma (rad), flap, gear } */
  F.setAir = (o) => {
    F.reset('park'); const r = rho(ELEV_FT * FT + o.h), V = o.ias * KT / Math.sqrt(r / 1.225);
    Object.assign(F, { x: o.x, z: o.z, h: o.h, yaw: o.yaw, psi: o.yaw, beta: 0, onGround: false, V, u: 0, gamma: o.gamma || 0, flap: o.flap || 0, gear: o.gear ? 1 : 0, airT: 30, mode: 'AIR' });
    const W = AF.m * G, q = 0.5 * r * V * V, fi = Math.min(3, Math.floor(F.flap)), ff = F.flap - fi, cl0 = AF.CL0[fi] + (AF.CL0[Math.min(4, fi + 1)] - AF.CL0[fi]) * ff;
    F.pitch = F.gamma + (W / (q * AF.S) - cl0) / AF.CLa;   // trimmed attitude for level (or the given) flight path
    derived(0);
  };
  /* scripted pushback: the tug pushes the aircraft back along PUSH_PATH and turns it onto the taxi line */
  F.startPush = () => { if (F.mode !== 'GROUND' || F.push || F.u > 0.3) return false; F.push = { t: 0, dur: 46, idx: 0, done: false, disconnectT: -1 }; F.mode = 'PUSH'; emit('pushStart'); return true; };
  function pushStep(dt, inp) {
    const pu = F.push;
    if (inp.park) { pu.held = true; return; }                       // the tug waits while the parking brake is set
    pu.held = false;
    if (pu.done) { pu.disconnectT -= dt; if (pu.disconnectT <= 0) { F.mode = 'GROUND'; F.push = { ...pu, gone: true }; emit('pushDone'); } return; }
    pu.t += dt; const k = clamp(pu.t / pu.dur, 0, 1), e = k * k * (3 - 2 * k), fi = e * (PUSH_PATH.length - 1), i = Math.min(PUSH_PATH.length - 2, Math.floor(fi)), f = fi - i;
    const a = PUSH_PATH[i], b = PUSH_PATH[i + 1], s = a.s + (b.s - a.s) * f, n = a.n + (b.n - a.n) * f;
    const pos = P(s, n), dirA = Math.atan2(-(b.n - a.n), -(b.s - a.s));  // moving backwards: the nose points opposite the path tangent
    const px = F.x, pz = F.z; F.x = pos.x; F.z = pos.z; F.yaw = yawOfA(dirA);
    F.u = -Math.hypot(F.x - px, F.z - pz) / Math.max(dt, 1e-6);
    if (k >= 1) { pu.done = true; pu.disconnectT = 8; F.u = 0; emit('pushStopped'); }
  }

  /** inp: { T:[N,N], pitch, roll (-1..1, + aft / right), rudder, tiller (+ right), brakeL, brakeR (0..1), park, flapLever (0..4),
   *  gearDown, spoilerArmed, autoBrk (0 off, 1 LO, 2 MED, 3 MAX), thrIdle, ap: { q, p } (rad/s, when the autopilot flies) } */
  F.step = (dt, inp) => {
    const W = AF.m * G, altM = ELEV_FT * FT + F.h, r = rho(altM), wv = windVec(inp.wind);
    const dx = -Math.sin(F.yaw), dz = -Math.cos(F.yaw);
    // flaps / slats and gear move towards their levers
    F.flap = towards(F.flap, clamp(inp.flapLever, 0, 4), 1 / 7, dt);
    const gTgt = inp.gearDown || F.onGround ? 1 : 0, g0 = F.gear; F.gear = towards(F.gear, gTgt, 1 / 9, dt);
    if (g0 < 1 && F.gear >= 1) emit('gearDown'); if (g0 > 0 && F.gear <= 0) emit('gearUp'); if (g0 === 1 && F.gear < 1) emit('gearMoving');
    const fi = Math.min(3, Math.floor(F.flap)), ff = F.flap - fi, mix = arr => arr[fi] + (arr[Math.min(4, fi + 1)] - arr[fi]) * ff;
    const CL0 = mix(AF.CL0), CLmax = mix(AF.CLmax), CDf = mix(AF.CDflap), aMax = mix(AF.aMax) * D2R;
    const Tsum = (inp.T[0] || 0) + (inp.T[1] || 0);
    // ground spoilers: armed, on the ground, levers at idle, above about 72 kt (take-off rejected or landing)
    const spoTgt = (inp.spoilerArmed || inp.sbLever > 0) && F.onGround && inp.thrIdle && F.ias > 72 ? 1 : inp.thrIdle && F.onGround && F.spoiler > 0 && F.gs > 3 ? 1 : 0;
    F.spoiler = towards(F.spoiler, spoTgt, 1.5, dt);
    // speed brakes in flight follow the lever (half / full); retracted on the ground (the ground spoilers take over)
    F.sb = towards(F.sb, F.onGround ? 0 : clamp(inp.sbLever || 0, 0, 1), 0.8, dt);
    if (F.mode === 'PUSH') { pushStep(dt, inp); derived(dt, wv, r); return; }

    if (F.onGround) {
      const hw = -(wv.x * dx + wv.z * dz), Va = F.u + hw, qd = 0.5 * r * Va * Math.abs(Va);
      const CL = Math.min(CLmax, CL0 + AF.CLa * F.pitch) - 0.7 * F.spoiler, CD = AF.CD0 + CDf + AF.CDgear * F.gear + AF.k * CL * CL + 0.09 * F.spoiler;
      const L = qd * AF.S * CL, D = qd * AF.S * CD, Ng = Math.max(0, W - L), T = Tsum * Math.cos(F.pitch);
      // brakes: pedals, parking brake, autobrake: RTO (MAX armed, above 72 kt, levers to idle) or landing LO / MED
      // (LO / MED start when the ground spoilers deploy after touchdown and hold a target deceleration)
      const pedal = Math.max(inp.brakeL || 0, inp.brakeR || 0), muB = inp.wet ? AF.muBrkWet : AF.muBrk;
      if (inp.autoBrk === 3 && inp.thrIdle && F.ias > 72 && F.gs > 20) { if (!F.abActive) emit('rto'); F.abActive = true; F.abMode = 3; }
      if ((inp.autoBrk === 1 || inp.autoBrk === 2) && F.landed && !F.abActive && F.spoiler > 0.5 && F.gs > 20 && inp.thrIdle && F.abMode !== -1) { F.abActive = true; F.abMode = inp.autoBrk; F.abT = 0; F.abTgt = 0; emit('autobrake', { mode: inp.autoBrk }); }
      if (F.abActive && (!inp.thrIdle || inp.autoBrk !== F.abMode || (F.abMode !== 3 && pedal > 0.6))) { if (F.abMode !== 3) emit('abOff', { gs: F.gs, why: pedal > 0.6 ? 'pedals' : !inp.thrIdle ? 'thrust' : 'selector' }); F.abActive = false; F.abMode = F.abMode !== 3 ? -1 : 0; }
      let abCmd = 0;
      if (F.abActive && F.abMode === 3) abCmd = 1;
      else if (F.abActive) {
        F.abT += dt; const tgt = AF.abDecel[F.abMode], delay = F.abMode === 1 ? 4 : 0;
        if (F.abT > delay) F.abTgt = Math.min(tgt, F.abTgt + AF.abJerk * dt);
        const need = AF.m * F.abTgt - (D + (AF.mu0 + AF.mu1 * Math.abs(F.u)) * Ng - T);           // brake force for the target deceleration
        abCmd = clamp(need / Math.max(1, muB * 0.92 * Ng), 0, 1);
      }
      F.abCmd = abCmd;
      const bL = Math.max(inp.brakeL || 0, inp.park ? 1 : 0, abCmd), bR = Math.max(inp.brakeR || 0, inp.park ? 1 : 0, abCmd);
      F.brakeCmd = (bL + bR) / 2;
      const Fb = muB * 0.92 * Ng * F.brakeCmd, Fr = (AF.mu0 + AF.mu1 * Math.abs(F.u)) * Ng;
      if (Math.abs(F.u) < 0.02 && Math.abs(T - D) <= Fr * 1.15 + Fb) { F.u = 0; F.ax = 0; }
      else {
        const sgn = Math.sign(F.u) || Math.sign(T - D) || 1;
        const a = (T - D * Math.sign(Va || 1) - sgn * (Fr + Fb)) / AF.m, u0 = F.u;
        F.u += a * dt; if (u0 !== 0 && Math.sign(F.u) !== Math.sign(u0)) F.u = 0; F.ax = a;
        // brake heating: energy into the four brakes (left pair / right pair by pedal split)
        const P = Fb * Math.abs(F.u), sh = bL + bR > 0 ? bL / (bL + bR) : 0.5;
        for (let j = 0; j < 4; j++) F.brakeT[j] += P * dt * (j < 2 ? sh : 1 - sh) / 2 / AF.brakeCap;
      }
      F.decel = -F.ax; F.abDecel = F.abActive && (F.abMode === 3 ? F.decel > 2.5 : F.decel > 0.8 * AF.abDecel[F.abMode] && F.abT > 1);
      // steering: tiller (about ±75° at low speed, fading out above 20 kt) and rudder pedals (about ±6°)
      const ukt = Math.abs(F.u) / KT, auth = ukt < 20 ? 1 : clamp(1 - (ukt - 20) / 30, 0, 1);
      const delta = clamp((inp.tiller || 0) * 75 * auth + (inp.rudder || 0) * 6, -75, 75) * D2R;
      F.nwsAngle = lag(F.nwsAngle, delta, 0.25, dt);
      let rate = F.u * Math.tan(F.nwsAngle) / AF.wheelbase;
      const latMax = 0.15 * G / Math.max(0.5, Math.abs(F.u)); rate = clamp(rate, -latMax, latMax);
      rate += (inp.rudder || 0) * clamp(Va / 70, 0, 1) ** 2 * 3 * D2R;                       // rudder: aerodynamic yaw at speed
      rate += ((inp.brakeR || 0) - (inp.brakeL || 0)) * clamp(F.u / 3, 0, 1) * 0.1;          // differential braking
      const xw = wv.x * Math.cos(F.yaw) - wv.z * Math.sin(F.yaw);                                // crosswind from the right (+) or left (−), m/s
      rate -= clamp(xw / Math.max(10, Math.abs(Va)), -0.3, 0.3) * clamp(Math.abs(F.u) / 60, 0, 1) * 0.02;   // weathervane: the nose turns into the wind at speed
      if (F.pitch > 0.5 * D2R) rate *= 0.3;                                                  // nose wheel off the ground
      F.yaw -= rate * dt;                                                                    // right turn = heading up = yaw down
      F.x += dx * F.u * dt; F.z += dz * F.u * dt;
      // rotation about the main gear: elevator authority builds from about 100 kt
      const auth2 = clamp((Va / KT - 100) / 30, 0, 1);
      const stick = inp.ap ? inp.ap.q / (4.5 * D2R) : inp.pitch;
      const qc = stick > 0.05 ? stick * 4.5 * D2R * auth2 : stick < -0.05 ? stick * 3 * D2R : -2 * D2R;
      F.q = lag(F.q, qc, 0.35, dt); F.pitch = Math.max(0, F.pitch + F.q * dt); if (F.pitch === 0 && F.q < 0) F.q = 0;
      if (F.pitch > AF.tailPitch * D2R && !F.tailstrike) { F.tailstrike = true; emit('tailstrike'); }
      if (F.landed && F.noseT < 0 && F.pitch < 0.3 * D2R) { F.noseT = F.gndT; emit('noseDown', { t: F.gndT, ias: F.ias }); }
      F.gndT += dt;
      F.roll = lag(F.roll, 0, 0.3, dt); F.p = 0; F.psi = F.yaw; F.beta = 0;
      if (L > W && F.pitch > 2 * D2R) {
        F.onGround = false; F.V = Va; F.gamma = 0; F.airT = 0; F.abActive = false; F.psi = F.yaw; F.beta = 0;
        if (F.landed && F.gndT < 8 && !inp.toga) { F.bounces++; emit('bounce', { kind: 'skip', ias: F.ias }); } else { F.landed = false; emit('liftoff', { ias: F.ias, pitch: F.pitch / D2R }); }
      }
    } else {
      const V = Math.max(20, F.V), qd = 0.5 * r * V * V, alpha = F.pitch - F.gamma;
      let CL = CL0 + AF.CLa * alpha; if (alpha > aMax + 2 * D2R) CL = CLmax * 0.8; CL = Math.min(CL, CLmax) - AF.CLsb * F.sb;
      // ground effect below about half a wing span: a little more lift, less induced drag (helps the flare, causes float when fast)
      const ge = clamp(1 - F.h / 17, 0, 1);
      const CD = AF.CD0 + CDf + AF.CDgear * F.gear + AF.k * CL * CL * (1 - 0.35 * ge) + AF.CDsb * F.sb, L = qd * AF.S * CL * (1 + 0.06 * ge), D = qd * AF.S * CD;
      // sideslip from the rudder (nose yaws away from the flight path; fades when the rudder is centred)
      const bT = -(inp.rudder || 0) * 10 * D2R * clamp(V / 60, 0.4, 1);
      F.beta = lag(F.beta, bT, 0.9, dt);
      const Ybeta = qd * AF.S * 0.9 * F.beta;                                   // side force pushes the flight path towards the nose
      F.V += ((Tsum * Math.cos(alpha) * Math.cos(F.beta) - D * (1 + 2 * F.beta * F.beta)) / AF.m - G * Math.sin(F.gamma)) * dt;
      F.gamma += ((L * Math.cos(F.roll) + Tsum * Math.sin(alpha) - W * Math.cos(F.gamma)) / (AF.m * V)) * dt;
      F.psi -= ((L * Math.sin(F.roll) - Ybeta) / (AF.m * V * Math.cos(F.gamma))) * dt;
      F.yaw = F.psi + F.beta;
      // control law: stick → pitch rate / roll rate; attitude held when released; pitch, bank and angle-of-attack limits
      let qc = inp.ap ? inp.ap.q : inp.pitch * 5 * D2R;
      // flare law below about 50 ft (manual): the attitude reference slowly lowers, so the pilot has to pull for the flare
      if (!inp.ap && F.h < 15 && F.gear > 0.9 && F.gamma < -0.01 && Math.abs(inp.pitch) < 0.05) qc = -0.35 * D2R;
      if (alpha > aMax - 1.5 * D2R) qc = Math.min(qc, -(alpha - (aMax - 1.5 * D2R)) * 1.5);
      if (F.pitch > 25 * D2R) qc = Math.min(qc, 0); if (F.pitch < -15 * D2R) qc = Math.max(qc, 0);
      F.q = lag(F.q, qc, 0.45, dt); F.pitch += F.q * dt;
      let pc = inp.ap ? inp.ap.p : inp.roll * 15 * D2R;
      if (!inp.ap && Math.abs(inp.roll) < 0.05 && Math.abs(F.roll) > 33 * D2R) pc = -Math.sign(F.roll) * 5 * D2R;
      if (Math.abs(F.roll) > 67 * D2R && Math.sign(pc) === Math.sign(F.roll)) pc = 0;
      F.p = lag(F.p, pc, 0.3, dt); F.roll += F.p * dt;
      F.h += V * Math.sin(F.gamma) * dt; F.airT += dt;
      const dvx = -Math.sin(F.psi), dvz = -Math.cos(F.psi);
      F.x += (dvx * V * Math.cos(F.gamma) + wv.x) * dt; F.z += (dvz * V * Math.cos(F.gamma) + wv.z) * dt;
      F.ax = 0;
      // tail strike in the flare: tail cone about 17 m behind the main gear, 11.7° clearance with the gear on the ground
      if (!F.tailstrike && F.pitch > AF.tailPitch * D2R && F.h < AF.tailArm * Math.sin(F.pitch - AF.tailPitch * D2R)) { F.tailstrike = true; emit('tailstrike', { air: true }); }
      if (F.h <= 0) {
        const vs = F.vs, sink = -vs, trkYaw = Math.atan2(-F.vx, -F.vz), crab = Math.atan2(Math.sin(F.yaw - trkYaw), Math.cos(F.yaw - trkYaw)) / D2R, sn = toSN(F.x, F.z);
        const first = !F.landed;
        if (first) { F.td = { fpm: sink / FT * 60, vs, pitch: F.pitch / D2R, roll: F.roll / D2R, crab, ias: F.ias, gs: F.gs, s: sn.s, n: sn.n, t: F.airT }; F.landed = true; F.gndT = 0; F.noseT = -1; F.abMode = 0; }
        F.h = 0;
        if (sink > 3.3 && F.spoiler < 0.3) {   // hard contact: the gear rebounds the aircraft into the air
          F.gamma = Math.asin(clamp(0.25 * sink / V, 0, 0.1)); F.bounces++; F.h = 0.05;
          emit('touchdown', { vs, fpm: sink / FT * 60, first, hard: true }); emit('bounce', { kind: 'hard', fpm: sink / FT * 60 });
        } else {
          F.onGround = true; F.u = V * Math.cos(F.gamma) * Math.cos(F.beta) - (-(wv.x * dx + wv.z * dz)); F.gamma = 0; F.roll = 0; F.psi = F.yaw; F.beta = 0;
          if (first || F.gndT > 1) emit('touchdown', { vs, fpm: sink / FT * 60, first, crab });
        }
      }
    }
    for (let j = 0; j < 4; j++) F.brakeT[j] = 15 + (F.brakeT[j] - 15) * Math.exp(-dt / (F.onGround ? 1500 : 700));
    derived(dt, wv, r);
  };
  function derived(dt, wv = windVec(), r = rho(ELEV_FT * FT + F.h)) {
    const dx = -Math.sin(F.yaw), dz = -Math.cos(F.yaw);
    if (F.onGround) { F.vx = dx * F.u; F.vz = dz * F.u; F.vs = 0; const hw = -(wv.x * dx + wv.z * dz); F.tas = Math.max(0, F.u + hw); }
    else { const vx = -Math.sin(F.psi ?? F.yaw), vz = -Math.cos(F.psi ?? F.yaw); F.vx = vx * F.V * Math.cos(F.gamma) + wv.x; F.vz = vz * F.V * Math.cos(F.gamma) + wv.z; F.vs = F.V * Math.sin(F.gamma); F.tas = F.V; }
    F.ias = F.tas * Math.sqrt(r / 1.225) / KT;
    F.gs = Math.hypot(F.vx, F.vz) / KT;
    F.hdg = hdgOfYaw(F.yaw);
    F.trk = F.gs > 3 ? hdgOfYaw(Math.atan2(-F.vx, -F.vz)) : F.hdg;
    F.alt = ELEV_FT + F.h / FT; F.ra = F.h / FT;
  }
  F.reset();
  return F;
}

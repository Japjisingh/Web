/*
 * Glidepath Companion - deterministic demo flights.
 *
 * A small kinematic "scripted pilot" model of a C172S-class trainer. It is not a flight model:
 * each script is a list of legs (lateral + vertical targets) that a simple controller follows,
 * with a few realistic student errors written in so the scoring has something to teach.
 * Instructor failures change the simulated data (engine failure -> windmilling prop and a glide,
 * pitot/static blockages -> wrong instrument readings, alternator -> low volts, vacuum -> low suction).
 *
 * No network, no DOM, no randomness: the same script always produces the same flight.
 * Used by companion.js (demo mode) and by test/mock-xplane.mjs (fake X-Plane).
 */

const KT = 0.514444, FT = 0.3048, G = 9.80665, D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const norm360 = a => ((a % 360) + 360) % 360;
const wrap180 = a => ((((a % 360) + 540) % 360) - 180);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** 0 -> 1 -> 0 trapezoid between a and b with soft ramps. */
const bump = (x, a, b, ramp) => smooth(a, a + ramp, x) * (1 - smooth(b - ramp, b, x));
const val = (v, sim) => (typeof v === 'function' ? v(sim) : v);

/** Fictional training field. Flat terrain, magnetic variation 0, so magnetic = true. */
export const FIELD = Object.freeze({
  name: 'Glidepath Field', fictional: true, elevFt: 500,
  ident: '36', recip: '18', hdg: 0, lengthM: 900, widthM: 23,
  lat: 50.0, lon: -30.0, // deliberately in the open ocean: this airfield does not exist
});

/** Demo playback at "1x" runs the flight at this multiple of real time (~7 min circuit in ~85 s). */
export const TIME_SCALE = 5;
export const STEP = 0.1; // seconds of flight time per simulation step

const M_PER_DEG = 111320;
export function toLatLon(x, y) {
  return { lat: FIELD.lat + y / M_PER_DEG, lon: FIELD.lon + x / (M_PER_DEG * Math.cos(FIELD.lat * D2R)) };
}

/* ---------------------------------------------------------------- scripts */
// Altitudes in the scripts are feet above the field (AGL). Positions are metres east (x) / north (y)
// of the runway 36 threshold.

const TAKEOFF = [
  { name: 'Line-up and pre-take-off checks', phase: 'Line-up', lat: { k: 'rwy' }, vert: { k: 'hold' }, flaps: 0, until: s => s.legT > 8 },
  { name: 'Take-off roll, rotate at 55 kt', phase: 'Take-off roll', lat: { k: 'rwy' }, vert: { k: 'roll', vr: 55 }, flaps: 0, until: s => !s.S.ground },
];

const SCRIPTS = {
  circuit: {
    title: 'Normal circuit',
    start: { x: 0, y: 0, h: FIELD.elevFt, hdg: 0, ground: true },
    legs: [
      ...TAKEOFF,
      { name: 'Climb out at Vy 74 kt', phase: 'Climb-out', ahead: true, lat: { k: 'line', a: [0, 0], b: [0, 6000] }, vert: { k: 'alt', alt: 1000, spd: 90, climbSpd: 74 }, flaps: 0, until: s => s.agl >= 500 },
      {
        name: 'Crosswind, climbing to 1,000 ft', phase: 'Crosswind',
        enter: s => { s.vars.yc = s.S.y + 380; },
        lat: { k: 'line', a: s => [0, s.vars.yc], b: s => [-1900, s.vars.yc], maxBank: 20 },
        vert: { k: 'alt', alt: 1000, spd: 90, climbSpd: 74 }, flaps: 0,
      },
      {
        // Student error: drifts about 120 ft high mid-downwind before correcting.
        name: 'Downwind at 1,000 ft, 90 kt', phase: 'Downwind',
        lat: { k: 'line', a: s => [-1900, s.vars.yc], b: [-1900, -3300], maxBank: 20 },
        vert: { k: 'alt', alt: s => 1000 + 150 * bump(s.legT, 34, 76, 8), spd: 90 }, flaps: 0,
      },
      {
        // Student error: flies base about 9 kt fast (79 instead of 70).
        name: 'Base, descending with flap', phase: 'Base',
        lat: { k: 'line', a: [-1900, -3300], b: [0, -3300], maxBank: 20 },
        vert: { k: 'desc', vs: s => (s.legT < 3 ? 0 : -540), floor: 420, spd: s => (s.legT < 5 ? 88 : 79) },
        flaps: s => (s.legT < 6 ? 0 : s.legT < 26 ? 10 : 20),
      },
      {
        name: 'Final, full flap, 65 kt', phase: 'Final',
        lat: { k: 'line', a: [0, -3300], b: [0, 900], maxBank: 20 },
        vert: { k: 'gp', aim: 150, angle: 3, spd: 65 }, flaps: s => (s.legT < 6 ? 20 : 30),
      },
    ],
  },

  steep: {
    title: 'Steep turns',
    start: { x: -2600, y: -5200, h: FIELD.elevFt + 2500, hdg: 0, ias: 95, rpm: 2350, ground: false },
    legs: [
      { name: 'Straight and level, HASEL and lookout', phase: 'Entry', lat: { k: 'hdg', hdg: 0 }, vert: { k: 'alt', alt: 2500, spd: 95 }, flaps: 0, until: s => s.legT > 16 },
      { name: 'Steep turn left, 45°', phase: 'Left turn', lat: { k: 'turn', dir: -1, deg: 360, bank: 45 }, vert: { k: 'alt', alt: s => 2500 - 55 * bump(s.legT, 6, 26, 6), spd: 91 }, flaps: 0 },
      { name: 'Roll out and reverse', phase: 'Reversal', lat: { k: 'hdg', hdg: 0 }, vert: { k: 'alt', alt: 2500, spd: 93 }, flaps: 0, until: s => s.legT > 4 },
      // Student error: balloons about 130 ft high in the right turn (back pressure not relaxed).
      { name: 'Steep turn right, 45°', phase: 'Right turn', lat: { k: 'turn', dir: 1, deg: 360, bank: 46 }, vert: { k: 'alt', alt: s => 2500 + 250 * bump(s.legT, 6, 27, 5), spd: 90 }, flaps: 0 },
      { name: 'Roll out, straight and level', phase: 'Roll-out', lat: { k: 'hdg', hdg: 0 }, vert: { k: 'alt', alt: 2500, spd: 95 }, flaps: 0, until: s => s.legT > 14, last: true },
    ],
  },

  stall: {
    title: 'Power-off stall and recovery',
    start: { x: 2400, y: -6500, h: FIELD.elevFt + 3500, hdg: 0, ias: 90, rpm: 2250, ground: false },
    legs: [
      { name: 'HASEL checks and lookout', phase: 'Entry', lat: { k: 'hdg', hdg: 0 }, vert: { k: 'alt', alt: 3500, spd: 90 }, flaps: 0, until: s => s.legT > 14 },
      // Student error: lets the left wing drop as the stall approaches.
      { name: 'Power to idle, hold altitude', phase: 'Slowing', lat: { k: 'hdg', hdg: 0, drop: -13 }, vert: { k: 'decel', stallAt: 47.5 }, flaps: 0 },
      { name: 'Stall: nose down, full power, level the wings', phase: 'Recovery', lat: { k: 'level' }, vert: { k: 'recover' }, flaps: 0, until: s => s.vars.climbT && s.t - s.vars.climbT > 22, last: true },
    ],
  },

  efato: {
    title: 'Engine failure after take-off',
    start: { x: 0, y: 0, h: FIELD.elevFt, hdg: 0, ground: true },
    legs: [
      ...TAKEOFF,
      { name: 'Climb out at Vy 74 kt', phase: 'Climb-out', ahead: true, lat: { k: 'line', a: [0, 0], b: [0, 9000] }, vert: { k: 'alt', alt: 1000, spd: 80, climbSpd: 74 }, flaps: 0, until: s => s.agl > 990 && s.legT > 10 },
      { name: 'Level at 1,000 ft (no failure given)', phase: 'Level', lat: { k: 'line', a: [0, 0], b: [0, 9000] }, vert: { k: 'alt', alt: 1000, spd: 85 }, flaps: 0, until: s => s.legT > 20, last: true },
    ],
  },

  ils: {
    title: 'ILS approach',
    start: { x: 140, y: -10200, h: FIELD.elevFt + 1700, hdg: 355, ias: 90, rpm: 2250, ground: false },
    legs: [
      { name: 'Intercept the localiser at 1,700 ft', phase: 'Intercept', lat: { k: 'line', a: [0, -12000], b: [0, 900], maxBank: 15 }, vert: { k: 'alt', alt: 1700, spd: 90 }, flaps: 0, until: s => s.gpHeight() <= s.agl + 15 },
      {
        // Student errors: drifts 1.3 dots high on the glideslope near 1,300 ft and is slow to slow down.
        name: 'Glideslope descent', phase: 'ILS approach',
        lat: { k: 'line', a: [0, -12000], b: [0, 900], maxBank: 15 },
        vert: { k: 'gp', aim: 300, angle: 3, bias: s => 0.55 * bump(s.legT, 24, 68, 10), spd: s => (s.agl > 1250 ? 80 : s.agl > 700 ? 78 : 66) },
        flaps: s => (s.agl > 1450 ? 10 : s.agl > 900 ? 20 : 30),
      },
    ],
  },
};

export const DEMO_EXERCISES = Object.keys(SCRIPTS);

/* ---------------------------------------------------------------- model */

class DemoSim {
  constructor(id) {
    const sc = SCRIPTS[id] || SCRIPTS.circuit;
    this.id = SCRIPTS[id] ? id : 'circuit';
    this.script = sc;
    this.t = 0; this.legT = 0; this.legI = -1; this.done = false;
    this.S = Object.assign({ x: 0, y: 0, h: FIELD.elevFt, ias: 0, hdg: 0, bank: 0, vs: 0, pitch: 0, flaps: 0, rpm: 800, ground: true }, sc.start);
    if (!this.S.ground) this.S.pitch = 2;
    this.fail = { engine: false, alternator: false, vacuum: false, pitot: false, static: false };
    this.inst = { volts: 28.0, suction: 5.0, pitotH: null, pitotIas: null, staticH: null, altFailT: null };
    this.vars = {};
    this.land = null; // null | 'flare' | 'roll' | 'stopped'
    this.forced = null;
    this.line = null;
    this.rotated = false;
    this.tdVs = null;
    this.enterLeg(0);
  }

  get agl() { return this.S.h - FIELD.elevFt; }
  get leg() { return this.script.legs[this.legI]; }
  tas(ias = this.S.ias) { return Math.max(ias, 1) * KT * (1 + 0.017 * this.S.h / 1000); }

  /** Height (ft AGL) of the glidepath at the current position for the current/next gp leg. */
  gpHeight() {
    const L = this.script.legs.find(l => l.vert.k === 'gp');
    const dist = L.vert.aim - this.S.y;
    return dist * Math.tan(L.vert.angle * D2R) / FT;
  }

  resolveLine(L) {
    return { a: val(L.lat.a, this), b: val(L.lat.b, this) };
  }

  enterLeg(i) {
    this.legI = i; this.legT = 0;
    const L = this.leg;
    if (!L) return;
    if (L.enter) L.enter(this);
    this.line = L.lat.k === 'line' ? this.resolveLine(L) : null;
    if (L.lat.k === 'turn') this.turn = { done: 0, lastHdg: this.S.hdg, rolling: false };
    if (L.vert.k === 'decel') this.vars.altRef = this.S.h;
  }

  lineGuide(a, b) {
    const S = this.S, dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const px = S.x - a[0], py = S.y - a[1];
    const along = px * ux + py * uy, xte = px * uy - py * ux; // +ve = right of track
    const brg = norm360(Math.atan2(ux, uy) * R2D);
    return { hdg: norm360(brg - clamp(xte / 7, -35, 35)), remain: len - along, brg, xte };
  }

  bankTo(hdg, maxBank) {
    return clamp(wrap180(hdg - this.S.hdg) * 2.0, -maxBank, maxBank);
  }

  climbPerf() {
    const S = this.S;
    const base = 735 - 55 * (S.h / 1000);
    return Math.max(80, base * (1 - ((S.ias - 74) / 42) ** 2) - S.flaps * 9);
  }

  setFailure(name, on) {
    if (!(name in this.fail)) return;
    on = !!on;
    if (this.fail[name] === on) return;
    this.fail[name] = on;
    if (name === 'pitot' && !on) { this.inst.pitotH = null; this.inst.pitotIas = null; }
    if (name === 'static' && !on) { this.inst.staticH = null; }
    if (name === 'alternator') this.inst.altFailT = on ? this.t : null;
  }

  step(dt = STEP) {
    if (this.done) return;
    this.t += dt; this.legT += dt;
    const S = this.S;
    let L = this.leg;

    // Leg switching (time / condition based, or turn anticipation for line legs).
    if (!this.land && !this.forced && L) {
      let next = false;
      if (L.until) next = L.until(this);
      else if (L.lat.k === 'line' && this.line) {
        const g = this.lineGuide(this.line.a, this.line.b);
        const N = this.script.legs[this.legI + 1];
        if (N && N.lat.k === 'line') {
          const nl = this.resolveLine(N);
          const nb = this.lineGuide(nl.a, nl.b).brg;
          const d = Math.abs(wrap180(nb - g.brg));
          const r = this.tas() ** 2 / (G * Math.tan((N.lat.maxBank || 20) * D2R));
          if (g.remain < r * Math.tan(d / 2 * D2R) + 30) next = true;
        }
      } else if (L.lat.k === 'turn' && this.turn.finished) next = true;
      else if (L.vert.k === 'decel' && this.vars.stallT) next = true;
      if (next) {
        if (L.last) { this.done = true; return; }
        this.enterLeg(this.legI + 1); L = this.leg;
      }
    }

    if (this.fail.engine && !this.forced && !S.ground) {
      const ahead = !!(L && L.ahead) || this.agl < 600;
      this.forced = { t0: this.t, hdg0: S.hdg, vs0: S.vs, ahead, react: ahead && S.vs > 200 ? 4.1 : 2.0 };
    }
    if (this.fail.engine && S.ground && !this.land && L && L.vert.k === 'roll') this.land = 'roll'; // rejected take-off

    let bankCmd = 0, vsCmd = S.vs, iasTgt = S.ias, iasTau = 5, iasRate = null, power = 'auto', vsTau = 1.6;
    let flapsTgt = L ? val(L.flaps, this) : S.flaps;
    let groundHdg = FIELD.hdg;
    let rollRate = 10;

    if (this.land) {
      power = 'idle';
      groundHdg = this.forced ? S.hdg : FIELD.hdg;
      if (this.land === 'flare') {
        vsCmd = -clamp(this.agl * 7 + 60, 100, 420); vsTau = 1.0;
        iasTgt = 50; iasTau = 7;
        const hold = this.forced ? this.forced.hdgCmd ?? S.hdg : this.lineGuide([0, -3300], [0, 900]).hdg;
        bankCmd = this.bankTo(hold, 5);
        if (this.agl <= 0.4) {
          this.tdVs = S.vs; S.ground = true; S.vs = 0; S.h = FIELD.elevFt; S.bank = 0; this.land = 'roll';
        }
      } else if (this.land === 'roll') {
        iasRate = -2.6; vsCmd = 0;
        if (S.ias <= 0.5) { S.ias = 0; this.land = 'stopped'; this.vars.stopT = this.t; }
      } else {
        iasRate = 0; S.ias = 0;
        if (this.t - this.vars.stopT > 3) { this.done = true; }
      }
      flapsTgt = S.flaps;
    } else if (this.forced && !S.ground) {
      const F = this.forced, ft = this.t - F.t0;
      power = 'dead';
      if (ft < F.react) {
        // Startle: attitude held for a few seconds, so speed bleeds off.
        vsCmd = F.vs0 * Math.max(0, 1 - ft / F.react) * 0.7;
        iasRate = F.vs0 > 200 ? -4.2 : -1.6;
        bankCmd = S.bank;
        F.hdgCmd = S.hdg;
      } else {
        iasTgt = 68; iasTau = 3;
        const sink = 720 + 0.6 * (S.ias - 68) ** 2 + S.flaps * 9;
        vsCmd = -sink - clamp((68 - S.ias) * 45, -300, 900);
        if (F.ahead) { F.hdgCmd = norm360(F.hdg0 + 12); bankCmd = this.bankTo(F.hdgCmd, 15); }
        else {
          // Glide to a point on the extended centreline, then down the runway.
          if (!F.onFinal && (Math.hypot(S.x, S.y + 350) < 350 || (S.y < -350 && Math.abs(S.x) < 150))) F.onFinal = true;
          const tgt = F.onFinal ? this.lineGuide([0, -3300], [0, 900]).hdg : norm360(Math.atan2(0 - S.x, -350 - S.y) * R2D);
          F.hdgCmd = tgt; bankCmd = this.bankTo(tgt, 25);
        }
        flapsTgt = this.agl < 350 ? 30 : this.agl < 700 && !F.ahead ? 10 : S.flaps;
        if (!F.ahead) {
          // Too high for the runway: full flap and a sideslip to steepen the glide.
          const dist = Math.hypot(S.x, S.y - 200) + (F.onFinal ? 0 : 300);
          if (this.agl > dist * Math.tan(7 * D2R) / FT + 80) { flapsTgt = 30; vsCmd -= 550; F.slip = true; } else F.slip = false;
        }
        if (this.agl < 22) this.land = 'flare';
      }
    } else if (L) {
      // Lateral
      const lat = L.lat;
      if (lat.k === 'rwy') { bankCmd = 0; groundHdg = FIELD.hdg; }
      else if (lat.k === 'line') { const g = this.lineGuide(this.line.a, this.line.b); bankCmd = this.bankTo(g.hdg, lat.maxBank || 20); this.vars.hdgCmd = g.hdg; }
      else if (lat.k === 'level') bankCmd = 0;
      else if (lat.k === 'hdg') {
        bankCmd = this.bankTo(lat.hdg, 20);
        if (lat.drop && S.ias < 52) bankCmd = lat.drop; // wing drop near the stall
      } else if (lat.k === 'turn') {
        const T = this.turn;
        T.done += Math.abs(wrap180(S.hdg - T.lastHdg)); T.lastHdg = S.hdg;
        rollRate = 12;
        const omega = R2D * G * Math.tan(lat.bank * D2R) / this.tas();
        const lead = omega * (lat.bank / rollRate) * 0.5;
        if (T.done < lat.deg - lead) bankCmd = lat.dir * lat.bank;
        else { bankCmd = 0; if (Math.abs(S.bank) < 1.5) T.finished = true; }
      }

      // Vertical / speed
      const v = L.vert;
      if (v.k === 'hold') { power = 'idle'; iasRate = 0; S.ias = 0; }
      else if (v.k === 'roll') {
        power = 'full';
        iasRate = 2.9 - 0.022 * S.ias;
        if (S.ias >= v.vr) this.rotated = true;
        if (this.rotated && S.ias >= v.vr + 2.5) { S.ground = false; S.vs = 150; }
      } else if (v.k === 'alt') {
        const tgt = val(v.alt, this), err = tgt - this.agl, perf = this.climbPerf();
        if (err > 250 || (err > 60 && v.climbSpd && this.vars.climbing !== false)) { vsCmd = perf; power = 'full'; iasTgt = v.climbSpd || 74; }
        else { vsCmd = clamp(err * 3.2, -700, perf); iasTgt = val(v.spd, this); }
      } else if (v.k === 'desc') {
        vsCmd = val(v.vs, this);
        if (this.agl < v.floor) vsCmd = clamp((v.floor - this.agl) * 3, -200, 300);
        iasTgt = val(v.spd, this);
      } else if (v.k === 'gp') {
        const dist = v.aim - S.y;
        const ang = v.angle + (v.bias ? val(v.bias, this) : 0);
        const hPath = dist * Math.tan(ang * D2R) / FT;
        const gsFpm = this.tas() / KT * 101.27;
        vsCmd = -gsFpm * Math.tan(v.angle * D2R) + clamp((hPath - this.agl) * 2.4, -450, 450);
        iasTgt = val(v.spd, this);
        if (this.agl < 24 && dist < 700) this.land = 'flare';
      } else if (v.k === 'decel') {
        power = 'idle';
        vsCmd = clamp((this.vars.altRef - S.h) * 3, -250, 250);
        iasRate = S.ias > 60 ? -1.15 : -0.85;
        if (S.ias <= v.stallAt) this.vars.stallT = this.t;
      } else if (v.k === 'recover') {
        const lt = this.legT;
        power = lt < 1.1 ? 'idle' : 'full';
        if (!this.vars.pullT) {
          vsCmd = lt < 0.5 ? -800 : -1450; vsTau = 0.8;
          iasRate = lt < 0.6 ? -0.4 : 3.6;
          if (S.ias >= 61) this.vars.pullT = this.t;
        } else if (!this.vars.climbT) {
          vsCmd = 250; vsTau = 1.2; iasTgt = 70; iasTau = 4;
          if (S.vs > 0) this.vars.climbT = this.t;
        } else {
          vsCmd = this.climbPerf(); power = 'full'; iasTgt = 74; iasTau = 5;
        }
        if (lt < 0.9) bankCmd = S.bank; // still dropping
      }
    }

    // ---- integrate
    S.flaps += clamp(flapsTgt - S.flaps, -3 * dt, 3 * dt);
    if (S.ground) S.bank = 0;
    else S.bank += clamp(bankCmd - S.bank, -rollRate * dt, rollRate * dt);

    if (iasRate != null) S.ias = Math.max(0, S.ias + iasRate * dt);
    else S.ias += clamp((iasTgt - S.ias) / iasTau, -2.0, 2.0) * dt;

    const tas = this.tas();
    if (S.ground) S.hdg = groundHdg;
    else S.hdg = norm360(S.hdg + R2D * G * Math.tan(S.bank * D2R) / tas * dt);
    const gsMs = S.ground ? S.ias * KT : tas;
    S.x += gsMs * Math.sin(S.hdg * D2R) * dt;
    S.y += gsMs * Math.cos(S.hdg * D2R) * dt;

    if (!S.ground) {
      S.vs += clamp((vsCmd - S.vs) / vsTau, -1000, 1000) * dt;
      S.h += S.vs / 60 * dt;
      if (this.agl <= 0 && !this.land) { // arrived without a flare
        this.tdVs = S.vs; S.ground = true; S.vs = 0; S.h = FIELD.elevFt; this.land = 'roll';
      }
    }

    // Engine
    let rpmT;
    if (power === 'dead' || this.fail.engine) rpmT = S.ias > 25 ? 120 + 11 * S.ias : 0;
    else if (power === 'full') rpmT = S.ground ? 2290 + 1.2 * S.ias : 2300 + 4.5 * (S.ias - 74);
    else if (power === 'idle') rpmT = S.ground && S.ias < 1 ? 1000 : 680 + 6 * S.ias;
    else {
      const level = 1480 + 25 * (S.ias - 60) + 11 * S.flaps;
      const climb = S.vs > 0 ? S.vs / Math.max(this.climbPerf(), 100) * Math.max(0, 2350 - level) : S.vs * 0.62;
      rpmT = clamp(level + climb, 680 + 6 * S.ias, 2450);
    }
    S.rpm += (rpmT - S.rpm) * Math.min(1, dt / 0.9);

    // Pitch (display only): angle of attack plus flight-path angle.
    const gamma = S.ground ? 0 : Math.atan2(S.vs * FT / 60, tas) * R2D;
    let alpha = S.ground ? 0 : -1.5 + 7.5 * Math.pow(55 / Math.max(S.ias, 35), 2.4) - 0.1 * S.flaps;
    if (S.ground && this.rotated && !this.land) alpha = 8;
    if (this.land === 'flare') alpha += 2.5;
    S.pitch += ((alpha + gamma) - S.pitch) * Math.min(1, dt / (S.ground ? 1.4 : 0.8));

    // Instruments
    const I = this.inst;
    const voltsT = this.fail.alternator ? 24.3 - 0.0012 * (this.t - (I.altFailT ?? this.t)) : S.rpm > 900 ? 28.0 : 24.6;
    I.volts += (voltsT - I.volts) * Math.min(1, dt / 2.5);
    const suctionT = this.fail.vacuum ? 0 : clamp(5.0 * Math.min(1, S.rpm / 1000), 0, 5.2);
    I.suction += (suctionT - I.suction) * Math.min(1, dt / 3.5);
  }

  sample() {
    const S = this.S, I = this.inst;
    let iasInd = S.ias < 18 ? 0 : S.ias;
    let altInd = S.h, vsInd = S.vs;
    if (this.fail.pitot) {
      if (I.pitotH == null) { I.pitotH = S.h; I.pitotIas = iasInd; }
    }
    if (this.fail.static && I.staticH == null) I.staticH = S.h;
    if (this.fail.pitot && this.fail.static) iasInd = I.pitotIas;
    else if (this.fail.pitot) iasInd = Math.max(0, I.pitotIas + (S.h - I.pitotH) * 0.012);
    else if (this.fail.static) iasInd = Math.max(0, iasInd + (I.staticH - S.h) * 0.01);
    if (this.fail.static) { altInd = I.staticH; vsInd = 0; }

    const tas = this.tas();
    const { lat, lon } = toLatLon(S.x, S.y);
    // ILS: localiser antenna 300 m beyond the far end, glidepath antenna abeam the aim point.
    const ils = this.script.legs.find(l => l.vert.k === 'gp');
    const aim = ils ? ils.vert.aim : 300;
    const locDist = Math.max(200, FIELD.lengthM + 300 - S.y);
    const loc = Math.atan2(S.x, locDist) * R2D / 1.0;            // 1 dot = 1.0 deg, +ve = aircraft right of course
    const gpDist = Math.max(150, aim - S.y);
    const gsd = (Math.atan2(this.agl * FT, gpDist) * R2D - 3) / 0.28; // 1 dot = 0.28 deg, +ve = above the glidepath
    return {
      t: this.t,
      ias: S.ias, iasInd, alt: S.h, altInd, agl: Math.max(0, this.agl), vs: S.vs, vsInd,
      hdg: S.hdg, trk: S.hdg, pitch: S.pitch, bank: S.bank,
      lat, lon, gs: (S.ground ? S.ias : tas / KT),
      rpm: Math.max(0, S.rpm), flaps: Math.round(S.flaps * 10) / 10, ground: S.ground,
      thr: clamp((S.rpm - 700) / 1700, 0, 1),
      volts: I.volts, suction: I.suction,
      stall: !S.ground && S.ias < 53 && S.ias > 20,
      loc: clamp(loc, -2.5, 2.5), gsd: clamp(gsd, -2.5, 2.5),
      fail: { ...this.fail },
      demoPhase: this.land === 'roll' || this.land === 'stopped' ? 'Landing roll' : this.land === 'flare' ? 'Flare and touchdown' : this.forced && !S.ground ? 'Engine failure: glide' : (this.leg ? this.leg.name : ''),
    };
  }
}

const durCache = {};
/** Flight time (s) of a script flown with no failures. */
function baseDuration(id) {
  if (durCache[id] != null) return durCache[id];
  const sim = new DemoSim(id);
  let n = 0;
  while (!sim.done && n < 30000) {
    if (id === 'efato' && !sim.fail.engine && !sim.S.ground && sim.agl >= 400) sim.setFailure('engine', true);
    sim.step(STEP); n++;
  }
  return (durCache[id] = sim.t);
}

/**
 * Create a demo flight. Returns a small controller:
 *   step(dt)  advance flight time by dt seconds (use STEP)
 *   sample()  normalized sample (same shape the bridge sends in live mode)
 *   setFailure(name, on)
 */
export function createDemoFlight(exerciseId = 'circuit') {
  const sim = new DemoSim(exerciseId);
  return {
    id: sim.id,
    title: sim.script.title,
    runway: { lat: FIELD.lat, lon: FIELD.lon, hdg: FIELD.hdg, lengthM: FIELD.lengthM, widthM: FIELD.widthM, ident: FIELD.ident, recip: FIELD.recip, elevFt: FIELD.elevFt, name: FIELD.name },
    get duration() { return Math.max(baseDuration(sim.id), sim.t); },
    get t() { return sim.t; },
    get done() { return sim.done; },
    get failures() { return { ...sim.fail }; },
    get committed() { return !!sim.forced; },
    step: dt => sim.step(dt),
    sample: () => sim.sample(),
    setFailure: (name, on) => sim.setFailure(name, on),
  };
}

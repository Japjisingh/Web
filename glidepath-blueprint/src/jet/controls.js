/* Control semantics shared by the 3D flight deck, the test API and the Node tests.
   k: pb (push on / push off), gpb (guarded pb), mom (momentary), rot (rotary selector), tog (toggle switch),
      lever (detented lever), master (lift-and-move ENG MASTER), page (display page pb), ind (indicator: touch only), deco (inert),
      knob (turn / push / pull), key (flight computer key), avp (avionics momentary key), sel (one-of-several select pb), stick (sidestick check positions) */
import { avKnob, avPress, fmsKey, baroText, freqText } from './avionics.js';
const pb = (sw, name, extra = {}) => ({ k: 'pb', sw, name, ...extra });
const F = { free: true }; // avionics: never counted as a wrong control in the flows
export const CTL = {
  // ELEC
  bat1: pb('bat1', 'BAT 1'), bat2: pb('bat2', 'BAT 2'), extPwr: pb('extPwr', 'EXT PWR'), gen1: pb('gen1', 'GEN 1'), gen2: pb('gen2', 'GEN 2'), apuGen: pb('apuGen', 'APU GEN'), busTie: pb('busTie', 'BUS TIE'),
  acEssFeed: pb('acEssFeed', 'AC ESS FEED'), galy: pb('galy', 'GALLEY & CABIN'), commercial: pb('commercial', 'COMMERCIAL'),
  idg1: { k: 'deco', name: 'IDG 1 disconnect (guarded, not modelled)' }, idg2: { k: 'deco', name: 'IDG 2 disconnect (guarded, not modelled)' },
  batV1: { k: 'ind', name: 'BAT 1 voltage' }, batV2: { k: 'ind', name: 'BAT 2 voltage' },
  // IRS
  irs1: { k: 'rot', sw: 'irs1', pos: ['OFF', 'NAV', 'ATT'], name: 'IRS 1 mode selector' }, irs2: { k: 'rot', sw: 'irs2', pos: ['OFF', 'NAV', 'ATT'], name: 'IRS 2 mode selector' }, irs3: { k: 'rot', sw: 'irs3', pos: ['OFF', 'NAV', 'ATT'], name: 'IRS 3 mode selector' },
  ir1: pb('ir1', 'IR 1'), ir2: pb('ir2', 'IR 2'), ir3: pb('ir3', 'IR 3'), onBat: { k: 'ind', name: 'ON BAT light' },
  // FUEL
  pL1: pb('pL1', 'L TK PUMP 1'), pL2: pb('pL2', 'L TK PUMP 2'), pC1: pb('pC1', 'CTR TK PUMP 1'), pC2: pb('pC2', 'CTR TK PUMP 2'), pR1: pb('pR1', 'R TK PUMP 1'), pR2: pb('pR2', 'R TK PUMP 2'), xfeed: pb('xfeed', 'X FEED'), fuelMode: pb('fuelMode', 'FUEL MODE SEL'),
  // HYD
  hEng1: pb('hEng1', 'HYD ENG 1 PUMP'), hEng2: pb('hEng2', 'HYD ENG 2 PUMP'), hElec: pb('hElec', 'HYD ELEC PUMP'), ptu: pb('ptu', 'PTU'), ratMan: { k: 'deco', name: 'RAT MAN ON (guarded, not modelled)' },
  // AIR
  pack1: pb('pack1', 'PACK 1'), pack2: pb('pack2', 'PACK 2'), apuBleed: pb('apuBleed', 'APU BLEED'), eBleed1: pb('eBleed1', 'ENG 1 BLEED'), eBleed2: pb('eBleed2', 'ENG 2 BLEED'),
  xbleed: { k: 'rot', sw: 'xbleed', pos: ['SHUT', 'AUTO', 'OPEN'], name: 'X BLEED selector' }, ramAir: { k: 'deco', name: 'RAM AIR (guarded, not modelled)' }, hotAir: pb('hotAir', 'HOT AIR'),
  packFlow: { k: 'rot', sw: 'packFlow', pos: [0, 1, 2], labels: ['LO', 'NORM', 'HI'], name: 'PACK FLOW (not modelled)' },
  tCkpt: { k: 'deco', name: 'Cockpit temperature (not modelled)' }, tFwd: { k: 'deco', name: 'Forward cabin temperature (not modelled)' }, tAft: { k: 'deco', name: 'Aft cabin temperature (not modelled)' },
  // APU
  apuMaster: pb('apuMaster', 'APU MASTER SW'), apuStart: { k: 'mom', press: 'apuStart', name: 'APU START' },
  // FIRE
  firePb1: { k: 'gpb', sw: 'firePb1', guard: 'fireGuard1', name: 'ENG 1 FIRE pb (guarded)' }, firePbApu: { k: 'gpb', sw: 'firePbApu', guard: 'fireGuardApu', name: 'APU FIRE pb (guarded)' }, firePb2: { k: 'gpb', sw: 'firePb2', guard: 'fireGuard2', name: 'ENG 2 FIRE pb (guarded)' },
  agent1_1: { k: 'mom', press: 'agent1_1', name: 'ENG 1 AGENT 1' }, agent1_2: { k: 'mom', press: 'agent1_2', name: 'ENG 1 AGENT 2' }, agentApu_1: { k: 'mom', press: 'agentApu_1', name: 'APU AGENT' },
  agent2_1: { k: 'mom', press: 'agent2_1', name: 'ENG 2 AGENT 1' }, agent2_2: { k: 'mom', press: 'agent2_2', name: 'ENG 2 AGENT 2' },
  test1: { k: 'mom', press: 'test1', name: 'ENG 1 FIRE TEST' }, testApu: { k: 'mom', press: 'testApu', name: 'APU FIRE TEST' }, test2: { k: 'mom', press: 'test2', name: 'ENG 2 FIRE TEST' },
  // EXT LT / SIGNS / INT LT
  strobe: { k: 'tog', sw: 'strobe', pos: [0, 1, 2], labels: ['OFF', 'AUTO', 'ON'], name: 'STROBE' }, beacon: { k: 'tog', sw: 'beacon', pos: [0, 1], labels: ['OFF', 'ON'], name: 'BEACON' },
  wingLt: { k: 'tog', sw: 'wingLt', pos: [0, 1], labels: ['OFF', 'ON'], name: 'WING lights' }, navLogo: { k: 'tog', sw: 'navLogo', pos: [0, 1, 2], labels: ['OFF', '1', '2'], name: 'NAV & LOGO' },
  rwyTurn: { k: 'tog', sw: 'rwyTurn', pos: [0, 1], labels: ['OFF', 'ON'], name: 'RWY TURN OFF' }, landL: { k: 'tog', sw: 'landL', pos: [0, 1, 2], labels: ['RETRACT', 'OFF', 'ON'], name: 'LAND L' }, landR: { k: 'tog', sw: 'landR', pos: [0, 1, 2], labels: ['RETRACT', 'OFF', 'ON'], name: 'LAND R' },
  nose: { k: 'tog', sw: 'nose', pos: [0, 1, 2], labels: ['OFF', 'TAXI', 'T.O.'], name: 'NOSE light' },
  seatBelts: { k: 'tog', sw: 'seatBelts', pos: [0, 1], labels: ['OFF', 'ON'], name: 'SEAT BELTS' }, noSmoking: { k: 'tog', sw: 'noSmoking', pos: [0, 1, 2], labels: ['OFF', 'AUTO', 'ON'], name: 'NO SMOKING' },
  emerExit: { k: 'tog', sw: 'emerExit', pos: [0, 1, 2], labels: ['OFF', 'ARM', 'ON'], name: 'EMER EXIT LT' },
  annLt: { k: 'tog', sw: 'annLt', pos: [0, 1, 2], labels: ['DIM', 'BRT', 'TEST'], name: 'ANN LT' }, dome: { k: 'tog', sw: 'dome', pos: [0, 1, 2], labels: ['OFF', 'DIM', 'BRT'], name: 'DOME light' },
  intLtOvhd: { k: 'rot', sw: 'intLtOvhd', pos: [0, 1, 2], labels: ['OFF', 'DIM', 'BRT'], name: 'OVHD INTEG LT' },
  wiperL: { k: 'rot', sw: 'wiperL', pos: [0, 1, 2], labels: ['OFF', 'SLOW', 'FAST'], name: 'WIPER (captain)' }, wiperR: { k: 'rot', sw: 'wiperR', pos: [0, 1, 2], labels: ['OFF', 'SLOW', 'FAST'], name: 'WIPER (first officer)' },
  // ANTI ICE, PRESS, OXY
  wingAI: pb('wingAI', 'WING ANTI ICE'), eng1AI: pb('eng1AI', 'ENG 1 ANTI ICE'), eng2AI: pb('eng2AI', 'ENG 2 ANTI ICE'), probeHeat: pb('probeHeat', 'PROBE/WINDOW HEAT'),
  pressMan: pb('pressMan', 'CABIN PRESS MODE SEL'), ditching: { k: 'deco', name: 'DITCHING (guarded, not modelled)' }, ldgElev: { k: 'rot', sw: 'ldgElev', pos: [0, 1, 2], labels: ['AUTO', '0', '+2'], name: 'LDG ELEV (not modelled)' },
  crewOxy: pb('crewOxy', 'CREW OXY SUPPLY'), paxOxy: { k: 'deco', name: 'PAX OXY (guarded, not modelled)' }, maskMan: { k: 'deco', name: 'MASK MAN ON (guarded, not modelled)' },
  manStart1: pb('manStart1', 'ENG 1 MAN START (opens the start valve with the mode selector at IGN/START or CRANK)'), manStart2: pb('manStart2', 'ENG 2 MAN START (opens the start valve with the mode selector at IGN/START or CRANK)'),
  // PEDESTAL
  master1: { k: 'master', sw: 'master1', name: 'ENG 1 MASTER' }, master2: { k: 'master', sw: 'master2', name: 'ENG 2 MASTER' },
  engMode: { k: 'rot', sw: 'engMode', pos: ['CRANK', 'NORM', 'IGN'], labels: ['CRANK', 'NORM', 'IGN/START'], name: 'ENG MODE selector' },
  thr1: { k: 'lever', sw: 'thr1', pos: [0, 1, 2, 3], labels: ['IDLE', 'CL', 'FLX/MCT', 'TOGA'], name: 'Thrust lever 1' }, thr2: { k: 'lever', sw: 'thr2', pos: [0, 1, 2, 3], labels: ['IDLE', 'CL', 'FLX/MCT', 'TOGA'], name: 'Thrust lever 2' },
  parkBrk: { k: 'pb', sw: 'parkBrk', name: 'PARKING BRAKE handle' }, flaps: { k: 'lever', sw: 'flaps', pos: [0, 1, 2, 3, 4], labels: ['0', '1', '2', '3', 'FULL'], name: 'FLAPS lever' },
  spdBrk: { k: 'lever', sw: 'spdBrk', pos: [0, 1], labels: ['RET', 'ARM'], name: 'SPEED BRAKE lever' }, xpdr: { k: 'rot', sw: 'xpdr', pos: [0, 1, 2], labels: ['STBY', 'AUTO', 'ON'], name: 'Transponder mode' },
  autoBrk: { k: 'deco', name: 'AUTO BRK (not modelled)' },
  sdENG: { k: 'page', page: 'ENG', name: 'ENG page' }, sdBLEED: { k: 'page', page: 'BLEED', name: 'BLEED page' }, sdPRESS: { k: 'page', page: 'PRESS', name: 'PRESS page' }, sdELEC: { k: 'page', page: 'ELEC', name: 'ELEC page' },
  sdHYD: { k: 'page', page: 'HYD', name: 'HYD page' }, sdFUEL: { k: 'page', page: 'FUEL', name: 'FUEL page' }, sdAPU: { k: 'page', page: 'APU', name: 'APU page' }, sdCOND: { k: 'page', page: 'COND', name: 'COND page' },
  sdDOOR: { k: 'page', page: 'DOOR', name: 'DOOR page' }, sdWHEEL: { k: 'page', page: 'WHEEL', name: 'WHEEL page' }, sdFCTL: { k: 'page', page: 'FCTL', name: 'F/CTL page' }, sdSTS: { k: 'page', page: 'STS', name: 'STATUS page' },
  // GLARESHIELD
  masterWarnL: { k: 'mom', press: 'masterWarn', name: 'MASTER WARNING (press to silence)' }, masterWarnR: { k: 'mom', press: 'masterWarn', name: 'MASTER WARNING (press to silence)' },
  masterCautL: { k: 'mom', press: 'masterCaut', name: 'MASTER CAUTION (press to silence)' }, masterCautR: { k: 'mom', press: 'masterCaut', name: 'MASTER CAUTION (press to silence)' },
  // FCU (glareshield autopilot panel). Knobs: turn (drag / wheel), push = managed, pull = selected
  spdKnob: { k: 'knob', knob: 'spd', name: 'SPD/MACH knob', push: 'managed speed', pull: 'selected speed', ...F },
  hdgKnob: { k: 'knob', knob: 'hdg', name: 'HDG/TRK knob', push: 'managed lateral (NAV)', pull: 'selected heading', ...F },
  altKnob: { k: 'knob', knob: 'alt', name: 'ALT knob', push: 'managed altitude', pull: 'selected altitude', ...F },
  vsKnob: { k: 'knob', knob: 'vs', name: 'V/S / FPA knob', push: 'level off (V/S 0)', pull: 'V/S engaged', ...F },
  spdMach: { k: 'avp', press: 'spdMach', name: 'SPD/MACH toggle', ...F }, hdgTrk: { k: 'avp', press: 'hdgTrk', name: 'HDG-V/S / TRK-FPA toggle', ...F },
  altInc: { k: 'rot', sw: 'altInc', pos: [100, 1000], labels: ['100 ft', '1000 ft'], name: 'ALT knob increment', ...F },
  ap1: pb('ap1', 'AP 1 (logic only on the ground: the trainer has no flight model)', F), ap2: pb('ap2', 'AP 2 (logic only on the ground: the trainer has no flight model)', F),
  athr: pb('athr', 'A/THR (logic only on the ground)', F), loc: pb('loc', 'LOC (arms the localizer mode)', F), appr: pb('appr', 'APPR (arms the approach modes)', F), exped: pb('exped', 'EXPED', F),
  // displays / gauges (touch only)
  pfd: { k: 'ind', name: 'Primary flight display' }, nd: { k: 'ind', name: 'Navigation display' }, ewd: { k: 'ind', name: 'ENGINE & WARNING display' }, sd: { k: 'ind', name: 'SYSTEMS display' },
  stby: { k: 'ind', name: 'Standby instrument' }, clock: { k: 'ind', name: 'Clock' }, brakeGauge: { k: 'ind', name: 'Brake and accumulator pressure' }, gear: { k: 'deco', name: 'Landing gear lever (down, not modelled)' }
};

// EFIS control panels (captain L, first officer R)
for (const sd of ['L', 'R']) {
  const who = sd === 'L' ? 'captain' : 'first officer';
  Object.assign(CTL, {
    ['baro' + sd]: { k: 'knob', knob: 'baro' + sd, name: `Baro reference knob (${who})`, push: 'STD on / off', pull: 'QNH', ...F },
    ['baroUnit' + sd]: { k: 'rot', sw: 'baroUnit' + sd, pos: ['inHg', 'hPa'], labels: ['inHg', 'hPa'], name: `Baro unit (${who})`, ...F },
    ['fd' + sd]: pb('fd' + sd, `FD flight director (${who})`, F), ['ls' + sd]: pb('ls' + sd, `LS landing system scales (${who})`, F),
    ['ndMode' + sd]: { k: 'rot', sw: 'ndMode' + sd, pos: ['LS', 'VOR', 'NAV', 'ARC', 'PLAN'], labels: ['ROSE LS', 'ROSE VOR', 'ROSE NAV', 'ARC', 'PLAN'], name: `ND mode (${who})`, ...F },
    ['ndRange' + sd]: { k: 'rot', sw: 'ndRange' + sd, pos: [10, 20, 40, 80, 160, 320], labels: ['10 NM', '20 NM', '40 NM', '80 NM', '160 NM', '320 NM'], name: `ND range (${who})`, ...F },
    ['adf1' + sd]: { k: 'tog', sw: 'adf1' + sd, pos: ['VOR', 'OFF', 'ADF'], labels: ['VOR', 'OFF', 'ADF'], name: `Bearing pointer 1 (${who})`, ...F },
    ['adf2' + sd]: { k: 'tog', sw: 'adf2' + sd, pos: ['VOR', 'OFF', 'ADF'], labels: ['VOR', 'OFF', 'ADF'], name: `Bearing pointer 2 (${who})`, ...F }
  });
  for (const [o, nm] of [['CSTR', 'constraints'], ['WPT', 'waypoints'], ['VORD', 'VOR/DME stations'], ['NDB', 'NDB stations'], ['ARPT', 'airports']]) CTL[o.toLowerCase() + sd] = { k: 'sel', sw: 'ovl' + sd, val: o, toggle: true, name: `ND overlay ${o === 'VORD' ? 'VOR.D' : o}: ${nm} (${who})`, ...F };
}
// radio management panels and transponder
for (const n of [1, 2]) {
  Object.assign(CTL, {
    [`rmp${n}Outer`]: { k: 'knob', knob: `rmp${n}Outer`, name: `RMP ${n} tuning knob, outer (MHz)`, ...F }, [`rmp${n}Inner`]: { k: 'knob', knob: `rmp${n}Inner`, name: `RMP ${n} tuning knob, inner (kHz)`, ...F },
    [`rmpXfer${n}`]: { k: 'avp', press: `rmpXfer${n}`, name: `RMP ${n} transfer (swap active and standby)`, ...F },
    [`rmpOn${n}`]: { k: 'tog', sw: `rmpOn${n}`, pos: [false, true], labels: ['OFF', 'ON'], name: `RMP ${n} power`, ...F }
  });
  for (const r of ['VHF1', 'VHF2', 'VHF3']) CTL[`rmp${n}${r}`] = { k: 'sel', sw: `rmpSel${n}`, val: r, name: `RMP ${n}: select ${r}`, ...F };
}
for (let i = 0; i < 8; i++) CTL['x' + i] = { k: 'avp', press: 'x' + i, name: `Transponder key ${i}`, ...F };
Object.assign(CTL, {
  xIdent: { k: 'avp', press: 'xIdent', name: 'Transponder IDENT', ...F }, xClr: { k: 'avp', press: 'xClr', name: 'Transponder CLR (deletes the last digit)', ...F },
  altRptg: { k: 'tog', sw: 'altRptg', pos: [false, true], labels: ['OFF', 'ON'], name: 'ALT RPTG (altitude reporting)', ...F },
  stickL: { k: 'stick', sw: 'stickL', pos: ['NEUTRAL', 'AFT', 'FWD', 'LEFT', 'RIGHT'], labels: ['neutral', 'full aft', 'full forward', 'full left', 'full right'], name: 'Captain sidestick (click to step through a flight control check)', ...F }
});
CTL.xpdr.free = true;
// simplified flight computers (1 captain, 2 first officer): keys
export const FMS_FK = ['DIR', 'PROG', 'PERF', 'INIT', 'DATA', '', 'F-PLN', 'RAD NAV', 'FUEL PRED', 'SEC F-PLN', 'ATC COMM', 'MENU'];
export const FMS_AK = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').concat(['-', '/', 'SP', 'CLR']);
export const FMS_NK = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '+/-'];
export const fmsId = (n, key) => `f${n}_` + ({ '/': 'SLASH', '.': 'DOT', '-': 'DASH', '+/-': 'PM' }[key] || key.replace(/[ -]/g, ''));
for (const n of [1, 2]) {
  for (const k of [...FMS_FK.filter(Boolean), ...FMS_AK, ...FMS_NK]) CTL[fmsId(n, k)] = { k: 'key', unit: n - 1, key: k, name: `Flight computer ${n}: ${k} key`, ...F };
  for (const sd of ['L', 'R']) for (let i = 1; i <= 6; i++) CTL[fmsId(n, sd + i)] = { k: 'key', unit: n - 1, key: sd + i, name: `Flight computer ${n}: line key ${sd === 'L' ? 'left' : 'right'} ${i}`, ...F };
}

/** value text for tooltips / readouts */
export function valueText(sys, id) {
  const c = CTL[id]; if (!c) return '';
  if (c.k === 'knob') {
    const av = sys.st.av, Fc = av.fcu, w = sys.sw;
    if (c.knob === 'spd') return `${Fc.unit === 'SPD' ? Fc.spd + ' kt' : '.' + String(Math.round(Fc.mach * 100)).padStart(2, '0') + ' M'} · ${Fc.spdMan ? 'managed' : 'selected'}`;
    if (c.knob === 'hdg') return `${Fc.trk ? 'TRK' : 'HDG'} ${String(Fc.hdg).padStart(3, '0')} · ${Fc.hdgMan ? 'managed' : 'selected'}`;
    if (c.knob === 'alt') return `${Fc.alt} ft · ${Fc.altMan ? 'managed' : 'selected'} · steps of ${w.altInc} ft`;
    if (c.knob === 'vs') return Fc.vsMode ? (Fc.trk ? `FPA ${Fc.fpa.toFixed(1)}°` : `V/S ${Fc.vs} ft/min`) : 'not engaged';
    if (c.knob === 'baroL' || c.knob === 'baroR') { const sd = c.knob === 'baroL' ? 0 : 1, u = w['baroUnit' + (sd ? 'R' : 'L')]; return av.baro[sd].std ? 'STD' : `QNH ${baroText(av, sd, u)} ${u}`; }
    const m = /^rmp(\d)/.exec(c.knob); if (m) { const r = av.radio[w['rmpSel' + m[1]]]; return r ? `${w['rmpSel' + m[1]]} standby ${freqText(r.sby)}` : ''; }
    return '';
  }
  if (c.k === 'sel') return sys.sw[c.sw] === c.val ? 'selected' : 'off';
  if (!c.sw) return '';
  const v = sys.sw[c.sw];
  if (c.k === 'pb') return v ? 'ON (in)' : 'OFF (out)';
  if (c.k === 'gpb') return (sys.sw[c.guard] ? 'guard open, ' : 'guard closed, ') + (v ? 'pushed' : 'normal');
  if (c.k === 'master') return v ? 'ON' : 'OFF';
  if (c.labels) return c.labels[c.pos.indexOf(v)] ?? String(v);
  return String(v);
}

/**
 * Operate a control. how: undefined (click: toggle / next), +1 / -1 (direction for multi-position), or { to: value }.
 * Returns { did: 'pb'|'guard'|'mom'|'rot'|'tog'|'lever'|'master'|'page'|null, sound }
 */
export function operate(sys, id, how) {
  const c = CTL[id]; if (!c) return { did: null };
  const w = sys.sw, to = how && typeof how === 'object' ? how.to : undefined;
  switch (c.k) {
    case 'pb': sys.setSwitch(c.sw, to !== undefined ? !!to : !w[c.sw]); return { did: 'pb', sound: 'pb' };
    case 'gpb':
      if (to !== undefined) { sys.setSwitch(c.guard, true); sys.setSwitch(c.sw, !!to); return { did: 'pb', sound: 'pb' }; }
      if (!w[c.guard]) { sys.setSwitch(c.guard, true); return { did: 'guard', sound: 'guard' }; }
      sys.setSwitch(c.sw, !w[c.sw]); return { did: 'pb', sound: 'pb' };
    case 'mom': sys.press(c.press); return { did: 'mom', sound: 'pb' };
    case 'master': sys.setSwitch(c.sw, to !== undefined ? !!to : !w[c.sw]); return { did: 'master', sound: 'lever' };
    case 'page': sys.setSwitch('sdManual', w.sdManual === c.page ? null : c.page); return { did: 'page', sound: 'pb' };
    case 'knob': {
      if (how === 'push' || how === 'pull') { avKnob(sys, c.knob, how); return { did: 'knob', sound: 'pb' }; }
      if (to !== undefined) { avKnob(sys, c.knob, 'set', to); return { did: 'knob', sound: 'knob' }; }
      const n = typeof how === 'number' ? how : how && how.turn ? how.turn : 0;
      if (n) { avKnob(sys, c.knob, 'turn', n); return { did: 'knob', sound: 'knob' }; }
      if (c.push) { avKnob(sys, c.knob, 'push'); return { did: 'knob', sound: 'pb' }; }
      return { did: null };
    }
    case 'key': return fmsKey(sys, c.unit, c.key) ? { did: 'key', sound: 'key' } : { did: null };
    case 'avp': return avPress(sys, c.press) ? { did: 'mom', sound: 'key' } : { did: 'mom', sound: 'key' };
    case 'sel': sys.setSwitch(c.sw, c.toggle && w[c.sw] === c.val ? null : c.val); return { did: 'pb', sound: 'pb' };
    case 'rot': case 'tog': case 'lever': case 'stick': {
      const i = c.pos.indexOf(w[c.sw]); let j;
      if (to !== undefined) j = c.pos.indexOf(to);
      else if (how === 1 || how === -1) j = i + how;
      else j = i + 1 >= c.pos.length ? 0 : i + 1;
      if (j < 0 || j >= c.pos.length || j === i) return { did: null };
      sys.setSwitch(c.sw, c.pos[j]); return { did: c.k, sound: c.k === 'rot' ? 'rot' : c.k === 'tog' ? 'tog' : c.k === 'stick' ? 'stick' : 'lever' };
    }
    default: return { did: null };
  }
}

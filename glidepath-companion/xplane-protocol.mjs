/*
 * Everything that is specific to X-Plane's built-in web API lives in this file:
 * API version detection, REST paths, WebSocket message shapes, dataref names and unit conversion.
 * If a detail turns out to be wrong for your X-Plane build, this is the only file to change.
 *
 * Reference: https://developer.x-plane.com/article/x-plane-web-api/
 *            https://developer.x-plane.com/datarefs/
 * Those pages could not be fetched while this was written (no network from the build machine),
 * so the formats below come from prior knowledge of the API (X-Plane 12.1.1+). Items marked
 * TODO(verify) should be checked against the docs or a running X-Plane.
 *
 * Summary of the API as implemented here
 *   Server:        http://<host>:8086, no authentication; enabled in Settings > Network.
 *   Capabilities:  GET /api/capabilities  -> { "api": { "versions": ["v1","v2",...] }, "x-plane": { "version": "12.x.y" } }
 *   Datarefs:      GET /api/<v>/datarefs?filter[name]=<name>&filter[name]=<name>...
 *                    -> { "data": [ { "id": 123, "name": "sim/...", "value_type": "float", "is_writable": true }, ... ] }
 *   Commands:      GET /api/<v>/commands?filter[name]=<name>  -> { "data": [ { "id": 456, "name": "sim/...", "description": "..." } ] }
 *   WebSocket:     ws://<host>:8086/api/<v>
 *     client -> {"req_id":1,"type":"dataref_subscribe_values","params":{"datarefs":[{"id":123},{"id":124,"index":0}]}}
 *     server -> {"req_id":1,"type":"result","success":true}            (or "success":false,"error_code":..,"error_message":..)
 *     server -> {"type":"dataref_update_values","data":{"123":71.2,"124":[2310.5]}}   (~10 Hz, changed values)
 *     client -> {"req_id":2,"type":"dataref_set_values","params":{"datarefs":[{"id":789,"value":6}]}}
 *     client -> {"req_id":3,"type":"command_set_is_active","params":{"commands":[{"id":456,"is_active":true,"duration":0}]}}
 */

export const DEFAULT_PORT = 8086;
/** Newest first. v1 = 12.1.1 (datarefs), v2 = 12.1.4+ (adds commands), v3 = later builds. */
export const API_VERSIONS = ['v3', 'v2', 'v1'];

const M_TO_FT = 3.28084, MS_TO_KT = 1.943844;

/**
 * Datarefs the companion reads. `index` picks one element of an array dataref.
 * `required` ones must resolve or the connection is reported as unusable.
 */
export const DATAREFS = {
  ias:      { name: 'sim/flightmodel/position/indicated_airspeed', required: true },         // kt (flight model, unaffected by pitot/static failures)
  iasInd:   { name: 'sim/cockpit2/gauges/indicators/airspeed_kts_pilot' },                   // kt, what the pilot's ASI shows
  elev:     { name: 'sim/flightmodel/position/elevation', required: true },                   // m MSL (double)
  altInd:   { name: 'sim/cockpit2/gauges/indicators/altitude_ft_pilot' },                    // ft, pilot altimeter
  yAgl:     { name: 'sim/flightmodel/position/y_agl', required: true },                       // m above ground
  vs:       { name: 'sim/flightmodel/position/vh_ind_fpm', required: true },                  // fpm
  vsInd:    { name: 'sim/cockpit2/gauges/indicators/vvi_fpm_pilot' },                        // fpm, pilot VSI
  hdg:      { name: 'sim/flightmodel/position/mag_psi', required: true },                     // deg magnetic
  trk:      { name: 'sim/flightmodel/position/hpath' },                                       // deg true, flight path over the ground. TODO(verify) unit/frame
  psi:      { name: 'sim/flightmodel/position/psi' },                                         // deg true heading (fallback for track)
  pitch:    { name: 'sim/flightmodel/position/theta' },                                       // deg
  bank:     { name: 'sim/flightmodel/position/phi' },                                         // deg, +ve right wing down
  lat:      { name: 'sim/flightmodel/position/latitude', required: true },                    // deg (double)
  lon:      { name: 'sim/flightmodel/position/longitude', required: true },                   // deg (double)
  gsMs:     { name: 'sim/flightmodel/position/groundspeed' },                                 // m/s
  rpm:      { name: 'sim/cockpit2/engine/indicators/engine_speed_rpm', index: 0 },            // float[], engine 1
  flapRat:  { name: 'sim/flightmodel/controls/flaprat' },                                     // 0..1 actual flap deployment. TODO(verify) vs sim/flightmodel2/wing/flap1_deg
  onGround: { name: 'sim/flightmodel/failures/onground_any' },                                // int 0/1
  yokePitch:{ name: 'sim/cockpit2/controls/yoke_pitch_ratio' },                               // -1..1
  yokeRoll: { name: 'sim/cockpit2/controls/yoke_roll_ratio' },                                // -1..1
  rudder:   { name: 'sim/cockpit2/controls/yoke_heading_ratio' },                             // -1..1
  thr:      { name: 'sim/cockpit2/engine/actuators/throttle_ratio_all' },                     // 0..1
  volts:    { name: 'sim/cockpit2/electrical/bus_volts', index: 0 },                          // V, bus 1
  suction:  { name: 'sim/cockpit2/gauges/indicators/suction_1_ratio' },                       // TODO(verify) name and unit (inHg?)
  stall:    { name: 'sim/flightmodel/failures/stallwarning' },                                // int 0/1 stall warning
  locDots:  { name: 'sim/cockpit2/radios/indicators/nav1_hdef_dots_pilot' },                  // CDI dots. TODO(verify) sign convention
  gsDots:   { name: 'sim/cockpit2/radios/indicators/nav1_vdef_dots_pilot' },                  // glideslope dots. TODO(verify) sign convention
  paused:   { name: 'sim/time/paused' },                                                      // int 0/1
};

/** Flap ratio -> degrees for a C172S (0/10/20/30 detents). Change for other aircraft. */
export const MAX_FLAP_DEG = 30;
/**
 * Sign conventions for the companion's normalized ILS values:
 *   loc  > 0 means the aircraft is RIGHT of the localiser course
 *   gsd  > 0 means the aircraft is ABOVE the glideslope
 * X-Plane's *_dots_pilot datarefs describe needle deflection. A needle deflected right/up
 * means the course/glidepath is right/above you, i.e. the aircraft is left/below.
 * TODO(verify): flip these if the debrief reports "high" when you were low.
 */
export const LOC_SIGN = -1;
export const GS_SIGN = -1;

/**
 * Instructor failures. X-Plane failure enum: 0 = always working, 6 = inoperative now
 * (1 = mean time between failures, 2 = exact time, 3 = at speed, 4 = at altitude, 5 = on input).
 */
export const FAIL_ON = 6, FAIL_OFF = 0;
export const FAILURES = {
  engine:     { name: 'sim/operation/failures/rel_engfai0', label: 'Engine failure (engine 1)' },
  alternator: { name: 'sim/operation/failures/rel_genera0', label: 'Alternator / generator 1 failure' }, // TODO(verify) C172 in XP12 may use a different electrical failure
  vacuum:     { name: 'sim/operation/failures/rel_vacuum', label: 'Vacuum pump 1 failure' },              // TODO(verify)
  pitot:      { name: 'sim/operation/failures/rel_pitot', label: 'Pitot tube blocked (pilot side)' },      // TODO(verify)
  static:     { name: 'sim/operation/failures/rel_static', label: 'Static port blocked (pilot side)' },    // TODO(verify)
};

/** Allow-listed instructor commands (POST /api/command {name}). */
export const COMMANDS = {
  fix_all: { name: 'sim/operation/fix_all_systems', label: 'Repair all failures' },
  pause:   { name: 'sim/operation/pause_toggle', label: 'Pause / resume' },
};

/* ------------------------------------------------------------- REST */

export const paths = {
  capabilities: () => '/api/capabilities',
  datarefs: (v, names) => `/api/${v}/datarefs?` + names.map(n => 'filter[name]=' + encodeURIComponent(n)).join('&'),
  datarefCount: v => `/api/${v}/datarefs/count`,
  datarefValue: (v, id, index) => `/api/${v}/datarefs/${id}/value` + (index != null ? `?index=${index}` : ''),
  commands: (v, names) => `/api/${v}/commands?` + names.map(n => 'filter[name]=' + encodeURIComponent(n)).join('&'),
  activate: (v, id) => `/api/${v}/command/${id}/activate`,
  ws: v => `/api/${v}`,
};

async function getJson(base, path, timeoutMs = 3000) {
  const r = await fetch(base + path, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = null; }
  return { status: r.status, ok: r.ok, body };
}

/**
 * Find the newest API version this X-Plane supports.
 * Tries GET /api/capabilities first (12.1.4+), then probes v3 -> v2 -> v1.
 * Throws { code: 'unreachable' } if nothing answers.
 */
export async function detectApi(base) {
  let caps = null;
  try {
    const r = await getJson(base, paths.capabilities());
    if (r.ok && r.body) caps = r.body;
  } catch (err) {
    const e = new Error(`No answer from ${base} (${err.cause?.code || err.name || err.message})`); e.code = 'unreachable'; throw e;
  }
  const xpVersion = caps?.['x-plane']?.version || caps?.xplane?.version || null;
  const listed = caps?.api?.versions || [];
  for (const v of API_VERSIONS) {
    if (listed.length && !listed.includes(v)) continue;
    try {
      const r = await getJson(base, paths.datarefCount(v));
      if (r.ok) return { api: v, xpVersion, caps };
      const r2 = await getJson(base, paths.datarefs(v, [DATAREFS.paused.name]));
      if (r2.ok && r2.body && Array.isArray(r2.body.data)) return { api: v, xpVersion, caps };
    } catch { /* try next */ }
  }
  if (listed.length) return { api: API_VERSIONS.find(v => listed.includes(v)) || listed[listed.length - 1], xpVersion, caps };
  const e = new Error('X-Plane answered but no known web API version (v1-v3) responded'); e.code = 'no_api'; throw e;
}

/** Resolve dataref names to ids. Returns Map name -> { id, value_type }. */
export async function lookupDatarefs(base, v, names) {
  const out = new Map();
  for (let i = 0; i < names.length; i += 12) {
    const chunk = names.slice(i, i + 12);
    const r = await getJson(base, paths.datarefs(v, chunk));
    if (!r.ok || !r.body || !Array.isArray(r.body.data)) throw new Error(`dataref lookup failed (HTTP ${r.status})`);
    for (const d of r.body.data) out.set(d.name, { id: d.id, valueType: d.value_type, writable: d.is_writable });
  }
  return out;
}

/** Resolve command names to ids (v2+). Returns Map name -> { id }. */
export async function lookupCommands(base, v, names) {
  const out = new Map();
  if (v === 'v1') return out; // commands arrived in v2
  const r = await getJson(base, paths.commands(v, names));
  if (r.ok && r.body && Array.isArray(r.body.data)) for (const c of r.body.data) out.set(c.name, { id: c.id });
  return out;
}

/* ------------------------------------------------------------- WebSocket messages */

export const wsUrl = (host, port, v) => `ws://${host.includes(':') ? `[${host}]` : host}:${port}${paths.ws(v)}`;

export function msgSubscribe(reqId, items) {
  return JSON.stringify({ req_id: reqId, type: 'dataref_subscribe_values', params: { datarefs: items.map(d => (d.index != null ? { id: d.id, index: d.index } : { id: d.id })) } });
}
export function msgSetValues(reqId, items) {
  return JSON.stringify({ req_id: reqId, type: 'dataref_set_values', params: { datarefs: items.map(d => (d.index != null ? { id: d.id, value: d.value, index: d.index } : { id: d.id, value: d.value })) } });
}
/** TODO(verify): whether duration 0 means "tap once" on every build. */
export function msgCommand(reqId, id, isActive = true, duration = 0) {
  return JSON.stringify({ req_id: reqId, type: 'command_set_is_active', params: { commands: [{ id, is_active: isActive, duration }] } });
}

/** Parse a server message into { kind: 'update', values } | { kind: 'result', reqId, ok, error } | { kind: 'other' }. */
export function parseMessage(text) {
  let m; try { m = JSON.parse(text); } catch { return { kind: 'other' }; }
  if (m.type === 'dataref_update_values' && m.data && typeof m.data === 'object') return { kind: 'update', values: m.data };
  if (m.type === 'result') return { kind: 'result', reqId: m.req_id, ok: m.success !== false, error: m.error_message || m.error_code || null };
  return { kind: 'other', type: m.type };
}

/** Values for array datarefs subscribed with an index may arrive as [v] or v. */
const scalar = v => (Array.isArray(v) ? v[0] : v);
const num = v => { v = scalar(v); return typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'boolean' ? +v : null); };

/**
 * Build the normalized sample the browser expects from the latest raw values (keyed like DATAREFS)
 * and failure states (keyed like FAILURES).
 */
export function normalize(raw, failRaw = {}) {
  const g = k => num(raw[k]);
  const ias = g('ias'), elevM = g('elev'), aglM = g('yAgl');
  const flapRat = g('flapRat');
  const trk = g('trk') ?? g('psi') ?? g('hdg');
  const sample = {
    ias, iasInd: g('iasInd') ?? ias,
    alt: elevM != null ? elevM * M_TO_FT : null, altInd: g('altInd'),
    agl: aglM != null ? Math.max(0, aglM * M_TO_FT) : null,
    vs: g('vs'), vsInd: g('vsInd'),
    hdg: g('hdg'), trk, pitch: g('pitch'), bank: g('bank'),
    lat: g('lat'), lon: g('lon'),
    gs: g('gsMs') != null ? g('gsMs') * MS_TO_KT : null,
    rpm: g('rpm'), flaps: flapRat != null ? flapRat * MAX_FLAP_DEG : null,
    ground: g('onGround') != null ? g('onGround') > 0 : (aglM != null ? aglM < 1.5 : false),
    thr: g('thr'), yokePitch: g('yokePitch'), yokeRoll: g('yokeRoll'), rudder: g('rudder'),
    volts: g('volts'), suction: g('suction'),
    stall: (g('stall') || 0) > 0,
    loc: g('locDots') != null ? LOC_SIGN * g('locDots') : null,
    gsd: g('gsDots') != null ? GS_SIGN * g('gsDots') : null,
    paused: (g('paused') || 0) > 0,
    fail: {},
  };
  if (sample.altInd == null) sample.altInd = sample.alt;
  if (sample.vsInd == null) sample.vsInd = sample.vs;
  for (const k of Object.keys(FAILURES)) { const v = num(failRaw[k]); sample.fail[k] = v != null && v >= FAIL_ON; }
  return sample;
}

export const NOT_FOUND_HINT = 'X-Plane is not answering. Start X-Plane 12.1.1 or later and, in Settings > Network, allow incoming connections to the web API (port 8086).';

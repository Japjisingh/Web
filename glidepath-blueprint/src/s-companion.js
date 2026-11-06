/* Companion mode: Glidepath Companion running its built-in demo flight (no network needed). */
import { mountCompanion } from '../../glidepath-companion/public/companion.js';
import { createDemoFlight } from '../../glidepath-companion/public/demo-flight.js';

export default function (host) {
  const root = host.querySelector('.companion-root');
  if (!root) return;
  mountCompanion(root, { mode: 'demo', demo: createDemoFlight });
}

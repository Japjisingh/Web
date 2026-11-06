/* Boots each [data-scene] lazily when it comes near the viewport. */
export function boot(SCENES) {
  const start = host => {
    const name = host.dataset.scene, fn = SCENES[name];
    if (!fn) return;
    try { fn(host); }
    catch (err) {
      const s = host.querySelector('.stage');
      if (s) s.insertAdjacentHTML('beforeend', `<p class="stage-err">This 3D view could not start (${String(err && err.message || err)}). Try a browser with WebGL 2 turned on.</p>`);
      console.error(name, err);
    }
  };
  const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); start(e.target); } }, { rootMargin: '700px 0px' });
  const go = () => document.querySelectorAll('[data-scene]').forEach(h => io.observe(h));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
}

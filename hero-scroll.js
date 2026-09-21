/* Scroll depth for the name and sculpture; supporting copy stays page-anchored. */
(() => {
  const header = document.querySelector('.site-header');
  const updateDock = () => header?.classList.toggle('is-docked', window.scrollY > 0);
  addEventListener('scroll', updateDock, { passive: true });
  updateDock();
  const hero = document.querySelector('.hero');
  const art = document.querySelector('.hero__art');
  const ryan = document.querySelector('.hero__name--ryan');
  const fong = document.querySelector('.hero__name--fong');
  const supporting = [...document.querySelectorAll('.hero__intro, .hero__actions, .hero__footer')];
  if (!hero || !art) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let visible = true;

  function render() {
    frame = 0;
    const rect = hero.getBoundingClientRect();
    const travel = reduced.matches ? 0 : Math.min(rect.height, Math.max(0, window.scrollY));
    const strength = innerWidth <= 760 ? .75 : 1;
    const shift = (element, rate) => {
      if (element) element.style.translate = `0 ${(travel * rate * strength).toFixed(2)}px`;
    };
    // Normal page scrolling already moves every layer upward at 1x.
    // These offsets produce 1.48x / 1.18x / .82x desktop speeds; copy follows normal page scroll.
    shift(ryan, -.48);
    shift(art, -.18);
    shift(fong, .18);
    supporting.forEach(element => { element.style.removeProperty('translate'); });
  }

  function schedule() {
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(render);
  }

  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) schedule();
    else { cancelAnimationFrame(frame); frame = 0; }
  }).observe(hero);
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', render);
  render();
})();

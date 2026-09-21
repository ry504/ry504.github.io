/* Conceptual project artwork: ordered Bayer 8x8 binary dither on a 2 CSS px lattice.
   Mirrors the sculpture.js look (ivory #e8e6da / red #ff4655) and reuses its pointer
   threshold field: only the threshold matrix shifts horizontally in integer cells,
   while sampled source luminance and the silhouette stay fixed. Source images stay in
   the DOM as the fallback. */
(() => {
  'use strict';

  const sources = document.querySelectorAll('[data-project-art]');
  if (!sources.length) return;

  const IVORY = [232, 230, 218]; // #e8e6da
  const RED = [255, 70, 85];     // #ff4655
  const CELL_CSS = 2;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // Bayer 8x8 thresholds computed with the same bit ordering as the
  // sculpture.js GLSL helper (bayer2 / bayer4 / bayer8), so both renderers
  // share one dither pattern. Wrapping with & 7 keeps negative (shifted)
  // cells on the same lattice as GLSL floor/mod.
  const bayer2 = (x, y) => {
    const qx = x & 1;
    const qy = y & 1;
    return 2 * qx + 3 * qy - 4 * qx * qy;
  };
  const threshold = (cx, cy) => {
    const x = cx & 7;
    const y = cy & 7;
    const idx = 16 * bayer2(x, y)
      + 4 * bayer2(x >> 1, y >> 1)
      + bayer2(x >> 2, y >> 2);
    return (idx + 0.5) / 64;
  };

  // Same tone curve as the sculpture shader so the two treatments read alike.
  const tone = (lum) => {
    const l = Math.min(1, Math.max(0, (lum - 0.025) * 1.13));
    return Math.pow(l, 0.95);
  };

  const isRedAccent = (r, g, b) => r > 70 && r - Math.max(g, b) > 45;

  // Hero pointer field evaluated in integer lattice cells, scaled by the grid
  // (cols/rows) so the falloff and mixed row frequencies track the lattice.
  const shiftFor = (cx, cy, cols, rows, pointer, hover) => {
    const du = (cx + 0.5) - pointer.x * cols;
    const dv = (cy + 0.5) - pointer.y * rows;
    let fx = du / 62;
    let fy = dv / 38;
    fx += 0.24 * Math.sin(fy * 2.7 + cy * 0.031);
    fy += 0.19 * Math.sin(fx * 3.1 - cx * 0.027);
    const influence = Math.exp(-(fx * fx + fy * fy) * 1.25);
    const flow = 0.55 * Math.sin(cy * 0.071 + pointer.x * 9)
      + 0.29 * Math.sin(cy * 0.173 - pointer.y * 13 + cx * 0.017)
      + 0.16 * Math.sin(cy * 0.317 + pointer.x * 7);
    return flow * 3.2 * influence * hover;
  };

  sources.forEach((img) => {
    const host = img.closest('.work-entry__art-frame') || img.parentElement;
    if (!host) return;

    let canvas = null;
    let ctx = null;
    let frame = 0;
    let width = 0;
    let height = 0;
    let cell = 0;
    let cols = 0;
    let rows = 0;
    let sample = null; // { light, accent } cached per lattice size
    const pointer = { x: 0.5, y: 0.5 };
    let hover = 0;

    const motionEnabled = () => !reduceMotion.matches;

    // Resample the source only when the lattice changes; pointermove reuses this.
    const resample = () => {
      const rect = (host || img).getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cell = Math.max(2, Math.round(CELL_CSS * dpr));
      // Backing store matches the layout box 1:1 in device pixels, so the CSS
      // 100% canvas never rescales and the lattice stays a crisp integer grid.
      width = Math.max(1, Math.round(Math.max(1, rect.width) * dpr));
      height = Math.max(1, Math.round(Math.max(1, rect.height) * dpr));
      cols = Math.ceil(width / cell);
      rows = Math.ceil(height / cell);
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      const scratch = document.createElement('canvas');
      scratch.width = cols;
      scratch.height = rows;
      const sampleCtx = scratch.getContext('2d', { willReadFrequently: true });
      if (!sampleCtx) return false;
      sampleCtx.imageSmoothingEnabled = true;
      sampleCtx.clearRect(0, 0, cols, rows);
      sampleCtx.drawImage(img, 0, 0, cols, rows);

      let data;
      try {
        data = sampleCtx.getImageData(0, 0, cols, rows).data;
      } catch (error) {
        return false;
      }

      const light = new Float32Array(cols * rows);
      const accent = new Uint8Array(cols * rows);
      for (let i = 0; i < cols * rows; i += 1) {
        const p = i * 4;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const red = isRedAccent(r, g, b);
        accent[i] = red ? 1 : 0;
        light[i] = tone(red ? Math.max(lum, r / 255 * 0.85) : lum);
      }
      sample = { light, accent };
      return true;
    };

    const paint = (color, rects) => {
      if (!rects.length) return;
      ctx.fillStyle = `rgb(${color[0]} ${color[1]} ${color[2]})`;
      for (let i = 0; i < rects.length; i += 2) {
        ctx.fillRect(rects[i], rects[i + 1], cell, cell);
      }
    };

    const draw = () => {
      if (!canvas || !sample) return;
      const { light, accent } = sample;
      const strength = motionEnabled() ? hover : 0;
      const ivoryRects = [];
      const redRects = [];
      for (let cy = 0; cy < rows; cy += 1) {
        for (let cx = 0; cx < cols; cx += 1) {
          const i = cy * cols + cx;
          const value = light[i];
          if (value <= 0.025) continue;
          let tx = cx;
          if (strength > 0) {
            tx = cx + Math.floor(shiftFor(cx, cy, cols, rows, pointer, strength) + 0.5);
          }
          if (value >= threshold(tx, cy)) {
            (accent[i] ? redRects : ivoryRects).push(cx * cell, cy * cell);
          }
        }
      }
      ctx.clearRect(0, 0, width, height);
      paint(IVORY, ivoryRects);
      paint(RED, redRects);
    };

    // On-demand RAF coalescing: one queued frame per burst, no idle loop.
    const schedule = () => {
      if (frame || !canvas) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!canvas.isConnected) return;
        draw();
      });
    };

    const reset = () => {
      if (!hover) return;
      hover = 0;
      schedule();
    };

    const start = () => {
      if (canvas || !img.naturalWidth) return;
      const drawn = document.createElement('canvas');
      drawn.className = 'work-entry__art-canvas';
      drawn.setAttribute('aria-hidden', 'true');
      drawn.style.opacity = '0';
      host.appendChild(drawn);
      canvas = drawn;
      ctx = drawn.getContext('2d', { alpha: true });
      if (!ctx || !resample()) {
        canvas = null;
        ctx = null;
        drawn.remove();
        return;
      }
      draw();
      drawn.style.opacity = '';
      img.style.opacity = '0';

      host.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'touch' || !motionEnabled()) return;
        const rect = drawn.getBoundingClientRect();
        pointer.x = (event.clientX - rect.left) / rect.width;
        pointer.y = (event.clientY - rect.top) / rect.height;
        hover = 1;
        schedule();
      }, { passive: true });
      host.addEventListener('pointerleave', reset, { passive: true });

      const refresh = () => { if (resample()) draw(); };
      if (typeof ResizeObserver === 'function') {
        const observer = new ResizeObserver(refresh);
        observer.observe(host);
      } else {
        addEventListener('resize', refresh, { passive: true });
      }
    };

    // A scroll moves the artwork away from a stationary cursor; clear stale interaction.
    addEventListener('scroll', reset, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', reset);

    if (img.complete && img.naturalWidth) start();
    else {
      img.addEventListener('load', start, { once: true });
      img.addEventListener('error', () => {}, { once: true });
    }
  });
})();

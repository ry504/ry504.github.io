// Pure pointer-drag controller for the physics demos. No DOM access.
//
// Root cause it fixes: applying a far pointer target in a single frame implies
// enormous instantaneous velocity (~96480 px/s) and launches the car. This
// controller follows the pointer directly and synchronizes previous positions
// so repositioning does not become an artificial launch velocity.
//
// API:
//   createDrag(mode, simulation, grabbed, cursor, world) -> handle
//   updateDrag(handle, cursor)
//   stepDrag(handle, dt)
//   releaseDrag(handle)


function finiteNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function posOf(p) {
  return p && p.pos ? p.pos : p;
}

function radOf(p) {
  return p && finiteNum(p.rad) ? p.rad : 0;
}

function zeroPrev(p) {
  if (!p) return;
  if (p.pPos) {
    p.pPos.x = p.pos.x;
    p.pPos.y = p.pos.y;
  } else {
    p.px = p.x;
    p.py = p.y;
  }
}

function collect(simulation, mode) {
  if (mode === 'softbody') return simulation.points;
  if (mode === 'car') return simulation.bodies;
  return [simulation];
}

function readCursor(cursor, fallback, world) {
  const x = cursor && finiteNum(cursor.x) ? cursor.x : fallback.x;
  const y = cursor && finiteNum(cursor.y) ? cursor.y : fallback.y;
  const w = world || {};
  return {
    x: finiteNum(w.width) ? Math.min(Math.max(x, 0), w.width) : x,
    y: finiteNum(w.height) ? Math.min(Math.max(y, 0), w.height) : y,
  };
}

function axisLimits(handle) {
  let minX = -Infinity;
  let maxX = Infinity;
  let minY = -Infinity;
  let maxY = Infinity;
  const w = handle.world || {};
  for (const p of handle.moving) {
    const q = posOf(p);
    const r = radOf(p);
    if (finiteNum(w.width)) {
      minX = Math.max(minX, r - q.x);
      maxX = Math.min(maxX, w.width - r - q.x);
    }
    if (finiteNum(w.height)) {
      minY = Math.max(minY, r - q.y);
      maxY = Math.min(maxY, w.height - r - q.y);
    }
  }
  return { minX, maxX, minY, maxY };
}

function translate(handle, dx, dy) {
  if (handle.mode === 'softbody') {
    const p = handle.grabbed;
    p.x += dx;
    p.y += dy;
    p.px = p.x;
    p.py = p.y;
    return;
  }
  for (const p of handle.moving) {
    p.pos.x += dx;
    p.pos.y += dy;
    zeroPrev(p);
  }
}

export function createDrag(mode, simulation, grabbed, cursor, world) {
  const anchor = posOf(grabbed) || { x: 0, y: 0 };
  const c = readCursor(cursor, anchor, world);
  const handle = {
    mode,
    simulation,
    grabbed,
    world: world || {},
    moving: mode === 'softbody' ? [grabbed] : mode === 'car' ? simulation.bodies : [simulation],
    offset: { x: anchor.x - c.x, y: anchor.y - c.y },
    target: { x: c.x, y: c.y },
    active: true,
  };
  for (const p of collect(simulation, mode)) zeroPrev(p);
  return handle;
}

export function updateDrag(handle, cursor) {
  if (!handle || !handle.active) return;
  const c = readCursor(cursor, handle.target, handle.world);
  handle.target.x = c.x;
  handle.target.y = c.y;
}

export function stepDrag(handle, dt) {
  if (!handle || !handle.active || !finiteNum(dt) || dt <= 0) return;
  const anchor = posOf(handle.grabbed);
  if (!anchor) return;
  let dx = handle.target.x + handle.offset.x - anchor.x;
  let dy = handle.target.y + handle.offset.y - anchor.y;
  const lim = axisLimits(handle);
  dx = Math.min(Math.max(dx, lim.minX), lim.maxX);
  dy = Math.min(Math.max(dy, lim.minY), lim.maxY);
  translate(handle, dx, dy);
}

export function releaseDrag(handle) {
  if (!handle) return;
  for (const p of collect(handle.simulation, handle.mode)) zeroPrev(p);
  handle.active = false;
}

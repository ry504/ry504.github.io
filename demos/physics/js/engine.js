// Pure physics engine for the browser demos. No DOM access so it can run under
// node:test. Ported from Ryan Fong's Processing / py5 experiments:
//   softbody.py, ball_physics/{ball_physics.pyde,physics.py},
//   car/{car.pyde,physics.py}. See ../../README.md for the source mapping.

export const SOFTBODY_GRAVITY = 500;
export const SOFTBODY_SEG_DIST = 50;
export const SOFTBODY_RIGIDITY = 1 / 1000;

export const BALL_GRAVITY = 800;
export const TERRAIN_DETAIL = 25;
export const CAR_LINK_LENGTH = 100;

export const FIXED_DT = 1 / 120;

// ---------------------------------------------------------------------------
// Deterministic rolling terrain (seeded value noise; the Processing originals
// used Perlin noise, this keeps roll + determinism without a noise library).
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

export class Terrain {
  constructor(seed, { worldWidth, detail = TERRAIN_DETAIL, center, amplitude = 600, frequency = 0.0015 } = {}) {
    this.seed = seed >>> 0;
    this.detail = detail;
    this.worldWidth = worldWidth;
    this.center = center;
    this.amplitude = amplitude;
    this.frequency = frequency;
    const count = Math.ceil(worldWidth / detail) + 2;
    const rnd = mulberry32(this.seed);
    const lattice = [];
    for (let i = 0; i < count + 8; i++) lattice.push(rnd());
    this.height = [];
    for (let i = 0; i < count; i++) {
      const x = i * detail * frequency;
      const i0 = Math.floor(x);
      const frac = x - i0;
      const a = lattice[i0 % lattice.length];
      const b = lattice[(i0 + 1) % lattice.length];
      const n = a + (b - a) * smooth(frac);
      this.height.push((n - 0.5) * amplitude + center);
    }
  }

  // Clamped, never-negative terrain index (fixes the negative-index hazard in
  // the original int(x1 / detail) lookups).
  at(index) {
    if (index < 0) return this.height[0];
    if (index >= this.height.length) return this.height[this.height.length - 1];
    return this.height[index];
  }

  heightAtX(x) {
    return this.at(Math.round(x / this.detail));
  }

  clone() {
    return new Terrain(this.seed, {
      worldWidth: this.worldWidth,
      detail: this.detail,
      center: this.center,
      amplitude: this.amplitude,
      frequency: this.frequency,
    });
  }
}

// ---------------------------------------------------------------------------
// Verlet ball (ball physics + car share this body)
// ---------------------------------------------------------------------------

export class Ball {
  constructor({ x, y, rad, gravity = BALL_GRAVITY, detail = TERRAIN_DETAIL, terrain, links = [], initVel = { x: 0, y: 0 }, damp = 0.9 }) {
    this.pos = { x, y };
    this.pPos = { x: x - initVel.x, y: y - initVel.y };
    this.acc = { x: 0, y: gravity };
    this.dAcc = { x: 0, y: 0 };
    this.nor = null;
    this.rad = rad;
    this.gravity = gravity;
    this.damp = damp;
    this.detail = detail;
    this.terrain = terrain;
    this.links = links;
  }

  update(dt, world) {
    const damp = Math.pow(this.damp, dt);
    const vel = {
      x: (this.pos.x - this.pPos.x) * damp,
      y: (this.pos.y - this.pPos.y) * damp,
    };
    this.acc = { x: 0, y: this.gravity };
    this.nor = null;

    const detail = this.detail;
    const sx = Math.round(this.pos.x / detail) * detail;
    const sd = Math.round((this.rad * 2) / detail) + 2;
    for (let i = 0; i < sd; i++) {
      const x1 = sx + (i - sd / 2) * detail;
      const x2 = sx + (i + 1 - sd / 2) * detail;
      const idx1 = Math.min(Math.max(0, Math.floor(x1 / detail)), this.terrain.height.length - 1);
      const idx2 = Math.min(Math.max(0, Math.floor(x2 / detail)), this.terrain.height.length - 1);
      const A = { x: x1, y: this.terrain.at(idx1) };
      const B = { x: x2, y: this.terrain.at(idx2) };

      const hit = collision(this.pos, this.rad, A, B);
      if (hit.collided) {
        this.pos = { x: hit.x, y: hit.y };
        vel.y = 0;
        const dx = A.x - B.x;
        const dy = A.y - B.y;
        const mag = Math.hypot(dx, dy) || 1;
        const dir = { x: dx / mag, y: dy / mag };
        this.nor = { x: -dir.y, y: dir.x };
        const g = { x: 0, y: this.gravity };
        const dot = g.x * this.nor.x + g.y * this.nor.y;
        this.acc = { x: (g.x - this.nor.x * dot) * 3, y: (g.y - this.nor.y * dot) * 3 };
      }
    }

    if (this.pos.x - this.rad < 0 || this.pos.x + this.rad > world.width) {
      this.pos.x = Math.max(Math.min(this.pos.x, world.width - this.rad), this.rad);
      vel.x = 0;
    }
    if (this.pos.y - this.rad < 0 || this.pos.y + this.rad > world.height) {
      this.pos.y = Math.max(Math.min(this.pos.y, world.height - this.rad), this.rad);
      vel.y = 0;
    }

    this.acc.x += this.dAcc.x;
    this.acc.y += this.dAcc.y;

    this.pPos = { x: this.pos.x, y: this.pos.y };
    this.pos = {
      x: this.pos.x + vel.x + this.acc.x * dt * dt,
      y: this.pos.y + vel.y + this.acc.y * dt * dt,
    };
  }

  // Fixed-distance link pull, averaged over targets (car mode).
  link(targets, d) {
    if (targets.length === 0) return;
    let cx = 0;
    let cy = 0;
    for (const t of targets) {
      const dx = t.x - this.pos.x;
      const dy = t.y - this.pos.y;
      const mag = Math.hypot(dx, dy);
      if (mag === 0) continue;
      const delta = mag - d;
      cx += (dx / mag) * (delta / 2);
      cy += (dy / mag) * (delta / 2);
    }
    this.pos = { x: this.pos.x + cx / targets.length, y: this.pos.y + cy / targets.length };
  }

  setVelocityFromDelta(dx, dy) {
    this.pPos = { x: this.pos.x - dx, y: this.pos.y - dy };
  }
}

// Closest point on segment AB to circle centre C, pushed out by radius r.
// Returns {collided:false} when there is no overlap.
export function collision(C, r, A, B) {
  const abx = B.x - A.x;
  const aby = B.y - A.y;
  const acx = C.x - A.x;
  const acy = C.y - A.y;
  const denom = abx * abx + aby * aby || 1;
  let t = (acx * abx + acy * aby) / denom;
  t = Math.max(0, Math.min(1, t));
  const px = A.x + abx * t;
  const py = A.y + aby * t;
  const dx = C.x - px;
  const dy = C.y - py;
  const diff = Math.hypot(dx, dy);
  if (diff > r) return { collided: false, x: C.x, y: C.y };
  if (diff < 1e-9) {
    const length = Math.hypot(abx, aby);
    const nx = length ? aby / length : 0;
    const ny = length ? -abx / length : -1;
    const sign = ny > 0 ? -1 : 1;
    return { collided: true, x: C.x + nx * sign * r, y: C.y + ny * sign * r };
  }
  const mag = diff;
  const push = r - diff;
  return { collided: true, x: C.x + (dx / mag) * push, y: C.y + (dy / mag) * push };
}

// ---------------------------------------------------------------------------
// Soft body (softbody.py): 8 linked points + area restoration
// ---------------------------------------------------------------------------

export class SoftBody {
  constructor({
    x, y, numPts = 8, segDist = SOFTBODY_SEG_DIST, gravity = SOFTBODY_GRAVITY,
    rigidity = SOFTBODY_RIGIDITY, iterations = 5, damp = 0.6, bounce = 0.7, ptRad = 5,
  } = {}) {
    this.segDist = segDist;
    this.gravity = gravity;
    this.rigidity = rigidity;
    this.iterations = iterations;
    this.points = polygon(x, y, segDist, numPts, ptRad);
    this.realArea = area(this.points);
    this.dragged = null;
  }

  update(dt, world) {
    for (const pt of this.points) {
      const damp = Math.pow(pt.damp, dt);
      let vx = (pt.x - pt.px) * damp;
      let vy = (pt.y - pt.py) * damp;

      if (pt.x - pt.rad < 0 || pt.x + pt.rad > world.width) {
        pt.x = Math.max(Math.min(pt.x, world.width - pt.rad), pt.rad);
        vx *= -pt.bounce;
      }
      if (pt.y - pt.rad < 0 || pt.y + pt.rad > world.height) {
        pt.y = Math.max(Math.min(pt.y, world.height - pt.rad), pt.rad);
        vy *= -pt.bounce;
      }

      pt.px = pt.x;
      pt.py = pt.y;
      pt.x += vx;
      pt.y += vy + this.gravity * dt * dt;
    }

    for (let i = 0; i < this.iterations; i++) {
      const inflation = this.rigidity * (this.realArea - area(this.points));
      for (const pt of this.points) {
        const targets = pt.links.map((idx) => ({ x: this.points[idx].x, y: this.points[idx].y }));
        linkPoint(pt, targets, this.segDist);
        if (targets.length === 2) inflatePoint(pt, targets[0], targets[1], inflation);
      }
    }
  }

  nearest(px, py, maxDist = 15) {
    let best = null;
    let bestD = maxDist;
    for (const pt of this.points) {
      const d = Math.hypot(px - pt.x, py - pt.y);
      if (d <= bestD) {
        bestD = d;
        best = pt;
      }
    }
    return best;
  }

  dragTo(pt, x, y) {
    const dx = x - pt.x;
    const dy = y - pt.y;
    pt.x = x;
    pt.y = y;
    pt.px = x - dx;
    pt.py = y - dy;
  }
}

export function polygon(x, y, d, numPts, ptRad = 5, initVel = { x: 0, y: 0 }) {
  const pts = [];
  const theta = (2 * Math.PI) / numPts;
  const rad = d / (2 * Math.sin(theta / 2));
  for (let i = 0; i < numPts; i++) {
    const ang = i * theta;
    pts.push({
      x: x + Math.cos(ang) * rad,
      y: y + Math.sin(ang) * rad,
      px: x + Math.cos(ang) * rad - initVel.x,
      py: y + Math.sin(ang) * rad - initVel.y,
      rad: ptRad,
      damp: 0.6,
      bounce: 0.7,
      links: [i > 0 ? i - 1 : numPts - 1, i < numPts - 1 ? i + 1 : 0],
    });
  }
  return pts;
}

// Shoelace-style area matching the original softbody.py accumulation.
export function area(points) {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const j = i < points.length - 1 ? i + 1 : 0;
    const w = points[i].x - points[j].x;
    const h = (points[i].y + points[j].y) / 2;
    total += w * h;
  }
  return total;
}

export function linkPoint(pt, targets, d) {
  if (targets.length === 0) return;
  let cx = 0;
  let cy = 0;
  for (const t of targets) {
    const dx = t.x - pt.x;
    const dy = t.y - pt.y;
    const mag = Math.hypot(dx, dy);
    if (mag === 0) continue;
    const delta = mag - d;
    cx += (dx / mag) * (delta / 2);
    cy += (dy / mag) * (delta / 2);
  }
  pt.x += cx / targets.length;
  pt.y += cy / targets.length;
}

export function inflatePoint(pt, a, b, d) {
  let cx = a.x - b.x;
  let cy = a.y - b.y;
  // rotate 90 degrees
  const rx = -cy;
  const ry = cx;
  const mag = Math.hypot(rx, ry);
  if (mag === 0) return;
  pt.x += (rx / mag) * d;
  pt.y += (ry / mag) * d;
}

// ---------------------------------------------------------------------------
// Car: two linked balls driven along the terrain tangent
// ---------------------------------------------------------------------------

export class Car {
  constructor({ x, y, terrain, gravity = BALL_GRAVITY, rad = 25, length = CAR_LINK_LENGTH, detail = TERRAIN_DETAIL } = {}) {
    this.length = length;
    this.bodies = [
      new Ball({ x, y, rad, gravity, detail, terrain, links: [1], initVel: { x: 4, y: 0 } }),
      new Ball({ x: x + 100, y, rad, gravity, detail, terrain, links: [0], initVel: { x: 4, y: 0 } }),
    ];
  }

  update(dt, world, input = {}) {
    for (const body of this.bodies) {
      if (body.nor) {
        const tang = { x: -body.nor.y, y: body.nor.x };
        if (input.left) body.dAcc = { x: tang.x * -1000, y: tang.y * -1000 };
        else if (input.right) body.dAcc = { x: tang.x * 1000, y: tang.y * 1000 };
        else body.dAcc = { x: 0, y: 0 };
      } else {
        body.dAcc = { x: 0, y: 0 };
      }
      body.update(dt, world);
    }
    for (const body of this.bodies) {
      const targets = body.links.map((id) => this.bodies[id].pos);
      body.link(targets, this.length);
    }
  }

  nearest(px, py, maxDist = 30) {
    let best = null;
    let bestD = maxDist;
    for (const body of this.bodies) {
      const d = Math.hypot(px - body.pos.x, py - body.pos.y);
      if (d <= bestD) {
        bestD = d;
        best = body;
      }
    }
    return best;
  }
}

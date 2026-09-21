// Behaviour tests for the physics demo engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SoftBody, Ball, Car, Terrain, collision, FIXED_DT, BALL_GRAVITY, CAR_LINK_LENGTH } from '../js/engine.js';

const WIDTH = 1280;
const softWorld = { width: WIDTH, height: 720 };
const tallWorld = { width: WIDTH, height: 800 };

function finite(p) {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}
function inBounds(p, world, pad = 1) {
  return p.x >= -pad && p.x <= world.width + pad && p.y >= -pad && p.y <= world.height + pad;
}
function settle(body, world, seconds, input) {
  const steps = Math.round(seconds * 120);
  for (let i = 0; i < steps; i++) body.update(FIXED_DT, world, input);
}
function driveCar(car, world, seconds, input) {
  const steps = Math.round(seconds * 120);
  for (let i = 0; i < steps; i++) car.update(FIXED_DT, world, input);
}
function gentleTerrain(seed) {
  return new Terrain(seed, { worldWidth: WIDTH, center: 400, amplitude: 60, detail: 25 });
}

test('soft body stays finite and bounded through a long run', () => {
  const body = new SoftBody({ x: WIDTH / 2, y: 220 });
  const realArea = body.realArea;
  for (let i = 0; i < 2400; i++) body.update(FIXED_DT, softWorld);
  for (const pt of body.points) {
    assert.ok(finite(pt), `point finite: ${JSON.stringify(pt)}`);
    assert.ok(inBounds(pt, softWorld), `point in bounds: ${JSON.stringify(pt)}`);
  }
  const finalArea = Math.abs(require_area(body));
  assert.ok(Math.abs(finalArea / realArea) < 3, `area ratio bounded, got ${finalArea / realArea}`);
});

function require_area(body) {
  let total = 0;
  const pts = body.points;
  for (let i = 0; i < pts.length; i++) {
    const j = i < pts.length - 1 ? i + 1 : 0;
    total += (pts[i].x - pts[j].x) * ((pts[i].y + pts[j].y) / 2);
  }
  return total;
}

test('soft body is pushed apart by dragging then remains connected', () => {
  const body = new SoftBody({ x: WIDTH / 2, y: 200 });
  const pt = body.points[0];
  body.dragTo(pt, WIDTH - 40, 40);
  for (let i = 0; i < 600; i++) body.update(FIXED_DT, softWorld);
  for (const p of body.points) {
    assert.ok(finite(p), 'finite after drag');
    assert.ok(inBounds(p, softWorld), 'in bounds after drag');
  }
});

test('ball falls onto terrain and settles near the surface', () => {
  const terrain = gentleTerrain(7);
  const ball = new Ball({ x: 640, y: 100, rad: 50, gravity: BALL_GRAVITY, detail: 25, terrain, initVel: { x: 0, y: 0 } });
  assert.ok(ball.pos.y < 300, 'starts high');
  settle(ball, tallWorld, 20);
  assert.ok(Number.isFinite(ball.pos.x) && Number.isFinite(ball.pos.y), 'finite');
  assert.ok(inBounds(ball.pos, tallWorld), 'in bounds');
  const surface = terrain.heightAtX(ball.pos.x);
  const gap = surface - ball.pos.y;
  assert.ok(Math.abs(gap - ball.rad) < 25, `rests near surface, gap=${gap.toFixed(1)}`);
});

test('collision helper pushes an overlapping circle out and ignores clear segments', () => {
  const A = { x: 0, y: 0 };
  const B = { x: 100, y: 0 };
  const hit = collision({ x: 50, y: 5 }, 10, A, B);
  assert.equal(hit.collided, true);
  assert.ok(Math.abs(hit.y - 10) < 1e-6, `pushed to radius, y=${hit.y}`);
  const miss = collision({ x: 50, y: 40 }, 10, A, B);
  assert.equal(miss.collided, false);
});

test('linked car keeps its wheel spacing while driving over terrain', () => {
  const terrain = gentleTerrain(3);
  const car = new Car({ x: 120, y: 100, terrain, gravity: BALL_GRAVITY, rad: 25, detail: 25 });
  driveCar(car, tallWorld, 15, { left: false, right: true });
  const [a, b] = car.bodies;
  const dist = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
  assert.ok(Number.isFinite(dist), 'distance finite');
  assert.ok(Math.abs(dist - CAR_LINK_LENGTH) < 10, `linked at fixed distance, got ${dist.toFixed(1)}`);
  for (const body of car.bodies) {
    assert.ok(finite(body.pos) && inBounds(body.pos, tallWorld), 'wheel in bounds');
  }
});

test('car moves under drive input but stays put without it', () => {
  const terrain = gentleTerrain(11);
  const still = new Car({ x: 400, y: 100, terrain });
  driveCar(still, tallWorld, 3, {});
  const idleDrift = Math.hypot(still.bodies[0].pos.x - 400, still.bodies[0].pos.y - 100);
  const driving = new Car({ x: 400, y: 100, terrain });
  driveCar(driving, tallWorld, 3, { right: true });
  const driven = Math.hypot(driving.bodies[0].pos.x - 400, driving.bodies[0].pos.y - 100);
  assert.ok(driven > idleDrift, `drive input produces more travel (${driven.toFixed(1)} vs ${idleDrift.toFixed(1)})`);
});

test('terrain is deterministic per seed and clamps negative indices', () => {
  const a = gentleTerrain(42);
  const b = gentleTerrain(42);
  const c = gentleTerrain(43);
  assert.deepEqual(a.height, b.height);
  assert.notDeepEqual(a.height, c.height);
  assert.equal(a.at(-5), a.height[0]);
  assert.equal(a.at(1e9), a.height[a.height.length - 1]);
});

test('a ball centered exactly on terrain is pushed clear without NaN', () => {
  for (const [a, b] of [[{x:50,y:300},{x:150,y:300}],[{x:150,y:300},{x:50,y:300}],[{x:100,y:300},{x:100,y:300}]]) {
    const hit = collision({x:100,y:300}, 50, a, b);
    assert.equal(hit.collided, true);
    assert.equal(hit.x, 100);
    assert.equal(hit.y, 250);
  }
});

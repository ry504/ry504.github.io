// Behaviour tests for the drag controller against the real simulations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SoftBody, Ball, Car, Terrain, FIXED_DT, CAR_LINK_LENGTH } from '../js/engine.js';
import { createDrag, updateDrag, stepDrag, releaseDrag } from '../js/drag.js';

const world = { width: 1280, height: 720 };

function finite(p) {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}
function inBounds(p, pad = 6) {
  return p.x >= -pad && p.x <= world.width + pad && p.y >= -pad && p.y <= world.height + pad;
}
function gentleTerrain(seed) {
  return new Terrain(seed, { worldWidth: world.width, center: 400, amplitude: 60, detail: 25 });
}
function farTarget(i) {
  return i % 2 === 0 ? { x: -4000, y: -4000 } : { x: 8000, y: 8000 };
}

test('car drag: bounded, connected, launch-free, gentle release', () => {
  const terrain = gentleTerrain(7);
  const car = new Car({ x: 300, y: 180, terrain });
  const grabbed = car.bodies[0];
  const drag = createDrag('car', car, grabbed, { x: grabbed.pos.x, y: grabbed.pos.y }, world);
  let maxSpeed = 0;
  let maxSpacingErr = 0;

  for (let i = 0; i < 1200; i++) {
    updateDrag(drag, farTarget(i));
    car.update(FIXED_DT, world);
    stepDrag(drag, FIXED_DT);
    for (const b of car.bodies) {
      assert.ok(finite(b.pos), `car body finite: ${JSON.stringify(b.pos)}`);
      assert.ok(inBounds(b.pos), `car body in bounds: ${JSON.stringify(b.pos)}`);
      const speed = Math.hypot(b.pos.x - b.pPos.x, b.pos.y - b.pPos.y) / FIXED_DT;
      maxSpeed = Math.max(maxSpeed, speed);
    }
    const d = Math.hypot(
      car.bodies[0].pos.x - car.bodies[1].pos.x,
      car.bodies[0].pos.y - car.bodies[1].pos.y,
    );
    maxSpacingErr = Math.max(maxSpacingErr, Math.abs(d - CAR_LINK_LENGTH));
  }
  assert.ok(maxSpeed < 2000, `no launch, max speed ${maxSpeed} px/s`);
  assert.ok(maxSpacingErr < 10, `car spacing error ${maxSpacingErr} < 10`);

  // Stationary hold: pointer stops, then release must be gentle (no fling).
  const hold = car.bodies[0].pos;
  updateDrag(drag, { x: hold.x, y: hold.y });
  for (let i = 0; i < 120; i++) {
    car.update(FIXED_DT, world);
    stepDrag(drag, FIXED_DT);
  }
  const before = { ...car.bodies[0].pos };
  releaseDrag(drag);
  car.update(FIXED_DT, world);
  const kick = Math.hypot(car.bodies[0].pos.x - before.x, car.bodies[0].pos.y - before.y);
  assert.ok(kick < 12, `gentle release, one-step kick ${kick} px`);
  assert.equal(drag.active, false);
});

test('softbody drag: only grabbed point moves, stays finite and bounded', () => {
  const body = new SoftBody({ x: 640, y: 220 });
  const grabbed = body.points[0];
  const others = body.points.slice(1);
  const drag = createDrag('softbody', body, grabbed, { x: grabbed.x, y: grabbed.y }, world);

  for (let i = 0; i < 1200; i++) {
    updateDrag(drag, farTarget(i));
    body.update(FIXED_DT, world);
    // Snapshot non-grabbed points: stepDrag must not touch them at all.
    const before = others.map((p) => ({ x: p.x, y: p.y }));
    stepDrag(drag, FIXED_DT);
    for (const p of body.points) {
      assert.ok(finite(p), `soft point finite: ${JSON.stringify(p)}`);
      assert.ok(inBounds(p), `soft point in bounds: ${JSON.stringify(p)}`);
    }
    others.forEach((p, i) => {
      assert.ok(p.x === before[i].x && p.y === before[i].y,
        'stepDrag must only move the grabbed point');
    });
    const target = farTarget(i);
    assert.equal(grabbed.x, Math.min(world.width - grabbed.rad, Math.max(grabbed.rad, target.x)));
    assert.equal(grabbed.y, Math.min(world.height - grabbed.rad, Math.max(grabbed.rad, target.y)));
    // Grabbed point previous position is synced to remove artificial velocity.
    assert.ok(grabbed.px === grabbed.x && grabbed.py === grabbed.y,
      'grabbed point px/py synced to x/y');
  }

  const hold = { x: grabbed.x, y: grabbed.y };
  updateDrag(drag, hold);
  for (let i = 0; i < 120; i++) {
    body.update(FIXED_DT, world);
    stepDrag(drag, FIXED_DT);
  }
  releaseDrag(drag);
  body.update(FIXED_DT, world);
  for (const p of body.points) {
    assert.ok(finite(p), 'finite after release');
  }
  assert.equal(drag.active, false);
});

test('ball drag: single body stays finite, bounded, launch-free', () => {
  const terrain = gentleTerrain(11);
  const ball = new Ball({ x: 500, y: 150, rad: 20, terrain });
  const drag = createDrag('ball', ball, ball, { x: ball.pos.x, y: ball.pos.y }, world);
  let maxSpeed = 0;
  for (let i = 0; i < 1200; i++) {
    updateDrag(drag, farTarget(i));
    ball.update(FIXED_DT, world);
    stepDrag(drag, FIXED_DT);
    assert.ok(finite(ball.pos), 'ball finite');
    assert.ok(inBounds(ball.pos), `ball in bounds: ${JSON.stringify(ball.pos)}`);
    maxSpeed = Math.max(maxSpeed, Math.hypot(ball.pos.x - ball.pPos.x, ball.pos.y - ball.pPos.y) / FIXED_DT);
  }
  assert.ok(maxSpeed < 2000, `no launch, max speed ${maxSpeed}`);
  releaseDrag(drag);
});

test('duplicate pointer events do not change the physical outcome', () => {
  function run(updatesPerStep) {
    const terrain = gentleTerrain(3);
    const car = new Car({ x: 320, y: 170, terrain });
    const grabbed = car.bodies[0];
    const drag = createDrag('car', car, grabbed, { x: grabbed.pos.x, y: grabbed.pos.y }, world);
    for (let i = 0; i < 600; i++) {
      const t = farTarget(i);
      for (let k = 0; k < updatesPerStep; k++) updateDrag(drag, t);
      car.update(FIXED_DT, world);
      stepDrag(drag, FIXED_DT);
    }
    return car.bodies.map((b) => ({ x: b.pos.x, y: b.pos.y }));
  }
  const once = run(1);
  const duplicated = run(4);
  once.forEach((p, i) => {
    assert.ok(Math.hypot(p.x - duplicated[i].x, p.y - duplicated[i].y) < 1e-9,
      `duplicate updateDrag is idempotent at body ${i}`);
  });
});

test('stepDrag ignores non-finite / non-positive dt', () => {
  const body = new SoftBody({ x: 400, y: 200 });
  const grabbed = body.points[0];
  const drag = createDrag('softbody', body, grabbed, { x: grabbed.x, y: grabbed.y }, world);
  updateDrag(drag, { x: 900, y: 100 });
  const snapshot = { x: grabbed.x, y: grabbed.y };
  stepDrag(drag, NaN);
  stepDrag(drag, Infinity);
  stepDrag(drag, 0);
  stepDrag(drag, -1);
  assert.deepEqual({ x: grabbed.x, y: grabbed.y }, snapshot);
  updateDrag(drag, { x: NaN, y: Infinity });
  stepDrag(drag, FIXED_DT);
  assert.ok(Number.isFinite(grabbed.x) && Number.isFinite(grabbed.y), 'still finite');
});


test('holding a ball in midair does not accumulate gravity or drift', () => {
  const ball = new Ball({ x: 500, y: 100, rad: 20, terrain: gentleTerrain(11) });
  const handle = createDrag('ball', ball, ball, { x: 500, y: 100 }, world);
  for (let i = 0; i < 1200; i++) {
    ball.update(FIXED_DT, world);
    stepDrag(handle, FIXED_DT);
    assert.ok(Math.hypot(ball.pos.x - 500, ball.pos.y - 100) < 0.01);
  }
  releaseDrag(handle);
  ball.update(FIXED_DT, world);
  assert.ok(Math.abs(ball.pos.y - 100) < 1, 'release starts falling gently');
});

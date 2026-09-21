// Extra sample-course tests: every exported LEVELS entry must be solvable by
// the real agent physics, must exercise jumps, must span at least four rows of
// height, and must have unique id/name metadata.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, unreachableLevel } from '../js/levels.js';
import { buildNetwork, simulate } from './helpers.mjs';
import { aStar } from '../js/pathfinder.js';

test('LEVELS metadata is unique and well-formed', () => {
  assert.ok(Array.isArray(LEVELS) && LEVELS.length > 0);
  const ids = LEVELS.map((l) => l.id);
  const names = LEVELS.map((l) => l.name);
  assert.equal(new Set(ids).size, ids.length, 'ids must be unique');
  assert.equal(new Set(names).size, names.length, 'names must be unique');
  for (const level of LEVELS) {
    assert.equal(typeof level.id, 'string');
    assert.ok(level.id.length > 0);
    assert.equal(typeof level.name, 'string');
    assert.ok(level.name.length > 0);
    assert.equal(typeof level.create, 'function');
  }
});

for (const level of LEVELS) {
  test(`${level.id}: start and goal stand on ground`, () => {
    const data = level.create();
    const { ground } = buildNetwork(data.cells);
    assert.ok(ground.has(data.start[0], data.start[1] + 1), 'start must stand on ground');
    assert.ok(ground.has(data.goal[0], data.goal[1] + 1), 'goal must stand on ground');
  });

  test(`${level.id}: route exists and uses a jump`, () => {
    const data = level.create();
    const { network } = buildNetwork(data.cells);
    const route = aStar(network.graph, data.start, data.goal);
    assert.ok(route.length > 2, 'expected a multi-node route');
    assert.deepEqual(route[0], data.start);
    assert.deepEqual(route[route.length - 1], data.goal);
    let usedJump = false;
    for (let i = 0; i + 1 < route.length; i++) {
      const edge = network.graph
        .get(`${route[i][0]},${route[i][1]}`)
        ?.get(`${route[i + 1][0]},${route[i + 1][1]}`);
      assert.ok(edge, `route edge missing: ${route[i]} -> ${route[i + 1]}`);
      if (edge[1] === 'jmp') usedJump = true;
    }
    assert.ok(usedJump, 'route must use a jump');
  });

  test(`${level.id}: route spans at least 4 rows of height`, () => {
    const data = level.create();
    const { network } = buildNetwork(data.cells);
    const route = aStar(network.graph, data.start, data.goal);
    const ys = route.map((p) => p[1]);
    assert.ok(Math.max(...ys) - Math.min(...ys) >= 4, `y-range too small: ${ys.join(',')}`);
  });

  test(`${level.id}: agent reaches goal via real physics, grounded`, () => {
    const result = simulate(level.create(), 3600);
    assert.equal(result.success, true, `agent failed: ${JSON.stringify(result)}`);
    assert.deepEqual(result.final, level.create().goal);
    assert.equal(result.onGrnd, true);
  });
}

test('unreachable level still yields no route', () => {
  const level = unreachableLevel();
  const { network } = buildNetwork(level.cells);
  assert.equal(aStar(network.graph, level.start, level.goal).length, 0);
});

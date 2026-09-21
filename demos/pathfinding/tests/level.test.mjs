// End-to-end: drive the default sample level through the *actual* agent physics
// and A* loop (same order as main.py) until the grounded agent reaches the goal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLevel, unreachableLevel } from '../js/levels.js';
import { buildNetwork, simulate } from './helpers.mjs';
import { aStar } from '../js/pathfinder.js';

test('default level has a route graph from start to goal', () => {
  const level = defaultLevel();
  const { ground, network } = buildNetwork(level.cells);
  assert.ok(ground.has(level.start[0], level.start[1] + 1), 'start must stand on ground');
  assert.ok(ground.has(level.goal[0], level.goal[1] + 1), 'goal must stand on ground');
  const route = aStar(network.graph, level.start, level.goal);
  assert.ok(route.length > 2, 'expected a multi-node route');
  assert.deepEqual(route[0], level.start);
  assert.deepEqual(route[route.length - 1], level.goal);
});

test('default level completes via real physics within 3600 steps, grounded at goal', () => {
  const result = simulate(defaultLevel(), 3600);
  assert.equal(result.success, true, `agent failed: ${JSON.stringify(result)}`);
  assert.deepEqual(result.final, defaultLevel().goal);
  assert.equal(result.onGrnd, true);
  assert.ok(result.steps <= 3600);
});

test('default level includes jumps and drops (routes use jmp and height changes)', () => {
  const level = defaultLevel();
  const { network } = buildNetwork(level.cells);
  const route = aStar(network.graph, level.start, level.goal);
  let usedJump = false;
  let maxDrop = 0;
  for (let i = 0; i + 1 < route.length; i++) {
    const edge = network.graph.get(`${route[i][0]},${route[i][1]}`)?.get(`${route[i + 1][0]},${route[i + 1][1]}`);
    assert.ok(edge, `route edge missing: ${route[i]} -> ${route[i + 1]}`);
    if (edge[1] === 'jmp') usedJump = true;
    const drop = route[i + 1][1] - route[i][1];
    if (drop > maxDrop) maxDrop = drop;
  }
  assert.ok(usedJump, 'expected the route to use a jump link');
  assert.ok(maxDrop >= 1, 'expected the route to descend at least one row (drop)');
});

test('unreachable level: A* returns no route and physics never reaches the goal', () => {
  const level = unreachableLevel();
  const { network } = buildNetwork(level.cells);
  assert.deepEqual(aStar(network.graph, level.start, level.goal), []);
  const result = simulate(level, 900);
  assert.equal(result.success, false);
  assert.notDeepEqual(result.final, level.goal);
});

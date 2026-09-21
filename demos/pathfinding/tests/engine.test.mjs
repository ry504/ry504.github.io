// Engine unit tests: rounding, grid snapping, graph rebuild on edit/delete,
// reset behaviour and no-route handling.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Ground } from '../js/ground.js';
import { Network } from '../js/algorithm.js';
import { Agent } from '../js/agent.js';
import { aStar } from '../js/pathfinder.js';
import { pyRound, snapToGrid } from '../js/math.js';
import { buildNetwork } from './helpers.mjs';

test('pyRound matches CPython ties-to-even', () => {
  assert.equal(pyRound(0.5), 0);
  assert.equal(pyRound(1.5), 2);
  assert.equal(pyRound(2.5), 2);
  assert.equal(pyRound(-0.5), 0);
  assert.equal(pyRound(-1.5), -2);
  assert.equal(pyRound(2.4), 2);
  assert.equal(pyRound(2.6), 3);
});

test('snapToGrid centres cells like the source', () => {
  assert.deepEqual(snapToGrid(10, 10, 50), [0, 0]);
  assert.deepEqual(snapToGrid(25, 25, 50), [0, 0]); // exact tie -> even
  assert.deepEqual(snapToGrid(75, 75, 50), [50, 50]);
});

test('A* finds a walk route on flat ground, then none after deleting the bridge', () => {
  const cells = [];
  for (let x = 0; x <= 9; x++) cells.push([x, 13]);
  const { ground, network } = buildNetwork(cells);
  assert.ok(aStar(network.graph, [1, 12], [8, 12]).length > 0);
  assert.ok(network.nodeAt(4, 12));

  // Edit: delete a 4-cell run -> gap is wider than any jump, rebuild like main.py does on mouse press.
  for (const x of [3, 4, 5, 6]) ground.remove(x, 13);
  network.graph.clear();
  network.fPlaceGroundNodes(ground);
  network.fLinkAdjacentNodes();
  network.fLinkVerticalNodes(ground);
  network.fLinkJumpNodes(ground);

  assert.equal(network.nodeAt(4, 12), false);
  assert.equal(network.nodeAt(3, 12), false);
  assert.deepEqual(aStar(network.graph, [1, 12], [8, 12]), []);
});

test('rebuild after delete equals a fresh build of the edited cells', () => {
  const cells = [];
  for (let x = 0; x <= 9; x++) cells.push([x, 13]);
  const { ground, network } = buildNetwork(cells);
  for (const x of [3, 4, 5, 6]) ground.remove(x, 13);
  network.graph.clear();
  network.fPlaceGroundNodes(ground);
  network.fLinkAdjacentNodes();
  network.fLinkVerticalNodes(ground);
  network.fLinkJumpNodes(ground);

  const { network: fresh } = buildNetwork(ground.cells);
  const dump = (net) => [...net.graph.keys()].sort().map((k) => {
    const nbrs = [...net.graph.get(k).entries()].map(([t, e]) => `${t}:${e[0]}:${e[1]}`).sort();
    return `${k}->${nbrs.join('|')}`;
  }).join(';');
  assert.equal(dump(network), dump(fresh));
});

test('A* returns no route for an unknown or unreachable goal', () => {
  const { network } = buildNetwork([[0, 13], [1, 13], [2, 13], [20, 13], [21, 13]]);
  assert.deepEqual(aStar(network.graph, [1, 12], [21, 12]), []);
  assert.deepEqual(aStar(network.graph, [99, 99], [1, 12]), []);
});

test('agent reset returns to default position and deactivates', () => {
  const { ground } = buildNetwork([[0, 13], [1, 13], [2, 13], [3, 13]]);
  const agent = new Agent([1, 12], 0.6);
  agent.active = true;
  agent.AI([], ground.cells ? new Map() : new Map());
  agent.physics(ground.cells, 720);
  agent.x += 123;
  agent.reset();
  assert.equal(agent.x, agent.default_pos[0]);
  assert.equal(agent.y, agent.default_pos[1]);
  assert.equal(agent.grid_x, 1);
  assert.equal(agent.grid_y, 12);
  assert.equal(agent.xv, 0);
  assert.equal(agent.yv, 0);
  assert.equal(agent.active, false);
  // Known source quirk: reset() does not clear on_grnd. Documented in README.
  assert.equal(typeof agent.on_grnd, 'boolean');
});

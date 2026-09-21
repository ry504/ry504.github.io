// Python <-> JS parity: graph nodes, edges and A* routes.
// python_expected.json is produced by tests/gen_python_fixtures.py from the
// original _algorithm.py / pathfinder.py (see README).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildNetwork } from './helpers.mjs';
import { aStar } from '../js/pathfinder.js';
import { key } from '../js/nodekey.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(join(HERE, 'fixtures/cases.json'), 'utf8')).cases;
const expected = JSON.parse(readFileSync(join(HERE, 'fixtures/python_expected.json'), 'utf8')).cases;
const byName = new Map(expected.map((c) => [c.name, c]));

const TOL = 1e-9;

test('python fixtures cover every case', () => {
  for (const c of cases) assert.ok(byName.has(c.name), `missing python fixture for ${c.name}`);
});

for (const c of cases) {
  const exp = byName.get(c.name);

  test(`graph parity: ${c.name}`, () => {
    const { network } = buildNetwork(c.cells);

    const nodes = [...network.graph.keys()].map((k) => k.split(',').map(Number));
    const expNodes = exp.nodes.map((n) => [n[0], n[1]]);
    const norm = (arr) => arr.map((n) => n.join(',')).sort();
    assert.deepEqual(norm(nodes), norm(expNodes), 'node sets differ');

    const jsEdges = new Map();
    for (const [from, nbrs] of network.graph) {
      for (const [to, [w, type]] of nbrs) jsEdges.set(`${from}->${to}`, { w, type });
    }
    const expEdges = new Map(exp.edges.map((e) => [`${e.from.join(',')}->${e.to.join(',')}`, e]));
    assert.equal(jsEdges.size, expEdges.size, 'edge counts differ');
    for (const [k, e] of expEdges) {
      const j = jsEdges.get(k);
      assert.ok(j, `missing edge ${k}`);
      assert.equal(j.type, e.type, `edge type differs for ${k}`);
      assert.ok(Math.abs(j.w - e.w) <= TOL, `edge weight differs for ${k}: js=${j.w} py=${e.w}`);
    }
    for (const k of jsEdges.keys()) assert.ok(expEdges.has(k), `extra edge ${k}`);
  });

  test(`route parity: ${c.name}`, () => {
    const { network } = buildNetwork(c.cells);
    const route = aStar(network.graph, c.start, c.goal);
    assert.deepEqual(route, exp.route.map((n) => [n[0], n[1]]));
  });
}

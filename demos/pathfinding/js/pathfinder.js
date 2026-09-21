// Ported from pathfinder.py
import { parseKey } from './nodekey.js';

// Python heapq compares (f_score, node) tuples: ties fall back to node tuple
// lexicographic order (x, then y). This heap preserves that ordering so paths
// match CPython on equal-cost frontiers.
class MinHeap {
  constructor() { this.a = []; }
  get length() { return this.a.length; }
  less(i, j) {
    const [fi, ni] = this.a[i];
    const [fj, nj] = this.a[j];
    if (fi !== fj) return fi < fj;
    const [xi, yi] = parseKey(ni);
    const [xj, yj] = parseKey(nj);
    if (xi !== xj) return xi < xj;
    return yi < yj;
  }
  push(item) {
    this.a.push(item);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(i, p)) { [this.a[i], this.a[p]] = [this.a[p], this.a[i]]; i = p; }
      else break;
    }
  }
  pop() {
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length) {
      this.a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.a.length && this.less(l, m)) m = l;
        if (r < this.a.length && this.less(r, m)) m = r;
        if (m === i) break;
        [this.a[i], this.a[m]] = [this.a[m], this.a[i]];
        i = m;
      }
    }
    return top;
  }
}

// heuristic(a, b): Manhattan distance
export function heuristic(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

// a_star(network, start, goal). `network` is a Map of nodeKey -> Map(nodeKey -> [weight, linkType]).
// Returns an array of [x, y] node tuples, [] when unreachable.
export function aStar(network, start, goal) {
  const startK = `${start[0]},${start[1]}`;
  const goalK = `${goal[0]},${goal[1]}`;

  const openSet = new MinHeap();
  openSet.push([0, startK]);

  const cameFrom = new Map();
  const gScore = new Map();
  for (const node of network.keys()) gScore.set(node, Infinity);
  gScore.set(startK, 0);

  const fScore = new Map();
  for (const node of network.keys()) fScore.set(node, Infinity);
  fScore.set(startK, heuristic(start, goal));

  while (openSet.length) {
    const [, current] = openSet.pop();

    if (current === goalK) {
      const path = [];
      let cur = current;
      while (cameFrom.has(cur)) {
        path.push(parseKey(cur));
        cur = cameFrom.get(cur);
      }
      path.push(start);
      return path.reverse();
    }

    const neighbors = network.get(current) || new Map();
    for (const [neighbor, edge] of neighbors) {
      const gCur = gScore.has(current) ? gScore.get(current) : Infinity;
      const tentative = gCur + edge[0];
      const gNbr = gScore.has(neighbor) ? gScore.get(neighbor) : Infinity;
      if (tentative < gNbr) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentative);
        fScore.set(neighbor, tentative + heuristic(parseKey(neighbor), goal));
        openSet.push([fScore.get(neighbor), neighbor]);
      }
    }
  }
  return [];
}

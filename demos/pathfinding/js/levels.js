// Ready-made sample courses for the pathfinding demo.
//
// Coordinate system matches the Python source: 50px cells in a 1280x720 world.
// A "ground" cell (x, y) occupies the square [x*50,(x+1)*50) x [y*50,(y+1)*50).
// A walkable node sits directly above a ground cell at (x, y-1); the agent's
// start/goal are node cells, so a grounded agent standing on a platform has an
// integer grid position equal to that node.
//
// defaultLevel(): verified end-to-end through the actual Agent physics + A* loop
//   (see tests/level.test.mjs). Island hop course: a flat walk, a jump up,
//   a drop, two more hops with a jump, and a final drop to the goal.
//
// terracesLevel(): serpentine course that climbs then steps back down to the
//   goal; grounded-success verified through the same physics loop.
//
// ascentLevel(): ascending route with extra upper platforms matching Ryan's reference.
//
// unreachableLevel(): same start island but the goal sits on an isolated pillar
//   separated by a gap wider than any jump, so A* returns no route.

const fillRun = (y, x0, x1) => {
  const out = [];
  for (let x = x0; x <= x1; x++) out.push([x, y]);
  return out;
};

const fromTiers = (tiers, start, goal) => ({
  cells: tiers.flatMap(([y, x0, x1]) => fillRun(y, x0, x1)),
  start,
  goal,
});

export function defaultLevel() {
  return fromTiers(
    [
      [13, 0, 3],
      [11, 5, 8],
      [12, 10, 13],
      [10, 15, 18],
      [8, 20, 23],
      [10, 24, 25],
    ],
    [1, 12],
    [25, 9],
  );
}

export function terracesLevel() {
  return fromTiers(
    [
      [13, 0, 4],
      [11, 7, 11],
      [9, 14, 18],
      [10, 20, 24],
      [8, 22, 25],
    ],
    [1, 12],
    [24, 7],
  );
}

export function ascentLevel() {
  return fromTiers(
    [
      [13, 0, 4],
      [11, 7, 11],
      [9, 14, 18],
      [7, 18, 21],
      [5, 22, 25],
      [4, 5, 8],
      [5, 9, 13],
      [5, 16, 17],
      [8, 7, 10],
    ],
    [1, 12],
    [24, 4],
  );
}

export function unreachableLevel() {
  const cells = [
    ...fillRun(13, 0, 5),   // start platform
    ...fillRun(13, 20, 25), // far island; 14-cell gap is far beyond jump range
  ];
  return { cells, start: [1, 12], goal: [22, 12] };
}

export const LEVELS = [
  { id: 'island-hop', name: 'Island hop', create: defaultLevel },
  { id: 'terraces', name: 'Terraces', create: terracesLevel },
  { id: 'ascent', name: 'High ascent', create: ascentLevel },
];

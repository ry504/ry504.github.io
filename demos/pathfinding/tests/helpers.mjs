// Shared test helpers: build the source Network from a cell list and run the
// same per-frame loop as main.py (AI -> physics -> recompute A*).
import { Ground } from '../js/ground.js';
import { Network } from '../js/algorithm.js';
import { Agent } from '../js/agent.js';
import { aStar } from '../js/pathfinder.js';
import { WORLD_H } from '../js/constants.js';

export function buildNetwork(cells) {
  const ground = new Ground();
  ground.setCells(cells);
  const network = new Network();
  network.build(ground);
  return { ground, network };
}

// Returns { success, steps, final, onGrnd, lastPath, initialPath }.
// Success requires the *physical* agent to be grounded on the goal node, i.e.
// not merely that a graph route exists.
export function simulate(level, maxSteps = 3600) {
  const { ground, network } = buildNetwork(level.cells);
  const agent = new Agent(level.start, 0.6);
  agent.active = true;
  const goal = level.goal;

  let path = aStar(network.graph, [agent.curr_x, agent.curr_y], goal);
  const initialPath = path.map((p) => [p[0], p[1]]);

  let steps = 0;
  for (; steps < maxSteps; steps++) {
    if (agent.on_grnd && agent.grid_x === goal[0] && agent.grid_y === goal[1]) {
      return { success: true, steps, final: [agent.grid_x, agent.grid_y], onGrnd: agent.on_grnd, lastPath: path, initialPath };
    }
    agent.AI(path, network.graph);
    agent.physics(ground.cells, WORLD_H);
    path = aStar(network.graph, [agent.curr_x, agent.curr_y], goal);
  }
  return {
    success: false, steps, final: [agent.grid_x, agent.grid_y], onGrnd: agent.on_grnd,
    pos: [agent.x, agent.y], lastPath: path, initialPath,
  };
}

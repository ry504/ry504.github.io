# Pathfinding platformer — engine port

A faithful JavaScript port of the read-only Python/py5 sketch
`*platformer_pathfinding_latest` (its `main.py` imports `_algorithm.py`, **not**
`_algorithm_plus.py`). The engine builds a jump/drop/walk navigation graph from
the ground tiles, runs the original Manhattan-heuristic A*, and drives a
platformer agent through it with the original collision physics.

The original Python/py5 project was designed and hand-coded entirely by Ryan Fong (author-confirmed). This JavaScript/Canvas edition is an AI-assisted browser adaptation. The original source remains unchanged.

## Play

Serve the portfolio root and open `/demos/pathfinding/`. Run/Pause controls the agent; Reset agent returns it to the start; Reset level reloads High ascent; Clear level removes platforms. There is no course selector. Use the graph checkbox to reveal connections.

Controls mirror the original sketch: left-drag the agent or goal directly, left-drag elsewhere to paint platforms, right-drag to erase. Right-clicking the agent or Space runs/resets it; H toggles the graph and X clears. Shortcuts are confined to the canvas. The browser context menu is suppressed only on the canvas. Paint/Erase buttons remain for touch. Keyboard arrows move the cursor; Enter picks up/drops a marker or paints; Delete erases; Escape releases a marker. Editing resets the simulation. Moving the agent is disabled while running; pause or reset first.

The browser uses a fixed-step accumulator at 60 Hz, pauses on hidden tabs, and stops on reaching the grounded goal, falling, or a 3600-step limit. Nothing runs until Run is pressed. It uses no external libraries or network services.

Browser checks: full sample run reached goal; empty level disabled Run; keyboard-created unreachable goal showed No route; pointer editing rebuilt nodes; graph toggle worked; 390px viewport had no horizontal overflow.

## Files

- `js/constants.js` — verbatim `constants.py` values (+ documented browser-only
  `WORLD_W`/`WORLD_H`/`FRAME_RATE`).
- `js/math.js` — `pyRound` (CPython ties-to-even), `sign`, `snapToGrid`, `dist`.
- `js/nodekey.js` — tuple/Map key helpers.
- `js/ground.js` — `Ground` (ordered cells, insertion order preserved).
- `js/algorithm.js` — `Network`: `fPlaceGroundNodes`, `fLinkAdjacentNodes`,
  `fLinkVerticalNodes`, `fLinkJumpNodes`, `build(ground)`.
- `js/pathfinder.js` — `aStar(network, start, goal)`, `heuristic`.
- `js/agent.js` — `Agent`: physics, collisions, ground check, `AI(path, graph)`.
- `js/levels.js` — `defaultLevel()` and `unreachableLevel()` sample courses.
- `tests/` — native `node:test` suites + Python parity fixtures.

## Source mapping

| Python | JS |
| --- | --- |
| `constants.py` | `js/constants.js` |
| `ground_script.py` | `js/ground.js` |
| `_algorithm.py` (Network) | `js/algorithm.js` |
| `pathfinder.py` (a_star) | `js/pathfinder.js` |
| `agent_script.py` (Agent) | `js/agent.js` |
| `main.py` per-frame loop | mimicked by `tests/helpers.mjs` `simulate()` |

The per-frame order matches `main.py`: `agent.AI(path, graph)` → `agent.physics`
→ recompute `path = a_star(graph, (curr_x, curr_y), goal)`. Graph rebuild after
an edit mirrors the mouse-press rebuild block in `main.py`.

## Courses

The UI offers only **High ascent**, with the ascending route and four extra platform runs matching Ryan’s reference screenshot. Reset level restores this editable default. Other layouts remain engine test fixtures and are not selectable in the demo.

`LEVELS` exports selector metadata and constructors. `defaultLevel()` supplies Island hop for the engine tests; `unreachableLevel()` retains the disconnected-island fixture. The 50px grid and 1280×720 world match the original sketch.

## Running the tests

```sh
cd demos/pathfinding
node --test tests/*.test.mjs
```

Regenerate the Python parity fixtures from the read-only source (requires the
source directory; nothing is written to it):

```sh
cd demos/pathfinding
PYTHONDONTWRITEBYTECODE=1 python3 tests/gen_python_fixtures.py "<path-to>/Processing_port/*platformer_pathfinding_latest"
node --test tests/*.test.mjs
```

`gen_python_fixtures.py` imports only `constants.py`, `_algorithm.py` and
`pathfinder.py` (no py5 needed) and writes `tests/fixtures/python_expected.json`.

## Verified results

- Full engine, parity and course suite: 37/37 passing. After moving the Island hop goal inward to keep its marker fully visible, the 18 affected level tests passed again.
- All three courses complete with the real physics/A* loop, **grounded** at the goal within 3600 steps.
- Python/JS graph edges match within `1e-9` and A* routes match exactly for the
  six fixtures: flat walk, gap jump, step up, drop, blocked/no-route, empty
  board.

## Differences and limitations

- **Fixed frame rate.** The source used `py5.get_frame_rate()`; the port fixes
  `FRAME_RATE = 60` so headless simulation is deterministic. The delta-time
  formula is otherwise unchanged.
- **`round()` semantics.** JS `Math.round` differs from CPython at exact `.5`
  ties; `pyRound` reproduces ties-to-even. `-0` is normalised to `0` so values
  match CPython (`round(-0.5) == 0`).
- **`reset()` does not clear `on_grnd`** — the source has the same quirk
  (`agent_script.py` `reset()` omits it). It is harmless in practice because the
  next `physics()` call recomputes `on_grnd`.
- **No optimality claim.** The graph edge weights are the source's rough
  distance approximations and the heuristic is Manhattan, which need not be
  admissible for Euclidean edges. Tests compare routes for equality against
  Python, not global optimality.
- **Physics tuning.** AI behaviour is ad hoc like the source (it does not
  simulate the trajectory; it steers toward the next node and jumps when a node
  is above). The sample course is tuned and verified against that behaviour.
- Routes can jump small holes: deleting a single ground cell does **not**
  necessarily disconnect the graph, because jump/vertical links still bridge it.

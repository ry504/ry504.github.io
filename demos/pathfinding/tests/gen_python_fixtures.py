#!/usr/bin/env python3
"""Generate Python reference fixtures for the JS parity test.

Usage:
    PYTHONDONTWRITEBYTECODE=1 python3 tests/gen_python_fixtures.py <source_dir>

<source_dir> must contain the read-only original modules: constants.py,
_algorithm.py and pathfinder.py. Nothing is written to the source tree; this
script only reads it and writes tests/fixtures/python_expected.json.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    if len(sys.argv) != 2:
        print("usage: gen_python_fixtures.py <source_dir>", file=sys.stderr)
        return 2
    src = os.path.abspath(sys.argv[1])
    if not os.path.isfile(os.path.join(src, "_algorithm.py")):
        print("source dir missing _algorithm.py: %s" % src, file=sys.stderr)
        return 2

    sys.path.insert(0, src)
    import _algorithm  # noqa: E402
    import pathfinder  # noqa: E402

    with open(os.path.join(HERE, "fixtures", "cases.json")) as fh:
        cases = json.load(fh)["cases"]

    out = {"cases": []}
    for case in cases:
        cells = [tuple(c) for c in case["cells"]]
        net = _algorithm.Network()
        net.f_place_ground_nodes(cells)
        net.f_link_adjacent_nodes()
        net.f_link_vertical_nodes(cells)
        net.f_link_jump_nodes(cells)

        edges = []
        for (x, y), nbrs in net.graph.items():
            for (nx, ny), (w, t) in nbrs.items():
                edges.append({"from": [x, y], "to": [nx, ny], "w": w, "type": t})
        edges.sort(key=lambda e: (e["from"], e["to"]))

        route = pathfinder.a_star(net.graph, tuple(case["start"]), tuple(case["goal"]))
        out["cases"].append({
            "name": case["name"],
            "nodes": sorted([list(n) for n in net.graph.keys()]),
            "edges": edges,
            "route": [list(n) for n in route],
        })

    dest = os.path.join(HERE, "fixtures", "python_expected.json")
    with open(dest, "w") as fh:
        json.dump(out, fh, indent=1, sort_keys=True)
        fh.write("\n")
    print("wrote %s (%d cases)" % (dest, len(out["cases"])))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

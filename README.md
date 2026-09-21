# Ryan Fong — Portfolio

Personal portfolio featuring SchooledUp, interactive platformer pathfinding, physics simulations, and film projects.

## Local preview

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173. No build step or dependencies are required.

## Hosting

GitHub Pages serves the root of the `main` branch at https://ry504.github.io/.
Push changes to `main` to update the site. `.nojekyll` keeps the site as plain static files.

## Site

- `index.html`, CSS, and JavaScript: responsive portfolio with a WebGL dithered hero and interactive project illustrations.
- `assets/projects/schooledup-demo.mp4`: silent 25-second excerpt of the real application, cropped for readability with processing waits omitted.
- `demos/pathfinding/`: editable platformer navigation playground.
- `demos/physics/`: soft-body, ball, and linked-wheel experiments.

The original Python/Processing experiments were designed and hand-coded by Ryan Fong. The browser adaptations are AI-assisted; each demo documents its source mapping and changes.

## Checks

```sh
node --test demos/pathfinding/tests/*.test.mjs demos/physics/tests/*.test.mjs
```

Earlier art studies and backup previews are kept locally and excluded from publication.

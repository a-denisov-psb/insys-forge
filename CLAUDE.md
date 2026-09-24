# CLAUDE.md

## Git workflow

- `develop` is the working branch. Never commit directly to `develop` or `main`.
- Every change goes into its own feature branch created from `develop`, finished with a PR **into `develop`**.
- `main` only receives releases (merge `develop` → `main`) when explicitly requested by the maintainer.

## Project

- Plain HTML/CSS/JS, no framework, no build step, no backend. See `PROJECT_SPEC.md` and `README.md`.
- Config data must never leave the browser (no network requests).
- All source code, comments, docs and UI texts in English.
- Tests: `npm test` (parser, `node:test`).

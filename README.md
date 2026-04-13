# Rowly

Rowly is an open source desktop SQL client focused on learning, simplicity, and developer experience. The current base is built with Electron, React, TypeScript, Tailwind CSS, and `shadcn/ui`, and is being evolved toward a PostgreSQL-first MVP.

## Current Status

Stage 1 is focused on hardening the project foundation:

- Electron main, preload, renderer, and shared contracts are now separated by responsibility.
- The renderer consumes a typed `window.rowly` bridge instead of raw `ipcRenderer`.
- TypeScript, ESLint, and build scripts are structured to support future database features safely.
- Global theming is already wired with light, dark, and system modes.

## MVP Direction

The initial MVP will target:

- PostgreSQL as the only database driver
- Saved connection profiles without persisted passwords
- Schema browsing
- Table record previews
- SQL execution with a warning before potentially mutating statements

## Tech Stack

- Desktop shell: Electron
- Core language: TypeScript
- Renderer: React
- UI: Tailwind CSS v4 + `shadcn/ui`
- Build tooling: Vite + `vite-plugin-electron`
- Packaging: `electron-builder`

## Project Structure

```text
electron/
  main/        # Electron main-process bootstrap, IPC handlers, local runtime services
  preload/     # Typed bridge exposed to the renderer
  shared/      # Contracts, result/error helpers, and shared logging primitives

src/
  app/         # Renderer bootstrap, providers, and app shell
  components/  # Shared UI components
  features/    # Feature-oriented renderer modules
  hooks/       # Renderer hooks
  lib/         # Renderer-only utilities and integration helpers
```

## Local Setup

### Requirements

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts Vite in development mode and launches the Electron app through `vite-plugin-electron`.

## Available Scripts

- `npm run dev`: start the desktop app in development mode
- `npm run lint`: run ESLint across renderer, main, preload, and shared code
- `npm run typecheck`: run TypeScript checks for renderer, Electron, and tooling configs
- `npm run build:renderer`: build the renderer bundle into `dist/`
- `npm run build:electron`: compile Electron main/preload code into `dist-electron/`
- `npm run build`: run typecheck + renderer build + Electron build
- `npm run package`: build the app and generate distributable artifacts with `electron-builder`

## Packaging Notes

`electron-builder` is configured for Windows, macOS, and Linux artifact generation. Code signing, notarization, and auto-update are not part of the current stage.

## Scope of This Stage

This stage does not yet include:

- database drivers
- connection storage flows
- query execution
- schema exploration
- data editing

Those arrive in the next implementation stages, on top of the typed bridge and hardened foundation introduced here.
